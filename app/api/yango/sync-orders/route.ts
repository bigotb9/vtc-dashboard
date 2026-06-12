import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

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

// Backoff exponentiel "court" pour erreurs reseau / 5xx / non-JSON : 1s, 2s, 4s.
// Pour 429 (rate limit), on bascule sur RATE_LIMIT_BACKOFF_MS (30s, 60s, 120s)
// car insister rapidement sur un 429 ne sert qu'a aggraver la situation cote API.
const RATE_LIMIT_BACKOFF_MS = [30_000, 60_000, 120_000]

type YangoOrder = {
  id:          string
  short_id?:   number
  status?:     string
  created_at?: string
  ended_at?:   string
  [k: string]: unknown
}

/**
 * Erreur typee pour les rate limits Yango (HTTP 429).
 * Permet a l'appelant de distinguer un "vrai" echec (5xx, network, etc.) d'une
 * pause forcee qui peut etre reprise au prochain cron sans intervention.
 *
 * En reception (boucle principale du POST), on retourne HTTP 200 avec
 * `rate_limited: true` pour signaler "succes partiel a poursuivre plus tard".
 */
class YangoRateLimitError extends Error {
  constructor(
    public readonly retryAfterSec: number | null,
    public readonly attemptsExhausted: number,
  ) {
    super(`Yango rate limit (HTTP 429) — ${attemptsExhausted} retries epuises, Retry-After: ${retryAfterSec ?? "n/a"}s`)
    this.name = "YangoRateLimitError"
  }
}

/**
 * Fetch une page d'orders Yango avec retry typé.
 *
 * Differencie 2 familles d'erreurs :
 *  - HTTP 429 (rate limit) : backoff LONG (30s, 60s, 120s) + respect du header
 *    `Retry-After` si present. Apres MAX_RETRIES, jette YangoRateLimitError
 *    pour que l'appelant traite ca comme un "succes partiel a reprendre".
 *  - Reste (network, 5xx, non-JSON, autres 4xx) : backoff COURT (1s, 2s, 4s)
 *    et jette une Error generique apres MAX_RETRIES (vrai echec, 502 cote
 *    appelant).
 *
 * Boucle `for` explicite (au lieu de recursion) pour avoir un controle clair
 * sur `attempt` et separer proprement les deux strategies de backoff.
 */
async function fetchYangoPage(
  url: string, headers: Record<string, string>, body: unknown,
): Promise<{ orders: YangoOrder[]; cursor: string | null }> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res  = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) })

      // ─── Cas particulier : HTTP 429 (rate limit) ───────────────────────
      if (res.status === 429) {
        const retryAfterHeader = res.headers.get("Retry-After")
        const retryAfterSec    = retryAfterHeader && /^\d+$/.test(retryAfterHeader)
          ? parseInt(retryAfterHeader, 10)
          : null

        if (attempt >= MAX_RETRIES) {
          // Plus de retry possible → on remonte un signal typé pour que la
          // boucle principale retourne 200 rate_limited (les courses deja
          // inserees sont preservees, le prochain cron reprendra a partir
          // de MAX(ended_at) - 1h).
          throw new YangoRateLimitError(retryAfterSec, MAX_RETRIES)
        }

        // Backoff long. Si l'API donne Retry-After, on le respecte ;
        // sinon on prend 30s / 60s / 120s selon l'attempt.
        const fallbackDelay = RATE_LIMIT_BACKOFF_MS[attempt - 1] ?? 120_000
        const delayMs       = retryAfterSec != null
          ? Math.max(retryAfterSec * 1000, 1000)
          : fallbackDelay
        console.warn(`[sync-orders] Yango HTTP 429 (rate limit) — attempt ${attempt}/${MAX_RETRIES}, retry dans ${delayMs}ms (Retry-After: ${retryAfterSec ?? "n/a"})`)
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }

      // ─── Cas standard : reponse non-429 ─────────────────────────────────
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
      // Les YangoRateLimitError remontent telles quelles (deja typees pour
      // l'appelant, pas de retry supplementaire).
      if (e instanceof YangoRateLimitError) throw e

      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < MAX_RETRIES) {
        // Backoff exponentiel court : 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }
  throw lastError ?? new Error("Yango fetch failed (unknown reason)")
}

