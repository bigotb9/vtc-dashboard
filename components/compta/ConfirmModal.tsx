"use client"

/**
 * Modal de confirmation simple (1 clic). Écran 7 §7.5.
 * Pour les actions sensibles mais non-destructives.
 */

import { useState } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"

type Variant = "warning" | "danger" | "info"

const VARIANT_ICON: Record<Variant, string> = {
  warning: "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/30",
  danger:  "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-500/30",
  info:    "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/30",
}
const VARIANT_BTN: Record<Variant, string> = {
  warning: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/30",
  danger:  "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-red-500/30",
  info:    "bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-violet-500/30",
}

type Props = {
  open:           boolean
  title:          string
  message:        string
  confirmLabel?:  string
  cancelLabel?:   string
  variant?:       Variant
  onConfirm:      () => Promise<void> | void
  onCancel:       () => void
}

export function ConfirmModal({
  open, title, message, confirmLabel = "Confirmer", cancelLabel = "Annuler",
  variant = "warning", onConfirm, onCancel,
}: Props) {
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function handleConfirm() {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="absolute top-3 right-3 w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition disabled:opacity-50"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${VARIANT_ICON[variant]}`}>
            <AlertTriangle size={17} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">{title}</h3>
            <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50 ${VARIANT_BTN[variant]}`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
