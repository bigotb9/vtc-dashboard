"use client"

/**
 * Barre de filtres du plan comptable (Écran 10 §2.4).
 * Tabs Toutes + Classe 1..9 + recherche texte. State serialisé dans URL.
 */

import { Search, X } from "lucide-react"
import { ALL_CLASSES, CLASSE_COLORS } from "@/components/compta/planComptableConstants"
import type { PlanComptableClasseFilter } from "@/types/compta-ui"

type Props = {
  classe:        PlanComptableClasseFilter
  search:        string
  /** Compteurs par classe (du dataset complet) pour afficher dans les pills. */
  countsByClasse?: Record<number, number>
  onClasseChange: (next: PlanComptableClasseFilter) => void
  onSearchChange: (next: string) => void
  onReset?:       () => void
}

export function PlanComptableFilters({
  classe, search, countsByClasse, onClasseChange, onSearchChange, onReset,
}: Props) {
  const hasFilter = classe !== "all" || search !== ""

  return (
    <div className="space-y-2.5 print:hidden">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Tabs classes — défilable horizontalement sur mobile */}
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <div className="inline-flex items-center gap-1 min-w-max">
            <button
              type="button"
              onClick={() => onClasseChange("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                classe === "all"
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
              }`}
            >
              Toutes
            </button>
            {ALL_CLASSES.map(c => {
              const active = classe === String(c)
              const count = countsByClasse?.[c] ?? 0
              const color = CLASSE_COLORS[c]
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onClasseChange(String(c) as PlanComptableClasseFilter)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                    active
                      ? `${color.bg} ${color.text} ring-1 ${color.ring}`
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  Cl. {c}
                  {count > 0 && (
                    <span className={`text-[9.5px] font-bold tabular-nums px-1 rounded ${
                      active
                        ? "bg-white/40 dark:bg-white/[0.10]"
                        : "bg-gray-200 dark:bg-white/[0.05]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-[480px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Rechercher un code ou un libellé…"
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.08] rounded-md text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/[0.05] text-gray-400"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {hasFilter && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  )
}
