"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

type DepenseJour = { date_depense: string; total_depenses: number }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
        {label ? new Date(label).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : ""}
      </p>
      <p className="text-sm font-bold font-numeric text-red-600 dark:text-red-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs opacity-60">FCFA</span>
      </p>
    </div>
  )
}

export default function DepensesJourChart({ data }: { data: DepenseJour[] }) {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Évolution des dépenses</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Charges journalières</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-red-500" />Dépenses
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="depGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
          <XAxis dataKey="date_depense" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
            tickFormatter={d => { try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) } catch { return d } }}
            interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="total_depenses" stroke="#ef4444" strokeWidth={2.5}
            fill="url(#depGradient)" dot={false} activeDot={{ r: 5, fill: "#ef4444", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
