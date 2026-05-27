"use client"

/**
 * KPI card avec glow blur + icon gradient (Phase 4.x Vague 3.5 §2.2.3).
 *
 * 2 variantes :
 *   - "number"  → grosse valeur + sous-info (trend %)
 *   - "toplist" → liste verticale (label + montant compact)
 */

import { ArrowUp, ArrowDown, Minus } from "lucide-react"
import { formatMontantCompact, formatMontantFull } from "@/lib/compta/formatMontantCompact"

export type KpiAccent = "red" | "green" | "amber" | "cyan" | "violet" | "blue"

const GLOW_HEX: Record<KpiAccent, string> = {
  red:    "#EF4444",
  green:  "#10B981",
  amber:  "#F59E0B",
  cyan:   "#06B6D4",
  violet: "#8B5CF6",
  blue:   "#3B82F6",
}
const ICON_GRADIENT: Record<KpiAccent, string> = {
  red:    "from-red-500 to-rose-600",
  green:  "from-emerald-500 to-green-600",
  amber:  "from-amber-500 to-orange-600",
  cyan:   "from-cyan-500 to-sky-600",
  violet: "from-violet-500 to-fuchsia-600",
  blue:   "from-blue-500 to-indigo-600",
}

type NumberProps = {
  variant:   "number"
  label:     string
  value:     number
  /** Préfixe affiché devant la valeur (ex "−" ou "+"). */
  prefix?:   string
  /** Trend en % (peut être null si N/A). */
  trendPct?: number | null
  /** Interprétation : up = bon (recettes) ou up = mauvais (dépenses). */
  trendUpIsGood?: boolean
  /** Note sous la valeur (ex "Sur 14 jours"). */
  note?:     string | null
  Icon:      React.ElementType
  accent:    KpiAccent
  loading?:  boolean
}
type ToplistProps = {
  variant: "toplist"
  label:   string
  rows:    Array<{ label: string; total: number }>
  Icon:    React.ElementType
  accent:  KpiAccent
  loading?: boolean
}
type Props = NumberProps | ToplistProps

export function KpiCard(props: Props) {
  const glow = GLOW_HEX[props.accent]
  const grad = ICON_GRADIENT[props.accent]
  const Icon = props.Icon
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1E2D45] bg-[#0D1424] p-4">
      {/* Glow blur décoratif */}
      <div
        aria-hidden
        className="absolute -right-8 -top-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: glow, opacity: 0.10, filter: "blur(28px)" }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400">
            {props.label}
          </div>

          {props.variant === "number" ? (
            <NumberBody {...props} />
          ) : (
            <ToplistBody {...props} />
          )}
        </div>
        <div className={`shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md`}>
          <Icon size={15} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function NumberBody(p: NumberProps) {
  const trend = p.trendPct
  const isUp = trend !== null && trend !== undefined && trend > 0
  const isDown = trend !== null && trend !== undefined && trend < 0
  const trendGood = p.trendUpIsGood ? isUp : isDown
  const trendBad  = p.trendUpIsGood ? isDown : isUp
  const trendColor = trend === null || trend === undefined
    ? "text-gray-400"
    : trendGood ? "text-emerald-400"
    : trendBad  ? "text-red-400"
    : "text-gray-400"
  const TrendIcon = trend === null || trend === undefined || trend === 0
    ? Minus
    : (isUp ? ArrowUp : ArrowDown)
  return (
    <>
      <div className="mt-2 text-2xl font-black font-mono tabular-nums text-white tracking-tight leading-none">
        {p.loading ? <span className="text-gray-600">—</span> : `${p.prefix ?? ""}${formatMontantFull(p.value, false)} F`}
      </div>
      {(trend !== null && trend !== undefined) && (
        <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${trendColor}`}>
          <TrendIcon size={11} />
          {Math.abs(trend).toFixed(0)}% vs période préc.
        </div>
      )}
      {p.note && (
        <div className="mt-1 text-[10.5px] text-gray-500">{p.note}</div>
      )}
    </>
  )
}

function ToplistBody(p: ToplistProps) {
  if (p.loading) {
    return (
      <div className="mt-2 space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-[#1A2235] animate-pulse" />
        ))}
      </div>
    )
  }
  if (p.rows.length === 0) {
    return (
      <div className="mt-2 text-[11px] text-gray-500 italic">Aucune donnée</div>
    )
  }
  return (
    <ul className="mt-2 space-y-1">
      {p.rows.slice(0, 3).map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-2 text-[12px]">
          <span className="text-gray-200 truncate max-w-[110px]">{r.label}</span>
          <span className="font-mono font-bold tabular-nums text-white shrink-0">{formatMontantCompact(r.total)}</span>
        </li>
      ))}
    </ul>
  )
}
