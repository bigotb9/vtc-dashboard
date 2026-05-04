import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const maxDuration = 60

/**
 * Sync des commandes Yango vers Supabase.
 *
 * Stratégie :
 *   1. Filtre sur `created_at` (et NON ended_at) pour capter les courses
 *      en cours, annulées et celles sans ended_at.
 *   2. Sync incrémental : fenêtre = (latest_created_at - 1h) → maintenant.
 *      Le -1h sert à rattraper les corrections rétroactives Yango.
 *   3. Mode complet (forceFrom) : remonte de 2026-01-01 jusqu'à la plus
 *      ancienne course stockée. Utile pour réparer un trou historique.
 *   4. Pagination jusqu'à épuisement (cap safety 100 000).
 *   5. Retry exponentiel sur erreur transitoire (5xx, non-JSON, network).
 *   6. Réponse détaillée : pages, retries, batches insérés, erreurs.
 */

const PAGE_SIZE      = 100
const SAFETY_CAP     = 100_000
const HISTORY_START  = "2026-01-01T00:00:00Z"
const OVERLAP_HOURS  = 1
const MAX_RETRIES    = 3
const BATCH_INSERT   = 500

type YangoOrder = {
  id:          string
  short_id?:   number
  status?:     string
  created_at?: string
  ended_at?:   string
  [k: string]: unknown
}

