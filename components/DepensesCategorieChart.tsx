"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

type DepenseCategorie = { type_depense: string; total_depenses: number }

const PALETTE = ["#6366f1","#8b5cf6","#ec4899","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4"]

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{payload[0].name}</p>
      <p className="text-sm font-bold font-numeric text-red-600 dark:text-red-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs font-semibold opacity-70">FCFA</span>
      </p>
    </div>
  )
}

export default function DepensesCategorieChart({ data }: { data: DepenseCategorie[] }) {
  const total = data.reduce((s, d) => s + Number(d.total_depenses || 0), 0)
  const sorted = [...data].sort((a, b) => Number(b.total_depenses) - Number(a.total_depenses))

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Dépenses par catégorie</h2>
      <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">
        Total : <span className="font-numeric font-semibold text-red-500">{total.toLocaleString("fr-FR")} FCFA</span>
      </p>

      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={sorted} dataKey="total_depenses" nameKey="type_depense"
            outerRadius={80} innerRadius={48} paddingAngle={3} strokeWidth={0}>
            {sorted.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Légende custom avec montants et pourcentages */}
      <div className="mt-4 space-y-2 max-h-[160px] overflow-y-auto">
        {sorted.map((d, i) => {
          const pct = total > 0 ? ((Number(d.total_depenses) / total) * 100).toFixed(1) : "0"
          return (
            <div key={d.type_depense} className="flex items-center gap-2 group">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                {d.type_depense || "Autre"}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-600 font-numeric flex-shrink-0">{pct}%</span>
              <span className="text-xs font-bold font-numeric text-red-600 dark:text-red-400 flex-shrink-0 min-w-[80px] text-right">
                {Number(d.total_depenses).toLocaleString("fr-FR")}
                <span className="text-[9px] opacity-60 ml-0.5">F</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
