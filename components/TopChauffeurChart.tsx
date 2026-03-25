"use client"

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"
import { TrendingUp, TrendingDown, Minus, Award, Calendar, Zap } from "lucide-react"

type Versement = { date_recette: string; montant: number }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D1424] border border-amber-500/20 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-500 mb-0.5">
        {label ? new Date(label).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : ""}
      </p>
      <p className="text-sm font-bold text-amber-400">
        {Number(payload[0].value).toLocaleString("fr-FR")}
        <span className="text-[10px] font-normal ml-1 opacity-60">FCFA</span>
      </p>
    </div>
  )
}

export default function TopChauffeurChart({ data }: { data: Versement[] }) {
  if (!data.length) return null

  const sorted   = [...data].sort((a, b) => new Date(a.date_recette).getTime() - new Date(b.date_recette).getTime())
  const montants = sorted.map(d => d.montant)
  const total    = montants.reduce((s, v) => s + v, 0)
  const moyenne  = montants.length > 0 ? Math.round(total / montants.length) : 0
  const meilleur = Math.max(...montants)
  const dernier  = montants[montants.length - 1] ?? 0
  const avantDernier = montants[montants.length - 2] ?? dernier
  const tendance = dernier > avantDernier ? "up" : dernier < avantDernier ? "down" : "flat"
  const jouresTravailles = montants.filter(m => m > 0).length

  const TrendIcon = tendance === "up" ? TrendingUp : tendance === "down" ? TrendingDown : Minus
  const trendColor = tendance === "up" ? "text-emerald-400" : tendance === "down" ? "text-red-400" : "text-gray-400"

  return (
    <div className="mt-4 space-y-3">

      {/* KPI MINI CARDS */}
      <div className="grid grid-cols-3 gap-2">

        <div className="flex flex-col gap-0.5 bg-amber-500/5 border border-amber-500/15 rounded-xl p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Zap size={9} className="text-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/70">Moyenne / j</span>
          </div>
          <span className="text-sm font-bold text-white leading-tight">
            {moyenne.toLocaleString("fr-FR")}
          </span>
          <span className="text-[9px] text-gray-500">FCFA</span>
        </div>

        <div className="flex flex-col gap-0.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Award size={9} className="text-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/70">Meilleur j.</span>
          </div>
          <span className="text-sm font-bold text-white leading-tight">
            {meilleur.toLocaleString("fr-FR")}
          </span>
          <span className="text-[9px] text-gray-500">FCFA</span>
        </div>

        <div className="flex flex-col gap-0.5 bg-sky-500/5 border border-sky-500/15 rounded-xl p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Calendar size={9} className="text-sky-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-sky-500/70">Jours actifs</span>
          </div>
          <span className="text-sm font-bold text-white leading-tight">{jouresTravailles}</span>
          <span className="text-[9px] text-gray-500">jours</span>
        </div>

      </div>

      {/* SPARKLINE + TENDANCE */}
      <div className="relative bg-gradient-to-b from-amber-500/[0.06] to-transparent border border-amber-500/10 rounded-xl overflow-hidden p-3 pb-0">

        {/* Tendance badge */}
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[10px] text-gray-500 font-medium">Évolution des versements</span>
          <div className={`flex items-center gap-1 text-[10px] font-bold ${trendColor}`}>
            <TrendIcon size={11} />
            {tendance === "up" ? "En hausse" : tendance === "down" ? "En baisse" : "Stable"}
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={sorted} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="topGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="montant"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#topGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>

      </div>

    </div>
  )
}
