"use client"

/**
 * Grille de 4 KPIs sur la page détail tiers (Phase 4.x Vague 2 §3.4).
 *
 * Opérations · Total flux · Dernière op · Solde courant.
 */

import { Activity, TrendingUp, Calendar, Scale } from "lucide-react"
import type { TiersDetail } from "@/types/compta-ui"

function formatF(n: number): string {
  const abs = Math.abs(n)
  return Math.round(abs).toLocaleString("fr-FR").replace(/ | /g, " ")
}
function formatDateFr(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

type Props = {
  detail:  TiersDetail
  loading: boolean
}

export function TiersDetailKpis({ detail, loading }: Props) {
  const k = detail.kpis
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard label="Opérations (année)" Icon={Activity} value={loading ? "—" : String(k.nb_operations)} accent="indigo" />
      <KpiCard
        label="Flux net (année)"
        Icon={TrendingUp}
        value={loading ? "—" : `${k.total_flux_signe >= 0 ? "+" : "−"}${formatF(k.total_flux_signe)} F`}
        accent={k.total_flux_signe > 0 ? "emerald" : k.total_flux_signe < 0 ? "red" : "gray"}
      />
      <KpiCard label="Dernière opération" Icon={Calendar} value={loading ? "—" : formatDateFr(k.derniere_op_date)} accent="cyan" />
      <KpiCard
        label="Solde courant"
        Icon={Scale}
        value={loading ? "—" : `${k.solde_courant >= 0 ? "+" : "−"}${formatF(k.solde_courant)} F`}
        accent={k.solde_courant > 0 ? "emerald" : k.solde_courant < 0 ? "red" : "gray"}
      />
    </div>
  )
}

const ACCENT: Record<string, { grad: string; ring: string; text: string }> = {
  indigo:  { grad: "from-indigo-500 to-violet-600", ring: "ring-indigo-500/20", text: "text-gray-900 dark:text-white" },
  emerald: { grad: "from-emerald-500 to-teal-600",  ring: "ring-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300" },
  red:     { grad: "from-red-500 to-rose-600",      ring: "ring-red-500/20",     text: "text-red-700 dark:text-red-300" },
  cyan:    { grad: "from-cyan-500 to-sky-600",      ring: "ring-cyan-500/20",    text: "text-gray-900 dark:text-white" },
  gray:    { grad: "from-gray-400 to-gray-500",     ring: "ring-gray-500/15",    text: "text-gray-500 dark:text-gray-400" },
}

function KpiCard({ label, Icon, value, accent }: {
  label: string; Icon: React.ElementType; value: string; accent: keyof typeof ACCENT
}) {
  const a = ACCENT[accent]
  return (
    <div className={`rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-3.5 shadow-sm ${a.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${a.grad} flex items-center justify-center shadow-md`}>
          <Icon size={13} className="text-white" />
        </div>
      </div>
      <div className={`mt-2 text-xl font-black tabular-nums font-mono ${a.text}`}>
        {value}
      </div>
    </div>
  )
}
