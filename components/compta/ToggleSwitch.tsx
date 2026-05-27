"use client"

/**
 * Switch toggle réutilisable (Écran 7 §5).
 * Vert si actif, gris sinon. Disabled supporté.
 */

import { Loader2 } from "lucide-react"

type Props = {
  checked:    boolean
  onChange:   (next: boolean) => void
  disabled?:  boolean
  loading?:   boolean
  /** Label inline à droite du switch. Optionnel. */
  label?:     string
}

export function ToggleSwitch({ checked, onChange, disabled, loading, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && !loading && onChange(!checked)}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${label ? "" : ""}`}
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          checked
            ? "bg-emerald-500"
            : "bg-gray-300 dark:bg-white/[0.10]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
        {loading && (
          <Loader2 size={10} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white animate-spin" />
        )}
      </span>
      {label && (
        <span className={`text-xs font-semibold ${checked ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500 dark:text-gray-400"}`}>
          {label}
        </span>
      )}
    </button>
  )
}