export async function POST(req: NextRequest) {
  // Auth : accepte le cron (CRON_SECRET, transmis par le GET delegue ci-dessous)
  // OU un utilisateur avec la permission sync_orders (declenchement manuel UI).
  const cronSecret = process.env.CRON_SECRET
  const isCron = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`
  if (!isCron) {
    const auth = await requirePermission(req, "sync_orders")
    if (!auth.ok) return auth.response
  }

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

    // Détermination de la fenêtre de sync — SUR `ended_at`.
    //
    // Breaking change Yango (04/05/2026) : l'API n'accepte plus
    // `query.park.order.created_at` dans le filtre. Désormais il faut envoyer
    // `query.park.order.ended_at` (ou `booked_at`). Ce changement a bloqué la
    // sync silencieusement pendant 23 jours (toutes les pages retournaient des
    // erreurs propagées en 502, mais sans log applicatif côté serveur).
    //
    // Conséquence sur la pagination incrémentale : on doit aussi calculer la
    // borne `fromDate` à partir de `MAX(ended_at)` (et non plus
    // `MAX(created_at)`), sinon on rate des courses car le filtre Yango et le
    // curseur de reprise ne portent pas sur le même champ. Idem pour la borne
    // `toDate` du mode full qui s'appuie sur `MIN(ended_at)`.
    //
    // Note : les courses sans `ended_at` (en cours / non terminées) ne sont
    // donc plus capturées. Vérifié factuellement avant patch : 100 % des
    // statuts `complete` et `cancelled` ont un `ended_at` rempli, et l'API
    // Yango renvoie bien les deux statuts quand on filtre par `ended_at`.
    let fromDate: string
    let toDate:   string
    let mode:     "full" | "incremental"

    if (forceFrom) {
      // Sync complet : descend dans l'historique
      const { data: oldest } = await supabaseAdmin
        .from("commandes_yango")
        .select("ended_at")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: true })
        .limit(1)
        .single()
      mode     = "full"
      fromDate = HISTORY_START
      toDate   = oldest?.ended_at && oldest.ended_at > HISTORY_START
        ? oldest.ended_at
        : new Date().toISOString()
    } else {
      // Incremental : depuis la dernière course TERMINÉE stockée, MOINS 1h
      // pour rattraper les corrections rétroactives (statut/prix updaté côté
      // Yango après coup).
      const { data: latest } = await supabaseAdmin
        .from("commandes_yango")
        .select("ended_at")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(1)
        .single()
      mode = "incremental"
      const latestDate = latest?.ended_at ? new Date(latest.ended_at) : new Date(HISTORY_START)
      latestDate.setHours(latestDate.getHours() - OVERLAP_HOURS)
      fromDate = latestDate.toISOString()
      toDate   = new Date().toISOString()
    }

    if (fromDate >= toDate) {
      return NextResponse.json({ ok: true, synced: 0, mode, from: fromDate, to: toDate, message: "rien à syncer" })
    }

    // ── Pagination + insertion page par page (resilience aux pannes partielles) ──
    //
    // Strategie reecrite suite a la regression du 04/05/2026 + rate limits Yango
    // sur backfill long :
    //   AVANT : on accumulait toutes les pages en RAM (`allOrders[]`) puis
    //           upsert en fin de boucle. Si la sync plantait page 19/100,
    //           les 1800 courses fetchees etaient PERDUES (RAM libere a la
    //           sortie du handler).
    //   APRES : chaque page est upsertee dans Supabase IMMEDIATEMENT apres son
    //           fetch, AVANT la page suivante. Un echec en milieu de sync
    //           preserve toutes les courses deja inserees. Le prochain cron
    //           reprend automatiquement via `MAX(ended_at) - 1h`, idempotent
    //           grace a `onConflict: "id"`.
    //
    // Cas terminaux de la boucle :
    //   1. cursor exhausted (fin naturelle)              → return 200 ok
    //   2. SAFETY_CAP atteint                            → return 200 ok (avec note)
    //   3. cursor identique (bug API Yango)              → break + return 200 ok
    //   4. fetch echoue sur 429 apres 3 retries          → return 200 rate_limited
    //   5. fetch echoue sur autre erreur apres 3 retries → return 502 partial
    //   6. upsert Supabase echoue                        → return 500 partial
    let cursor: string | null = null
    let pages: number    = 0
    let inserted: number = 0   // total courses upsertees en BD (sur cette invocation)
    let batchesOk: number = 0  // nb d'upserts page-par-page reussis
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
              // FILTRE SUR ended_at (breaking change Yango 04/05/2026 — voir
              // commentaire détaillé plus haut au calcul de fromDate/toDate).
              // Avant : created_at — depuis le 04/05/2026, l'API ne l'accepte
              // plus et renvoie une erreur sur ce filtre, ce qui faisait
              // échouer toute la sync silencieusement (chaque page retournait
              // en 502 partial, mais sans log côté serveur).
              ended_at: { from: fromDate, to: toDate },
            },
          },
        },
      }
      if (cursor) body.cursor = cursor

      // ─── 1. Fetch une page ───────────────────────────────────────────────
      let pageRes
      try {
        pageRes = await fetchYangoPage(ordersUrl, headers, body)
      } catch (e) {
        // ─── 1a. Cas rate limit (HTTP 429 apres retries) ─────────────────
        // Les courses deja inserees (jusqu'a la page precedente) sont
        // preservees. Le prochain cron reprend la oU on s'est arrete grace
        // a MAX(ended_at) - 1h.
        if (e instanceof YangoRateLimitError) {
          console.warn("[sync-orders] Rate limit Yango — arret apres %d pages, %d courses inserees", pages, inserted)
          return NextResponse.json({
            ok:              true,
            synced:          inserted,
            pages,
            batches_ok:      batchesOk,
            rate_limited:    true,
            retry_after_sec: e.retryAfterSec,
            message:         `Rate limit Yango atteint apres ${pages} pages. Relancer dans 5-10 min pour continuer.`,
            mode,
            from:            fromDate,
            to:              toDate,
            duration_ms:     Date.now() - t0,
          })
        }

        // ─── 1b. Autre erreur fetch (network, 5xx, non-JSON, 4xx≠429) ──────
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[sync-orders] Yango fetch failed after retries", {
          message:        msg,
          page:           pages + 1,
          max_retries:    MAX_RETRIES,
          mode,
          from:           fromDate,
          to:             toDate,
          park_id:        parkId,
          orders_url:     ordersUrl,
          request_body:   body,
          inserted_so_far: inserted,
          duration_ms:    Date.now() - t0,
        })
        return NextResponse.json({
          error:       `Échec page ${pages + 1} après ${MAX_RETRIES} retries: ${msg}`,
          partial:     true,
          inserted,         // courses deja en BD (preservees)
          pages,
          batches_ok:  batchesOk,
          mode,
          from:        fromDate,
          to:          toDate,
          duration_ms: Date.now() - t0,
        }, { status: 502 })
      }

      pages++
      cursor = pageRes.cursor

      // ─── 2. Upsert IMMEDIAT de la page (avant la prochaine page) ────────
      if (pageRes.orders.length > 0) {
        // Securite : si une page deborde BATCH_INSERT (improbable avec
        // PAGE_SIZE=100), on decoupe en sous-batches.
        for (let i = 0; i < pageRes.orders.length; i += BATCH_INSERT) {
          const batch = pageRes.orders.slice(i, i + BATCH_INSERT)
          const rows = batch.map((o) => ({
            id:         o.id,
            short_id:   o.short_id != null ? Number(o.short_id) : null,
            status:     o.status ?? null,
            created_at: o.created_at || null,
            ended_at:   o.ended_at  || null,
            raw:        o,
          }))
          const { error: upsertErr } = await supabaseAdmin
            .from("commandes_yango")
            .upsert(rows, { onConflict: "id" })

          if (upsertErr) {
            // Echec ecriture : on retourne tout de suite, les pages precedentes
            // sont preservees en BD (upsertees a chaque tour).
            console.error("[sync-orders] Upsert Supabase failed", {
              message:       upsertErr.message,
              page:          pages,
              batch_size:    batch.length,
              inserted_so_far: inserted,
              duration_ms:   Date.now() - t0,
            })
            return NextResponse.json({
              error:       upsertErr.message,
              partial:     true,
              inserted,
              pages,
              batches_ok:  batchesOk,
              mode,
              from:        fromDate,
              to:          toDate,
              duration_ms: Date.now() - t0,
            }, { status: 500 })
          }
          inserted += batch.length
          batchesOk++
        }
      }

      // ─── 3. Detection de boucle infinie (cursor identique → bug API) ───
      if (cursor && cursor === lastCursor) {
        console.warn("[sync-orders] Cursor identique reçu, arrêt:", cursor)
        break
      }
      lastCursor = cursor

    } while (cursor && inserted < SAFETY_CAP)

    // has_more = mode complet et la fenêtre n'est pas remontée jusqu'à HISTORY_START
    const hasMore = mode === "full" && fromDate > HISTORY_START

    return NextResponse.json({
      ok:           true,
      synced:       inserted,
      mode,
      from:         fromDate,
      to:           toDate,
      pages,
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

/**
 * Patch 24/05/2026 - Cron Vercel
 * Les crons Vercel font des GET par defaut. On expose un handler GET qui
 * delegue a POST (cas typique : appel automatique toutes les 2h via vercel.json).
 *
 * Patch Lot AA (26/05/2026 audit) - Securite fail-closed :
 *   - En production : CRON_SECRET OBLIGATOIRE. Si absent en env -> 500
 *     pour bloquer la route (jamais ouverte en prod, meme par erreur de
 *     configuration).
 *   - En dev/local : CRON_SECRET optionnel (pratique pour tester sans secret).
 *   - Si CRON_SECRET est defini, on verifie 'authorization: Bearer ${SECRET}'
 *     (Vercel l'envoie automatiquement sur ses crons).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const isProd     = process.env.NODE_ENV === "production"

  if (!cronSecret) {
    if (isProd) {
      console.error("[yango/sync-orders] CRON_SECRET manquant en env prod — route bloquee")
      return NextResponse.json(
        { ok: false, error: "Configuration serveur incomplete" },
        { status: 500 }
      )
    }
    // En dev : on laisse passer sans secret (warning visible dans les logs)
    console.warn("[yango/sync-orders] CRON_SECRET non defini — mode dev permissif")
  } else {
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Authentification requise" },
        { status: 401 }
      )
    }
  }

  // Delegation a POST avec un body vide (mode incremental par defaut)
  return POST(new NextRequest(req.url, {
    method:  "POST",
    headers: req.headers,
    body:    JSON.stringify({}),
  }))
}
