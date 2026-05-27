"use client"

/**
 * Modal de confirmation pour l'annulation d'une opération validée.
 * Référence : doc Phase 3 Écran 2 §4.2.
 *
 * L'annulation génère automatiquement une extourne (logique Day 5).
 * On demande un motif optionnel libre qui sera tracé en activity_logs.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, X } from "lucide-react"

type Props = {
  open:      boolean
  loading?:  boolean
  onClose:   () => void
  onConfirm: (raison: string | undefined) => void
}

export function ConfirmAnnulerModal({ open, loading, onClose, onConfirm }: Props) {
  const [raison, setRaison] = useState("")

  useEffect(() => {
    if (!open) setRaison("")
  }, [open])

  // ESC pour fermer
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-3">
                <span className="inline-flex w-10 h-10 rounded-xl items-center justify-center bg-red-500/12 text-red-500">
                  <AlertTriangle size={18} strokeWidth={2.5} />
                </span>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Confirmer l&apos;annulation
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Vous êtes sur le point d&apos;annuler cette opération.{" "}
                <strong>Une écriture d&apos;extourne sera automatiquement générée</strong> pour
                inverser l&apos;écriture originale. Cette action est irréversible.
              </p>

              <div>
                <label htmlFor="raison" className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Motif de l&apos;annulation (optionnel)
                </label>
                <textarea
                  id="raison"
                  value={raison}
                  onChange={e => setRaison(e.target.value)}
                  disabled={loading}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex : erreur de saisie, montant inversé…"
                  className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 transition resize-none"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  {raison.length}/500 caractères
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-5 pt-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => onConfirm(raison.trim() || undefined)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-md shadow-red-500/25 disabled:opacity-60 transition"
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Confirmer l&apos;annulation
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
