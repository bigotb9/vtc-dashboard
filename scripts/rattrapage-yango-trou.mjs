#!/usr/bin/env node
/**
 * scripts/rattrapage-yango-trou.mjs
 *
 * Script standalone de rattrapage des courses Yango sur une plage de jours.
 *
 * Cible initiale : combler le trou 05/05/2026 → 10/05/2026 inclus (6 jours)
 * causé par les rate limits qui ont fait avancer MAX(ended_at) sans rattraper
 * le passé.
 *
 * Strategie :
 *   - Boucle jour par jour (chaque jour est independant)
 *   - Pour chaque jour : pagination Yango avec filtre `ended_at = {from, to}`
 *   - Insertion PAGE PAR PAGE dans commandes_yango (idempotent via PK `id` +
 *     onConflict: "id" — relancer le script ne cree pas de doublons)
 *   - Gestion 429 : backoff 30s puis 60s (3 essais max par page). Si toujours
 *     429, on abandonne CE jour et continue avec le suivant — on perd pas
 *     tout le run pour un jour difficile.
 *
 * Variables d'env requises (lues depuis .env.local a la racine du projet) :
 *   YANGO_ORDERS_URL
 *   YANGO_ORDERS_API_KEY
 *   CLID
 *   ID_DU_PARTENAIRE
 *   NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL en fallback)
 *   SUPABASE_SERVICE_ROLE_KEY (bypass RLS — important pour ecrire commandes_yango
 *   sans contexte user)
 *
 * Usage :
 *   node scripts/rattrapage-yango-trou.mjs
 *     → defaut : 2026-05-05 → 2026-05-10 (6 jours)
 *
 *   node scripts/rattrapage-yango-trou.mjs --day 2026-05-05
 *     → un seul jour (test recommande avant de lancer la plage complete)
 *
 *   node scripts/rattrapage-yango-trou.mjs --from 2026-05-08 --to 2026-05-10
 *     → plage custom
 *
 *   node scripts/rattrapage-yango-trou.mjs --dry-run
 *     → fetch et compte mais n'insere RIEN en BD (utile pour valider la conf)
 *
 *   node scripts/rattrapage-yango-trou.mjs --help
 *
 * Mapping commandes_yango (identique a app/api/yango/sync-orders/route.ts) :
 *   { id, short_id, status, created_at, ended_at, raw: orderEntierBrut }
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join }  from "node:path"
import { createClient }   from "@supabase/supabase-js"

// ════════════════════════════════════════════════════════════════════════════
// 1. CONSTANTES
// ════════════════════════════════════════════════════════════════════════════
const DEFAULT_FROM = "2026-05-05"
const DEFAULT_TO   = "2026-05-10"
const PAGE_SIZE    = 100
// Backoff long sur 429 : 30s puis 60s (3 essais max au total, pour limiter
// l'agressivite sur une API qui nous dit "stop"). Si le 3e essai echoue
// encore, on passe au jour suivant.
const RATE_LIMIT_BACKOFFS_MS = [30_000, 60_000]
const MAX_429_RETRIES        = RATE_LIMIT_BACKOFFS_MS.length + 1

// ════════════════════════════════════════════════════════════════════════════
// 2. PARSE CLI ARGS
// ════════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2)
const opts = { dryRun: false, help: false }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if      (a === "--day")     opts.day     = argv[++i]
  else if (a === "--from")    opts.from    = argv[++i]
  else if (a === "--to")      opts.to      = argv[++i]
  else if (a === "--dry-run") opts.dryRun  = true
  else if (a === "--help" || a === "-h") opts.help = true
  else {
    console.error(`Argument inconnu : ${a} (utilise --help pour l'aide)`)
    process.exit(1)
  }
}

if (opts.help) {
  console.log(`
scripts/rattrapage-yango-trou.mjs — Rattrapage Yango par jour

Usage :
  node scripts/rattrapage-yango-trou.mjs
    Defaut : ${DEFAULT_FROM} → ${DEFAULT_TO} (6 jours)

  node scripts/rattrapage-yango-trou.mjs --day YYYY-MM-DD
    1 seul jour (test recommande avant la plage complete)

  node scripts/rattrapage-yango-trou.mjs --from YYYY-MM-DD --to YYYY-MM-DD
    Plage custom

  node scripts/rattrapage-yango-trou.mjs --dry-run
    Fetch + compte sans insert (validation conf)

Exit codes :
  0 = tous les jours OK
  1 = au moins un jour partiel (429 persistant)
  2 = au moins un jour failed (erreur fetch ou upsert)
 99 = erreur fatale (env manquante, exception non gere, etc.)
`)
  process.exit(0)
}

const fromIso = opts.day ?? opts.from ?? DEFAULT_FROM
const toIso   = opts.day ?? opts.to   ?? DEFAULT_TO

if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso)) {
  console.error(`ERREUR : dates invalides (format attendu YYYY-MM-DD, recu from=${fromIso} to=${toIso})`)
  process.exit(99)
}
if (fromIso > toIso) {
  console.error(`ERREUR : from (${fromIso}) > to (${toIso})`)
  process.exit(99)
}

// ════════════════════════════════════════════════════════════════════════════
// 3. PARSE .env.local (parsing manuel, pas de dotenv requis)
// ════════════════════════════════════════════════════════════════════════════
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const envPath    = join(__dirname, "..", ".env.local")

function parseEnvFile(path) {
  let content
  try {
    content = readFileSync(path, "utf8")
  } catch (e) {
    console.error(`ERREUR : impossible de lire ${path}`)
    console.error(`  ${e.message}`)
    console.error(`  Lance le script depuis n'importe ou — il cherche .env.local au niveau du projet.`)
    process.exit(99)
  }
  const env = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Supprime les quotes optionnelles
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = parseEnvFile(envPath)

const ORDERS_URL   = env.YANGO_ORDERS_URL
const API_KEY      = env.YANGO_ORDERS_API_KEY
const CLID         = env.CLID
const PARK_ID      = env.ID_DU_PARTENAIRE
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY

const missing = [
  !ORDERS_URL   && "YANGO_ORDERS_URL",
  !API_KEY      && "YANGO_ORDERS_API_KEY",
  !CLID         && "CLID",
  !PARK_ID      && "ID_DU_PARTENAIRE",
  !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)",
  !SERVICE_ROLE && "SUPABASE_SERVICE_ROLE_KEY",
].filter(Boolean)

if (missing.length) {
  console.error(`ERREUR : variables d'env manquantes dans ${envPath} :`)
  for (const m of missing) console.error(`  - ${m}`)
  process.exit(99)
}

// ════════════════════════════════════════════════════════════════════════════
// 4. INIT SUPABASE CLIENT (service_role, bypass RLS)
// ════════════════════════════════════════════════════════════════════════════
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ════════════════════════════════════════════════════════════════════════════
// 5. HELPERS
// ════════════════════════════════════════════════════════════════════════════
function rangeDays(from, to) {
  const days = []
  const d   = new Date(from + "T00:00:00Z")
  const end = new Date(to   + "T00:00:00Z")
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Fetch une page Yango.
 *   - { ok: true, orders, cursor }
 *   - { ok: false, rateLimited: true, retryAfterSec }
 *   - { ok: false, error: string }
 */
