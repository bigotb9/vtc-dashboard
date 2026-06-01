"use client"

/**
 * components/cockpit/CockpitKpis.tsx
 *
 * Zone 1 — Cockpit Boyah : cards KPI vitaux.
 * Grille responsive : 3 colonnes desktop / 1 mobile.
 *
 * Cards de base (toujours visibles, source /api/cockpit/kpis) :
 *   - cashflow_jour      : vert si > 0, rouge si < 0
 *   - activite_flotte    : couleur indigo neutre
 *   - vehicules_retard   : rouge si count > 0, neutre sinon
 *
 * Cards FINANCE (visibles uniquement si view_finances_cockpit, source
 * /api/cockpit/finances — données sensibles) :
 *   - marge_du_mois      : marge réelle du mois courant + variation vs préc.
 *   - loyers_a_verser    : loyers nets DUS ce mois + montant déjà versé
 *   - arriere_mois       : reste à verser ce mois (version minimale)
 */

import { Coins, Car, AlertTriangle, TrendingUp, Wallet, Briefcase } from "lucide-react"
import { formatMontant } from "@/lib/format/montant"
import type { Kpis, CockpitFinances } from "./types"

type Props = {
  data:    Kpis | null
  loading: boolean
  error:   string | null
  // ── Finance (optionnel : null/false si l'utilisateur n'a pas la permission)
  canFinances?:     boolean
  finances?:        CockpitFinances | null
  financesLoading?: boolean
  financesError?:   string | null
}

export default function CockpitKpis({
  data, loading, error,
  canFinances = false, finances = null, financesLoading = false, financesError = null,
}: Props) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
        Erreur KPIs : {error}
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-4 animate-pulse"
          >
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/5 mb-3" />
            <div className="h-7 w-32 rounded bg-gray-200 dark:bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  const cashflowPositive = data.cashflow_jour.value >= 0
  const retardActif      = data.vehicules_retard.count > 0

  return (
    <div className="space-y-3">
      {/* ── Cards de base (non sensibles) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Cashflow jour */}
        <Card
          icon={Coins}
          label="CASH FLOW JOUR"
          value={`${cashflowPositive ? "+" : "−"} ${formatMontant(data.cashflow_jour.value)} F`}
          sub={`Recettes ${formatMontant(data.cashflow_jour.recettes)} · Dépenses ${formatMontant(data.cashflow_jour.depenses)}`}
          tone={cashflowPositive ? "positive" : "negative"}
        />

        {/* Activité flotte */}
        <Card
          icon={Car}
          label="ACTIVITÉ FLOTTE"
          value={`${data.activite_flotte.courses_jour} / ${data.activite_flotte.objectif_jour}`}
          sub={`${data.activite_flotte.pourcentage}% de l'objectif courses du jour`}
          tone="neutral"
        />

        {/* Véhicules en retard */}
        <Card
          icon={AlertTriangle}
          label="VÉHICULES EN RETARD"
          value={`${data.vehicules_retard.count}`}
          sub={
            retardActif
              ? `${formatMontant(data.vehicules_retard.montant_du_total)} F dû · ${data.vehicules_retard.chauffeurs_a_contacter} à contacter`
              : "Tous les versements sont à jour"
          }
          tone={retardActif ? "negative" : "positive"}
        />
      </div>

      {/* ── Cards FINANCE (sensibles) — uniquement si permission ── */}
      {canFinances && (
        <FinanceCards
          finances={finances}
          loading={financesLoading}
          error={financesError}
        />
      )}
    </div>
  )
}

// ── Bloc des 3 cards finance (marge, loyers, arriéré) ───────────────────────
function FinanceCards({
  finances, loading, error,
}: {
  finances: CockpitFinances | null
  loading:  boolean
  error:    string | null
}) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
        Erreur finances : {error}
      </div>
    )
  }

  if (loading || !finances) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-4 animate-pulse"
          >
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/5 mb-3" />
            <div className="h-7 w-32 rounded bg-gray-200 dark:bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  const marge = finances.marge_mois.marge_reelle
  const margePositive = marge >= 0
  const variation = finances.variation_pct
  const variationLabel = variation != null
    ? ` · ${variation >= 0 ? "+" : ""}${variation}% vs mois préc.`
    : ""
  const margeTone = finances.marge_en_baisse || marge < 0 ? "negative" : margePositive ? "positive" : "neutral"

  const arriere = finances.arriere_mois_courant
  const arriereActif = arriere > 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* Marge du mois */}
      <Card
        icon={TrendingUp}
        label="MARGE DU MOIS"
        value={`${margePositive ? "+" : "−"} ${formatMontant(marge)} F`}
        sub={`Ce mois (à ce jour)${variationLabel}`}
        tone={margeTone}
      />

      {/* Loyers à verser ce mois */}
      <Card
        icon={Wallet}
        label="LOYERS À VERSER (MOIS)"
        value={`${formatMontant(finances.loyers_dus_ce_mois)} F`}
        sub={`Déjà versé : ${formatMontant(finances.verses_ce_mois)} F`}
        tone="neutral"
      />

      {/* Arriéré (mois courant) */}
      <Card
        icon={Briefcase}
        label="ARRIÉRÉ (MOIS)"
        value={`${formatMontant(arriere)} F`}
        sub={arriereActif ? "Reste à verser ce mois" : "À jour sur le mois"}
        tone={arriereActif ? "negative" : "positive"}
      />
    </div>
  )
}

type CardProps = {
  icon:   React.ElementType
  label:  string
  value:  string
  sub:    string
  tone:   "neutral" | "positive" | "negative"
}

function Card({ icon: Icon, label, value, sub, tone }: CardProps) {
  const borderClass = tone === "negative"
    ? "border-red-200 dark:border-red-500/30"
    : tone === "positive"
      ? "border-emerald-200/70 dark:border-emerald-500/20"
      : "border-gray-100 dark:border-[#1E2D45]"

  const valueClass = tone === "negative"
    ? "text-red-600 dark:text-red-400"
    : tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-gray-900 dark:text-white"

  const iconClass = tone === "negative"
    ? "text-red-500"
    : tone === "positive"
      ? "text-emerald-500"
      : "text-indigo-500"

  return (
    <div className={`rounded-2xl border ${borderClass} bg-white dark:bg-[#0D1424] p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-white/[0.04] flex items-center justify-center">
          <Icon size={14} className={iconClass} />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </p>
      </div>
      <p className={`text-[22px] leading-tight font-bold tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
    </div>
  )
}
