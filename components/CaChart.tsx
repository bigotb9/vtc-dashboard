"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts"
import AnimatedChart from "@/components/AnimatedChart"

type CaRow = { date_recette: string; chiffre_affaire: number }
type Period = "7j" | "30j" | "90j" | "tout"

const PERIODS: { label: string; value: Period }[] = [
  { label: "7j",   value: "7j"   },
  { label: "30j",  value: "30j"  },
  { label: "90j",  value: "90j"  },
  { label: "Tout", value: "tout" },
]

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const val = Number(payload[0].value)
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-2xl border border-white/10"
      style={{
        background: "rgba(10, 14, 26, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 0 0 1px rgba(99,102,241,0.2), 0 16px 48px -12px rgba(0,0,0,0.7)",
      }}
    >
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-black text-white font-numeric">{val.toLocaleString("fr-FR")}</span>
        <span className="text-xs font-semibold text-indigo-400">FCFA</span>
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-gray-200 dark:bg-[#1A2235] rounded" />
          <div className="h-3 w-32 bg-gray-100 dark:bg-[#1A2235]/60 rounded" />
        </div>
        <div className="h-8 w-32 bg-gray-100 dark:bg-[#1A2235] rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="bg-gray-50 dark:bg-[#0A1020] rounded-xl px-3 py-2.5 space-y-1.5">
            <div className="h-2.5 w-20 bg-gray-200 dark:bg-[#1A2235] rounded" />
            <div className="h-4 w-28 bg-gray-200 dark:bg-[#1A2235] rounded" />
          </div>
        ))}
      </div>
      <div className="relative h-[240px] overflow-hidden rounded-xl bg-gray-50 dark:bg-[#0A1020]">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  )
}

export default function CaChart() {
  const [data, setData]         = useState<CaRow[]>([])
  const [period, setPeriod]     = useState<Period>("30j")
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from("vue_ca_journalier")
      .select("date_recette, chiffre_affaire")
      .order("date_recette", { ascending: true })
      .then(({ data }) => { setData(data || []); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (period === "tout") return data
    const days = period === "7j" ? 7 : period === "30j" ? 30 : 90
    const now   = new Date()
    const cutoff = new Date(now.getTime() - days * 86400000).toISOString().split("T")[0]
    return data.filter(d => d.date_recette >= cutoff)
  }, [data, period])

  const formatted = filtered.map(d => ({
    ...d,
    date: new Date(d.date_recette).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }))

  const total   = filtered.reduce((s, d) => s + Number(d.chiffre_affaire || 0), 0)
  const average = filtered.length ? total / filtered.length : 0
  const max     = filtered.length ? Math.max(...filtered.map(d => Number(d.chiffre_affaire || 0))) : 0

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
        <ChartSkeleton />
      </div>
    )
  }

  return (
    <AnimatedChart>
    <div
      className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden relative"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px -8px rgba(0,0,0,0.3)" }}
    >
      {/* Subtle top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500 opacity-60" />

      {/* Ambient glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.04] bg-indigo-500 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5 relative">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Chiffre d&apos;affaires journalier</h2>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">Évolution des recettes dans le temps</p>
        </div>

        {/* Filtres période */}
        <div className="flex items-center gap-0.5 bg-gray-100/80 dark:bg-[#1A2235] rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                period === p.value
                  ? "bg-white dark:bg-[#0D1424] text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-500/20"
                  : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini stats — style chips premium */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { label: "Total période", value: total,   color: "text-indigo-400" },
          { label: "Moyenne / jour", value: average, color: "text-sky-400" },
          { label: "Meilleur jour",  value: max,     color: "text-emerald-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-50/80 dark:bg-[#080C14]/60 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-[#1E2D45]">
            <p className="text-[9.5px] text-gray-400 dark:text-gray-600 uppercase tracking-widest font-bold mb-1.5">{stat.label}</p>
            <p className={`text-[13px] font-black font-numeric ${stat.color}`}>
              {Math.round(stat.value).toLocaleString("fr-FR")}
              <span className="text-[9px] font-semibold text-gray-500 ml-1">F</span>
            </p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted} margin={{ top: 8, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="60%"  stopColor="#6366f1" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="dark:[&>line]:stroke-[#131D2E]" vertical={false}
            stroke="rgba(241,245,249,0.5)" />
          <XAxis dataKey="date" tick={{ fontSize: 9.5, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9.5, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={32} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(99,102,241,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
          {average > 0 && (
            <ReferenceLine y={average} stroke="#6366f1" strokeDasharray="3 5" strokeOpacity={0.35} strokeWidth={1}
              label={{ value: "moy", position: "right", fontSize: 8.5, fill: "#818cf8", opacity: 0.7 }} />
          )}
          <Area
            type="monotone" dataKey="chiffre_affaire"
            stroke="#818cf8" strokeWidth={2}
            fill="url(#caGradient)"
            dot={false}
            activeDot={{ r: 5, fill: "#818cf8", stroke: "rgba(99,102,241,0.4)", strokeWidth: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    </AnimatedChart>
  )
}
