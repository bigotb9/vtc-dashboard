"use client"

/**
 * Grille de 5 KPIs pour /comptabilite/tiers (Phase 4.x Vague 2 §3.2).
 *
 * Total · Clients · Fournisseurs · Salariés · Autres
 */

import { Users, User, Building2, BadgeCheck, Sparkles } from "lucide-react"
import type { TiersListKpis } from "@/types/compta-ui"

type Props = {
  kpis:    TiersListKpis | null
  loading: boolean
}

const CARDS: Array<{
  key: keyof TiersListKpis
  label: string
  Icon: React.ElementType
  gradient: string
  ring: string
}> = [
  { key: "total",        label: "Total",       Icon: Users,      gradient: "from-indigo-500 to-violet-600", ring: "ring-indigo-500/20"  },
  { key: "clients",      label: "Clients",     Icon: User,       gradient: "from-emerald-500 to-teal-600",  ring: "ring-emerald-500/20" },
  { key: "fournisseurs", label: "Fournisseurs",Icon: Building2,  gradient: "from-amber-500 to-orange-600",  ring: "ring-amber-500/20"   },
  { key: "salaries",     label: "Salariés",    Icon: BadgeCheck, gradient: "from-cyan-500 to-sky-600",      ring: "ring-cyan-500/20"    },
  { key: "autres",       label: "Autres",      Icon: Sparkles,   gradient: "from-violet-500 to-fuchsia-600",ring: "ring-violet-500/20"  },
]

export function TiersKpis({ kpis, loading }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {CARDS.map(c => {
        const Icon = c.Icon
        const val  = kpis?.[c.key] ?? 0
        return (
          <div key={c.key} className={`rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-3.5 shadow-sm ${c.ring}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                {c.label}
              </span>
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-md`}>
                <Icon size={13} className="text-white" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black tabular-nums text-gray-900 dark:text-white font-mono">
              {loading ? "—" : val}
            </div>
          </div>
        )
      })}
    </div>
  )
}
