"use client"

/**
 * Textarea Notes — détails complémentaires sur l'opération.
 * Hauteur min 80px, compteur de caractères en bas à droite (max 2000).
 *
 * Référence : doc Phase 3 Écran 4 §3.3.
 */

import { useId } from "react"

type Props = {
  value:     string
  onChange:  (next: string) => void
  max?:      number
  /** Hint affichée sous le label. */
  hint?:     string
}

export function NotesField({ value, onChange, max = 2000, hint }: Props) {
  const id = useId()
  const remaining = max - value.length
  const overLimit = remaining < 0

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        Notes
      </label>
      {hint && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 leading-snug">{hint}</p>
      )}
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          maxLength={max + 100}   // tolérance souple, garde-fou serveur 2000
          placeholder="Détails complémentaires sur l'opération…"
          className={`w-full min-h-[80px] rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-y ${
            overLimit
              ? "border-red-400 dark:border-red-500/50 focus:border-red-400"
              : "border-gray-200/70 dark:border-white/[0.08] focus:border-violet-400"
          }`}
        />
        <span className={`absolute right-2 bottom-2 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
          overLimit
            ? "bg-red-500/10 text-red-500"
            : remaining < 100
              ? "bg-amber-500/10 text-amber-500"
              : "bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-gray-500"
        }`}>
          {remaining}
        </span>
      </div>
    </div>
  )
}
