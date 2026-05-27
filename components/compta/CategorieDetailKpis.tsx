"use client"

/**
 * 4 KPIs locaux de la page détail catégorie (Écran 6 §3.3) :
 *  - Volume cumulé (vert si entrée, rouge si sortie)
 *  - Opérations (violet)
 *  - Montant moyen (cyan)
 *  - Dernière utilisation (ambre)
 */

import { motion } from "framer-motion"
import { TrendingUp, Activity, Calculator, CalendarClock } from "lucide-react"
import type { CategorieDetail } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}
const fmtDate = (s: string | null) => {
  if (!s) return "—"
  const d = new Date(s + "T00:00:00")
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })
    : s
}

type Accent = "emerald" | "red" | "violet" | "cyan" | "amber"

const ACCENT_BAR: Record<Accent, string> = {
  emerald: "from-transparent via-[#10B981] to-transparent",
  red:     "from-transparent via-[#F87171] to-transparent",
  violet:  "from-transparent via-[#8B5CF6] to-transparent",
  cyan:    "from-transparent via-[#06B6D4] to-transparent",
  amber:   "from-transparent via-[#F59E0B] to-transparent",
}
const ACCENT_ICON: Record<Accent, string> = {
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  red:     "from-red-400 to-rose-500 text-white shadow-red-500/30",
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  cyan:    "from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}

function Card({ title, value, unit, sub, Icon, accent, index }: {
  title: string; value: string; unit?: string; sub?: string
  Icon: React.ElementType; accent: Accent; index: number
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
          <div className="font-black tracking-tight text-gray-900 dark:text-white leading-none font-numeric text-[1.6rem] flex items-baseline gap-1">
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
  detail:   CategorieDetail | null
  loading?: boolean
}

export function CategorieDetailKpis({ detail, loading }: Props) {
  if (loading || !detail) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }

  const isCredit = detail.sens === "credit"

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        title="Volume cumulé"
        value={fmtCompact(detail.volume_cumule)}
        unit="F"
        Icon={TrendingUp}
        accent={isCredit ? "emerald" : "red"}
        index={0}
      />
      <Card
        title="Opérations"
        value={String(detail.nb_operations)}
        sub="Statut validé"
        Icon={Activity}
        accent="violet"
        index={1}
      />
      <Card
        title="Montant moyen"
        value={fmtCompact(detail.montant_moyen)}
        unit="F"
        sub={detail.nb_operations > 0 ? `Sur ${detail.nb_operations} op${detail.nb_operations > 1 ? "s" : ""}` : "Aucune"}
        Icon={Calculator}
        accent="cyan"
        index={2}
      />
      <Card
        title="Dernière utilisation"
        value={detail.derniere_utilisation ? fmtDate(detail.derniere_utilisation) : "—"}
        sub={detail.premiere_utilisation ? `Première : ${fmtDate(detail.premiere_utilisation)}` : "Jamais utilisée"}
        Icon={CalendarClock}
        accent="amber"
        index={3}
      />
    </div>
  )
}
