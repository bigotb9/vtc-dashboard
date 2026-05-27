"use client"

/**
 * Modal de confirmation avant correction d'une anomalie (Écran 8).
 * Variante de ConfirmModal centrée sur le détail de l'anomalie.
 */

import { useState } from "react"
import { Wrench, Loader2, X, AlertCircle } from "lucide-react"
import type { HealthAnomaly } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Props = {
  open:      boolean
  anomaly:   HealthAnomaly | null
  /** Promesse de correction. Si resolve, on ferme. Si reject, on remonte l'erreur. */
  onConfirm: (a: HealthAnomaly) => Promise<{ ok: true } | { ok: false; error: string }>
  onCancel:  () => void
}

export function HealthFixModal({ open, anomaly, onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

  if (!open || !anomaly) return null

  async function handleConfirm() {
    if (!anomaly) return
    setBusy(true)
    setErr(null)
    const res = await onConfirm(anomaly)
    setBusy(false)
    if (!res.ok) setErr(res.error)
  }

  // Description selon le type
  let desc = "Une correction automatique va être appliquée à cette anomalie."
  if (anomaly.type === "op_sans_ecriture") {
    desc = `L'opération "${anomaly.libelle}" sera revalidée, ce qui régénère son écriture comptable SYSCOHADA (partie double).`
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 flex-shrink-0">
            <Wrench size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Appliquer la correction ?
            </h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              {desc}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-white/[0.025] border border-gray-200/70 dark:border-white/[0.06] p-3 space-y-1.5 text-[11.5px]">
          <Row label="Type">
            <span className="font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold">
              {anomaly.type}
            </span>
          </Row>
          <Row label="Libellé">
            <span className="font-semibold text-gray-900 dark:text-white truncate">{anomaly.libelle}</span>
          </Row>
          {anomaly.montant != null && (
            <Row label="Montant">
              <span className="font-mono tabular-nums">{fmt(anomaly.montant)} F</span>
            </Row>
          )}
          {anomaly.date_operation && (
            <Row label="Date">
              <span className="font-mono tabular-nums">{anomaly.date_operation}</span>
            </Row>
          )}
          {anomaly.caisse_libelle && (
            <Row label="Caisse"><span>{anomaly.caisse_libelle}</span></Row>
          )}
          {anomaly.raison && (
            <Row label="Raison"><span className="italic text-gray-500 dark:text-gray-400">{anomaly.raison}</span></Row>
          )}
        </div>

        {err && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[11.5px] text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            {err}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Appliquer la correction
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">{label}</span>
      <span className="text-right text-gray-900 dark:text-white text-[11.5px] min-w-0 truncate">{children}</span>
    </div>
  )
}
