"use client"

/**
 * components/cockpit/CockpitKpis.tsx
 *
 * Zone 1 — Cockpit Boyah : 4 cards KPI vitaux.
 * Grille responsive : 4 colonnes desktop / 2 tablette / 1 mobile.
 *
 * Code couleur :
 *   - cashflow_jour      : vert si > 0, rouge si < 0
 *   - activite_flotte    : couleur indigo neutre
 *   - vehicules_retard   : rouge si count > 0, neutre sinon
 *   - dette_clients      : neutre (stub à 0 en Étape 2)
 */

import { Coins, Car, AlertTriangle, Briefcase } from "lucide-react"
import { formatMontant } from "@/lib/format/montant"
import type { Kpis } from "./types"

type Props = {
  data:    Kpis | null
  loading: boolean
  error:   string | null
}

export default function CockpitKpis({ data, loading, error }: Props) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
        Erreur KPIs : {error}
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* Dette clients */}
      <Card
        icon={Briefcase}
        label="DETTE CLIENTS"
        value={`${formatMontant(data.dette_clients.montant_total)} F`}
        sub={
          data.dette_clients.jours_horizon != null
            ? `Horizon remboursement : ${data.dette_clients.jours_horizon}j`
            : "Calcul en cours (placeholder Étape 2)"
        }
        tone="neutral"
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
