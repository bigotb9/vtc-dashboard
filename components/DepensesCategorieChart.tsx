"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

type DepenseCategorie = { type_depense: string; total_depenses: number }

const PALETTE = ["#6366f1","#8b5cf6","#ec4899","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4"]

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{payload[0].name}</p>
      <p className="text-sm font-bold text-red-600 dark:text-red-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs font-semibold opacity-70">FCFA</span>
      </p>
    </div>
  )
}

export default function DepensesCategorieChart({ data }: { data: DepenseCategorie[] }) {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Dépenses par catégorie</h2>
      <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">Répartition des charges</p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="total_depenses" nameKey="type_depense"
            outerRadius={90} innerRadius={45} paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={v => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
