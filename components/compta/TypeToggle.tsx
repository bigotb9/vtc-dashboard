"use client"

/**
 * Toggle Type opération — 2 cards radio (Entrée / Sortie).
 * Le choix conditionne le filtrage des catégories disponibles + la couleur
 * du champ Montant.
 *
 * Référence : doc Phase 3 Écran 4 §2.2.
 */

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import type { TypeOperation } from "@/types/compta-ui"

type Props = {
  value:    TypeOperation
  onChange: (next: TypeOperation) => void
}

export function TypeToggle({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange("entree")}
        className={`text-left rounded-2xl border p-4 transition relative overflow-hidden ${
          value === "entree"
            ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/30"
            : "bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.06] hover:border-emerald-300 dark:hover:border-emerald-500/30"
        }`}
      >
        {value === "entree" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
        )}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${
            value === "entree"
              ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-emerald-500/40"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}>
            <ArrowDownCircle size={20} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black tracking-tight ${
              value === "entree" ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-white"
            }`}>
              Entrée
            </p>
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              Apport, recette, encaissement…
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange("sortie")}
        className={`text-left rounded-2xl border p-4 transition relative overflow-hidden ${
          value === "sortie"
            ? "bg-red-500/5 dark:bg-red-500/10 border-red-500/40 ring-2 ring-red-500/30"
            : "bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.06] hover:border-red-300 dark:hover:border-red-500/30"
        }`}
      >
        {value === "sortie" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        )}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${
            value === "sortie"
              ? "bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-red-500/40"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}>
            <ArrowUpCircle size={20} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black tracking-tight ${
              value === "sortie" ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-white"
            }`}>
              Sortie
            </p>
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              Dépense, paiement, décaissement…
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}
