"use client"

import { useEffect, useState, useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import {
  TrendingUp, Car, XCircle, DollarSign, Percent,
  Activity, CheckCircle, Clock, ArrowUpRight,
} from "lucide-react"

const COMMISSION_RATE = 0.025

type Order = {
  id: string; short_id: number; status: string; price?: string
  category?: string; payment_method?: string; created_at: string
  driver_profile?: { name?: string }
  car?: { brand_model?: string; brand?: string; model?: string }
}

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

const RevTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={`text-xs font-bold ${i === 0 ? "text-emerald-500" : "text-violet-500"}`}>
          {p.name === "commission" ? "Commission" : "Revenus"}: {Number(p.value).toLocaleString("fr-FR")} FCFA
        </p>
      ))}
    </div>
  )
}

export default function BoyahDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const fetchOrders = async () => {
    const r = await fetch("/api/yango/orders")
    const d = await r.json()
    setOrders(d.orders || [])
  }

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false))
    const lastSyncTs = parseInt(localStorage.getItem("yango_last_sync") || "0")
    if (Date.now() - lastSyncTs > 5 * 60 * 1000) {
      setSyncing(true)
      fetch("/api/yango/sync-orders", { method: "POST" })
        .then(r => r.json())
        .then(async (d) => {
          if (d.synced > 0) await fetchOrders()
          setLastSync(`${d.synced ?? 0} nouvelles`)
          localStorage.setItem("yango_last_sync", Date.now().toString())
        })
        .catch(() => setLastSync("erreur sync"))
        .finally(() => setSyncing(false))
    }
  }, [])

  const today       = new Date().toISOString().slice(0, 10)
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const weekAgo     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const completed    = orders.filter(o => o.status === "complete")
  const cancelled    = orders.filter(o => o.status === "cancelled").length
  const todayOrders  = orders.filter(o => o.created_at?.startsWith(today))

  const totalRevenue  = completed.reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const monthRevenue  = completed.filter(o => o.created_at?.startsWith(monthPrefix)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const weekRevenue   = completed.filter(o => (o.created_at?.slice(0, 10) || "") >= weekAgo).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const todayRevenue  = todayOrders.filter(o => o.status === "complete").reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const completionRate = orders.length > 0 ? ((completed.length / orders.length) * 100).toFixed(1) : "0"
  const avgOrder      = completed.length > 0 ? totalRevenue / completed.length : 0

  const dailyData = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d   = new Date(Date.now() - (29 - i) * 86400000)
    const day = d.toISOString().slice(0, 10)
    const rev = completed.filter(o => o.created_at?.startsWith(day)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
    return { name: `${d.getDate()}/${d.getMonth() + 1}`, revenus: Math.round(rev), commission: Math.round(rev * COMMISSION_RATE) }
  }), [completed])

  const hourlyData = useMemo(() => {
    const map: Record<number, number> = {}
    todayOrders.filter(o => o.status === "complete").forEach(o => {
      const h = new Date(o.created_at).getHours()
      map[h] = (map[h] || 0) + parseFloat(o.price || "0")
    })
    return Array.from({ length: 24 }, (_, h) => ({ name: `${h}h`, value: Math.round(map[h] || 0) })).filter(h => h.value > 0)
  }, [todayOrders])

  const pieData = [
    { name: "Complétées", value: completed.length,  color: "#10b981" },
    { name: "Annulées",   value: cancelled,          color: "#ef4444" },
    { name: "Autres",     value: orders.length - completed.length - cancelled, color: "#6366f1" },
  ].filter(d => d.value > 0)

  const topVehicles = useMemo(() => {
    const map: Record<string, { courses: number; revenus: number }> = {}
    completed.forEach(o => {
      const k = o.car?.brand_model || "N/A"
      if (!map[k]) map[k] = { courses: 0, revenus: 0 }
      map[k].courses++
      map[k].revenus += parseFloat(o.price || "0")
    })
    return Object.entries(map).map(([name, d]) => ({ name, ...d, revenus: Math.round(d.revenus) }))
      .sort((a, b) => b.revenus - a.revenus).slice(0, 6)
  }, [completed])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Chargement des données Yango…
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Boyah Transport</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            {orders.length.toLocaleString("fr-FR")} courses · {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {syncing ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
            <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Synchronisation…</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {lastSync ? `Sync: ${lastSync}` : "Yango Live"}
            </span>
          </div>
        )}
      </div>

      {/* REVENUS */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <DollarSign size={12} /> Revenus Boyah Transport
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label: "Aujourd'hui",   value: todayRevenue,  icon: Clock,       color: "from-emerald-400 to-teal-500",   glow: "bg-emerald-400" },
            { label: "Cette semaine", value: weekRevenue,   icon: Activity,    color: "from-sky-400 to-cyan-500",       glow: "bg-sky-400" },
            { label: "Ce mois",       value: monthRevenue,  icon: TrendingUp,  color: "from-indigo-400 to-blue-500",    glow: "bg-indigo-400" },
            { label: "Total général", value: totalRevenue,  icon: DollarSign,  color: "from-violet-400 to-purple-500",  glow: "bg-violet-400" },
          ] as const).map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden group hover:shadow-lg dark:hover:shadow-black/20 transition-all cursor-default">
                <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.08] blur-2xl ${k.glow}`} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5">{fmt(k.value)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">FCFA</p>
                  </div>
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* COMMISSIONS */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Percent size={12} /> Mes commissions (2,5%)
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Aujourd'hui",   value: todayRevenue  * COMMISSION_RATE },
            { label: "Cette semaine", value: weekRevenue   * COMMISSION_RATE },
            { label: "Ce mois",       value: monthRevenue  * COMMISSION_RATE },
            { label: "Total général", value: totalRevenue  * COMMISSION_RATE },
          ].map(k => (
            <div key={k.label} className="relative bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/5 dark:to-purple-500/10 rounded-2xl border border-violet-100 dark:border-violet-500/20 p-5 overflow-hidden hover:shadow-lg transition-all cursor-default">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-2xl bg-violet-400" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Percent size={10} className="text-violet-500" />
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">{k.label}</p>
                </div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{fmt(k.value)}</p>
                <p className="text-xs text-violet-400 mt-0.5">FCFA</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVITÉ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "Total courses",   value: orders.length,      sub: "historique complet",         icon: Car,         bg: "bg-indigo-50 dark:bg-indigo-500/10",   color: "text-indigo-600 dark:text-indigo-400" },
          { label: "Complétées",      value: completed.length,   sub: `${completionRate}% de taux`, icon: CheckCircle, bg: "bg-emerald-50 dark:bg-emerald-500/10", color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Annulées",        value: cancelled,          sub: `${(cancelled / Math.max(orders.length, 1) * 100).toFixed(1)}% de taux`, icon: XCircle, bg: "bg-red-50 dark:bg-red-500/10", color: "text-red-600 dark:text-red-400" },
          { label: "Panier moyen",    value: Math.round(avgOrder), sub: "par course complétée",     icon: ArrowUpRight, bg: "bg-sky-50 dark:bg-sky-500/10",        color: "text-sky-600 dark:text-sky-400", suffix: " FCFA" },
        ] as const).map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={k.color} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium truncate">{k.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(k.value)}{("suffix" in k ? k.suffix : "") || ""}</p>
                <p className="text-xs text-gray-400">{k.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* CHART 30 JOURS */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Évolution des revenus & commissions</h2>
            <p className="text-xs text-gray-400 mt-0.5">30 derniers jours</p>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />Revenus</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-500 rounded inline-block" />Commission</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={35} />
            <Tooltip content={<RevTooltip />} />
            <Area type="monotone" dataKey="revenus"    stroke="#10b981" strokeWidth={2} fill="url(#gRev)"  dot={false} />
            <Area type="monotone" dataKey="commission" stroke="#8b5cf6" strokeWidth={2} fill="url(#gComm)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* CHARTS SECONDAIRES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Horaire */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Revenus aujourd'hui</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Par heure</p>
          {hourlyData.length === 0
            ? <div className="flex items-center justify-center h-[180px] text-sm text-gray-400">Aucune course aujourd'hui</div>
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<RevTooltip />} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Pie statuts */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Répartition statuts</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">Distribution des courses</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v, name) => [`${v}`, String(name)]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{d.name} <span className="font-semibold text-gray-700 dark:text-gray-300">({d.value})</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Top véhicules */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Top véhicules</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Par revenus générés</p>
          <div className="space-y-3">
            {topVehicles.map((v, i) => {
              const pct = topVehicles[0]?.revenus > 0 ? (v.revenus / topVehicles[0].revenus) * 100 : 0
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-gray-400 w-3 flex-shrink-0">{i + 1}</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{v.name}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2">{fmt(v.revenus)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-[#1E2D45] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {topVehicles.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucune donnée</p>}
          </div>
        </div>
      </div>

      {/* TABLE DERNIÈRES COURSES */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1E2D45] flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Dernières courses</h2>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-[#1E2D45] px-2.5 py-1 rounded-lg font-medium">{orders.length.toLocaleString("fr-FR")} total</span>
        </div>
        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-[#080F1E] sticky top-0">
              <tr>
                {["ID", "Date", "Statut", "Véhicule", "Chauffeur", "Prix", "Commission"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
              {orders.slice(0, 30).map((o, i) => {
                const price = parseFloat(o.price || "0")
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{o.short_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        o.status === "complete"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}>
                        {o.status === "complete" ? "Complétée" : "Annulée"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{o.car?.brand_model || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{o.driver_profile?.name || "—"}</td>
                    <td className="px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(price)} FCFA</td>
                    <td className="px-4 py-3 text-xs font-semibold text-violet-600 dark:text-violet-400 whitespace-nowrap">{fmt(price * COMMISSION_RATE)} FCFA</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
