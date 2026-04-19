"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts"
import AnimatedChart from "@/components/AnimatedChart"

type Period = "30j" | "90j" | "tout"

type Row = {
  date: string
  ca: number
  depenses: number
  profit: number
}

const PERIODS: { label: string; value: Period }[] = [
  { label: "30j",  value: "30j"  },
  { label: "90j",  value: "90j"  },
  { label: "Tout", value: "tout" },
]

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl space-y-1.5">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-2 font-semibold">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-bold font-numeric" style={{ color: p.color }}>
            {Number(p.value).toLocaleString("fr-FR")} <span className="opacity-60 font-normal">F</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CaDepensesChart() {
  const [caData,  setCaData]  = useState<{ date_recette: string; chiffre_affaire: number }[]>([])
  const [depData, setDepData] = useState<{ date_depense: string; montant: number }[]>([])
  const [period,  setPeriod]  = useState<Period>("30j")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from("vue_ca_journalier").select("date_recette, chiffre_affaire").order("date_recette", { ascending: true }),
      supabase.from("depenses_vehicules").select("date_depense, montant").order("date_depense", { ascending: true }),
    ]).then(([{ data: ca }, { data: dep }]) => {
      setCaData(ca || [])
      setDepData(dep || [])
      setLoading(false)
    })
  }, [])

  const data = useMemo((): Row[] => {
    const cutoff = period !== "tout"
      ? new Date(Date.now() - (period === "30j" ? 30 : 90) * 86400000).toISOString().split("T")[0]
      : "1970-01-01"

    // Agréger CA par date
    const caByDate: Record<string, number> = {}
    for (const r of caData) {
      if (r.date_recette < cutoff) continue
      caByDate[r.date_recette] = (caByDate[r.date_recette] || 0) + Number(r.chiffre_affaire || 0)
    }

    // Agréger dépenses par date
    const depByDate: Record<string, number> = {}
    for (const d of depData) {
      if (!d.date_depense || d.date_depense < cutoff) continue
      depByDate[d.date_depense] = (depByDate[d.date_depense] || 0) + Number(d.montant || 0)
    }

    // Fusionner
    const allDates = Array.from(new Set([...Object.keys(caByDate), ...Object.keys(depByDate)])).sort()
    return allDates.map(date => ({
      date: new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      ca:       caByDate[date]  || 0,
      depenses: depByDate[date] || 0,
      profit:   (caByDate[date] || 0) - (depByDate[date] || 0),
    }))
  }, [caData, depData, period])

  const totCA  = data.reduce((s, d) => s + d.ca, 0)
  const totDep = data.reduce((s, d) => s + d.depenses, 0)
  const profit = totCA - totDep

  return (
    <AnimatedChart>
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">CA vs Dépenses</h2>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Comparaison revenus et charges</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1A2235] rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  period === p.value
                    ? "bg-white dark:bg-[#0D1424] text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs résumé */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "CA période",     value: totCA,  color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Dépenses",       value: totDep, color: "text-red-600 dark:text-red-400" },
            { label: "Profit net",     value: profit, color: profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400" },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-[#0A1020] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider font-semibold mb-1">{s.label}</p>
              <p className={`text-sm font-bold font-numeric ${s.color}`}>
                {Math.round(s.value).toLocaleString("fr-FR")}
                <span className="text-[10px] font-semibold text-gray-400 ml-1">FCFA</span>
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="h-[240px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="caGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={v => <span className="text-xs text-gray-500 dark:text-gray-400">{v}</span>}
                wrapperStyle={{ paddingTop: 12 }}
              />
              <Area type="monotone" dataKey="ca" name="CA" stroke="#6366f1" strokeWidth={2}
                fill="url(#caGrad2)" dot={false} activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }} />
              <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={18} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </AnimatedChart>
  )
}
