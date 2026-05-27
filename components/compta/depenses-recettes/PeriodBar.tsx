"use client"

/**
 * Pill-group des 7 onglets de période — réutilisable Dépenses + Recettes
 * (Phase 4.x Vague 3.5 §2.2.2).
 *
 * Onglets : Aujourd'hui · Cette semaine · Ce mois (default) · Mois préc.
 *           · 3 mois · Année · Personnalisé (2 inputs date Du / Au).
 *
 * Émet `(period, range)` à chaque sélection.
 */

import { useEffect, useMemo, useState } from "react"
import { Calendar } from "lucide-react"
import type { FlowPeriodKey, FlowDateRange, FlowKind } from "@/types/compta-ui"

type Tab = { key: FlowPeriodKey; label: string }
const TABS: Tab[] = [
  { key: "today",           label: "Aujourd'hui" },
  { key: "this_week",       label: "Cette semaine" },
  { key: "this_month",      label: "Ce mois" },
  { key: "previous_month",  label: "Mois préc." },
  { key: "three_months",    label: "3 mois" },
  { key: "year",            label: "Année" },
  { key: "custom",          label: "Personnalisé" },
]

function pad(n: number): string { return String(n).padStart(2, "0") }
function iso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export function computePeriodRange(key: FlowPeriodKey): FlowDateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (key) {
    case "today": {
      return { from: iso(now), to: iso(now) }
    }
    case "this_week": {
      // Lundi de la semaine
      const dow = (now.getDay() + 6) % 7   // lundi=0
      const start = new Date(now); start.setDate(now.getDate() - dow)
      return { from: iso(start), to: iso(now) }
    }
    case "this_month": {
      return { from: iso(new Date(y, m, 1)), to: iso(now) }
    }
    case "previous_month": {
      const start = new Date(y, m - 1, 1)
      const end   = new Date(y, m, 0)
      return { from: iso(start), to: iso(end) }
    }
    case "three_months": {
      const start = new Date(y, m - 2, 1)
      const end   = new Date(y, m + 1, 0)
      return { from: iso(start), to: iso(end) }
    }
    case "year": {
      return { from: `${y}-01-01`, to: iso(now) }
    }
    case "custom":
    default: {
      return { from: iso(new Date(y, m, 1)), to: iso(now) }
    }
  }
}

type Props = {
  kind:       FlowKind          // pour la couleur thématique
  period:     FlowPeriodKey
  range:      FlowDateRange
  onChange:   (period: FlowPeriodKey, range: FlowDateRange) => void
}

export function PeriodBar({ kind, period, range, onChange }: Props) {
  const accentText = kind === "depenses" ? "text-red-400" : "text-emerald-400"
  const [customFrom, setCustomFrom] = useState(range.from)
  const [customTo,   setCustomTo]   = useState(range.to)

  // Sync inputs custom quand la prop change
  useEffect(() => {
    if (period === "custom") {
      setCustomFrom(range.from)
      setCustomTo(range.to)
    }
  }, [period, range.from, range.to])

  const customValid = useMemo(
    () => /^\d{4}-\d{2}-\d{2}$/.test(customFrom) && /^\d{4}-\d{2}-\d{2}$/.test(customTo) && customFrom <= customTo,
    [customFrom, customTo],
  )

  function applyCustom() {
    if (!customValid) return
    onChange("custom", { from: customFrom, to: customTo })
  }

  return (
    <div className="space-y-2">
      <div className="inline-flex flex-wrap bg-[#1A2235] rounded-lg p-1 gap-0.5">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (t.key === "custom") {
                onChange("custom", { from: customFrom, to: customTo })
              } else {
                const r = computePeriodRange(t.key)
                onChange(t.key, r)
              }
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              period === t.key
                ? `bg-[#0D1424] ${accentText} shadow-sm`
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0D1424] border border-[#1E2D45]">
          <Calendar size={13} className="text-gray-400" />
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
            Du
            <input
              type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              onBlur={applyCustom}
              max={customTo}
              className="bg-[#1A2235] border border-[#1E2D45] rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
            Au
            <input
              type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              onBlur={applyCustom}
              min={customFrom}
              className="bg-[#1A2235] border border-[#1E2D45] rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </label>
          <button
            type="button" onClick={applyCustom} disabled={!customValid}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
              customValid
                ? `${accentText} hover:opacity-80`
                : "text-gray-600 cursor-not-allowed"
            }`}
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  )
}
