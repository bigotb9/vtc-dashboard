"use client"

/**
 * Bar chart SVG inline pour évolution mensuelle (6 derniers mois)
 * — Phase 4.x Vague 3.5 §2.2.4.
 *
 * Mois courant mis en avant. Gradient vertical par couleur thématique.
 * Lignes de grille horizontales en pointillés.
 */

import { useMemo } from "react"
import { formatMontantCompact } from "@/lib/compta/formatMontantCompact"
import type { FlowKind } from "@/types/compta-ui"

type Point = { month: string; total: number }

type Props = {
  data:    Point[]            // 6 entrées attendues, ISO YYYY-MM
  kind:    FlowKind
  loading?: boolean
}

const MONTH_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
function labelMois(iso: string): string {
  const [, m] = iso.split("-")
  return MONTH_FR[parseInt(m, 10) - 1] ?? m
}

// 4 paliers Y arrondis
function makeYTicks(max: number): number[] {
  if (max <= 0) return [0, 250_000, 500_000, 750_000, 1_000_000]
  // Trouve une magnitude jolie
  const magnitudes = [
    1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
    250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
  ]
  const step = magnitudes.find(m => m * 4 >= max) ?? magnitudes[magnitudes.length - 1]
  const top  = Math.ceil(max / step) * step
  const tickStep = top / 4
  return [0, tickStep, tickStep * 2, tickStep * 3, top]
}

export function EvolutionChart({ data, kind, loading }: Props) {
  const accent      = kind === "depenses" ? "#F87171" : "#34D399"
  const accentLight = kind === "depenses" ? "#FCA5A5" : "#6EE7B7"

  const maxVal = useMemo(() => Math.max(0, ...data.map(d => d.total)), [data])
  const ticks  = useMemo(() => makeYTicks(maxVal), [maxVal])
  const yTop   = ticks[ticks.length - 1]

  const W = 600, H = 240
  const padL = 56, padR = 12, padT = 18, padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

  // Titre de la card
  const card = (
    <div className="rounded-2xl border border-[#1E2D45] bg-[#0D1424] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-400">
          Évolution mensuelle (6 mois)
        </h3>
      </div>
      {loading ? (
        <div className="h-[240px] rounded-lg bg-[#1A2235] animate-pulse" />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`evolGrad-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={accentLight} stopOpacity="1" />
              <stop offset="100%" stopColor={accent}     stopOpacity="1" />
            </linearGradient>
            <linearGradient id={`evolGradFade-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={accentLight} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent}     stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {/* Lignes de grille + labels Y */}
          {ticks.map((t, i) => {
            const y = padT + innerH - (yTop > 0 ? (t / yTop) * innerH : 0)
            return (
              <g key={i}>
                <line
                  x1={padL} x2={W - padR} y1={y} y2={y}
                  stroke="#1E2D45" strokeOpacity="0.5"
                  strokeDasharray={i === 0 ? "" : "4 4"}
                />
                <text
                  x={padL - 6} y={y + 3}
                  textAnchor="end" fontSize="10" fill="#6B7280"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {formatMontantCompact(t, false)}
                </text>
              </g>
            )
          })}

          {/* Barres */}
          {(() => {
            const n = Math.max(1, data.length)
            const bandW = innerW / n
            const barW = Math.max(18, bandW * 0.55)
            return data.map((d, i) => {
              const cx = padL + bandW * i + bandW / 2
              const h = yTop > 0 ? (d.total / yTop) * innerH : 0
              const y = padT + innerH - h
              const isCurrent = d.month === nowMonth
              return (
                <g key={d.month}>
                  <rect
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={Math.max(2, h)}
                    rx={4}
                    fill={isCurrent ? `url(#evolGrad-${kind})` : `url(#evolGradFade-${kind})`}
                  />
                  {/* Valeur en haut de la barre du mois courant */}
                  {isCurrent && (
                    <text
                      x={cx} y={y - 6}
                      textAnchor="middle" fontSize="10.5" fontWeight="700"
                      fill={accent} fontFamily="ui-monospace, SFMono-Regular, monospace"
                    >
                      {formatMontantCompact(d.total, false)}
                    </text>
                  )}
                  {/* Label X */}
                  <text
                    x={cx} y={H - padB + 16}
                    textAnchor="middle" fontSize="10.5" fontWeight={isCurrent ? "800" : "600"}
                    fill={isCurrent ? accent : "#9CA3AF"}
                  >
                    {labelMois(d.month)}
                  </text>
                </g>
              )
            })
          })()}
        </svg>
      )}
    </div>
  )
  return card
}
