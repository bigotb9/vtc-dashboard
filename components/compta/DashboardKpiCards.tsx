"use client"

/**
 * Grille 4 KPI cards du Dashboard (Écran 3 Phase 3).
 *
 * KPI : CA · Dépenses · Résultat net · Trésorerie (tous temps)
 * Avec trend % vs période précédente de même durée.
 *
 * Référence : doc Phase 3 Écran 3 §4.1.
 */

import { motion } from "framer-motion"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react"
import type { DashboardKpis } from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant
const fmtMontant = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1).replace(".0", "")}k`
  return fmt(n)
}

type Accent = "violet" | "emerald" | "red" | "cyan" | "amber"

const ACCENT_BAR: Record<Accent, string> = {
  violet:  "from-transparent via-[#8B5CF6] to-transparent",
  emerald: "from-transparent via-[#10B981] to-transparent",
  red:     "from-transparent via-[#F87171] to-transparent",
  cyan:    "from-transparent via-[#06B6D4] to-transparent",
  amber:   "from-transparent via-[#F59E0B] to-transparent",
}

const ACCENT_ICON: Record<Accent, string> = {
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  red:     "from-red-400 to-rose-500 text-white shadow-red-500/30",
  cyan:    "from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}

function TrendBadge({ pct, inverseColor = false }: { pct: number | null; inverseColor?: boolean }) {
  if (pct === null) return null
  const isNeutral = Math.abs(pct) < 0.5
  const isUp      = pct >= 0
  const Icon  = isNeutral ? Minus : isUp ? ArrowUpRight : ArrowDownRight
  const color = isNeutral
    ? "text-gray-400 bg-gray-500/10"
    : (isUp !== inverseColor)
      ? "text-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/15"
      : "text-red-500 bg-red-500/10 ring-1 ring-red-500/15"
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
      <Icon size={10} strokeWidth={2.5} />
      {isNeutral ? "stable" : `${isUp ? "+" : ""}${pct.toFixed(1).replace(".0", "")}%`}
    </span>
  )
}

function KpiCard({
  title, value, unit, sub, Icon, accent, trend, trendLabel, inverseColor, index,
}: {
  title:        string
  value:        string
  unit?:        string
  sub?:         string
  Icon:         React.ElementType
  accent:       Accent
  trend?:       number | null
  trendLabel?:  string
  inverseColor?: boolean
  index:        number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)" }}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />
      <div className="flex items-start justify-between gap-3 relative">
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-2 truncate">
            {title}
          </p>
          <div className="font-black tracking-tight text-gray-900 dark:text-white leading-none font-numeric text-[1.6rem] flex items-baseline gap-1">
            {value}
            {unit && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600">{unit}</span>}
          </div>
          {sub && (
            <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1.5 font-medium">{sub}</p>
          )}
          {trend !== undefined && (
            trend === null ? (
              <div className="flex items-center gap-1.5 mt-3">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-gray-400 bg-gray-500/10">—</span>
                {trendLabel && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">{trendLabel}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-3">
                <TrendBadge pct={trend} inverseColor={inverseColor} />
                {trendLabel && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">{trendLabel}</span>
                )}
              </div>
            )
          )}
        </div>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg ${ACCENT_ICON[accent]}`}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  )
}

type Props = {
  kpis:     DashboardKpis | null
  loading?: boolean
}

export function DashboardKpiCards({ kpis, loading }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[140px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse"
          />
        ))}
      </div>
    )
  }

  const trendLabel = "vs préc."

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        title="Chiffre d'affaires"
        value={fmtMontant(kpis.ca)}
        unit="F"
        Icon={ArrowDownToLine}
        accent="emerald"
        trend={kpis.ca_trend_pct}
        trendLabel={trendLabel}
        index={0}
      />
      <KpiCard
        title="Dépenses"
        value={fmtMontant(kpis.depenses)}
        unit="F"
        Icon={ArrowUpFromLine}
        accent="red"
        trend={kpis.depenses_trend_pct}
        trendLabel={trendLabel}
        inverseColor
        index={1}
      />
      <KpiCard
        title="Résultat net"
        value={`${kpis.resultat_net >= 0 ? "+" : "−"}${fmtMontant(Math.abs(kpis.resultat_net))}`}
        unit="F"
        sub={kpis.marge_pct !== null ? `Marge ${kpis.marge_pct.toFixed(1).replace(".0", "")} %` : undefined}
        Icon={TrendingUp}
        accent={kpis.resultat_net >= 0 ? "violet" : "amber"}
        trend={kpis.resultat_trend_pct}
        trendLabel={trendLabel}
        index={2}
      />
      <KpiCard
        title="Trésorerie"
        value={fmtMontant(kpis.tresorerie)}
        unit="F"
        sub="Caisses + comptes"
        Icon={Wallet}
        accent="cyan"
        trend={kpis.tresorerie_trend_pct}
        trendLabel="vs T-12mois"
        index={3}
      />
    </div>
  )
}
