"use client"

/**
 * BilanCashNetWidget — Widget dashboard affichant le cash net (recettes Wave +
 * autres recettes - charges - reversements bailleurs) sur Jour / Semaine / Mois,
 * avec comparaison vs la periode equivalente precedente.
 *
 * Source : GET /api/compta/bilan-cash-net?period=day|week|month
 */

import { useEffect, useState, useCallback } from "react"
import { Wallet, ArrowUp, ArrowDown, Minus } from "lucide-react"

type Period = "day" | "week" | "month"

type Response = {
  ok:                     boolean
  period:                 Period
  periode:                { from: string; to: string; label: string }
  recettes_wave:          number
  autres_recettes:        number
  charges:                number
  reversements_bailleurs: number
  cash_net:               number
  comparaison: {
    periode_precedente:   { from: string; to: string; label: string }
    cash_net_precedent:   number
    variation:            number
    variation_pct:        number | null
  }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "day",   label: "Jour"    },
  { key: "week",  label: "Semaine" },
  { key: "month", label: "Mois"    },
]

function fmtCfa(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}

function fmtDateFr(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  const months = ["jan", "fév", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"]
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1] ?? m}`
}

export default function BilanCashNetWidget() {
  const [period,  setPeriod]  = useState<Period>("week")
  const [data,    setData]    = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (p: Period) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/compta/bilan-cash-net?period=${p}`)
      const j   = await res.json()
      if (!j.ok) { setError(j.error || "Erreur"); setData(null); return }
      setData(j as Response)
    } catch (e) {
      setError((e as Error).message); setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const VariationIcon = !data
    ? Minus
    : data.comparaison.variation > 0
      ? ArrowUp
      : data.comparaison.variation < 0
        ? ArrowDown
        : Minus

  const variationTone = !data || data.comparaison.variation === 0
    ? "text-gray-400"
    : data.comparaison.variation > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-500 dark:text-red-400"

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm flex flex-col">

      {/* Header + toggle periode */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <Wallet size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Bilan cash net</h2>
          {data && !loading && (
            <p className="text-[10.5px] text-gray-400 dark:text-gray-600">
              {fmtDateFr(data.periode.from)} → {fmtDateFr(data.periode.to)} {data.periode.from.slice(0, 4)}
            </p>
          )}
        </div>
        <div className="flex gap-0.5 bg-gray-100 dark:bg-white/[0.04] p-0.5 rounded-lg">
          {PERIODS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              disabled={loading}
              className={`px-2 py-1 text-[10px] font-bold rounded transition ${
                period === p.key
                  ? "bg-white dark:bg-[#0D1424] text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-red-500 py-4">Erreur : {error}</div>
      ) : data ? (
        <>
          {/* Lignes */}
          <div className="space-y-1.5 text-xs">
            <Line label="+ Recettes Wave"           value={data.recettes_wave}          tone="emerald" />
            <Line label="+ Autres recettes"         value={data.autres_recettes}        tone="emerald" />
            <Line label="− Charges"                 value={-data.charges}               tone="red" />
            <Line label="− Reversements bailleurs"  value={-data.reversements_bailleurs} tone="red" />
          </div>

          {/* Total cash net */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#1E2D45]">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Cash net</span>
              <span className={`text-xl font-black font-numeric tabular-nums ${
                data.cash_net > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : data.cash_net < 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-gray-500"
              }`}>
                {data.cash_net > 0 ? "+ " : data.cash_net < 0 ? "− " : ""}{fmtCfa(data.cash_net)} F
              </span>
            </div>
          </div>

          {/* Comparaison */}
          <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${variationTone}`}>
            <VariationIcon size={11} className="flex-shrink-0" />
            <span className="font-semibold tabular-nums">
              {data.comparaison.variation > 0 ? "+ " : data.comparaison.variation < 0 ? "− " : ""}
              {fmtCfa(data.comparaison.variation)} F
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              vs {data.comparaison.periode_precedente.label.toLowerCase()}
            </span>
            {data.comparaison.variation_pct !== null && data.comparaison.variation_pct !== 0 && (
              <span className="text-gray-400 dark:text-gray-500">
                ({data.comparaison.variation_pct > 0 ? "+" : ""}{data.comparaison.variation_pct}%)
              </span>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function Line({ label, value, tone }: { label: string; value: number; tone: "emerald" | "red" }) {
  const toneCls = tone === "emerald"
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-700 dark:text-red-400"
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${value === 0 ? "text-gray-400" : toneCls}`}>
        {fmtCfa(value)} F
      </span>
    </div>
  )
}
