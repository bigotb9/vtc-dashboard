"use client"

/**
 * Header de la page Plan comptable (Écran 10 §2.2).
 * Titre + sous-titre dynamique + boutons Export CSV + Imprimer.
 */

import { BookOpen, Download, Printer } from "lucide-react"

type Props = {
  nbClasses:    number
  nbComptes:    number
  onExportCsv:  () => void
  onPrint:      () => void
}

export function PlanComptableHeader({ nbClasses, nbComptes, onExportCsv, onPrint }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <BookOpen size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Plan comptable SYSCOHADA
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Référence du plan comptable révisé · <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{nbClasses}</span> classes · <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{nbComptes}</span> comptes
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition"
        >
          <Download size={14} /> Export CSV
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition"
        >
          <Printer size={14} /> Imprimer
        </button>
      </div>
    </div>
  )
}
