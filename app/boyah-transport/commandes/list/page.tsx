"use client"

import { useEffect, useState, useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Search, TrendingUp, CheckCircle, XCircle, DollarSign, Percent, Filter } from "lucide-react"

const COMMISSION_RATE = 0.025
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Order = {
  id: string; short_id: number; status: string; category?: string
  price?: string; payment_method?: string; created_at: string
  driver_profile?: { name?: string }
  car?: { brand_model?: string }
}

type FilterTab = "all" | "complete" | "cancelled"

const RevTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 mb-1 font-medium">{label}</p>
      <p className="text-xs font-bold text-emerald-500">{Number(payload[0].value).toLocaleString("fr-FR")} FCFA</p>
    </div>
  )
}

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch]   = useState("")
  const [tab, setTab]         = useState<FilterTab>("all")
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const fetchOrders = async () => {
    const res = await fetch("/api/yango/orders")
    const data = await res.json()
    setOrders(data.orders || [])
  }

  useEffect(() => {
    fetchOrders()
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

  const completed    = orders.filter(o => o.status === "complete")
  const cancelled    = orders.filter(o => o.status === "cancelled")
  const totalRevenue = completed.reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const avgOrder     = completed.length > 0 ? totalRevenue / completed.length : 0
  const cancelRate   = orders.length > 0 ? (cancelled.length / orders.length * 100).toFixed(1) : "0"

  const monthPrefix = new Date().toISOString().slice(0, 7)
  const weekAgo     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const commTotal   = totalRevenue * COMMISSION_RATE
  const commMonth   = completed.filter(o => o.created_at?.startsWith(monthPrefix)).reduce((s, o) => s + parseFloat(o.price || "0"), 0) * COMMISSION_RATE
  const commWeek    = completed.filter(o => (o.created_at?.slice(0, 10) || "") >= weekAgo).reduce((s, o) => s + parseFloat(o.price || "0"), 0) * COMMISSION_RATE

  // 30-day chart
  const dailyData = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d   = new Date(Date.now() - (29 - i) * 86400000)
    const day = d.toISOString().slice(0, 10)
    const rev = completed.filter(o => o.created_at?.startsWith(day)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
    return { name: `${d.getDate()}/${d.getMonth() + 1}`, revenus: Math.round(rev) }
  }), [completed])

  // Catégories
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { const k = o.category || "Autre"; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [orders])

  // Filtered list
  const baseList = tab === "complete" ? completed : tab === "cancelled" ? cancelled : orders
  const filtered = baseList.filter(o =>
    `${o.short_id} ${o.category || ""} ${o.driver_profile?.name || ""} ${o.car?.brand_model || ""}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: FilterTab; label: string; count: number; color: string; active: string }[] = [
    { key: "all",       label: "Toutes",     count: orders.length,    color: "text-gray-600 dark:text-gray-400",   active: "bg-gray-900 dark:bg-white text-white dark:text-gray-900" },
    { key: "complete",  label: "Complétées", count: completed.length, color: "text-emerald-600 dark:text-emerald-400", active: "bg-emerald-500 text-white" },
    { key: "cancelled", label: "Annulées",   count: cancelled.length, color: "text-red-500 dark:text-red-400",     active: "bg-red-500 text-white" },
  ]

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commandes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length.toLocaleString("fr-FR")} courses enregistrées</p>
        </div>
        {syncing ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
            <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Synchronisation…</span>
          </div>
        ) : lastSync && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Sync: {lastSync}</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "CA Total",       value: totalRevenue,          icon: DollarSign,  color: "from-emerald-400 to-teal-500",  glow: "bg-emerald-400", suffix: " FCFA" },
          { label: "Complétées",     value: completed.length,      icon: CheckCircle, color: "from-sky-400 to-cyan-500",      glow: "bg-sky-400",     suffix: "" },
          { label: "Annulations",    value: `${cancelRate}%`,      icon: XCircle,     color: "from-red-400 to-rose-500",      glow: "bg-red-400",     suffix: "" },
          { label: "Panier moyen",   value: Math.round(avgOrder),  icon: TrendingUp,  color: "from-indigo-400 to-blue-500",   glow: "bg-indigo-400",  suffix: " FCFA" },
        ] as const).map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-md transition-all">
              <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-10 blur-2xl ${k.glow}`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1.5">
                    {typeof k.value === "number" ? fmt(k.value) : k.value}{k.suffix}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* COMMISSION STRIP */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/5 dark:to-purple-500/10 rounded-2xl border border-violet-100 dark:border-violet-500/20 px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Percent size={14} className="text-violet-500" />
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Mes commissions (2,5%)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Cette semaine", value: commWeek },
            { label: "Ce mois",       value: commMonth },
            { label: "Total",         value: commTotal },
          ].map(k => (
            <div key={k.label}>
              <p className="text-xs text-violet-500 dark:text-violet-400 mb-0.5">{k.label}</p>
              <p className="text-lg font-bold text-violet-700 dark:text-violet-300">{fmt(k.value)} <span className="text-xs font-normal opacity-60">FCFA</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Revenus journaliers</h2>
          <p className="text-xs text-gray-400 mb-4">30 derniers jours</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<RevTooltip />} />
              <Area type="monotone" dataKey="revenus" stroke="#10b981" strokeWidth={2} fill="url(#gR)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Catégories</h2>
          <p className="text-xs text-gray-400 mb-4">Courses par type</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categoryData.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45] flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-[#080F1E] rounded-xl p-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? t.active : t.color + " hover:bg-gray-200 dark:hover:bg-[#1E2D45]"}`}
              >
                {t.label} <span className="ml-1 opacity-70">({t.count})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-4 py-2 text-xs bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 dark:text-gray-300 w-48"
              />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-xs text-gray-500">
              <Filter size={12} /> {filtered.length} résultats
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-[#080F1E] sticky top-0">
              <tr>
                {["ID", "Date", "Statut", "Catégorie", "Chauffeur", "Véhicule", "Paiement", "Prix", "Commission"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
              {filtered.map((o, i) => {
                const price = parseFloat(o.price || "0")
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{o.short_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{o.category || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{o.driver_profile?.name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{o.car?.brand_model || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 dark:bg-[#1E2D45] text-gray-600 dark:text-gray-400 rounded-md">{o.payment_method || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(price)} FCFA</td>
                    <td className="px-4 py-3 text-xs font-semibold text-violet-600 dark:text-violet-400 whitespace-nowrap">{fmt(price * COMMISSION_RATE)} FCFA</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">Aucune commande trouvée</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
