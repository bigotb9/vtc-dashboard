"use client"

/**
 * Barre de période sticky (Phase 4 §3.2).
 *
 * Tabs : Mois en cours · Mois précédent (défaut) · Trimestre · Année · Personnalisé
 * + 2 inputs date (date_from / date_to)
 * + status pill avec compteurs (nb ops + nb écritures + nb caisses)
 */

import { CheckCircle, AlertCircle } from "lucide-react"
import type { ExportsPeriodKey, ExportsMetadata } from "@/types/compta-ui"

type Props = {
  period:     ExportsPeriodKey
  dateFrom:   string
  dateTo:     string
  metadata:   ExportsMetadata | null
  loading?:   boolean
  onPeriodChange: (p: ExportsPeriodKey, range: { date_from: string; date_to: string }) => void
  onDateFromChange: (s: string) => void
  onDateToChange:   (s: string) => void
}

const TABS: { key: ExportsPeriodKey; label: string }[] = [
  { key: "mois_courant",  label: "Mois en cours" },
  { key: "mois_prec",     label: "Mois précédent" },
  { key: "trimestre",     label: "Trimestre" },
  { key: "annee",         label: "Année" },
  { key: "personnalise",  label: "Personnalisé" },
]

export function computePeriodRange(p: ExportsPeriodKey, today = new Date()): { date_from: string; date_to: string } {
  const pad = (n: number) => String(n).padStart(2, "0")
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const y = today.getFullYear(), m = today.getMonth()

  if (p === "mois_courant") {
    return { date_from: iso(new Date(y, m, 1)), date_to: iso(today) }
  }
  if (p === "mois_prec") {
    return { date_from: iso(new Date(y, m - 1, 1)), date_to: iso(new Date(y, m, 0)) }
  }
  if (p === "trimestre") {
    const qStart = Math.floor(m / 3) * 3
    return { date_from: iso(new Date(y, qStart, 1)), date_to: iso(new Date(y, qStart + 3, 0)) }
  }
  if (p === "annee") {
    return { date_from: `${y}-01-01`, date_to: `${y}-12-31` }
  }
  // personnalise : on garde les valeurs en cours (callsite gère)
  return { date_from: iso(new Date(y, m, 1)), date_to: iso(today) }
}

export function ExportsPeriodBar({
  period, dateFrom, dateTo, metadata, loading,
  onPeriodChange, onDateFromChange, onDateToChange,
}: Props) {
  const nbOps = metadata?.stats.nb_operations ?? 0
  const nbEcr = metadata?.stats.nb_ecritures ?? 0
  const isEmpty = !loading && nbOps === 0 && nbEcr === 0

  return (
    <div className="sticky top-0 z-20 -mx-2 sm:mx-0 backdrop-blur bg-white/85 dark:bg-[#0a0a0a]/85 border-y border-gray-200/70 dark:border-white/[0.05] py-2.5 px-2 sm:px-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <div className="inline-flex gap-1 min-w-max">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => onPeriodChange(t.key, t.key === "personnalise"
                  ? { date_from: dateFrom, date_to: dateTo }
                  : computePeriodRange(t.key))}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                  period === t.key
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <input
          type="date"
          value={dateFrom}
          onChange={e => onDateFromChange(e.target.value)}
          disabled={period !== "personnalise"}
          className="text-xs bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.08] rounded-md px-2 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => onDateToChange(e.target.value)}
          disabled={period !== "personnalise"}
          className="text-xs bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.08] rounded-md px-2 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
        />

        <span className={`inline-flex items-center gap-1.5 ml-auto px-2 py-1 rounded-md text-[11px] font-semibold ${
          loading
            ? "bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400"
            : isEmpty
              ? "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
        }`}>
          {loading ? (
            "Chargement…"
          ) : isEmpty ? (
            <>
              <AlertCircle size={11} />
              Aucune opération sur la période
            </>
          ) : (
            <>
              <CheckCircle size={11} />
              <span className="tabular-nums">{nbOps}</span> ops · <span className="tabular-nums">{nbEcr}</span> écritures
            </>
          )}
        </span>
      </div>
    </div>
  )
}
