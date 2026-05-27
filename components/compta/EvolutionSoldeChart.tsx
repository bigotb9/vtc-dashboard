"use client"

/**
 * Line chart SVG natif "Évolution du solde 12 mois" (Écran 5 §3.4).
 *
 * Affiche le solde cumulé mois par mois sur 12 derniers mois.
 *  - Zone négative (sous zéro) teintée rouge
 *  - Zone positive (au-dessus de zéro) teintée vert
 *  - Ligne zéro pointillée
 *  - Courbe violet avec aire sous la courbe gradient
 *  - Points de départ + actuel mis en évidence
 *  - Tooltip hover par mois
 */

import { useMemo, useState } from "react"
import { TrendingUp } from "lucide-react"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}
const moisLabel = (ym: string): string => {
  const m = Number(ym.slice(5, 7))
  return ["Jan","Fév","Mar","Avr","Mai","Jui","Jul","Aoû","Sep","Oct","Nov","Déc"][m - 1] ?? ym
}

type Props = {
  data:     { mois: string; solde: number }[]
  loading?: boolean
}

export function EvolutionSoldeChart({ data, loading }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const layout = useMemo(() => {
    const W = 720
    const H = 280
    const padL = 56, padR = 16, padT = 18, padB = 32
    const innerW = W - padL - padR
    const innerH = H - padT - padB

    if (data.length === 0) {
      return { W, H, padL, padR, padT, padB, innerW, innerH,
        min: 0, max: 0, niceMin: 0, niceMax: 1,
        xAt: () => padL, yAt: () => padT + innerH / 2, yZero: padT + innerH / 2,
        linePath: "", areaPath: "", areaPosPath: "", areaNegPath: "", ticks: [] as { y: number; v: number }[] }
    }

    const max = Math.max(...data.map(d => d.solde), 0)
    const min = Math.min(...data.map(d => d.solde), 0)
    // Padding 10%
    const range = Math.max(1, max - min)
    const niceMax = max + range * 0.1
    const niceMin = min - range * 0.1
    const niceRange = niceMax - niceMin

    const n = data.length
    const xAt = (i: number) => n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW
    const yAt = (v: number) => padT + innerH - ((v - niceMin) / niceRange) * innerH
    const yZero = yAt(0)

    const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(d.solde).toFixed(1)}`).join(" ")
    const areaPath = linePath + ` L ${xAt(n - 1).toFixed(1)},${yZero.toFixed(1)} L ${xAt(0).toFixed(1)},${yZero.toFixed(1)} Z`

    // Two clip-y zones for positive / negative tint
    // Y-axis ticks : 0, niceMin, niceMax, mid
    const ticks: { y: number; v: number }[] = []
    const tickVals = [niceMax, max > 0 ? max / 2 : 0, 0, min < 0 ? min / 2 : 0, niceMin]
      .filter((v, i, a) => a.indexOf(v) === i)
    for (const v of tickVals) ticks.push({ y: yAt(v), v })

    return { W, H, padL, padR, padT, padB, innerW, innerH,
      min, max, niceMin, niceMax,
      xAt, yAt, yZero, linePath, areaPath,
      areaPosPath: "",
      areaNegPath: "",
      ticks }
  }, [data])

  if (loading) {
    return <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[360px] animate-pulse" />
  }

  const hovered = hoverIdx != null ? data[hoverIdx] : null
  const lastVal = data.length > 0 ? data[data.length - 1].solde : 0
  const firstVal = data.length > 0 ? data[0].solde : 0
  const delta = lastVal - firstVal

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

      <div className="flex items-start justify-between mb-4 gap-3 relative">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/30 flex-shrink-0">
            <TrendingUp size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Évolution du solde</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">12 derniers mois · cumul</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variation 12 mois</p>
          <p className={`text-sm font-black tabular-nums leading-tight mt-0.5 ${
            delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"
          }`}>
            {delta >= 0 ? "+" : "−"}{fmtCompact(Math.abs(delta))} F
          </p>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${layout.W} ${layout.H}`} preserveAspectRatio="none" width="100%" height={280} className="block overflow-visible">
          <defs>
            <linearGradient id="curvePosGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bgPosGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="bgNegGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.04" />
            </linearGradient>
            <clipPath id="aboveZero">
              <rect x={layout.padL} y={layout.padT} width={layout.innerW} height={Math.max(0, layout.yZero - layout.padT)} />
            </clipPath>
            <clipPath id="belowZero">
              <rect x={layout.padL} y={layout.yZero} width={layout.innerW} height={Math.max(0, layout.padT + layout.innerH - layout.yZero)} />
            </clipPath>
          </defs>

          {/* Background zones positive/negative tint */}
          <rect x={layout.padL} y={layout.padT} width={layout.innerW} height={Math.max(0, layout.yZero - layout.padT)} fill="url(#bgPosGrad)" />
          <rect x={layout.padL} y={layout.yZero} width={layout.innerW} height={Math.max(0, layout.padT + layout.innerH - layout.yZero)} fill="url(#bgNegGrad)" />

          {/* Grid */}
          {layout.ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={layout.padL} x2={layout.W - layout.padR}
                y1={t.y} y2={t.y}
                stroke="currentColor"
                className={t.v === 0 ? "text-gray-400 dark:text-white/[0.18]" : "text-gray-200 dark:text-white/[0.06]"}
                strokeWidth={1}
                strokeDasharray={t.v === 0 ? "4 4" : "2 4"}
              />
              <text
                x={layout.padL - 6}
                y={t.y + 3}
                textAnchor="end"
                className={`fill-gray-400 dark:fill-gray-600 text-[10px] font-medium tabular-nums ${t.v === 0 ? "fill-gray-500 dark:fill-gray-400 font-bold" : ""}`}
              >
                {fmtCompact(t.v)}
              </text>
            </g>
          ))}

          {/* Area sous la courbe (violet) */}
          {layout.linePath && <path d={layout.areaPath} fill="url(#curvePosGrad)" />}

          {/* Ligne violet */}
          {layout.linePath && (
            <path d={layout.linePath} stroke="#8B5CF6" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Points + hover hitboxes */}
          {data.map((d, i) => {
            const x = layout.xAt(i)
            const y = layout.yAt(d.solde)
            const isFirst = i === 0
            const isLast  = i === data.length - 1
            const pointColor = isLast
              ? (d.solde >= 0 ? "#10B981" : "#EF4444")
              : isFirst
                ? "#10B981"
                : "#8B5CF6"
            return (
              <g key={d.mois}>
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
                  <line x1={x} x2={x} y1={layout.padT} y2={layout.padT + layout.innerH} stroke="currentColor" className="text-violet-500" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
                )}
                <circle cx={x} cy={y} r={hoverIdx === i || isFirst || isLast ? 4.5 : 2.5} fill={pointColor} stroke="white" strokeWidth={hoverIdx === i || isFirst || isLast ? 1.5 : 0} pointerEvents="none" />
                {(data.length <= 6 || i % 2 === 0) && (
                  <text x={x} y={layout.H - 8} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500 text-[10px] font-semibold">
                    {moisLabel(d.mois)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {hovered && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none rounded-xl bg-gray-900/95 dark:bg-white/[0.08] backdrop-blur px-3 py-2 shadow-xl border border-white/10 text-[11px]" style={{ minWidth: 160 }}>
            <p className="font-bold text-white mb-0.5">
              {moisLabel(hovered.mois)} {hovered.mois.slice(0, 4)}
            </p>
            <p className={`font-mono font-bold tabular-nums ${hovered.solde < 0 ? "text-red-300" : "text-emerald-300"}`}>
              {fmt(hovered.solde)} F
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
