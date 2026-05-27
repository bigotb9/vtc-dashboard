"use client"

/**
 * /comptabilite/operations — Écran 1 Phase 3 (anciennement /comptabilite).
 *
 * Liste des opérations comptables — orchestre :
 *   - Header (titre + tab périodes + actions PDF/Ajouter)
 *   - OperationsKpiCards (4 KPI avec liserés)
 *   - OperationsFilters (recherche + filtres)
 *   - OperationsTable (paginée + responsive)
 *   - Pagination
 *
 * Note Phase 3 Écran 3 : la racine /comptabilite est désormais le Dashboard.
 * La liste a migré ici pour libérer la racine.
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, FileDown, Plus, ChevronLeft, ChevronRight, ChevronLeft as ArrowLeft, Loader2 } from "lucide-react"
import { OperationsKpiCards } from "@/components/compta/OperationsKpiCards"
import { OperationsFilters } from "@/components/compta/OperationsFilters"
import { OperationsTable } from "@/components/compta/OperationsTable"
import { useOperations } from "@/hooks/compta/useOperations"
import { useOperationsStats } from "@/hooks/compta/useOperationsStats"
import { useGenerateExport } from "@/hooks/compta/useGenerateExport"
import { toast } from "@/lib/toast"
import type { OperationsFilters as OperationsFiltersT, SourceOperation, StatutOperation, TypeOperation } from "@/types/compta-ui"

const ROUTE = "/comptabilite/operations"

// ─── Périodes prédéfinies ────────────────────────────────────────────────────

type PeriodKey = "ce_mois" | "mois_prec" | "3_mois" | "tout"

function calcPeriodRange(key: PeriodKey): { date_from?: string; date_to?: string } {
  const today = new Date()
  const y     = today.getFullYear()
  const m     = today.getMonth()
  const pad   = (n: number) => String(n).padStart(2, "0")
  const iso   = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (key === "ce_mois") {
    const start = new Date(y, m, 1)
    const end   = new Date(y, m + 1, 0)
    return { date_from: iso(start), date_to: iso(end) }
  }
  if (key === "mois_prec") {
    const start = new Date(y, m - 1, 1)
    const end   = new Date(y, m, 0)
    return { date_from: iso(start), date_to: iso(end) }
  }
  if (key === "3_mois") {
    const start = new Date(y, m - 2, 1)
    const end   = new Date(y, m + 1, 0)
    return { date_from: iso(start), date_to: iso(end) }
  }
  return {}
}

// ─── Lecture / écriture des query params URL ────────────────────────────────

function readFiltersFromUrl(params: URLSearchParams): OperationsFiltersT {
  const statuts = params.get("statut")?.split(",").filter(Boolean) as StatutOperation[] | undefined
  // Phase 4.x Vague 2 correctif §2.2 — filtre tiers_ids (CSV)
  const tiersIdsRaw = params.get("tiers_ids")
  const tiersIds = tiersIdsRaw ? tiersIdsRaw.split(",").filter(Boolean) : undefined
  return {
    type:         (params.get("type")   as TypeOperation)   || undefined,
    source:       (params.get("source") as SourceOperation) || undefined,
    statuts:      statuts && statuts.length > 0 ? statuts : undefined,
    categorie_id: params.get("categorie_id") || undefined,
    caisse_id:    params.get("caisse_id")    || undefined,
    compte_id:    params.get("compte_id")    || undefined,
    tiers_ids:    tiersIds,
    date_from:    params.get("date_from")    || undefined,
    date_to:      params.get("date_to")      || undefined,
    search:       params.get("search")       || undefined,
    sort_by:      (params.get("sort_by")    as OperationsFiltersT["sort_by"])    || "date_operation",
    sort_order:   (params.get("sort_order") as OperationsFiltersT["sort_order"]) || "desc",
    page:         Number(params.get("page")      || "1"),
    page_size:    Number(params.get("page_size") || "50"),
  }
}

function writeFiltersToUrl(f: OperationsFiltersT, opts?: { forcePeriodAll?: boolean }): string {
  const p = new URLSearchParams()
  if (f.type)         p.set("type", f.type)
  if (f.source)       p.set("source", f.source)
  if (f.statuts && f.statuts.length > 0) p.set("statut", f.statuts.join(","))
  if (f.categorie_id) p.set("categorie_id", f.categorie_id)
  if (f.caisse_id)    p.set("caisse_id", f.caisse_id)
  if (f.compte_id)    p.set("compte_id", f.compte_id)
  // Phase 4.x Vague 2 correctif §2.2 — filtre tiers
  if (f.tiers_ids && f.tiers_ids.length > 0) p.set("tiers_ids", f.tiers_ids.join(","))
  if (f.date_from)    p.set("date_from", f.date_from)
  if (f.date_to)      p.set("date_to", f.date_to)
  if (f.search)       p.set("search", f.search)
  if (f.sort_by)      p.set("sort_by", f.sort_by)
  if (f.sort_order)   p.set("sort_order", f.sort_order)
  if (f.page && f.page !== 1) p.set("page", String(f.page))
  if (f.page_size && f.page_size !== 50) p.set("page_size", String(f.page_size))
  if (opts?.forcePeriodAll || (!f.date_from && !f.date_to)) {
    p.set("period", "tout")
  }
  return p.toString()
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ComptabiliteOperationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = useMemo<OperationsFiltersT>(() => {
    const f = readFiltersFromUrl(searchParams)
    const periodParam = searchParams.get("period")
    if (!f.date_from && !f.date_to && periodParam !== "tout") {
      const r = calcPeriodRange("ce_mois")
      f.date_from = r.date_from
      f.date_to   = r.date_to
    }
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  const period = useMemo<PeriodKey>(() => {
    if (!filters.date_from && !filters.date_to) return "tout"
    for (const key of ["ce_mois", "mois_prec", "3_mois"] as const) {
      const r = calcPeriodRange(key)
      if (r.date_from === filters.date_from && r.date_to === filters.date_to) return key
    }
    return "tout"
  }, [filters.date_from, filters.date_to])

  const updateFilters = useCallback((next: OperationsFiltersT) => {
    const qs = writeFiltersToUrl(next)
    router.replace(`${ROUTE}${qs ? "?" + qs : ""}`)
  }, [router])

  const handlePeriodChange = useCallback((p: PeriodKey) => {
    const r = calcPeriodRange(p)
    const forceAll = p === "tout"
    const next: OperationsFiltersT = { ...filters, date_from: r.date_from, date_to: r.date_to, page: 1 }
    const qs = writeFiltersToUrl(next, { forcePeriodAll: forceAll })
    router.replace(`${ROUTE}${qs ? "?" + qs : ""}`)
  }, [filters, router])

  const handleSortChange = useCallback((col: NonNullable<OperationsFiltersT["sort_by"]>) => {
    const sameCol = filters.sort_by === col
    const newOrder: "asc" | "desc" = sameCol && filters.sort_order === "desc" ? "asc" : "desc"
    updateFilters({ ...filters, sort_by: col, sort_order: newOrder })
  }, [filters, updateFilters])

  const handleReset = useCallback(() => {
    router.replace(ROUTE)
  }, [router])

  const ops   = useOperations(filters)
  const stats = useOperationsStats(filters)

  const totalPages = ops.data ? Math.max(1, Math.ceil(ops.data.total / (filters.page_size ?? 50))) : 1
  const currentPage = filters.page ?? 1

  // ── Export Grand Livre filtré (Phase 4 §3.6) ──────────────────────────────
  const { generate, loading: exporting, currentType } = useGenerateExport()
  const exportingGl = exporting && currentType === "grand-livre"

  const handleExportPdf = useCallback(async () => {
    // Fallback : si "tout" sélectionné (pas de dates), utiliser année courante
    let dateFrom = filters.date_from
    let dateTo   = filters.date_to
    if (!dateFrom || !dateTo) {
      const d   = new Date()
      const y   = d.getFullYear()
      const pad = (n: number) => String(n).padStart(2, "0")
      const last = new Date(y, d.getMonth() + 1, 0)
      dateFrom = `${y}-01-01`
      dateTo   = `${y}-${pad(d.getMonth() + 1)}-${pad(last.getDate())}`
      toast.info("Période 'Tout' : export limité à l'année courante")
    }
    const res = await generate("grand-livre", { date_from: dateFrom, date_to: dateTo })
    if (res.ok) toast.success("Grand Livre téléchargé")
    else        toast.error(res.error)
  }, [filters.date_from, filters.date_to, generate])

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Accueil
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Comptabilité
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Opérations</span>
      </nav>

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/comptabilite"
            title="Retour au dashboard"
            className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-500/40 transition shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">Opérations comptables</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              {ops.data?.total ?? "…"} écritures · exercice 2026
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
            {([
              { key: "ce_mois",   label: "Ce mois" },
              { key: "mois_prec", label: "Mois préc." },
              { key: "3_mois",    label: "3 mois" },
              { key: "tout",      label: "Tout" },
            ] as { key: PeriodKey; label: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => handlePeriodChange(t.key)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  period === t.key
                    ? "bg-white dark:bg-white/[0.08] text-violet-600 dark:text-violet-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportPdf}
            disabled={exportingGl}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/[0.08] text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/[0.14] transition disabled:opacity-60 disabled:cursor-not-allowed"
            title="Exporter le Grand Livre PDF sur la période filtrée"
          >
            {exportingGl
              ? <Loader2 size={14} className="animate-spin" />
              : <FileDown size={14} />
            }
            {exportingGl ? "Génération…" : "Exporter en PDF"}
          </button>
          <Link
            href="/comptabilite/operations/nouveau"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 transition"
          >
            <Plus size={14} />
            Ajouter
          </Link>
        </div>
      </div>

      {/* KPI */}
      <OperationsKpiCards stats={stats.data} loading={stats.loading} />

      {/* FILTRES */}
      <OperationsFilters
        filters={filters}
        onChange={updateFilters}
        onReset={handleReset}
      />

      {/* TABLE */}
      <OperationsTable
        rows={ops.data?.data ?? []}
        loading={ops.loading}
        total={ops.data?.total ?? 0}
        sortBy={filters.sort_by ?? "date_operation"}
        sortOrder={filters.sort_order ?? "desc"}
        onSortChange={handleSortChange}
      />

      {/* PAGINATION */}
      {ops.data && ops.data.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Affichage{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
              {((currentPage - 1) * (filters.page_size ?? 50)) + 1}
              –
              {Math.min(currentPage * (filters.page_size ?? 50), ops.data.total)}
            </span>{" "}
            sur{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{ops.data.total}</span>
          </p>

          <div className="flex items-center gap-2">
            <select
              value={filters.page_size ?? 50}
              onChange={e => updateFilters({ ...filters, page_size: Number(e.target.value), page: 1 })}
              className="bg-gray-50 dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 rounded-md px-2 py-1 text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-gray-500 dark:text-gray-400">/page</span>

            <button
              onClick={() => updateFilters({ ...filters, page: Math.max(1, currentPage - 1) })}
              disabled={currentPage <= 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-white/[0.08] text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums px-2">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => updateFilters({ ...filters, page: Math.min(totalPages, currentPage + 1) })}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-white/[0.08] text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Erreur fetch */}
      {ops.error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {ops.error}.{" "}
          <button onClick={() => ops.refetch()} className="font-semibold underline hover:opacity-80">
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}
