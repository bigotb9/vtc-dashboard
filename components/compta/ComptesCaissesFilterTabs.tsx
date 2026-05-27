"use client"

/**
 * Filter tabs de la liste Comptes & Caisses (§2.4).
 * Tout / Caisses / Comptes / Actifs — state synchronisé avec URL ?filter=...
 */

import type { ComptesCaissesFilter } from "@/types/compta-ui"

type Tab = { key: ComptesCaissesFilter; label: string }
const TABS: Tab[] = [
  { key: "tout",     label: "Tout" },
  { key: "caisses",  label: "Caisses" },
  { key: "comptes",  label: "Comptes" },
  { key: "actifs",   label: "Actifs" },
]

type Props = {
  value:    ComptesCaissesFilter
  counts?:  Partial<Record<ComptesCaissesFilter, number>>
  onChange: (next: ComptesCaissesFilter) => void
}

export function ComptesCaissesFilterTabs({ value, counts, onChange }: Props) {
  return (
    <div className="inline-flex bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
      {TABS.map(t => {
        const c = counts?.[t.key]
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              value === t.key
                ? "bg-white dark:bg-white/[0.08] text-violet-600 dark:text-violet-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
            {typeof c === "number" && (
              <span className={`text-[10px] font-bold tabular-nums px-1 rounded ${
                value === t.key
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                  : "bg-gray-200 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400"
              }`}>
                {c}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
