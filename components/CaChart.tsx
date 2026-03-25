"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts"

type CaRow = { date_recette: string; chiffre_affaire: number }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs font-semibold opacity-70">FCFA</span>
      </p>
    </div>
  )
}

export default function CaChart() {
  const [data, setData] = useState<CaRow[]>([])

  useEffect(() => {
    supabase
      .from("vue_ca_journalier")
      .select("date_recette, chiffre_affaire")
      .order("date_recette", { ascending: true })
      .then(({ data }) => setData(data || []))
  }, [])

  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.date_recette).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }))

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Chiffre d'affaires journalier</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Évolution des recettes dans le temps</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          CA journalier
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="chiffre_affaire" stroke="#6366f1" strokeWidth={2.5}
            fill="url(#caGradient)" dot={false} activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
