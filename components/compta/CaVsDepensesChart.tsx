"use client"

/**
 * Chart "CA vs Dépenses" sur 12 mois calendaires (Écran 3 Phase 3).
 *
 * Double area chart SVG natif (pas de Chart.js) :
 * - série 1 : CA (vert)
 * - série 2 : Dépenses (rouge)
 * Tooltip au hover sur chaque mois.
 *
 * Référence : doc Phase 3 Écran 3 §5.1.
 */

import { useMemo, useState } from "react"
import { LineChart } from "lucide-react"
import type { MoisPoint } from "@/types/compta-ui"

const fmtMontant = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}
const fmtFull = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`

function moisLabel(ym: string): string {
  // "YYYY-MM" → "Jan", "Fév", … "Déc"
  const m = Number(ym.slice(5, 7))
  return ["Jan","Fév","Mar","Avr","Mai","Jui","Jul","Aoû","Sep","Oct","Nov","Déc"][m - 1] ?? ym
}

type Props = {
  data:     MoisPoint[]
  loading?: boolean
}

export function CaVsDepensesChart({ data, loading }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const layout = useMemo(() => {
    const W = 720
    const H = 240
    const padL = 44, padR = 16, padT = 16, padB = 28
    const innerW = W - padL - padR
    const innerH = H - padT - padB

    const max = Math.max(1, ...data.map(d => Math.max(d.ca, d.depenses)))
    const nice = (() => {
      // round-up to a nice scale
      const mag = Math.pow(10, Math.floor(Math.log10(max)))
      for (const m of [1, 2, 2.5, 5, 10]) {
        const v = m * mag
        if (v >= max) return v
      }
      return max
    })()

    const n = data.length
    const xAt = (i: number) => n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW
    const yAt = (v: number) => padT + innerH - (v / nice) * innerH

    const caPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(d.ca).toFixed(1)}`).join(" ")
    const dePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(d.depenses).toFixed(1)}`).join(" ")
    const caArea = caPath + ` L ${xAt(n - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L ${xAt(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`
    const deArea = dePath + ` L ${xAt(n - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L ${xAt(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`

    // y-axis ticks
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: padT + innerH - t * innerH, v: t * nice }))

    return { W, H, padL, padR, padT, padB, innerW, innerH, xAt, yAt, caPath, dePath, caArea, deArea, ticks }
  }, [data])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[320px] animate-pulse" />
    )
  }

  const hovered = hoverIdx != null ? data[hoverIdx] : null

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-500/30 flex-shrink-0">
            <LineChart size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">CA vs Dépenses</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">12 derniers mois</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-500 dark:text-gray-400 font-medium">CA</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-full bg-red-500" />
            <span className="text-gray-500 dark:text-gray-400 font-medium">Dépenses</span>
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${layout.W} ${layout.H}`}
          preserveAspectRatio="none"
          width="100%"
          height={240}
          className="block overflow-visible"
        >
          <defs>
            <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="deGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid */}
          {layout.ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={layout.padL} x2={layout.W - layout.padR}
                y1={t.y} y2={t.y}
                stroke="currentColor"
                className="text-gray-200 dark:text-white/[0.06]"
                strokeWidth={1}
                strokeDasharray={i === 0 ? "0" : "2 4"}
              />
              <text
                x={layout.padL - 6}
                y={t.y + 3}
                textAnchor="end"
                className="fill-gray-400 dark:fill-gray-600 text-[10px] font-medium tabular-nums"
              >
                {fmtMontant(t.v)}
              </text>
            </g>
          ))}

          {/* areas */}
          <path d={layout.caArea} fill="url(#caGrad)" />
          <path d={layout.deArea} fill="url(#deGrad)" />

          {/* lines */}
          <path d={layout.caPath} stroke="#10B981" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={layout.dePath} stroke="#EF4444" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* points + invisible hover hitboxes */}
          {data.map((d, i) => {
            const x = layout.xAt(i)
            return (
              <g key={d.mois}>
                {/* hitbox */}
                <rect
                  x={x - layout.innerW / (data.length * 2)}
                  y={layout.padT}
                  width={layout.innerW / Math.max(1, data.length)}
                  height={layout.innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(prev => prev === i ? null : prev)}
                />
                {hoverIdx === i && (
                  <line
                    x1={x} x2={x}
                    y1={layout.padT} y2={layout.padT + layout.innerH}
                    stroke="currentColor"
                    className="text-violet-500"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    pointerEvents="none"
                  />
                )}
                <circle cx={x} cy={layout.yAt(d.ca)}       r={hoverIdx === i ? 4 : 2.5} fill="#10B981" pointerEvents="none" />
                <circle cx={x} cy={layout.yAt(d.depenses)} r={hoverIdx === i ? 4 : 2.5} fill="#EF4444" pointerEvents="none" />

                {/* x-axis labels (1 sur 2 si trop dense) */}
                {(data.length <= 6 || i % 2 === 0) && (
                  <text
                    x={x}
                    y={layout.H - 8}
                    textAnchor="middle"
                    className="fill-gray-400 dark:fill-gray-500 text-[10px] font-semibold"
                  >
                    {moisLabel(d.mois)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none rounded-xl bg-gray-900/95 dark:bg-white/[0.08] backdrop-blur px-3 py-2 shadow-xl border border-white/10 text-[11px]"
            style={{ minWidth: 160 }}
          >
            <p className="font-bold text-white mb-1">
              {moisLabel(hovered.mois)} {hovered.mois.slice(0, 4)}
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> CA
              </span>
              <span className="font-semibold tabular-nums text-white">{fmtFull(hovered.ca)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1.5 text-red-300">
                <span className="w-2 h-2 rounded-full bg-red-400" /> Dépenses
              </span>
              <span className="font-semibold tabular-nums text-white">{fmtFull(hovered.depenses)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
