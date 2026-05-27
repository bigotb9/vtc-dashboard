"use client"

/**
 * 4 KPI cards de la liste catégories (Écran 6 §2.3) :
 *  - Total actives (violet)
 *  - Entrées (vert)
 *  - Sorties (rouge)
 *  - Sans usage (ambre)
 */

import { motion } from "framer-motion"
import { Folder, ArrowDownCircle, ArrowUpCircle, AlertCircle } from "lucide-react"
import type { CategorieListItem } from "@/types/compta-ui"

type Accent = "violet" | "emerald" | "red" | "amber"

const ACCENT_BAR: Record<Accent, string> = {
  violet:  "from-transparent via-[#8B5CF6] to-transparent",
  emerald: "from-transparent via-[#10B981] to-transparent",
  red:     "from-transparent via-[#F87171] to-transparent",
  amber:   "from-transparent via-[#F59E0B] to-transparent",
}
const ACCENT_ICON: Record<Accent, string> = {
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  red:     "from-red-400 to-rose-500 text-white shadow-red-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}

function Card({ title, value, sub, Icon, accent, index }: {
  title:  string
  value:  string
  sub?:   string
  Icon:   React.ElementType
  accent: Accent
  index:  number
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
  items:    CategorieListItem[]
  loading?: boolean
}

export function CategoriesKpis({ items, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }

  const actives  = items.filter(i => i.actif)
  const entrees  = actives.filter(i => i.sens === "credit")
  const sorties  = actives.filter(i => i.sens === "debit")
  const sansUsage = items.filter(i => (i.nb_operations ?? 0) === 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card title="Total actives"  value={String(actives.length)} sub="Catégories actives"        Icon={Folder}        accent="violet"  index={0} />
      <Card title="Entrées"        value={String(entrees.length)} sub="Sens crédit"               Icon={ArrowDownCircle} accent="emerald" index={1} />
      <Card title="Sorties"        value={String(sorties.length)} sub="Sens débit"                Icon={ArrowUpCircle}   accent="red"     index={2} />
      <Card title="Sans usage"     value={String(sansUsage.length)} sub="Aucune opération"        Icon={AlertCircle}   accent="amber"   index={3} />
    </div>
  )
}
