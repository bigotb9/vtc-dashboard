"use client"

/**
 * Sélecteur multi-journaux pour la card Journaux (Phase 4 §3.4).
 *
 * Pastilles : Tous · VE · OD · CA · BQ · AC · PA
 * Click "Tous" exclut les autres. Click sur un préfixe désélectionne "Tous"
 * et ajoute/retire le préfixe. Si tous les préfixes sont sélectionnés OU
 * aucun → équivalent à "Tous".
 */

import { Book } from "lucide-react"

type Props = {
  available: string[]   // codes journaux disponibles (depuis /metadata)
  value:     string[]   // ["all"] OU sous-ensemble
  onChange:  (next: string[]) => void
}

const ALL_KNOWN = ["VE", "OD", "CA", "BQ", "AC", "PA"]

export function ExportsJournauxSelector({ available, value, onChange }: Props) {
  // Journaux dispos = intersection availability + known + tout ceux explicitement sélectionnés
  const usable = Array.from(new Set([...ALL_KNOWN, ...available])).sort()
  const isAllMode = value.length === 0 || value.includes("all")

  function pickAll() {
    onChange(["all"])
  }
  function toggle(code: string) {
    const set = new Set(isAllMode ? [] : value)
    if (set.has(code)) set.delete(code)
    else                set.add(code)
    const next = Array.from(set)
    onChange(next.length === 0 ? ["all"] : next)
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Book size={12} className="text-cyan-500" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
          Journaux inclus
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill
          label="Tous"
          active={isAllMode}
          onClick={pickAll}
        />
        {usable.map(code => {
          const isPresent = available.includes(code)
          return (
            <Pill
              key={code}
              label={code}
              active={!isAllMode && value.includes(code)}
              dim={!isPresent}
              onClick={() => toggle(code)}
            />
          )
        })}
      </div>
    </div>
  )
}

function Pill({ label, active, dim, onClick }: {
  label: string
  active: boolean
  dim?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold transition ${
        active
          ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/30"
          : dim
            ? "bg-gray-100 dark:bg-white/[0.03] text-gray-400 dark:text-gray-600 hover:bg-gray-200 dark:hover:bg-white/[0.06]"
            : "bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400"
      }`}
    >
      {label}
    </button>
  )
}
