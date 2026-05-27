"use client"

/**
 * Modal de progression pendant la génération PDF (Phase 4 §3.5).
 *
 * Pas annulable (Puppeteer n'expose pas d'abort propre dans la stack
 * serverless), mais affiche un message rassurant + spinner. Le toast de
 * succès/échec prend le relai côté appelant.
 */

import { Loader2, FileText } from "lucide-react"

type Props = {
  open: boolean
  /** Type de rapport en cours (pour message) */
  type?: string | null
}

const LABELS: Record<string, string> = {
  "grand-livre":      "Grand Livre",
  "balance":          "Balance",
  "journaux":         "Journaux",
  "releves-caisses":  "Relevés de caisses",
  "rapport-mensuel":  "Rapport mensuel",
}

export function ExportProgressModal({ open, type }: Props) {
  if (!open) return null

  const label = type ? (LABELS[type] ?? type) : "Document"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 relative">
          <FileText size={22} className="text-white" />
          <Loader2 size={36} className="text-white/80 animate-spin absolute -top-3 -right-3" />
        </div>
        <h3 className="text-base font-black tracking-tight text-gray-900 dark:text-white mt-3">
          Génération du PDF
        </h3>
        <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
          <span className="font-semibold text-gray-700 dark:text-gray-200">{label}</span> en cours de préparation.
          Cela peut prendre de quelques secondes à 30 secondes pour les gros rapports.
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-3">
          Le téléchargement démarrera automatiquement.
        </p>
      </div>
    </div>
  )
}
