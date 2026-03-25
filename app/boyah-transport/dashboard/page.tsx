"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts"
import { TrendingUp, Car, XCircle, DollarSign } from "lucide-react"

type Order = {
  id: string; short_id: number; status: string; price?: string
  created_at: string; car?: { brand_model?: string; brand?: string; model?: string }
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D1424] border border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-emerald-400">{Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs opacity-60">FCFA</span></p>
    </div>
  )
}

export default function BoyahDashboardPage() {
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/yango/orders")
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Chargement des données Yango...
      </div>
    </div>
  )

  const today        = new Date().toISOString().slice(0, 10)
  const todayOrders  = orders.filter(o => o.created_at?.startsWith(today))
  const completed    = orders.filter(o => o.status === "complete")
  const cancelled    = orders.filter(o => o.status === "cancelled").length
  const cancelRate   = orders.length > 0 ? ((cancelled / orders.length) * 100).toFixed(0) : 0
  const todayRevenue = todayOrders.filter(o => o.status === "complete").reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const totalRevenue = completed.reduce((s, o) => s + parseFloat(o.price || "0"), 0)

  const hourlyData = Object.values(
    todayOrders.reduce((acc: Record<string, { name: string; value: number }>, o) => {
      const h = new Date(o.created_at).getHours()
      if (!acc[h]) acc[h] = { name: `${h}h`, value: 0 }
      acc[h].value += parseFloat(o.price || "0")
      return acc
    }, {})
  ).sort((a, b) => parseInt(a.name) - parseInt(b.name))

  const topVehicles = Object.entries(
    orders.reduce((acc: Record<string, number>, o) => {
      const k = o.car?.brand_model || "N/A"
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const kpis = [
    { label: "Aujourd'hui",  value: todayRevenue, isCurrency: true,  icon: TrendingUp, color: "from-emerald-400 to-teal-600",  glow: "bg-emerald-500" },
    { label: "Total",        value: totalRevenue, isCurrency: true,  icon: DollarSign, color: "from-indigo-400 to-blue-600",   glow: "bg-indigo-500" },
    { label: "Courses",      value: todayOrders.length, isCurrency: false, icon: Car, color: "from-sky-400 to-cyan-600",     glow: "bg-sky-500" },
    { label: "Annulations",  value: `${cancelRate}%`, isCurrency: false,  icon: XCircle, color: "from-red-400 to-rose-600",  glow: "bg-red-500" },
  ]

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Boyah Transport</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Données en temps réel via API Yango</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Yango Live</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-all">
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.glow}`} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 break-words">
                    {k.isCurrency && typeof k.value === "number"
                      ? <>{k.value.toLocaleString("fr-FR")}<span className="text-xs font-semibold text-gray-400 dark:text-gray-600 ml-1">FCFA</span></>
                      : k.value
                    }
                  </p>
                </div>
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CHART */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Revenus aujourd'hui</h2>
        <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">Par heure</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TOP VEHICULES + DERNIÈRES COURSES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Top véhicules</h2>
          <div className="space-y-2">
            {topVehicles.map(([name, count], i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-[#1A2235] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-600 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                </div>
                <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg">{count} course{count > 1 ? "s" : ""}</span>
              </div>
            ))}
            {topVehicles.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Aucune donnée</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Dernières courses</h2>
          <div className="max-h-[280px] overflow-y-auto space-y-2">
            {orders.slice(0, 15).map((o, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-[#1A2235] last:border-0 gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-600 font-mono flex-shrink-0">#{o.short_id}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{o.car?.brand_model || "—"}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  {parseFloat(o.price || "0").toLocaleString("fr-FR")}
                </span>
                <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full
                  ${o.status === "complete"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
