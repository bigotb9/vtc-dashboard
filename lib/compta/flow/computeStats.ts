/**
 * Compute stats pour /api/compta/depenses/stats et /recettes/stats
 * (Phase 4.x Vague 3.5 §3.1.1).
 *
 * Calcule KPIs, top catégories / tiers / chauffeurs, évolution 6 mois,
 * et répartitions pour les donuts.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type {
  FlowFilters, FlowKind, FlowSlice, FlowStatsResponse, FlowTopEntry,
} from "@/types/compta-ui"
import { kindToOpType } from "./parseFilters"

const DONUT_COLORS = [
  "#F87171", "#FBBF24", "#22D3EE", "#A78BFA",
  "#34D399", "#60A5FA", "#F59E0B", "#67E8F9", "#9CA3AF",
]

export async function computeFlowStats(
  kind: FlowKind, filters: FlowFilters, from: string, to: string,
): Promise<FlowStatsResponse> {
  const opType = kindToOpType(kind)

  // ── 1. Charger TOUTES les ops filtrées sur la période ──────────────────
  let q = supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, montant, source, categorie_id, tiers_id, chauffeur_id,
      categorie:categorie_id ( id, libelle ),
      tiers:tiers_id ( id, nom )
    `)
    .eq("type",   opType)
    .eq("statut", "valide")
    .gte("date_operation", from)
    .lte("date_operation", to)
    .neq("source", "transfert_interne")

  if (filters.cat_ids?.length)        q = q.in("categorie_id", filters.cat_ids)
  if (filters.tiers_ids?.length)      q = q.in("tiers_id",      filters.tiers_ids)
  if (filters.vehicule_ids?.length)   q = q.in("vehicule_id",   filters.vehicule_ids)
  if (filters.chauffeur_ids?.length)  q = q.in("chauffeur_id",  filters.chauffeur_ids)
  if (filters.sources?.length)        q = q.in("source",        filters.sources)
  if (filters.caisse_ids?.length) {
    const ids = filters.caisse_ids
    q = q.or(`caisse_id.in.(${ids.join(",")}),compte_id.in.(${ids.join(",")})`)
  }
  if (filters.montant_min != null) q = q.gte("montant", filters.montant_min)
  if (filters.montant_max != null) q = q.lte("montant", filters.montant_max)
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.replace(/[%_]/g, "\\$&")}%`
    q = q.or(`libelle.ilike.${pattern},notes.ilike.${pattern}`)
  }

  type Row = {
    id: string; date_operation: string; montant: number | string; source: string
    categorie_id: string | null; tiers_id: string | null; chauffeur_id: number | null
    categorie: { id: string; libelle: string } | null
    tiers:     { id: string; nom: string } | null
  }
  const { data: rows, error } = await q
  if (error) throw error

  const list = (rows ?? []) as unknown as Row[]
  const totalPeriod = list.reduce((a, r) => a + Number(r.montant), 0)
  const countPeriod = list.length

  // ── 2. Total période précédente (même durée juste avant `from`) ────────
  const totalPrevious = await computePreviousPeriodTotal(kind, filters, from, to)
  const trendPct = totalPrevious > 0
    ? ((totalPeriod - totalPrevious) / totalPrevious) * 100
    : null

  // ── 3. Nombre de jours + moyenne / jour ────────────────────────────────
  const dayCount = countDaysInRange(from, to)
  const avgPerDay = dayCount > 0 ? totalPeriod / dayCount : 0

  // ── 4. Top 3 catégories ─────────────────────────────────────────────────
  const catAgg = aggregateBy(list, r => r.categorie?.id ?? null, r => r.categorie?.libelle ?? "(sans catégorie)")
  const topCategories = pickTop(catAgg, 3)

  // ── 5. Top 3 tiers (toujours calculé, utile sur les deux pages) ────────
  const tiersAgg = aggregateBy(list, r => r.tiers?.id ?? null, r => r.tiers?.nom ?? "(sans tiers)")
  const topTiers  = pickTop(tiersAgg, 3, true)

  // ── 6. Top 3 chauffeurs (recettes principalement) ──────────────────────
  let topChauffeurs: FlowTopEntry[] = []
  if (kind === "recettes") {
    const chIds = uniqueNums(list.map(r => r.chauffeur_id))
    const chMap = await loadChauffeursMap(chIds)
    const chAgg = aggregateByNum(
      list,
      r => r.chauffeur_id ?? null,
      id => chMap.get(id)?.nom ?? `Chauffeur #${id}`,
    )
    topChauffeurs = pickTop(chAgg, 3, true)
  }

  // ── 7. Évolution 6 derniers mois ───────────────────────────────────────
  const evolution = await loadEvolution6Months(kind, filters, to)

  // ── 8. Répartition catégories (top 4 + "Autres") ───────────────────────
  const allCats = [...catAgg.values()].sort((a, b) => b.total - a.total)
  const repartCategories: FlowSlice[] = toSlices(allCats, totalPeriod, 4, "categorie")

  // ── 9. Répartition par source (utile pour /recettes) ────────────────────
  const sourceAgg = aggregateBy(list, r => r.source, r => sourceLabel(r.source))
  const allSources = [...sourceAgg.values()].sort((a, b) => b.total - a.total)
  const repartSources: FlowSlice[] = toSlices(allSources, totalPeriod, 6, "source")

  return {
    total_period:           totalPeriod,
    total_previous_period:  totalPrevious,
    trend_pct:              trendPct,
    count_period:           countPeriod,
    count_days:             dayCount,
    avg_per_day:            avgPerDay,
    top_categories:         topCategories,
    top_tiers:              topTiers,
    top_chauffeurs:         topChauffeurs,
    evolution_monthly:      evolution,
    repartition_categories: repartCategories,
    repartition_sources:    repartSources,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface AggEntry { id: string | number | null; libelle: string; total: number; count: number }

function aggregateBy<T extends { montant: number | string }>(
  list: T[],
  idFn: (r: T) => string | null,
  labelFn: (r: T) => string,
): Map<string, AggEntry> {
  const m = new Map<string, AggEntry>()
  for (const r of list) {
    const id = idFn(r) ?? "_null"
    const key = String(id)
    const cur = m.get(key) ?? { id, libelle: labelFn(r), total: 0, count: 0 }
    cur.total += Number(r.montant)
    cur.count += 1
    m.set(key, cur)
  }
  return m
}

function aggregateByNum<T extends { montant: number | string }>(
  list: T[],
  idFn: (r: T) => number | null,
  labelFn: (id: number) => string,
): Map<string, AggEntry> {
  const m = new Map<string, AggEntry>()
  for (const r of list) {
    const id = idFn(r)
    if (id === null) continue
    const key = String(id)
    const cur = m.get(key) ?? { id, libelle: labelFn(id), total: 0, count: 0 }
    cur.total += Number(r.montant)
    cur.count += 1
    m.set(key, cur)
  }
  return m
}

function pickTop(agg: Map<string, AggEntry>, n: number, requireId = false): FlowTopEntry[] {
  return [...agg.values()]
    .filter(e => (requireId ? e.id !== null && e.id !== "_null" : true) && e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
    .map(e => ({ id: e.id ?? "", libelle: e.libelle, total: e.total, count: e.count }))
}

function toSlices(sorted: AggEntry[], total: number, topN: number, kind: "categorie" | "source"): FlowSlice[] {
  if (total <= 0) return []
  const slices: FlowSlice[] = []
  let used = 0
  for (let i = 0; i < Math.min(topN, sorted.length); i++) {
    const e = sorted[i]
    slices.push({
      id:         String(e.id ?? `${kind}_${i}`),
      libelle:    e.libelle,
      total:      e.total,
      pct:        (e.total / total) * 100,
      color_hint: DONUT_COLORS[i % DONUT_COLORS.length],
    })
    used += e.total
  }
  if (sorted.length > topN) {
    const rest = total - used
    if (rest > 0) {
      slices.push({
        id:         "autres",
        libelle:    "Autres",
        total:      rest,
        pct:        (rest / total) * 100,
        color_hint: "#6B7280",
      })
    }
  }
  return slices
}

function uniqueNums(arr: (number | null | undefined)[]): number[] {
  const s = new Set<number>()
  for (const n of arr) { if (typeof n === "number") s.add(n) }
  return [...s]
}

async function loadChauffeursMap(ids: number[]): Promise<Map<number, { id_chauffeur: number; nom: string }>> {
  const m = new Map<number, { id_chauffeur: number; nom: string }>()
  if (ids.length === 0) return m
  const { data } = await supabaseAdmin.from("chauffeurs").select("id_chauffeur, nom").in("id_chauffeur", ids)
  for (const r of (data ?? []) as Array<{ id_chauffeur: number; nom: string }>) m.set(r.id_chauffeur, r)
  return m
}

function countDaysInRange(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime()
  const b = new Date(to   + "T00:00:00Z").getTime()
  const ms = b - a
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

async function computePreviousPeriodTotal(
  kind: FlowKind, filters: FlowFilters, from: string, to: string,
): Promise<number> {
  // Période précédente = même durée juste avant `from`
  const days = countDaysInRange(from, to)
  const prevTo  = isoOffset(from, -1)
  const prevFrom = isoOffset(prevTo, -(days - 1))
  const opType = kindToOpType(kind)
  let q = supabaseAdmin
    .from("operations")
    .select("montant")
    .eq("type",   opType)
    .eq("statut", "valide")
    .gte("date_operation", prevFrom)
    .lte("date_operation", prevTo)
    .neq("source", "transfert_interne")
  if (filters.cat_ids?.length)       q = q.in("categorie_id", filters.cat_ids)
  if (filters.tiers_ids?.length)     q = q.in("tiers_id",      filters.tiers_ids)
  if (filters.vehicule_ids?.length)  q = q.in("vehicule_id",   filters.vehicule_ids)
  if (filters.chauffeur_ids?.length) q = q.in("chauffeur_id",  filters.chauffeur_ids)
  if (filters.sources?.length)       q = q.in("source",        filters.sources)
  const { data } = await q
  return (data ?? []).reduce((a, r) => a + Number((r as { montant: number | string }).montant), 0)
}

async function loadEvolution6Months(
  kind: FlowKind, filters: FlowFilters, anchor: string,
): Promise<{ month: string; total: number }[]> {
  const opType = kindToOpType(kind)
  const months: string[] = []
  const anchorDate = new Date(anchor + "T00:00:00Z")
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - i, 1))
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`)
  }
  const from = `${months[0]}-01`
  const lastMonth = months[months.length - 1]
  const lastYear  = parseInt(lastMonth.slice(0, 4), 10)
  const lastMon   = parseInt(lastMonth.slice(5, 7), 10)
  const lastDay   = new Date(Date.UTC(lastYear, lastMon, 0)).getUTCDate()
  const to        = `${lastMonth}-${String(lastDay).padStart(2, "0")}`

  let q = supabaseAdmin
    .from("operations")
    .select("date_operation, montant")
    .eq("type",   opType)
    .eq("statut", "valide")
    .gte("date_operation", from)
    .lte("date_operation", to)
    .neq("source", "transfert_interne")
  if (filters.cat_ids?.length)       q = q.in("categorie_id", filters.cat_ids)
  if (filters.tiers_ids?.length)     q = q.in("tiers_id",      filters.tiers_ids)
  if (filters.vehicule_ids?.length)  q = q.in("vehicule_id",   filters.vehicule_ids)
  if (filters.chauffeur_ids?.length) q = q.in("chauffeur_id",  filters.chauffeur_ids)
  if (filters.sources?.length)       q = q.in("source",        filters.sources)
  const { data } = await q

  const totals = new Map<string, number>(months.map(m => [m, 0]))
  for (const r of (data ?? []) as Array<{ date_operation: string; montant: number | string }>) {
    const k = r.date_operation.slice(0, 7)
    totals.set(k, (totals.get(k) ?? 0) + Number(r.montant))
  }
  return months.map(m => ({ month: m, total: totals.get(m) ?? 0 }))
}

function isoOffset(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const SOURCE_LABELS: Record<string, string> = {
  manuel:            "Saisie manuelle",
  recette_wave:      "Recette Wave",
  depense_vehicule:  "Dépense véhicule",
  versement_client:  "Versement client",
  transfert_interne: "Transfert interne",
  dotation_amort:    "Dotation",
  import_csv:        "Import CSV",
}
function sourceLabel(s: string): string { return SOURCE_LABELS[s] ?? s }
