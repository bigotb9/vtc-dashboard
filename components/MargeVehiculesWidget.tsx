"use client"

/**
 * MargeVehiculesWidget — Tableau compact de la marge nette par vehicule
 * sur le mois en cours (1er du mois -> aujourd'hui).
 *
 * Source : GET /api/vehicules/marge
 * Affichage : 4 colonnes (Immatriculation / Recettes / Charges / Marge),
 * trie par marge nette decroissante. Icone trending-up vert si > 0,
 * trending-down rouge si < 0.
 */

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react"

type Row = {
  id_vehicule:     number
  immatriculation: string
  recettes:        number
  charges:         number
  marge:           number
}

type Response = {
  ok:      boolean
  periode: { from: string; to: string }
  rows:    Row[]
}

function fmtCfa(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(".", ",")} M`
  }
  if (abs >= 10_000) {
    return `${Math.round(n / 1000)} k`
  }
  return n.toLocaleString("fr-FR")
}

export default function MargeVehiculesWidget() {
  const [data,    setData]    = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch("/api/vehicules/marge")
        const j   = await res.json()
        if (cancelled) return
        if (!j.ok) { setError(j.error || "Erreur"); setData(null); return }
        setData(j as Response)
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setData(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const rows = data?.rows ?? []
  const totalMarge = rows.reduce((acc, r) => acc + r.marge, 0)

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <BarChart3 size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Marge par véhicule</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Mois en cours · {rows.length} véhicule{rows.length > 1 ? "s" : ""}
          </p>
        </div>
        {!loading && data && (
          <div className="text-right">
            <div className={`text-sm font-bold font-numeric ${totalMarge >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {totalMarge >= 0 ? "+" : "−"}{fmtCfa(Math.abs(totalMarge))} F
            </div>
            <div className="text-[10px] text-gray-400">Marge totale</div>
          </div>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-red-500 py-4">Erreur : {error}</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 italic py-4">
          Aucun véhicule actif à afficher.
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 max-h-[280px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424] z-10">
              <tr className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-[#1E2D45]">
                <th className="text-left  py-1.5 pr-2">Immat.</th>
                <th className="text-right py-1.5 px-1.5">Recettes</th>
                <th className="text-right py-1.5 px-1.5">Charges</th>
                <th className="text-right py-1.5 pl-1.5">Marge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const Icon = r.marge > 0 ? TrendingUp : r.marge < 0 ? TrendingDown : Minus
                const tone = r.marge > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : r.marge < 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-gray-400"
                return (
                  <tr key={r.id_vehicule} className="border-b border-gray-50 dark:border-[#1A2235] last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/[0.015]">
                    <td className="py-1.5 pr-2">
                      <span className="font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                        {r.immatriculation}
                      </span>
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                      {r.recettes > 0 ? fmtCfa(r.recettes) : "—"}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                      {r.charges > 0 ? fmtCfa(r.charges) : "—"}
                    </td>
                    <td className={`py-1.5 pl-1.5 text-right font-mono tabular-nums font-semibold ${tone}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Icon size={10} className="flex-shrink-0" />
                        {r.marge !== 0 ? fmtCfa(Math.abs(r.marge)) : "—"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
