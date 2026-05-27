"use client"

/**
 * Modal de confirmation double (Écran 7 §3.5 et §7.6).
 *
 * Pour les actions irréversibles (toggle mode, re-toggle forcé). L'utilisateur
 * doit taper exactement le mot de confirmation (par défaut "CONFIRMER") avant
 * que le bouton ne s'active.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"

type Props = {
  open:           boolean
  title:          string
  message:        string
  /** Liste de bullet points sous le message (conséquences détaillées). */
  warningList?:   string[]
  confirmWord?:   string
  confirmLabel?:  string
  cancelLabel?:   string
  onConfirm:      () => Promise<void> | void
  onCancel:       () => void
}

export function DoubleConfirmModal({
  open, title, message, warningList,
  confirmWord = "CONFIRMER",
  confirmLabel = "Confirmer", cancelLabel = "Annuler",
  onConfirm, onCancel,
}: Props) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  // Reset quand on ouvre/ferme
  useEffect(() => {
    if (!open) { setText(""); setBusy(false) }
  }, [open])

  if (!open) return null

  const matched = text === confirmWord

  async function handleConfirm() {
    if (!matched || busy) return
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/30 flex-shrink-0">
            <AlertTriangle size={17} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">{title}</h3>
            <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{message}</p>
          </div>
        </div>

        {warningList && warningList.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
            {warningList.map((w, i) => (
              <li key={i} className="text-[11.5px] text-amber-700 dark:text-amber-300 leading-snug flex items-start gap-1.5">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
            Pour confirmer, tapez <span className="text-red-500 font-mono">{confirmWord}</span> ci-dessous
          </label>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={confirmWord}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className={`w-full rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 text-sm font-mono tabular-nums tracking-wider transition focus:outline-none focus:ring-2 ${
              matched
                ? "border-emerald-400 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-500/30"
                : "border-gray-200/70 dark:border-white/[0.08] focus:ring-red-500/30 focus:border-red-400 text-gray-900 dark:text-white"
            } disabled:opacity-50`}
          />
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
            disabled={!matched || busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-semibold shadow-md shadow-red-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