async function fetchYangoPage(
  url: string, headers: Record<string, string>, body: unknown,
  attempt = 1,
): Promise<{ orders: YangoOrder[]; cursor: string | null }> {
  try {
    const res  = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) })
    const text = await res.text()
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      throw new Error(`Yango réponse non-JSON (status=${res.status}): ${text.slice(0, 120)}`)
    }
    if (!res.ok) {
      throw new Error(`Yango HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const data    = JSON.parse(text)
    const orders  = Array.isArray(data.orders) ? data.orders as YangoOrder[] : []
    const cursor  = (data.next_cursor as string) || (data.cursor as string) || null
    return { orders, cursor }
  } catch (e) {
    if (attempt >= MAX_RETRIES) throw e
    // Backoff exponentiel : 1s, 2s, 4s
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    return fetchYangoPage(url, headers, body, attempt + 1)
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const ordersUrl = process.env.YANGO_ORDERS_URL
    const apiKey    = process.env.YANGO_ORDERS_API_KEY
    const clid      = process.env.CLID
    const parkId    = process.env.ID_DU_PARTENAIRE

    if (!ordersUrl || !apiKey || !clid || !parkId) {
      const missing = [!ordersUrl && "YANGO_ORDERS_URL", !apiKey && "YANGO_ORDERS_API_KEY", !clid && "CLID", !parkId && "ID_DU_PARTENAIRE"].filter(Boolean)
      return NextResponse.json({ error: `Variables d'environnement manquantes: ${missing.join(", ")}` }, { status: 500 })
    }

    let forceFrom: string | null = null
    try {
      const body = await req.json()
      if (body?.from_date) forceFrom = body.from_date
    } catch { /* body vide */ }

    // Détermination de la fenêtre de sync (sur `created_at`)
    let fromDate: string
    let toDate:   string
    let mode:     "full" | "incremental"

    if (forceFrom) {
      // Sync complet : descend dans l'historique
      const { data: oldest } = await supabase
        .from("commandes_yango")
        .select("created_at")
        .not("created_at", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()
      mode     = "full"
      fromDate = HISTORY_START
      toDate   = oldest?.created_at && oldest.created_at > HISTORY_START
        ? oldest.created_at
        : new Date().toISOString()
    } else {
      // Incremental : depuis la dernière course créée stockée, MOINS 1h pour rattraper
      // les corrections rétroactives (statut/prix updaté côté Yango après coup).
      const { data: latest } = await supabase
        .from("commandes_yango")
        .select("created_at")
        .not("created_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      mode = "incremental"
      const latestDate = latest?.created_at ? new Date(latest.created_at) : new Date(HISTORY_START)
      latestDate.setHours(latestDate.getHours() - OVERLAP_HOURS)
      fromDate = latestDate.toISOString()
      toDate   = new Date().toISOString()
    }

    if (fromDate >= toDate) {
      return NextResponse.json({ ok: true, synced: 0, mode, from: fromDate, to: toDate, message: "rien à syncer" })
    }

    // Pagination jusqu'à épuisement
    const allOrders: YangoOrder[] = []
    let cursor: string | null = null
    let pages       = 0
    let totalRetries = 0
    let lastCursor: string | null = "<initial>"

    const headers = {
      "Content-Type": "application/json",
      "X-API-Key":    apiKey,
      "X-Client-ID":  clid,
    }

    do {
      const body: Record<string, unknown> = {
        limit: PAGE_SIZE,
        query: {
          park: {
            id: parkId,
            order: {
              // FILTRE SUR created_at (et non ended_at) : capte aussi
              // les courses en cours / annulées / sans ended_at
              created_at: { from: fromDate, to: toDate },
            },
          },
        },
      }
      if (cursor) body.cursor = cursor

      let pageRes
      try {
        pageRes = await fetchYangoPage(ordersUrl, headers, body)
      } catch (e) {
        // Échec après MAX_RETRIES : on retourne ce qu'on a, avec l'erreur
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({
          error:    `Échec page ${pages + 1} après ${MAX_RETRIES} retries: ${msg}`,
          partial:  true,
          fetched:  allOrders.length,
          pages,
          mode,
          from:     fromDate,
          to:       toDate,
          duration_ms: Date.now() - t0,
        }, { status: 502 })
      }

      pages++
      allOrders.push(...pageRes.orders)
      cursor = pageRes.cursor

      // Détection de boucle infinie (cursor identique → bug API)
      if (cursor && cursor === lastCursor) {
        console.warn("[sync-orders] Cursor identique reçu, arrêt:", cursor)
        break
      }
      lastCursor = cursor

    } while (cursor && allOrders.length < SAFETY_CAP)

    if (allOrders.length === 0) {
      return NextResponse.json({
        ok: true, synced: 0, mode,
        from: fromDate, to: toDate, pages,
        duration_ms: Date.now() - t0,
      })
    }

    // Upsert par batches (idempotent grâce au PK `id`)
    let upsertError: string | null = null
    let batchesOk = 0
    for (let i = 0; i < allOrders.length; i += BATCH_INSERT) {
      const batch = allOrders.slice(i, i + BATCH_INSERT)
      const rows = batch.map((o) => ({
        id:         o.id,
        short_id:   o.short_id != null ? Number(o.short_id) : null,
        status:     o.status ?? null,
        created_at: o.created_at || null,
        ended_at:   o.ended_at  || null,
        raw:        o,
      }))
      const { error } = await supabase.from("commandes_yango").upsert(rows, { onConflict: "id" })
      if (error) { upsertError = error.message; break }
      batchesOk++
    }

    if (upsertError) {
      return NextResponse.json({
        error: upsertError, partial: true,
        fetched: allOrders.length, batches_ok: batchesOk,
        mode, from: fromDate, to: toDate, pages,
        duration_ms: Date.now() - t0,
      }, { status: 500 })
    }

    // has_more = mode complet et la fenêtre n'est pas remontée jusqu'à HISTORY_START
    const hasMore = mode === "full" && fromDate > HISTORY_START

    return NextResponse.json({
      ok:           true,
      synced:       allOrders.length,
      mode,
      from:         fromDate,
      to:           toDate,
      pages,
      retries:      totalRetries,
      batches_ok:   batchesOk,
      has_more:     hasMore,
      duration_ms:  Date.now() - t0,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[sync-orders]", msg)
    return NextResponse.json({ error: msg, duration_ms: Date.now() - t0 }, { status: 500 })
  }
}
