"use client"

/**
 * Header de la page Exports (Phase 4 §3).
 * Icône file-export rouge/ambre + titre + sous-titre dynamique.
 */

import { FileText } from "lucide-react"

type Props = {
  raisonSociale?: string | null
}

export function ExportsHeader({ raisonSociale }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
          <FileText size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Exports PDF
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Documents comptables officiels{raisonSociale ? <> · <span className="font-semibold text-gray-700 dark:text-gray-200">{raisonSociale}</span></> : null}
          </p>
        </div>
      </div>
    </div>
  )
}
