"use client"

/**
 * Modal de confirmation de désactivation d'un tiers (Phase 4.x Vague 2 §3.4).
 */

import { useState } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"

type Props = {
  open:     boolean
  nom:      string
  onClose:  () => void
  onConfirm: () => Promise<void> | void
}

export function TiersDisableModal({ open, nom, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false)
  if (!open) return null

  async function handleConfirm() {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} disabled={busy} className="absolute top-3 right-3 w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition disabled:opacity-50">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 flex-shrink-0">
            <AlertTriangle size={17} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">Désactiver ce tiers ?</h3>
            <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              <strong className="text-gray-700 dark:text-gray-200">{nom}</strong> sera masqué de la liste par défaut.
              L&apos;historique des opérations rattachées reste intact. Le code SYSCOHADA sera libéré et
              pourra être réattribué à un nouveau tiers actif.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold shadow-md shadow-amber-500/30 transition disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />}
            Désactiver
          </button>
        </div>
      </div>
    </div>
  )
}
