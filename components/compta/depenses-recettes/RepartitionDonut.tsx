"use client"

/**
 * Donut chart SVG inline pour répartition catégorie/source
 * — Phase 4.x Vague 3.5 §2.2.4.
 *
 * Au centre : total + label "Total période".
 * Légende dessous : pastille + label + pourcentage.
 */

import { formatMontantCompact } from "@/lib/compta/formatMontantCompact"
import type { FlowSlice } from "@/types/compta-ui"

type Props = {
  title:   string
  slices:  FlowSlice[]
  loading?: boolean
  /** Affiché au centre (par défaut "Total période"). */
  centerLabel?: string
}

export function RepartitionDonut({ title, slices, loading, centerLabel = "Total période" }: Props) {
  const W = 220, R = 80, S = 30  // viewBox W, ray, stroke
  const cx = W / 2, cy = W / 2
  const C = 2 * Math.PI * R
  const total = slices.reduce((a, s) => a + s.total, 0)

  // Calcul des dasharray successifs
  let accLen = 0
  const segments = total > 0
    ? slices.map(s => {
        const frac = s.total / total
        const len = frac * C
        const seg = { color: s.color_hint ?? "#9CA3AF", len, offset: -accLen }
        accLen += len
        return seg
      })
    : []

  return (
    <div className="rounded-2xl border border-[#1E2D45] bg-[#0D1424] p-4">
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
        {title}
      </h3>
      {loading ? (
        <div className="h-[240px] rounded-lg bg-[#1A2235] animate-pulse" />
      ) : total === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-gray-500 italic">
          Aucune donnée sur la période
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${W}`} className="block mx-auto w-[200px] h-[200px]">
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1A2235" strokeWidth={S} />
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={cx} cy={cy} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={S}
                strokeDasharray={`${seg.len} ${C - seg.len}`}
                strokeDashoffset={seg.offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="butt"
              />
            ))}
            <text
              x={cx} y={cy - 6}
              textAnchor="middle"
              fontSize="11" fill="#9CA3AF"
              fontWeight="600"
              style={{ textTransform: "uppercase", letterSpacing: "1.5px" }}
            >
              {centerLabel}
            </text>
            <text
              x={cx} y={cy + 16}
              textAnchor="middle"
              fontSize="18" fontWeight="900" fill="#F3F4F6"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {formatMontantCompact(total, false)}
            </text>
          </svg>

          {/* Légende */}
          <ul className="mt-3 space-y-1.5">
            {slices.map(s => (
              <li key={s.id} className="flex items-center gap-2 text-[11.5px]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: s.color_hint ?? "#9CA3AF" }}
                />
                <span className="text-gray-300 truncate flex-1">{s.libelle}</span>
                <span className="font-mono tabular-nums text-gray-400 shrink-0">
                  {s.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
