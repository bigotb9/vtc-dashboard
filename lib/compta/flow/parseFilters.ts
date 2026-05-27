/**
 * Parsing des query params filtres pour les endpoints /depenses et /recettes
 * (Phase 4.x Vague 3.5 §3.1.1).
 *
 * Reçoit les `URLSearchParams` et retourne un objet `FlowFilters` typé +
 * la plage de dates effective (from/to).
 */

import type { FlowFilters, FlowKind, FlowSource } from "@/types/compta-ui"

const SOURCES_VALID: ReadonlyArray<FlowSource> = [
  "manuel", "recette_wave", "depense_vehicule", "versement_client",
  "transfert_interne", "dotation_amort", "import_csv",
]

function csvString(v: string | null): string[] | undefined {
  if (!v) return undefined
  const arr = v.split(",").map(s => s.trim()).filter(Boolean)
  return arr.length > 0 ? arr : undefined
}

function csvInt(v: string | null): number[] | undefined {
  const a = csvString(v)
  if (!a) return undefined
  const nums = a.map(s => Number(s)).filter(n => Number.isFinite(n))
  return nums.length > 0 ? nums : undefined
}

function csvSources(v: string | null): FlowSource[] | undefined {
  const a = csvString(v)
  if (!a) return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = a.filter(s => (SOURCES_VALID as any).includes(s)) as FlowSource[]
  return arr.length > 0 ? arr : undefined
}

function maybeNum(v: string | null): number | null | undefined {
  if (v === null || v === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function parseFilters(url: URL): FlowFilters {
  const p = url.searchParams
  return {
    from:         p.get("from")        ?? undefined,
    to:           p.get("to")          ?? undefined,
    cat_ids:      csvString(p.get("cat_ids")),
    caisse_ids:   csvString(p.get("caisse_ids")),
    vehicule_ids: csvInt(p.get("vehicule_ids")),
    chauffeur_ids:csvInt(p.get("chauffeur_ids")),
    tiers_ids:    csvString(p.get("tiers_ids")),
    sources:      csvSources(p.get("sources")),
    montant_min:  maybeNum(p.get("montant_min")) ?? null,
    montant_max:  maybeNum(p.get("montant_max")) ?? null,
    search:       p.get("search") ?? undefined,
    page:         Math.max(1, parseInt(p.get("page") ?? "1", 10)),
    page_size:    Math.min(100, Math.max(1, parseInt(p.get("page_size") ?? "20", 10))),
    sort_by:      (p.get("sort_by") === "montant" ? "montant" : "date_op"),
    sort_order:   (p.get("sort_order") === "asc" ? "asc" : "desc"),
  }
}

/** Plage de dates avec fallback "mois courant" si non fournie. */
export function ensureDateRange(filters: FlowFilters): { from: string; to: string } {
  if (filters.from && filters.to) return { from: filters.from, to: filters.to }
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const y = d.getFullYear()
  const m = d.getMonth()
  const start = `${y}-${pad(m + 1)}-01`
  const last  = new Date(y, m + 1, 0)
  const end   = `${y}-${pad(m + 1)}-${pad(last.getDate())}`
  return { from: start, to: end }
}

/** Détermine si on travaille sur les sorties ou entrées selon le path. */
export function kindToOpType(kind: FlowKind): "sortie" | "entree" {
  return kind === "depenses" ? "sortie" : "entree"
}
