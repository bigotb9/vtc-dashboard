"use client"

/**
 * Modal de confirmation pour la suppression d'un brouillon.
 * Référence : doc Phase 3 Écran 2 §4.3.
 *
 * La suppression n'est possible que pour les opérations en brouillon. Pour
 * les opérations validées, on utilise "Annuler" (qui crée une extourne).
 */

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, X } from "lucide-react"

type Props = {
  open:      boolean
  loading?:  boolean
  onClose:   () => void
  onConfirm: () => void
}

export function ConfirmDeleteModal({ open, loading, onClose, onConfirm }: Props) {
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
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-3">
                <span className="inline-flex w-10 h-10 rounded-xl items-center justify-center bg-red-500/12 text-red-500">
                  <Trash2 size={18} strokeWidth={2.5} />
                </span>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Supprimer le brouillon ?
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

            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Cette opération n&apos;a jamais été validée. La supprimer est définitif —
                aucune trace ne sera conservée. Pour les opérations validées, utilisez
                plutôt le bouton <strong>« Annuler »</strong> qui crée une extourne traçable.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 pt-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition"
              >
                Garder
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-md shadow-red-500/25 disabled:opacity-60 transition"
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
