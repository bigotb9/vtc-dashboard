"use client"

/**
 * Barre de filtres de la liste catégories (Écran 6 §2.4).
 * Tabs sens + select type + recherche + toggle inactives.
 */

import { Search, X } from "lucide-react"
import type { CategorieSensFilter } from "@/types/compta-ui"

const SENS_TABS: { key: CategorieSensFilter; label: string }[] = [
  { key: "tout",     label: "Tout" },
  { key: "entrees",  label: "Entrées" },
  { key: "sorties",  label: "Sorties" },
]

type Props = {
  sens:           CategorieSensFilter
  type:           string
  search:         string
  inactives:      boolean
  typesAvailable: string[]
  /** Compteurs optionnels par sens pour les badges. */
  counts?: {
    tout?:    number
    entrees?: number
    sorties?: number
  }
  onSensChange:      (next: CategorieSensFilter) => void
  onTypeChange:      (next: string) => void
  onSearchChange:    (next: string) => void
  onInactivesChange: (next: boolean) => void
  onReset?:          () => void
}

const TYPE_LABEL: Record<string, string> = {
  recette:        "Recette",
  depense:        "Dépense",
  apport:         "Apport",
  reversement:    "Reversement",
  avance:         "Avance",
  investissement: "Investissement",
  remboursement:  "Remboursement",
  dotation:       "Dotation",
  transfert:      "Transfert",
  autre:          "Autre",
}

export function CategoriesFilterBar({
  sens, type, search, inactives, typesAvailable, counts,
  onSensChange, onTypeChange, onSearchChange, onInactivesChange, onReset,
}: Props) {
  const hasFilter = type !== "" || search !== "" || inactives === true || sens !== "tout"

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Tabs sens */}
      <div className="inline-flex bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
        {SENS_TABS.map(t => {
          const c = counts?.[t.key]
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSensChange(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                sens === t.key
                  ? "bg-white dark:bg-white/[0.08] text-violet-600 dark:text-violet-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
              {typeof c === "number" && (
                <span className={`text-[10px] font-bold tabular-nums px-1 rounded ${
                  sens === t.key
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

      {/* Select type métier */}
      <select
        value={type}
        onChange={e => onTypeChange(e.target.value)}
        className="text-xs bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.08] rounded-md px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/30"
      >
        <option value="">Tous les types</option>
        {typesAvailable.map(t => (
          <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
        ))}
      </select>

      {/* Recherche */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Rechercher un libellé…"
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

      {/* Toggle inactives */}
      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={inactives}
          onChange={e => onInactivesChange(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-white/[0.10] text-violet-500 focus:ring-violet-500/30"
        />
        Inactives
      </label>

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
  )
}
