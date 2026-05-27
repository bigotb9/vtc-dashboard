"use client"

/**
 * Modal affichant le résultat d'un health check (Écran 7 §7.3).
 *
 * - ok=true  → modal verte avec compteurs
 * - ok=false → modal rouge avec liste des anomalies
 */

import { CheckCircle, AlertTriangle, X } from "lucide-react"
import type { HealthCheckResult } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Props = {
  open:    boolean
  result:  HealthCheckResult | null
  /** Affiché si le check tourne encore */
  loading?: boolean
  onClose: () => void
}

export function HealthCheckResultModal({ open, result, loading, onClose }: Props) {
  if (!open) return null

  const ok = result?.ok === true

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition"
        >
          <X size={14} />
        </button>

        {loading || !result ? (
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white animate-pulse">
              <CheckCircle size={17} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">Vérification en cours…</h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Analyse des écritures comptables</p>
            </div>
          </div>
        ) : ok ? (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 flex-shrink-0">
                <CheckCircle size={17} />
              </div>
              <div>
                <h3 className="text-base font-black text-emerald-700 dark:text-emerald-300">Comptabilité équilibrée</h3>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Aucune anomalie détectée</p>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label="Écritures valides" value={fmt(result.nb_ecritures)} />
              <Stat label="Lignes vérifiées" value={fmt(result.nb_lignes)} />
              <Stat label="Σ Débit"  value={`${fmt(result.total_debit)} F`}  mono />
              <Stat label="Σ Crédit" value={`${fmt(result.total_credit)} F`} mono />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/30 flex-shrink-0">
                <AlertTriangle size={17} />
              </div>
              <div>
                <h3 className="text-base font-black text-red-700 dark:text-red-300">Anomalies détectées</h3>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                  {result.anomalies.length} problème{result.anomalies.length > 1 ? "s" : ""} à investiguer
                </p>
              </div>
            </div>

            <ul className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 space-y-2">
              {result.anomalies.map((a, i) => (
                <li key={i} className="text-[12px] text-red-700 dark:text-red-300 flex items-start gap-2 tabular-nums">
                  <span className="text-red-500 flex-shrink-0 mt-0.5">•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Écritures valides : <span className="font-semibold tabular-nums">{fmt(result.nb_ecritures)}</span></span>
              <span>Lignes : <span className="font-semibold tabular-nums">{fmt(result.nb_lignes)}</span></span>
              <span className="tabular-nums">Σ Débit : <span className="font-semibold">{fmt(result.total_debit)}</span></span>
              <span className="tabular-nums">Σ Crédit : <span className="font-semibold">{fmt(result.total_credit)}</span></span>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">{label}</p>
      <p className={`text-[13.5px] font-black text-gray-900 dark:text-white mt-0.5 tabular-nums ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}
