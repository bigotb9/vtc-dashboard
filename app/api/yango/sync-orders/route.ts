import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const maxDuration = 60

const PAGE_SIZE  = 100
const MAX_ORDERS = 15000

export async function POST(req: NextRequest) {
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

    const HISTORY_START = "2026-01-01T00:00:00Z"

    // Mode SYNC NORMAL : récupère les nouvelles courses (du dernier ended_at stocké → maintenant)
    // Mode SYNC COMPLET : récupère les données PLUS ANCIENNES (2026-01-01 → plus vieille date stockée)
    let fromDate: string
    let toDate:   string

    if (forceFrom) {
      // Sync complet : cherche la date la plus ancienne déjà stockée
      const { data: oldest } = await supabase
        .from("commandes_yango")
        .select("ended_at")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: true })
        .limit(1)
        .single()

      if (oldest?.ended_at && oldest.ended_at > HISTORY_START) {
        // On va chercher en arrière : de HISTORY_START jusqu'à la plus ancienne date stockée
        fromDate = HISTORY_START
        toDate   = oldest.ended_at
      } else {
        // Rien de stocké ou on a déjà tout : sync normal du début à maintenant
        fromDate = HISTORY_START
        toDate   = new Date().toISOString()
      }
    } else {
      // Sync normal : du dernier ended_at stocké jusqu'à maintenant
      const { data: latest } = await supabase
        .from("commandes_yango")
        .select("ended_at")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(1)
        .single()

      fromDate = latest?.ended_at ?? HISTORY_START
      toDate   = new Date().toISOString()
    }

    // Fetch paginé depuis Yango
    const allOrders: Record<string, unknown>[] = []
    let cursor: string | null = null

    do {
      const body: Record<string, unknown> = {
        limit: PAGE_SIZE,
        query: {
          park: {
            id: parkId,
            order: {
              ended_at: { from: fromDate, to: toDate },
            },
          },
        },
      }
      if (cursor) body.cursor = cursor

      const res = await fetch(ordersUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key":    apiKey,
          "X-Client-ID":  clid,
        },
        body: JSON.stringify(body),
      })

      const text = await res.text()
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
        console.warn("[sync-orders] Réponse non-JSON:", text.slice(0, 200))
        break
      }

      const data = JSON.parse(text)
      const pageOrders: Record<string, unknown>[] = Array.isArray(data.orders) ? data.orders : []
      allOrders.push(...pageOrders)

      cursor = (data.next_cursor as string) || (data.cursor as string) || null

    } while (cursor && allOrders.length < MAX_ORDERS)

    if (allOrders.length === 0) {
      return NextResponse.json({ synced: 0, from: fromDate, to: toDate, has_more: false })
    }

    // Upsert dans Supabase
    const BATCH = 500
    let upsertError = null
    for (let i = 0; i < allOrders.length; i += BATCH) {
      const batch = allOrders.slice(i, i + BATCH)
      const rows = batch.map((o) => ({
        id:         o.id as string,
        short_id:   o.short_id != null ? Number(o.short_id) : null,
        status:     (o.status as string) ?? null,
        created_at: (o.created_at as string) || null,
        ended_at:   (o.ended_at as string) || (o.created_at as string) || null,
        raw:        o,
      }))
      const { error } = await supabase
        .from("commandes_yango")
        .upsert(rows, { onConflict: "id" })
      if (error) { upsertError = error.message; break }
    }

    if (upsertError) {
      return NextResponse.json({ error: upsertError, fetched: allOrders.length }, { status: 500 })
    }

    // has_more = on est en mode "sync complet" et il reste encore des données plus anciennes
    const hasMore = forceFrom !== null && fromDate < toDate && allOrders.length > 0

    return NextResponse.json({
      synced:   allOrders.length,
      from:     fromDate,
      to:       toDate,
      has_more: hasMore,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[sync-orders]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
