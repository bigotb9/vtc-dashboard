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
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold font-numeric text-indigo-600 dark:text-indigo-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs font-semibold opacity-70">FCFA</span>
      </p>
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
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Chiffre d&apos;affaires journalier</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Évolution des recettes dans le temps</p>
        </div>

        {/* Filtres période */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1A2235] rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                period === p.value
                  ? "bg-white dark:bg-[#0D1424] text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total période", value: total },
          { label: "Moyenne / jour", value: average },
          { label: "Meilleur jour",  value: max },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-50 dark:bg-[#0A1020] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider font-semibold mb-1">{stat.label}</p>
            <p className="text-sm font-bold font-numeric text-gray-900 dark:text-white">
              {Math.round(stat.value).toLocaleString("fr-FR")}
              <span className="text-[10px] font-semibold text-gray-400 ml-1">FCFA</span>
            </p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          {average > 0 && (
            <ReferenceLine y={average} stroke="#6366f1" strokeDasharray="4 4" strokeOpacity={0.4}
              label={{ value: "moy.", position: "right", fontSize: 9, fill: "#6366f1", opacity: 0.6 }} />
          )}
          <Area type="monotone" dataKey="chiffre_affaire" stroke="#6366f1" strokeWidth={2.5}
            fill="url(#caGradient)" dot={false} activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    </AnimatedChart>
  )
}
