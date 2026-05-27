"use client"

/**
 * Modal de confirmation de clôture d'un exercice (Phase 4.2 Module 2 §3.4).
 *
 * Action irréversible — le directeur doit confirmer. Si nb_brouillons > 0,
 * la confirmation est bloquée avec instruction de validation préalable.
 */

import { useState } from "react"
import { AlertTriangle, Loader2, X, Lock } from "lucide-react"
import type { ExerciceItem } from "@/types/compta-ui"

type Props = {
  open:        boolean
  exercice:    ExerciceItem | null
  onClose:     () => void
  onConfirm:   () => Promise<void>
}

export function ClotureModal({ open, exercice, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false)
  if (!open || !exercice) return null
  const hasBrouillons = exercice.nb_brouillons > 0

  async function handleConfirm() {
    if (hasBrouillons) return
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} disabled={busy}
          className="absolute top-3 right-3 w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition disabled:opacity-50">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-red-500/30 flex-shrink-0">
            <Lock size={17} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Clôturer l&apos;exercice {exercice.annee} ?
            </h3>
            <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              Cette action est <strong className="text-red-600 dark:text-red-400">irréversible</strong>.
              Toutes les opérations seront verrouillées par un trigger BD :
              plus aucun INSERT, UPDATE ou DELETE possible sur ces écritures.
            </p>
          </div>
        </div>

        {hasBrouillons ? (
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 flex items-start gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[12px] text-amber-700 dark:text-amber-300 leading-snug">
              <strong>{exercice.nb_brouillons} opération{exercice.nb_brouillons > 1 ? "s" : ""} en brouillon.</strong> Validez ou supprimez-les avant de clôturer.
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] p-3 mb-3 text-[12px] text-gray-700 dark:text-gray-300 space-y-1">
            <div><strong className="font-bold tabular-nums">{exercice.nb_operations}</strong> opérations validées</div>
            <div>Période : <span className="font-mono">{exercice.date_debut}</span> → <span className="font-mono">{exercice.date_fin}</span></div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-1.5">
              Le résultat net sera calculé et l&apos;exercice {exercice.annee + 1} créé automatiquement.
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={busy || hasBrouillons}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-semibold shadow-md shadow-red-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Clôturer définitivement
          </button>
        </div>
      </div>
    </div>
  )
}
