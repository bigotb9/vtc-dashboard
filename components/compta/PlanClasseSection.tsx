"use client"

/**
 * Section accordéon par classe (Écran 10 §3.1).
 * Header avec pastille colorée + titre + description + compteur + chevron.
 * Body = table de comptes (visible si open).
 */

import { ChevronRight } from "lucide-react"
import { CLASSE_TITLES, CLASSE_COLORS, type SyscoClasse } from "@/components/compta/planComptableConstants"
import { PlanComptesTable } from "@/components/compta/PlanComptesTable"
import type { PlanCompteRow } from "@/types/compta-ui"

type Props = {
  classe:    SyscoClasse
  rows:      PlanCompteRow[]
  open:      boolean
  onToggle:  () => void
  onPick:    (row: PlanCompteRow) => void
}

export function PlanClasseSection({ classe, rows, open, onToggle, onPick }: Props) {
  const { title, desc } = CLASSE_TITLES[classe]
  const color = CLASSE_COLORS[classe]
  const nbUtilises = rows.filter(r => r.total_usage > 0).length

  return (
    <section className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden class-section">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition class-head"
      >
        <span
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-base ring-1 ${color.bg} ${color.text} ${color.ring} class-num`}
        >
          {classe}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
            Classe {classe} — {title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate class-desc">
            {desc}
          </p>
        </div>
        <span className="text-[10.5px] font-bold text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap class-counter print:hidden">
          {rows.length} comptes · {nbUtilises} utilisés
        </span>
        <ChevronRight size={16} className={`text-gray-400 transition-transform flex-shrink-0 class-chevron print:hidden ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-2 pb-3 class-body print:block">
          <PlanComptesTable rows={rows} onPick={onPick} />
        </div>
      )}
    </section>
  )
}
