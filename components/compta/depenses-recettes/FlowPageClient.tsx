"use client"

/**
 * Client orchestrateur partagé pour /depenses-v2 et /recettes-v2
 * (Phase 4.x Vague 3.5 §3.2.4 + §4.4).
 *
 * Une seule source de vérité pour les filtres : query params URL.
 * Tous les changements de filtres passent par `updateFilters` qui pousse
 * l'état dans l'URL via `router.replace` (scroll: false).
 */

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  FileDown, Plus,
  Wallet, ListChecks, Users, TrendingDown, TrendingUp, BarChart3, Receipt,
} from "lucide-react"
import { PeriodBar, computePeriodRange } from "./PeriodBar"
import { KpiCard } from "./KpiCard"
import { EvolutionChart } from "./EvolutionChart"
import { RepartitionDonut } from "./RepartitionDonut"
import { FiltersBar } from "./FiltersBar"
import { OperationsTable } from "./OperationsTable"
import { ExportPdfModal } from "./ExportPdfModal"
import { useFlowData } from "@/hooks/compta/useFlowData"
import type {
  FlowFilters, FlowKind, FlowPeriodKey, FlowSource,
} from "@/types/compta-ui"

// ─── Helpers d'URL ─────────────────────────────────────────────────────────

function readFilters(p: URLSearchParams): FlowFilters {
  const csvStr = (key: string) => {
    const v = p.get(key)
    if (!v) return undefined
    const arr = v.split(",").filter(Boolean)
    return arr.length > 0 ? arr : undefined
  }
  const csvNum = (key: string) => {
    const a = csvStr(key); if (!a) return undefined
    return a.map(s => Number(s)).filter(Number.isFinite)
  }
  return {
    from:           p.get("from") ?? undefined,
    to:             p.get("to")   ?? undefined,
    cat_ids:        csvStr("cat_ids"),
    caisse_ids:     csvStr("caisse_ids"),
    vehicule_ids:   csvNum("vehicule_ids"),
    chauffeur_ids:  csvNum("chauffeur_ids"),
    tiers_ids:      csvStr("tiers_ids"),
    sources:        csvStr("sources") as FlowSource[] | undefined,
    montant_min:    p.get("montant_min") ? Number(p.get("montant_min")) : null,
    montant_max:    p.get("montant_max") ? Number(p.get("montant_max")) : null,
    search:         p.get("search") ?? undefined,
    page:           Math.max(1, parseInt(p.get("page") ?? "1", 10)),
    page_size:      Math.min(100, Math.max(1, parseInt(p.get("page_size") ?? "20", 10))),
    sort_by:        (p.get("sort_by") === "montant" ? "montant" : "date_op"),
    sort_order:     (p.get("sort_order") === "asc" ? "asc" : "desc"),
  }
}

function writeFilters(f: FlowFilters): string {
  const p = new URLSearchParams()
  if (f.from) p.set("from", f.from)
  if (f.to)   p.set("to",   f.to)
  if (f.cat_ids?.length)        p.set("cat_ids",       f.cat_ids.join(","))
  if (f.caisse_ids?.length)     p.set("caisse_ids",    f.caisse_ids.join(","))
  if (f.vehicule_ids?.length)   p.set("vehicule_ids",  f.vehicule_ids.join(","))
  if (f.chauffeur_ids?.length)  p.set("chauffeur_ids", f.chauffeur_ids.join(","))
  if (f.tiers_ids?.length)      p.set("tiers_ids",     f.tiers_ids.join(","))
  if (f.sources?.length)        p.set("sources",       f.sources.join(","))
  if (f.montant_min != null)    p.set("montant_min",   String(f.montant_min))
  if (f.montant_max != null)    p.set("montant_max",   String(f.montant_max))
  if (f.search)                 p.set("search",        f.search)
  if (f.page && f.page > 1)     p.set("page",          String(f.page))
  if (f.sort_by && f.sort_by !== "date_op")     p.set("sort_by",     f.sort_by)
  if (f.sort_order && f.sort_order !== "desc")  p.set("sort_order",  f.sort_order)
  return p.toString()
}

function rangeToPeriod(filters: FlowFilters): FlowPeriodKey {
  if (!filters.from || !filters.to) return "this_month"
  for (const key of ["today", "this_week", "this_month", "previous_month", "three_months", "year"] as const) {
    const r = computePeriodRange(key)
    if (r.from === filters.from && r.to === filters.to) return key
  }
  return "custom"
}

// ─── Composant principal ───────────────────────────────────────────────────

type Props = { kind: FlowKind }

