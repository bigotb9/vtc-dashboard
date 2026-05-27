"use client"

/**
 * Input Montant — gros chiffres, formatage espaces, couleur selon type.
 *
 * - 52px de haut, monospace 20px font-weight 700
 * - Affichage avec espaces tous les 3 chiffres (1 000 000)
 * - Couleur verte si type=entree, rouge si sortie
 * - Suffixe FCFA aligné à droite
 *
 * Référence : doc Phase 3 Écran 4 §3.1.1.
 */

import { useId } from "react"
import type { TypeOperation } from "@/types/compta-ui"

type Props = {
  value:     number | null
  onChange:  (n: number | null) => void
  type:      TypeOperation
  error?:    string | null
  required?: boolean
}

/** Formate un number en string avec espaces. 1234567 → "1 234 567" */
export function formatMontantInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ""
  return Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ")
}

/** Parse une string utilisateur en number (retire espaces, virgules, etc.). */
export function parseMontantInput(s: string): number | null {
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/,/g, ".")
  if (cleaned === "" || cleaned === "-") return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function MontantField({ value, onChange, type, error, required }: Props) {
  const id = useId()
  const isEntree = type === "entree"

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseMontantInput(e.target.value)
    onChange(parsed)
  }

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        Montant {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={formatMontantInput(value)}
          onChange={handleChange}
          placeholder="0"
          className={`w-full h-[52px] rounded-xl border bg-white dark:bg-white/[0.02] px-4 pr-16 text-right font-mono font-bold text-[20px] tabular-nums transition focus:outline-none focus:ring-2 ${
            error
              ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30"
              : isEntree
                ? "border-gray-200/70 dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500/30 focus:border-emerald-400"
                : "border-gray-200/70 dark:border-white/[0.08] text-red-600 dark:text-red-400 focus:ring-red-500/30 focus:border-red-400"
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-gray-500 pointer-events-none">
          FCFA
        </span>
      </div>
      {error && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-500">{error}</p>
      )}
    </div>
  )
}
