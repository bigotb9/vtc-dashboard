"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

type VehiculeChartItem = { date_recette: string; ca_jour: number }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-sky-600 dark:text-sky-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs opacity-60">FCFA</span>
      </p>
    </div>
  )
}

export default function VehiculesChart({ data }: { data: VehiculeChartItem[] }) {
  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.date_recette).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }))

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">CA véhicules — Journalier</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Performance de la flotte dans le temps</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-500/10 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-sky-500" />CA flotte
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vehGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="ca_jour" stroke="#0ea5e9" strokeWidth={2.5}
            fill="url(#vehGradient)" dot={false} activeDot={{ r: 5, fill: "#0ea5e9", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