export function FlowPageClient({ kind }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  // Filtres lus depuis l'URL (avec fallback "this_month")
  const filters = useMemo(() => {
    const f = readFilters(params)
    if (!f.from || !f.to) {
      const r = computePeriodRange("this_month")
      f.from = r.from; f.to = r.to
    }
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()])

  const period = useMemo(() => rangeToPeriod(filters), [filters])

  const route = kind === "depenses" ? "/depenses-v2" : "/recettes-v2"

  const updateFilters = useCallback((next: FlowFilters) => {
    const qs = writeFilters(next)
    router.replace(`${route}${qs ? "?" + qs : ""}`, { scroll: false })
  }, [router, route])

  const resetFilters = useCallback(() => {
    const r = computePeriodRange("this_month")
    router.replace(`${route}?from=${r.from}&to=${r.to}`, { scroll: false })
  }, [router, route])

  const { list, stats, loading, loadingMore, error, refetch } = useFlowData(kind, filters)

  const [exportOpen, setExportOpen] = useState(false)

  // ── Couleurs thématiques ─────────────────────────────────────────────────
  const isDep = kind === "depenses"
  const accentText = isDep ? "text-red-400" : "text-emerald-400"
  const accentBg   = isDep
    ? "from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/30"
    : "from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-emerald-500/30"
  const ctaHref    = isDep ? "/depenses/create" : "/comptabilite/operations/nouveau?type=entree"
  const ctaLabel   = isDep ? "Ajouter une dépense" : "Ajouter une recette"
  const titre      = isDep ? "Dépenses" : "Recettes"

  return (
    <div className="space-y-5">
      {/* Header */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-300 transition">Accueil</Link>
        <span className="text-gray-700">/</span>
        <span className="text-gray-300">{titre}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white leading-none">{titre}</h1>
          <p className="text-sm text-gray-400 mt-2">
            {isDep
              ? "Suivi unifié des sorties (véhicules, salaires, fournisseurs, reversements, autres)."
              : "Suivi unifié des entrées (Wave, versements, apports, autres)."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodBar
            kind={kind}
            period={period}
            range={{ from: filters.from ?? "", to: filters.to ?? "" }}
            onChange={(p, r) => updateFilters({ ...filters, from: r.from, to: r.to, page: 1 })}
          />
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1E2D45] bg-[#1A2235] text-sm font-semibold hover:bg-[#22304a] transition ${accentText}`}
          >
            <FileDown size={14} /> PDF
          </button>
          <Link
            href={ctaHref}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r ${accentBg} text-white text-sm font-semibold shadow-md transition`}
          >
            <Plus size={14} /> {ctaLabel}
          </Link>
        </div>
      </div>

      {/* Erreur globale */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
          Erreur : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          variant="number"
          label={isDep ? "Total dépenses" : "Total recettes"}
          value={stats?.total_period ?? 0}
          prefix={isDep ? "−" : "+"}
          trendPct={stats?.trend_pct ?? null}
          trendUpIsGood={!isDep}
          accent={isDep ? "red" : "green"}
          Icon={isDep ? TrendingDown : TrendingUp}
          loading={loading}
        />
        <KpiCard
          variant="toplist"
          label="Top 3 catégories"
          rows={(stats?.top_categories ?? []).map(c => ({ label: c.libelle, total: c.total }))}
          accent="amber"
          Icon={ListChecks}
          loading={loading}
        />
        <KpiCard
          variant="toplist"
          label={isDep ? "Top 3 tiers" : "Top 3 chauffeurs"}
          rows={((isDep ? stats?.top_tiers : stats?.top_chauffeurs) ?? []).map(c => ({ label: c.libelle, total: c.total }))}
          accent="cyan"
          Icon={isDep ? Users : Receipt}
          loading={loading}
        />
        <KpiCard
          variant="number"
          label="Moyenne / jour"
          value={stats?.avg_per_day ?? 0}
          note={stats ? `Sur ${stats.count_days} jour${stats.count_days > 1 ? "s" : ""}` : null}
          accent={isDep ? "violet" : "blue"}
          Icon={Wallet}
          loading={loading}
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EvolutionChart
            data={stats?.evolution_monthly ?? []}
            kind={kind}
            loading={loading}
          />
        </div>
        <div className="lg:col-span-1">
          {isDep ? (
            <RepartitionDonut
              title="Répartition par catégorie"
              slices={stats?.repartition_categories ?? []}
              loading={loading}
            />
          ) : (
            <RepartitionDonut
              title="Répartition par source"
              slices={stats?.repartition_sources ?? []}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* Filtres */}
      <FiltersBar
        kind={kind}
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {/* Table */}
      <OperationsTable
        kind={kind}
        rows={list?.data ?? []}
        total={list?.total ?? 0}
        filters={filters}
        loading={loading}
        loadingMore={loadingMore}
        onPageChange={p => updateFilters({ ...filters, page: p })}
        onSortChange={col => {
          const newOrder: "asc"|"desc" = filters.sort_by === col && filters.sort_order === "desc" ? "asc" : "desc"
          updateFilters({ ...filters, sort_by: col, sort_order: newOrder })
        }}
      />

      {/* Footnote BarChart3 icon for cohérence import */}
      <span className="hidden"><BarChart3 size={1} /></span>

      <ExportPdfModal
        open={exportOpen}
        kind={kind}
        filters={filters}
        onClose={() => setExportOpen(false)}
      />
    </div>
  )
}
