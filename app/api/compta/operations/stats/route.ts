/**
 * GET /api/compta/operations/stats
 *
 * KPIs agrégés sur les opérations comptables, avec mêmes filtres que la liste
 * (mais sans pagination ni tri). Évolutions calculées vs même filtre appliqué
 * sur la période précédente (translation date_from..date_to vers la période
 * précédente de durée identique).
 *
 * Réservé directeur. Référence : doc Phase 3 Écran 1 §6.2.
 *
 * Query params (tous optionnels) :
 *   type      = entree|sortie
 *   source    = recette_wave|depense_vehicule|versement_client|manuel|...
 *   statut    = brouillon,valide,annule (multi, comma)
 *   compte_id, caisse_id, categorie_id, vehicule_id, chauffeur_id, client_id
 *   date_from, date_to (YYYY-MM-DD)
 *   search    = libellé (ilike)
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

const ALLOWED_STATUTS = new Set(["brouillon", "valide", "annule"])
const ALLOWED_TYPES   = new Set(["entree", "sortie"])
const ALLOWED_SOURCES = new Set([
  "manuel", "recette_wave", "depense_vehicule", "versement_client",
  "import_csv", "transfert_interne", "dotation_amort",
])

type Filters = {
  type?:        string
  source?:      string
  statuts?:     string[]
  compte_id?:   string
  caisse_id?:   string
  categorie_id?: string
  vehicule_id?: string
  chauffeur_id?: string
  client_id?:   string
  date_from?:   string
  date_to?:     string
  search?:      string
}

/** Construit la query supabase avec les filtres communs. */
function buildBaseQuery(filters: Filters) {
  let q = supabaseAdmin
    .from("operations")
    .select("type, montant", { count: "exact" })

  if (filters.type)         q = q.eq("type", filters.type)
  if (filters.source)       q = q.eq("source", filters.source)
  if (filters.compte_id)    q = q.eq("compte_id",    filters.compte_id)
  if (filters.caisse_id)    q = q.eq("caisse_id",    filters.caisse_id)
  if (filters.categorie_id) q = q.eq("categorie_id", filters.categorie_id)
  if (filters.vehicule_id)  q = q.eq("vehicule_id",  Number(filters.vehicule_id))
  if (filters.chauffeur_id) q = q.eq("chauffeur_id", Number(filters.chauffeur_id))
  if (filters.client_id)    q = q.eq("client_id",    Number(filters.client_id))
  if (filters.statuts && filters.statuts.length > 0) q = q.in("statut", filters.statuts)
  if (filters.date_from)    q = q.gte("date_operation", filters.date_from)
  if (filters.date_to)      q = q.lte("date_operation", filters.date_to)
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_]/g, m => `\\${m}`)}%`
    q = q.ilike("libelle", pattern)
  }
  return q
}

type Agreg = {
  total:           number
  entrees_count:   number
  entrees_montant: number
  sorties_count:   number
  sorties_montant: number
  solde_net:       number
}

async function agreger(filters: Filters): Promise<Agreg> {
  // Récupération paginée (count exact + montants)
  const PAGE = 10_000
  let from = 0
  let total = 0
  let entrees_count   = 0
  let entrees_montant = 0
  let sorties_count   = 0
  let sorties_montant = 0

  while (from < 1_000_000) {
    const { data, count, error } = await buildBaseQuery(filters)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (count !== null) total = count
    if (!data || data.length === 0) break

    for (const r of data) {
      const m = Number(r.montant || 0)
      if (r.type === "entree") {
        entrees_count   += 1
        entrees_montant += m
      } else if (r.type === "sortie") {
        sorties_count   += 1
        sorties_montant += m
      }
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  return {
    total,
    entrees_count,
    entrees_montant,
    sorties_count,
    sorties_montant,
    solde_net: entrees_montant - sorties_montant,
  }
}

/** Translation de la fenêtre [date_from, date_to] vers la période précédente. */
function periodePrecedente(dateFrom?: string, dateTo?: string)
: { date_from: string; date_to: string } | null {
  if (!dateFrom || !dateTo) return null
  const d1 = new Date(dateFrom + "T00:00:00Z")
  const d2 = new Date(dateTo   + "T00:00:00Z")
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null

  const dayMs = 86_400_000
  const dureeJours = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / dayMs) + 1)
  const newTo   = new Date(d1.getTime() - dayMs)
  const newFrom = new Date(newTo.getTime() - (dureeJours - 1) * dayMs)
  return {
    date_from: newFrom.toISOString().slice(0, 10),
    date_to:   newTo.toISOString().slice(0, 10),
  }
}

function pct(current: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null
  return Math.round(((current - prev) / Math.abs(prev)) * 1000) / 10
}

// ─── Route GET ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const type         = url.searchParams.get("type")         ?? undefined
  const source       = url.searchParams.get("source")       ?? undefined
  const statutsRaw   = url.searchParams.get("statut")       ?? undefined
  const compte_id    = url.searchParams.get("compte_id")    ?? undefined
  const caisse_id    = url.searchParams.get("caisse_id")    ?? undefined
  const categorie_id = url.searchParams.get("categorie_id") ?? undefined
  const vehicule_id  = url.searchParams.get("vehicule_id")  ?? undefined
  const chauffeur_id = url.searchParams.get("chauffeur_id") ?? undefined
  const client_id    = url.searchParams.get("client_id")    ?? undefined
  const date_from    = url.searchParams.get("date_from")    ?? undefined
  const date_to      = url.searchParams.get("date_to")      ?? undefined
  const search       = url.searchParams.get("search")?.trim() || undefined

  // Validation légère
  if (type   && !ALLOWED_TYPES.has(type))     return comptaError("INVALID_PAYLOAD", { field: "type" })
  if (source && !ALLOWED_SOURCES.has(source)) return comptaError("INVALID_PAYLOAD", { field: "source" })
  const statuts = statutsRaw
    ? statutsRaw.split(",").map(s => s.trim()).filter(s => ALLOWED_STATUTS.has(s))
    : undefined

  const currentFilters: Filters = {
    type, source, statuts,
    compte_id, caisse_id, categorie_id,
    vehicule_id, chauffeur_id, client_id,
    date_from, date_to, search,
  }

  let current: Agreg
  try {
    current = await agreger(currentFilters)
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }

  // Période précédente — seulement si date_from + date_to fournies
  let evolutions: {
    operations_vs_mois_prec: number | null
    entrees_vs_mois_prec:    number | null
    sorties_vs_mois_prec:    number | null
    solde_vs_mois_prec:      number | null
  } = {
    operations_vs_mois_prec: null,
    entrees_vs_mois_prec:    null,
    sorties_vs_mois_prec:    null,
    solde_vs_mois_prec:      null,
  }

  const prev = periodePrecedente(date_from, date_to)
  if (prev) {
    try {
      const prevAgreg = await agreger({ ...currentFilters, date_from: prev.date_from, date_to: prev.date_to })
      evolutions = {
        operations_vs_mois_prec: pct(current.total,           prevAgreg.total),
        entrees_vs_mois_prec:    pct(current.entrees_montant, prevAgreg.entrees_montant),
        sorties_vs_mois_prec:    pct(current.sorties_montant, prevAgreg.sorties_montant),
        solde_vs_mois_prec:      pct(current.solde_net,       prevAgreg.solde_net),
      }
    } catch {
      // Non bloquant : on retourne les KPIs courants avec evolutions=null
    }
  }

  return comptaOk({
    total:           current.total,
    entrees_count:   current.entrees_count,
    entrees_montant: current.entrees_montant,
    sorties_count:   current.sorties_count,
    sorties_montant: current.sorties_montant,
    solde_net:       current.solde_net,
    evolutions,
    periode_precedente: prev,
  })
}
