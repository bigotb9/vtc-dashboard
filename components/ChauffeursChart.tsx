"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts"

type ChauffeurPerformance = { nom: string; ca: number }

const COLORS = ["#6366f1","#8b5cf6","#a78bfa","#7c3aed","#4f46e5","#818cf8","#c4b5fd"]

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1 font-medium">{label}</p>
      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs opacity-60">FCFA</span>
      </p>
    </div>
  )
}

export default function ChauffeursChart({ data }: { data: ChauffeurPerformance[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data.slice(0, 10)} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
        <XAxis dataKey="nom" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
          angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
          tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="ca" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