async function fetchYangoPage(bodyObj) {
  let res
  try {
    res = await fetch(ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":    API_KEY,
        "X-Client-ID":  CLID,
      },
      body: JSON.stringify(bodyObj),
    })
  } catch (e) {
    return { ok: false, error: `Network: ${e.message ?? String(e)}` }
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After")
    const sec = retryAfter && /^\d+$/.test(retryAfter)
      ? parseInt(retryAfter, 10)
      : null
    return { ok: false, rateLimited: true, retryAfterSec: sec }
  }

  let text
  try {
    text = await res.text()
  } catch (e) {
    return { ok: false, error: `Lecture body : ${e.message ?? String(e)}` }
  }
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    return { ok: false, error: `Reponse non-JSON (status=${res.status}): ${text.slice(0, 120)}` }
  }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
  }

  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `JSON parse : ${e.message ?? String(e)}` }
  }

  const orders = Array.isArray(data.orders) ? data.orders : []
  const cursor = data.next_cursor ?? data.cursor ?? null
  return { ok: true, orders, cursor }
}

/**
 * Traite un jour complet : pagination + upsert + 429 handling.
 * Retourne { status: "ok"|"partial"|"failed", inserted, pages, error? }.
 */
async function processDay(day) {
  const dayFromIso = `${day}T00:00:00Z`
  const dayToIso   = `${day}T23:59:59Z`

  let cursor      = null
  let pages       = 0
  let inserted    = 0
  let lastCursor  = "<init>"

  console.log(`\n📅 ${day} : début (ended_at ${dayFromIso} → ${dayToIso})`)

  while (true) {
    const body = {
      limit: PAGE_SIZE,
      query: {
        park: {
          id: PARK_ID,
          order: {
            // Filtre Yango sur ended_at (breaking change 04/05/2026).
            ended_at: { from: dayFromIso, to: dayToIso },
          },
        },
      },
    }
    if (cursor) body.cursor = cursor

    // ── Fetch avec retry 429 ────────────────────────────────────────────
    let page
    let attempt429 = 0
    while (true) {
      page = await fetchYangoPage(body)
      if (page.ok) break

      if (page.rateLimited) {
        if (attempt429 >= RATE_LIMIT_BACKOFFS_MS.length) {
          console.error(`  ❌ ${day} : HTTP 429 persistant après ${MAX_429_RETRIES} tentatives — abandon du jour`)
          return { status: "partial", inserted, pages, error: "rate_limit_persistent" }
        }
        const fallback = RATE_LIMIT_BACKOFFS_MS[attempt429]
        const waitMs   = page.retryAfterSec != null
          ? Math.max(page.retryAfterSec * 1000, 1000)
          : fallback
        console.warn(
          `  ⏳ ${day} page ${pages + 1} : HTTP 429, attente ${Math.round(waitMs / 1000)}s ` +
          `(Retry-After: ${page.retryAfterSec ?? "n/a"}) — tentative ${attempt429 + 1}/${MAX_429_RETRIES}`,
        )
        await sleep(waitMs)
        attempt429++
        continue
      }

      // Autre erreur fetch (network, 5xx, non-JSON, 4xx≠429)
      console.error(`  ❌ ${day} page ${pages + 1} : ${page.error}`)
      return { status: "failed", inserted, pages, error: page.error }
    }

    pages++
    const { orders, cursor: nextCursor } = page

    // ── Upsert immediat de cette page ────────────────────────────────────
    if (orders.length > 0) {
      const rows = orders.map(o => ({
        id:         o.id,
        short_id:   o.short_id != null ? Number(o.short_id) : null,
        status:     o.status ?? null,
        created_at: o.created_at || null,
        ended_at:   o.ended_at  || null,
        raw:        o,
      }))

      if (opts.dryRun) {
        inserted += orders.length
        console.log(`  🔬 ${day} page ${pages} : ${orders.length} fetched (DRY-RUN, pas d'insert) — total jour ${inserted}`)
      } else {
        const { error } = await supabase
          .from("commandes_yango")
          .upsert(rows, { onConflict: "id" })
        if (error) {
          console.error(`  ❌ ${day} page ${pages} : upsert Supabase échoué — ${error.message}`)
          return { status: "failed", inserted, pages, error: `upsert: ${error.message}` }
        }
        inserted += orders.length
        console.log(`  📄 ${day} page ${pages} : ${orders.length} upserted — total jour ${inserted}`)
      }
    } else {
      console.log(`  📄 ${day} page ${pages} : page vide`)
    }

    // ── Conditions de sortie ─────────────────────────────────────────────
    if (!nextCursor) break
    if (nextCursor === lastCursor) {
      console.warn(`  ⚠️  ${day} : cursor identique reçu (bug API Yango), arrêt`)
      break
    }
    lastCursor = nextCursor
    cursor     = nextCursor
  }

  console.log(`  ✅ ${day} terminé : ${inserted} courses sur ${pages} page${pages > 1 ? "s" : ""}`)
  return { status: "ok", inserted, pages }
}

