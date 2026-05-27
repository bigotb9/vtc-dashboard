"use client"

/**
 * Donut "Entrées par caisse" (Écran 3 Phase 3).
 *
 * Donut SVG natif avec une légende latérale incluant le logo et le %.
 *
 * Référence : doc Phase 3 Écran 3 §5.2.
 */

import { useMemo, useState } from "react"
import { PieChart } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { EntreeCaisseSlice } from "@/types/compta-ui"

const PALETTE = [
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#3B82F6", // blue
  "#84CC16", // lime
]

const fmtMontant = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}

type Props = {
  data:     EntreeCaisseSlice[]
  loading?: boolean
}

export function EntreesParCaisseDonut({ data, loading }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const slices = useMemo(() => {
    const total = data.reduce((s, d) => s + d.total, 0)
    if (total <= 0) return [] as { d: EntreeCaisseSlice; start: number; end: number; color: string }[]
    let acc = 0
    return data.map((d, i) => {
      const start = acc / total
      acc += d.total
      const end = acc / total
      return { d, start, end, color: PALETTE[i % PALETTE.length] }
    })
  }, [data])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[320px] animate-pulse" />
    )
  }

  const total = data.reduce((s, d) => s + d.total, 0)

  // Donut SVG geometry
  const R_OUT = 70
  const R_IN  = 46
  const cx    = 90
  const cy    = 90

  function arc(start: number, end: number, rOut: number, rIn: number): string {
    // Cas spécial : slice qui couvre tout le cercle (1 seule caisse à 100%).
    // L'arc SVG dégénère parce que start et end aboutissent au même point.
    // On trace donc 2 arcs de 180° pour l'extérieur ET l'intérieur (sens
    // opposé), puis on combine via fill-rule="evenodd" pour créer le trou.
    if (end - start >= 0.999) {
      return [
        `M ${(cx + rOut).toFixed(2)} ${cy.toFixed(2)}`,
        `A ${rOut} ${rOut} 0 1 1 ${(cx - rOut).toFixed(2)} ${cy.toFixed(2)}`,
        `A ${rOut} ${rOut} 0 1 1 ${(cx + rOut).toFixed(2)} ${cy.toFixed(2)}`,
        `Z`,
        `M ${(cx + rIn).toFixed(2)} ${cy.toFixed(2)}`,
        `A ${rIn} ${rIn} 0 1 1 ${(cx - rIn).toFixed(2)} ${cy.toFixed(2)}`,
        `A ${rIn} ${rIn} 0 1 1 ${(cx + rIn).toFixed(2)} ${cy.toFixed(2)}`,
        `Z`,
      ].join(" ")
    }

    const a0 = start * 2 * Math.PI - Math.PI / 2
    const a1 = end   * 2 * Math.PI - Math.PI / 2
    const large = end - start > 0.5 ? 1 : 0
    const x0 = cx + rOut * Math.cos(a0)
    const y0 = cy + rOut * Math.sin(a0)
    const x1 = cx + rOut * Math.cos(a1)
    const y1 = cy + rOut * Math.sin(a1)
    const x2 = cx + rIn  * Math.cos(a1)
    const y2 = cy + rIn  * Math.sin(a1)
    const x3 = cx + rIn  * Math.cos(a0)
    const y3 = cy + rIn  * Math.sin(a0)
    return [
      `M ${x0.toFixed(2)} ${y0.toFixed(2)}`,
      `A ${rOut} ${rOut} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `A ${rIn} ${rIn} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      "Z",
    ].join(" ")
  }

  const hovered = hoverIdx != null ? slices[hoverIdx] : null

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center shadow-md shadow-cyan-500/30 flex-shrink-0">
          <PieChart size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Entrées par caisse</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Répartition période courante</p>
        </div>
      </div>

      {slices.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-12">
          Aucune entrée sur la période
        </div>
      ) : (
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 180 180" width={150} height={150}>
              {slices.map((s, i) => (
                <path
                  key={s.d.caisse_id}
                  d={arc(s.start, s.end, R_OUT, R_IN)}
                  fill={s.color}
                  fillRule="evenodd"
                  opacity={hoverIdx == null || hoverIdx === i ? 1 : 0.35}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(prev => prev === i ? null : prev)}
                  className="transition-opacity cursor-pointer"
                />
              ))}
              <text
                x={cx} y={cy - 4}
                textAnchor="middle"
                className="fill-gray-400 dark:fill-gray-500 text-[10px] font-bold uppercase tracking-wider"
              >
                Total
              </text>
              <text
                x={cx} y={cy + 14}
                textAnchor="middle"
                className="fill-gray-900 dark:fill-white text-[15px] font-black tabular-nums"
              >
                {fmtMontant(total)} F
              </text>
            </svg>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            {slices.map((s, i) => (
              <button
                key={s.d.caisse_id}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(prev => prev === i ? null : prev)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
                  hoverIdx === i ? "bg-gray-50 dark:bg-white/[0.04]" : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <CaisseLogo caisse={{ code: s.d.code, libelle: s.d.libelle }} size="xs" />
                <span className="flex-1 min-w-0 text-left text-[12px] font-semibold text-gray-700 dark:text-gray-200 truncate">
                  {s.d.libelle}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-gray-900 dark:text-white">
                  {s.d.pct.toFixed(1).replace(".0", "")}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hovered && (
        <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 text-center tabular-nums">
          <span className="font-semibold text-gray-700 dark:text-gray-200">{hovered.d.libelle}</span> ·{" "}
          {Math.round(hovered.d.total).toLocaleString("fr-FR")} F · {hovered.d.pct.toFixed(1).replace(".0", "")}%
        </div>
      )}
    </div>
  )
}
