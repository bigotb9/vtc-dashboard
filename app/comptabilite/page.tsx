"use client"

/**
 * /comptabilite — Écran 3 Phase 3 : Dashboard comptable (nouvelle racine).
 *
 * Vue agrégée. Période par défaut : Ce mois.
 * Layout :
 *   [Header — titre + tab périodes + actions]
 *   [HealthBanner] (full width)
 *   [KPIs × 4]    (grid 4 cols)
 *   [CA vs Dépenses 12 mois — 2/3]   [Donut entrées caisse — 1/3]
 *   [Top véhicules — 1/3]            [Dernières écritures — 1/3]   [Soldes — 1/3]
 *   [Bar dépenses par catégorie — full]
 *
 * La liste des opérations a migré vers /comptabilite/operations.
 */

export const dynamic = "force-dynamic"

import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/compta/DashboardHeader"
import { HealthBanner } from "@/components/compta/HealthBanner"
import { MissingProofBanner } from "@/components/compta/MissingProofBanner"
import { DashboardKpiCards } from "@/components/compta/DashboardKpiCards"
import { CaVsDepensesChart } from "@/components/compta/CaVsDepensesChart"
import { EntreesParCaisseDonut } from "@/components/compta/EntreesParCaisseDonut"
import { DepensesParCategorieBar } from "@/components/compta/DepensesParCategorieBar"
import { TopVehiculesCard } from "@/components/compta/TopVehiculesCard"
import { DernieresEcrituresCard } from "@/components/compta/DernieresEcrituresCard"
import { SoldesCaissesCard } from "@/components/compta/SoldesCaissesCard"
import { useDashboardStats } from "@/hooks/compta/useDashboardStats"
import type { PeriodKey } from "@/types/compta-ui"

// ─── Périodes prédéfinies (identique à /operations) ──────────────────────────

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

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ComptabiliteDashboardPage() {
  const router = useRouter()
  const params = useSearchParams()

  // Période active : période=tout → "tout", sinon match avec une période standard,
  // par défaut "ce_mois". Permet de partager l'URL avec un état précis.
  const period = useMemo<PeriodKey>(() => {
    const p = params.get("period")
    if (p === "tout" || p === "mois_prec" || p === "3_mois" || p === "ce_mois") return p
    return "ce_mois"
  }, [params])

  // Quand period === "tout", on demande explicitement l'agrégat all-time
  // (sinon le hook ne posait aucun query param et la route fallback sur
  // "mois courant"). On distingue les deux cas via le flag `all`.
  const range = useMemo(() => {
    if (period === "tout") return { all: true as const }
    return calcPeriodRange(period)
  }, [period])

  const { data, loading, error, refetch } = useDashboardStats(range)

  const handlePeriodChange = useCallback((p: PeriodKey) => {
    const qs = new URLSearchParams()
    qs.set("period", p)
    router.replace(`/comptabilite?${qs.toString()}`)
  }, [router])

  // Timestamp dernier refresh = quand on a une data → maintenant
  const lastRefreshIso = data ? new Date().toISOString() : null

  return (
    <div className="space-y-5">
      <DashboardHeader
        period={period}
        lastRefreshIso={lastRefreshIso}
        onPeriodChange={handlePeriodChange}
      />

      {/* Bannière santé */}
      <HealthBanner health={data?.health ?? null} loading={loading} />

      {/* Phase 4.x Vague 3 — alerte ops sortie+tiers sans justificatif */}
      <MissingProofBanner count={data?.health?.nb_ops_missing_proof ?? 0} loading={loading} />

      {/* KPIs */}
      <DashboardKpiCards kpis={data?.kpis ?? null} loading={loading} />

      {/* Erreur fetch */}
      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline hover:opacity-80">
            Réessayer
          </button>
        </div>
      )}

      {/* Grid principal : CA vs Dépenses 2/3 + Donut 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CaVsDepensesChart data={data?.ca_vs_depenses_12_mois ?? []} loading={loading} />
        </div>
        <div className="lg:col-span-1">
          <EntreesParCaisseDonut data={data?.entrees_par_caisse ?? []} loading={loading} />
        </div>
      </div>

      {/* Grid secondaire : 3 cartes égales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopVehiculesCard       rows={data?.top_vehicules         ?? []} loading={loading} />
        <DernieresEcrituresCard rows={data?.dernieres_ecritures   ?? []} loading={loading} />
        <SoldesCaissesCard      rows={data?.soldes_caisses_comptes ?? []} loading={loading} />
      </div>

      {/* Bar chart dépenses par catégorie (full width) */}
      <DepensesParCategorieBar data={data?.depenses_par_categorie ?? []} loading={loading} />
    </div>
  )
}