// ════════════════════════════════════════════════════════════════════════════
// 6. MAIN
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  const days  = rangeDays(fromIso, toIso)
  const t0    = Date.now()

  console.log("════════════════════════════════════════════════════════════")
  console.log("Rattrapage Yango — script standalone")
  console.log("════════════════════════════════════════════════════════════")
  console.log(`Période   : ${fromIso} → ${toIso} (${days.length} jour${days.length > 1 ? "s" : ""})`)
  console.log(`Mode      : ${opts.dryRun ? "🔬 DRY-RUN (pas d'insert)" : "🚀 PRODUCTION"}`)
  console.log(`Yango URL : ${ORDERS_URL}`)
  console.log(`Park ID   : ${PARK_ID}`)
  console.log(`Supabase  : ${SUPABASE_URL}`)
  console.log("════════════════════════════════════════════════════════════")

  const results       = []
  let totalInserted = 0

  for (const day of days) {
    const r = await processDay(day)
    results.push({ day, ...r })
    totalInserted += r.inserted
  }

  // ─── Résumé ──────────────────────────────────────────────────────────────
  const elapsedMs = Date.now() - t0
  console.log("\n════════════════════════════════════════════════════════════")
  console.log("RÉSUMÉ")
  console.log("════════════════════════════════════════════════════════════")
  for (const r of results) {
    const icon =
      r.status === "ok"      ? "✅" :
      r.status === "partial" ? "⚠️ " :
                               "❌"
    const errSuffix = r.error ? ` — ${r.error}` : ""
    console.log(`${icon} ${r.day} : ${String(r.inserted).padStart(5)} inserted, ${r.pages} pages${errSuffix}`)
  }
  const ok      = results.filter(r => r.status === "ok").length
  const partial = results.filter(r => r.status === "partial").length
  const failed  = results.filter(r => r.status === "failed").length
  console.log("────────────────────────────────────────────────────────────")
  console.log(`Total inserted   : ${totalInserted} courses${opts.dryRun ? " (dry-run, rien en BD)" : ""}`)
  console.log(`Jours OK         : ${ok}`)
  console.log(`Jours partiels   : ${partial}`)
  console.log(`Jours en erreur  : ${failed}`)
  console.log(`Durée totale     : ${Math.round(elapsedMs / 1000)}s`)
  console.log("════════════════════════════════════════════════════════════")

  // Exit code informatif
  if (failed > 0)  process.exit(2)
  if (partial > 0) process.exit(1)
  process.exit(0)
}

main().catch(err => {
  console.error("\n💥 ERREUR FATALE non gerée :", err)
  process.exit(99)
})
