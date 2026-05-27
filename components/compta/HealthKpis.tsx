"use client"

/**
 * 4 KPIs globaux de l'audit (Écran 8 §2.1).
 * Total débit · Total crédit · Écart · Nombre d'anomalies.
 */

import { motion } from "framer-motion"
import { ArrowDownToLine, ArrowUpFromLine, Scale, AlertTriangle } from "lucide-react"
import type { HealthDetailed } from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}

type Accent = "violet" | "emerald" | "cyan" | "red" | "amber"
const ACCENT_BAR: Record<Accent, string> = {
  violet:  "from-transparent via-[#8B5CF6] to-transparent",
  emerald: "from-transparent via-[#10B981] to-transparent",
  cyan:    "from-transparent via-[#06B6D4] to-transparent",
  red:     "from-transparent via-[#F87171] to-transparent",
  amber:   "from-transparent via-[#F59E0B] to-transparent",
}
const ACCENT_ICON: Record<Accent, string> = {
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  cyan:    "from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
  red:     "from-red-400 to-rose-500 text-white shadow-red-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}

function Card({ title, value, unit, sub, Icon, accent, index, danger }: {
  title: string; value: string; unit?: string; sub?: string
  Icon: React.ElementType; accent: Accent; index: number; danger?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)" }}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />
      <div className="flex items-start justify-between gap-3 relative">
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-2 truncate">{title}</p>
          <div className={`font-black tracking-tight leading-none font-numeric text-[1.6rem] flex items-baseline gap-1 ${
            danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"
          }`}>
            {value}
            {unit && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600">{unit}</span>}
          </div>
          {sub && <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1.5 font-medium">{sub}</p>}
        </div>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg ${ACCENT_ICON[accent]}`}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  )
}

type Props = {
  data:     HealthDetailed | null
  loading?: boolean
}

export function HealthKpis({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }
  const g = data.global

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card title="Total débit"   value={fmtCompact(g.total_debit)}  unit="F" sub={`${fmt(g.nb_lignes)} lignes`} Icon={ArrowDownToLine} accent="emerald" index={0} />
      <Card title="Total crédit"  value={fmtCompact(g.total_credit)} unit="F" sub={`${fmt(g.nb_ecritures)} écritures`} Icon={ArrowUpFromLine}  accent="violet"  index={1} />
      <Card title="Écart"         value={g.ecart === 0 ? "0" : fmtCompact(Math.abs(g.ecart))} unit="F" sub={g.ecart === 0 ? "Comptabilité équilibrée" : "Écart à investiguer"} Icon={Scale} accent={g.ecart === 0 ? "cyan" : "red"} index={2} danger={g.ecart !== 0} />
      <Card title="Anomalies"     value={String(g.nb_anomalies)} sub={g.nb_anomalies === 0 ? "Aucune anomalie" : "À investiguer"} Icon={AlertTriangle} accent={g.nb_anomalies === 0 ? "emerald" : "amber"} index={3} danger={g.nb_anomalies > 0} />
    </div>
  )
}
