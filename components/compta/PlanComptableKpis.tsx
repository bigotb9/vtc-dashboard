"use client"

/**
 * 4 KPIs globaux (Écran 10 §2.3) :
 *  Total comptes (violet) · Utilisés (vert) · Classes présentes (cyan) · Disponibles (ambre)
 */

import { motion } from "framer-motion"
import { BookOpen, CheckCircle, Layers, Circle } from "lucide-react"
import type { PlanComptableStats } from "@/types/compta-ui"

type Accent = "violet" | "emerald" | "cyan" | "amber"

const ACCENT_BAR: Record<Accent, string> = {
  violet:  "from-transparent via-[#8B5CF6] to-transparent",
  emerald: "from-transparent via-[#10B981] to-transparent",
  cyan:    "from-transparent via-[#06B6D4] to-transparent",
  amber:   "from-transparent via-[#F59E0B] to-transparent",
}
const ACCENT_ICON: Record<Accent, string> = {
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  cyan:    "from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}

function Card({ title, value, sub, Icon, accent, index }: {
  title: string; value: string; sub?: string; Icon: React.ElementType; accent: Accent; index: number
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
          <div className="font-black tracking-tight text-gray-900 dark:text-white leading-none font-numeric text-[1.6rem]">
            {value}
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
  stats:    PlanComptableStats | null
  loading?: boolean
}

export function PlanComptableKpis({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
      <Card title="Total comptes" value={String(stats.total_comptes)}     sub="Plan complet"             Icon={BookOpen}    accent="violet"  index={0} />
      <Card title="Utilisés"      value={String(stats.nb_utilises)}       sub="Référencés dans Boyah"    Icon={CheckCircle} accent="emerald" index={1} />
      <Card title="Classes"       value={String(stats.classes_presentes.length)} sub="Couvertes par le plan" Icon={Layers}    accent="cyan"    index={2} />
      <Card title="Disponibles"   value={String(stats.nb_disponibles)}    sub="Non utilisés"             Icon={Circle}      accent="amber"   index={3} />
    </div>
  )
}
