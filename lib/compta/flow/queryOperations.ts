/**
 * Construction de la requête operations filtrée pour /depenses et /recettes
 * (Phase 4.x Vague 3.5 §3.1.1).
 *
 * Lit depuis la table `operations` (source de vérité Phase 4) avec un JOIN
 * déclaratif sur caisse, compte, categorie, tiers, et lookups annexes pour
 * vehicule / chauffeur / client (FK INT séparées).
 *
 * Par défaut on EXCLUT les transferts internes (source = 'transfert_interne')
 * — ils sont visibles uniquement via la page Opérations comptables.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { FlowFilters, FlowKind, FlowOperationItem } from "@/types/compta-ui"
import { kindToOpType } from "./parseFilters"

interface BuildOptions {
  kind:       FlowKind
  filters:    FlowFilters
  from:       string
  to:         string
  withLimit?: boolean
}

export async function fetchFlowOperations(opts: BuildOptions): Promise<{
  data:          FlowOperationItem[]
  total:         number
  total_period:  number
  count_period:  number
}> {
  const { kind, filters, from, to, withLimit = true } = opts
  const opType = kindToOpType(kind)

  // ── 1. Requête principale avec JOIN déclaratif ──────────────────────────
  let q = supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, type, montant, libelle, source, source_ref,
      caisse_id, compte_id, categorie_id, tiers_id,
      vehicule_id, chauffeur_id, client_id, statut,
      caisse:caisse_id ( id, libelle, compte_syscohada_code ),
      compte:compte_id ( id, libelle, compte_syscohada_code ),
      categorie:categorie_id ( id, libelle, type, compte_syscohada_code ),
      tiers:tiers_id ( id, nom, compte_syscohada_code )
    `, { count: "exact" })
    .eq("type",   opType)
    .eq("statut", "valide")
    .gte("date_operation", from)
    .lte("date_operation", to)
    // Exclusion par défaut des transferts internes (cf. spec §2.2.6 + question 7.3)
    .neq("source", "transfert_interne")

  // ── 2. Filtres ──────────────────────────────────────────────────────────
  if (filters.cat_ids && filters.cat_ids.length > 0)             q = q.in("categorie_id", filters.cat_ids)
  if (filters.tiers_ids && filters.tiers_ids.length > 0)         q = q.in("tiers_id", filters.tiers_ids)
  if (filters.vehicule_ids && filters.vehicule_ids.length > 0)   q = q.in("vehicule_id", filters.vehicule_ids)
  if (filters.chauffeur_ids && filters.chauffeur_ids.length > 0) q = q.in("chauffeur_id", filters.chauffeur_ids)
  if (filters.sources && filters.sources.length > 0) {
    // Si l'utilisateur force transfert_interne explicitement, on l'autorise
    q = q.in("source", filters.sources)
  }
  if (filters.caisse_ids && filters.caisse_ids.length > 0) {
    // caisse OU compte (les 2 sont mélangés dans le filtre)
    const ids = filters.caisse_ids
    q = q.or(`caisse_id.in.(${ids.join(",")}),compte_id.in.(${ids.join(",")})`)
  }
  if (filters.montant_min !== null && filters.montant_min !== undefined) q = q.gte("montant", filters.montant_min)
  if (filters.montant_max !== null && filters.montant_max !== undefined) q = q.lte("montant", filters.montant_max)
  if (filters.search && filters.search.trim()) {
    const pattern = `%${filters.search.replace(/[%_]/g, "\\$&")}%`
    q = q.or(`libelle.ilike.${pattern},notes.ilike.${pattern}`)
  }

  // ── 3. Tri + pagination ─────────────────────────────────────────────────
  const sortCol  = filters.sort_by === "montant" ? "montant" : "date_operation"
  const ascending = filters.sort_order === "asc"
  q = q.order(sortCol, { ascending })
  if (sortCol !== "date_operation") q = q.order("date_operation", { ascending: false })

  let page = filters.page ?? 1
  let pageSize = filters.page_size ?? 20
  if (withLimit) {
    const offset = (page - 1) * pageSize
    q = q.range(offset, offset + pageSize - 1)
  } else {
    page = 1
    pageSize = 100000
  }

  const { data: rows, count, error } = await q
  if (error) throw error

  const ids = (rows ?? []).map(r => r.id as string)

  // ── 4. Lookup véhicules / chauffeurs / clients (FK INT, hors Supabase JOIN) ──
  const vehIds = uniqueNums((rows ?? []).map(r => (r as { vehicule_id?: number }).vehicule_id))
  const chIds  = uniqueNums((rows ?? []).map(r => (r as { chauffeur_id?: number }).chauffeur_id))
  const clIds  = uniqueNums((rows ?? []).map(r => (r as { client_id?: number }).client_id))

  // Fix Lot L (audit 26/05/2026) : 3 loadMap parallélisés (auparavant en série)
  const [vehMap, chMap, clMap] = await Promise.all([
    loadMap<{ id_vehicule:  number; immatriculation: string | null }>(vehIds, "vehicules",  "id_vehicule",  ["immatriculation"]),
    loadMap<{ id_chauffeur: number; nom:             string | null }>(chIds,  "chauffeurs", "id_chauffeur", ["nom"]),
    loadMap<{ id:           number; nom:             string | null }>(clIds,  "clients",    "id",           ["nom"]),
  ])

  // ── 5. Mapping final ────────────────────────────────────────────────────
  type Raw = {
    id: string; date_operation: string; type: "entree"|"sortie";
    montant: number | string; libelle: string; source: string;
    caisse:    { id: string; libelle: string; compte_syscohada_code: string | null } | null
    compte:    { id: string; libelle: string; compte_syscohada_code: string | null } | null
    categorie: { id: string; libelle: string; type: string; compte_syscohada_code: string | null } | null
    tiers:     { id: string; nom: string; compte_syscohada_code: string } | null
    vehicule_id: number | null
    chauffeur_id: number | null
    client_id: number | null
  }

  const items: FlowOperationItem[] = (rows ?? []).map(r => {
    const row = r as unknown as Raw
    const caisseOrCompte = row.caisse
      ? { id: row.caisse.id, libelle: row.caisse.libelle, code_syscohada: row.caisse.compte_syscohada_code, kind: "caisse" as const }
      : row.compte
        ? { id: row.compte.id, libelle: row.compte.libelle, code_syscohada: row.compte.compte_syscohada_code, kind: "compte" as const }
        : null
    return {
      id:        row.id,
      date_op:   row.date_operation,
      type:      row.type,
      montant:   Number(row.montant),
      libelle:   row.libelle,
      source:    row.source as FlowOperationItem["source"],
      caisse:    caisseOrCompte,
      categorie: row.categorie,
      tiers:     row.tiers,
      vehicule:  row.vehicule_id ? { id: row.vehicule_id, immatriculation: vehMap.get(row.vehicule_id)?.immatriculation ?? null } : null,
      chauffeur: row.chauffeur_id ? { id: row.chauffeur_id, nom: chMap.get(row.chauffeur_id)?.nom ?? null } : null,
      client:    row.client_id   ? { id: row.client_id,    nom: clMap.get(row.client_id)?.nom    ?? null } : null,
    }
  })

  // ── 6. Total sur la période (somme + count) sans pagination ────────────
  // Pour économiser un round-trip, si on a déjà tous les résultats (withLimit=false)
  // on calcule depuis `items`. Sinon, on lance une 2e requête agrégée.
  //
  // Fix Lot L (audit 26/05/2026) : suppression d'un SELECT mort qui chargeait
  // toutes les montants sans filtre puis jetait le résultat (`void aggRows`),
  // avant de relancer `aggregateAfterFilters` (le vrai agrégat). Économie :
  // 1 round-trip Supabase + 1 scan complet de la période par requête.
  let totalPeriod = 0
  let countPeriod = 0
  if (!withLimit) {
    totalPeriod = items.reduce((a, i) => a + i.montant, 0)
    countPeriod = items.length
  } else {
    const agg = await aggregateAfterFilters(kind, filters, from, to)
    totalPeriod = agg.sum
    countPeriod = agg.count
  }
  void ids

  return {
    data:         items,
    total:        count ?? items.length,
    total_period: totalPeriod,
    count_period: countPeriod,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function uniqueNums(arr: (number | null | undefined)[]): number[] {
  const set = new Set<number>()
  for (const n of arr) { if (typeof n === "number" && Number.isFinite(n)) set.add(n) }
  return Array.from(set)
}

async function loadMap<T extends Record<string, unknown>>(
  ids: number[],
  table: string,
  idField: string,
  fields: string[],
): Promise<Map<number, T>> {
  const out = new Map<number, T>()
  if (ids.length === 0) return out
  const sel = [idField, ...fields].join(", ")
  const { data } = await supabaseAdmin.from(table).select(sel).in(idField, ids)
  for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    out.set(r[idField] as number, r as T)
  }
  return out
}

/** Agrégat (somme + count) avec MÊMES filtres que le SELECT principal. */
export async function aggregateAfterFilters(
  kind: FlowKind, filters: FlowFilters, from: string, to: string,
): Promise<{ sum: number; count: number }> {
  const opType = kindToOpType(kind)
  let q = supabaseAdmin
    .from("operations")
    .select("montant", { count: "exact" })
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

  const { data, count, error } = await q
  if (error) throw error
  const sum = (data ?? []).reduce((a, r) => a + Number((r as { montant: number | string }).montant), 0)
  return { sum, count: count ?? 0 }
}
