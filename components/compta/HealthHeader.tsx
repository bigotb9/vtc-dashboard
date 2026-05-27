"use client"

/**
 * Header de la page Audit comptable (Écran 8 §2.1).
 * Icône stéthoscope + titre + sous-titre dynamique (état + dernière vérif)
 * + bouton "Re-vérifier".
 */

import { Stethoscope, RefreshCw, Loader2 } from "lucide-react"

type Props = {
  ok:             boolean | null
  score:          number | null
  checkedAt:      string | null
  loading?:       boolean
  onRefetch:      () => void
}

function fmtChecked(s: string | null): string {
  if (!s) return "Jamais"
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return s
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60)         return "à l'instant"
  if (diff < 3600)       return `il y a ${Math.round(diff / 60)} min`
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function HealthHeader({ ok, score, checkedAt, loading, onRefetch }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
          ok === false
            ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-500/30"
            : ok === true
              ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-emerald-500/30"
              : "bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-gray-500/30"
        }`}>
          <Stethoscope size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Audit comptable
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            {loading ? (
              <span className="text-gray-400">Vérification en cours…</span>
            ) : (
              <>
                {ok === null ? (
                  <span>État inconnu</span>
                ) : ok ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Comptabilité saine
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    Anomalies détectées
                  </span>
                )}
                {score != null && (
                  <> · Score <span className="font-bold tabular-nums text-gray-700 dark:text-gray-200">{score}%</span></>
                )}
                {" · "}Dernière vérification <span className="text-gray-700 dark:text-gray-200">{fmtChecked(checkedAt)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefetch}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Re-vérifier
      </button>
    </div>
  )
}
