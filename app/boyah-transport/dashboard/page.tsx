"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import {
  TrendingUp, TrendingDown, Car, DollarSign, Percent,
  CheckCircle, XCircle, ArrowUpRight, RefreshCw, RotateCcw,
  Banknote, CreditCard, BarChart2, Users,
} from "lucide-react"
import { motion } from "framer-motion"
import Card3D from "@/components/Card3D"
import { shouldAutoSync, runQuickSync, runFullSync } from "@/lib/yangoSync"

// ── Types ──────────────────────────────────────────────────────────────────────
type Stats = {
  ok:     boolean
  period: { from: string | null; to: string | null }
  totals: { orders: number; completed: number; cancelled: number; completionRate: number; avgOrderValue: number }
  revenue: { today: number; week: number; month: number; total: number; prevWeek: number; trendWeekPct: number | null; especes: number; sanEspeces: number }
  commission: { today: number; week: number; month: number; total: number }
  charts: {
    daily:      { label: string; revenus: number; comm: number; courses: number }[]
    hourly:     { label: string; value: number }[]
    payments:   { name: string; value: number }[]
    completion: { label: string; taux: number }[]
  }
  topDrivers:  { name: string; courses: number; revenue: number; commission: number }[]
  topVehicles: { name: string; courses: number; revenue: number }[]
}

const fmt  = (n: number) => Math.round(n).toLocaleString("fr-FR")
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

function KpiCard({ label, value, sub, icon: Icon, grad, trend, index = 0 }: {
  label: string; value: string; sub?: string; icon: React.ElementType; grad: string; trend?: number | null; index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card3D className={`bg-gradient-to-br ${grad} shadow-md`} depth={10} glare>
        <div className="p-5 overflow-hidden relative">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">{label}</p>
              <motion.div
                className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <Icon size={15} className="text-white" />
              </motion.div>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-white/60 mt-0.5">{sub}</p>}
            {trend !== null && trend !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend >= 0 ? "+" : ""}{trend}% vs semaine précédente
              </div>
            )}
          </div>
        </div>
      </Card3D>
    </motion.div>
  )
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="text-gray-500 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {p.name === "comm" ? "Commission" : p.name === "revenus" ? "Revenus" : p.name === "taux" ? "Taux" : p.name}: {p.name === "taux" ? `${p.value}%` : `${fmt(p.value)} FCFA`}
        </p>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BoyahDashboardPage() {
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [syncMsg,     setSyncMsg]     = useState<string | null>(null)
  const [fullSyncing, setFullSyncing] = useState(false)
  // Date de départ configurable pour le sync complet
  const [fullSyncDate, setFullSyncDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    return d.toISOString().split("T")[0]
  })
  const [showDatePicker, setShowDatePicker] = useState(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/boyah-transport/dashboard-stats")
      const d = await r.json()
      if (d.ok) setStats(d)
    } finally {
      setLoading(false)
    }
  }, [])

  const showMsg = useCallback((msg: string) => {
    setSyncMsg(msg)
    setTimeout(() => setSyncMsg(null), 5000)
  }, [])

  const handleQuickSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    const { synced, error } = await runQuickSync()
    if (synced > 0) await loadStats()
    showMsg(error ?? `+${synced} courses synchronisées`)
    setSyncing(false)
  }, [loadStats, showMsg])

  const handleFullSync = async () => {
    setFullSyncing(true)
    setShowDatePicker(false)
    setSyncMsg("Sync complet en cours…")
    const { total, error } = await runFullSync(
      `${fullSyncDate}T00:00:00Z`,
      (n) => setSyncMsg(`Sync : ${n} courses importées…`)
    )
    await loadStats()
    showMsg(error ?? `Sync terminé : ${total} courses`)
    setFullSyncing(false)
  }

  useEffect(() => {
    loadStats()
    if (shouldAutoSync()) handleQuickSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500">
        <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Calcul des indicateurs…
      </div>
    </div>
  )

  if (!stats) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Erreur de chargement — <button onClick={loadStats} className="ml-2 underline">réessayer</button>
    </div>
  )

  const { period, totals, revenue, commission, charts, topDrivers, topVehicles } = stats
  const periodLabel = period.from && period.to
    ? `${new Date(period.from).toLocaleDateString("fr-FR")} → ${new Date(period.to).toLocaleDateString("fr-FR")}`
    : "—"

  const pieData = [
    { name: "Complétées", value: totals.completed,                              color: "#10b981" },
    { name: "Annulées",   value: totals.cancelled,                              color: "#ef4444" },
    { name: "Autres",     value: totals.orders - totals.completed - totals.cancelled, color: "#6366f1" },
  ].filter(d => d.value > 0)

  return (
    <div id="boyah-dashboard-content" className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Boyah Transport</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{totals.completed.toLocaleString("fr-FR")} complétées</span>
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
            {totals.orders.toLocaleString("fr-FR")} total
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
            <span className="text-xs font-mono text-indigo-500">{periodLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sync complet avec date configurable */}
          <div className="relative">
            <div className="flex items-center gap-1">
              <button onClick={handleFullSync} disabled={fullSyncing || syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-l-xl hover:bg-amber-100 transition disabled:opacity-50">
                {fullSyncing ? <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : <RotateCcw size={12} />}
                Sync complet
              </button>
              <button onClick={() => setShowDatePicker(p => !p)} disabled={fullSyncing || syncing}
                title="Configurer la date de départ"
                className="px-2 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 border border-l-0 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-r-xl hover:bg-amber-100 transition disabled:opacity-50">
                ▾
              </button>
            </div>
            {showDatePicker && (
              <div className="absolute top-full mt-1 right-0 z-20 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl p-3 shadow-xl w-52">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Depuis le</p>
                <input type="date" value={fullSyncDate} onChange={e => setFullSyncDate(e.target.value)}
                  className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <button onClick={handleFullSync}
                  className="mt-2 w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition">
                  Lancer
                </button>
              </div>
            )}
          </div>

          {/* Sync rapide */}
          <button onClick={handleQuickSync} disabled={syncing || fullSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition disabled:opacity-50">
            {syncing ? <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={12} />}
            Sync
          </button>

          {syncMsg && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{syncMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs REVENUS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ perspective: "1200px" }}>
        <KpiCard label="Aujourd'hui"   value={`${fmt(revenue.today)} F`}   icon={DollarSign}  grad="from-emerald-500 to-teal-600" index={0} />
        <KpiCard label="Cette semaine" value={`${fmt(revenue.week)} F`}    icon={TrendingUp}  grad="from-sky-500 to-cyan-600"     trend={revenue.trendWeekPct} index={1} />
        <KpiCard label="Ce mois"       value={`${fmt(revenue.month)} F`}   icon={BarChart2}   grad="from-indigo-500 to-blue-600" index={2} />
        <KpiCard label="Total général" value={`${fmt(revenue.total)} F`}   icon={ArrowUpRight} grad="from-violet-500 to-purple-600" index={3} />
      </div>

      {/* ── KPIs COMMISSION + ACTIVITÉ ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
          <div className="flex items-center gap-2 mb-1"><Percent size={13} className="text-violet-500" /><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Commission mois</p></div>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{fmt(commission.month)} F</p>
          <p className="text-xs text-gray-400 mt-0.5">Total : {fmt(commission.total)} F</p>
        </div>
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
          <div className="flex items-center gap-2 mb-1"><CheckCircle size={13} className="text-emerald-500" /><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Taux complétion</p></div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.completionRate}%</p>
          <p className="text-xs text-gray-400 mt-0.5">{totals.completed.toLocaleString("fr-FR")} / {totals.orders.toLocaleString("fr-FR")} courses</p>
        </div>
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
          <div className="flex items-center gap-2 mb-1"><Banknote size={13} className="text-amber-500" /><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Espèces</p></div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(revenue.especes)} F</p>
          <p className="text-xs text-gray-400 mt-0.5">{revenue.total > 0 ? Math.round(revenue.especes / revenue.total * 100) : 0}% du CA total</p>
        </div>
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
          <div className="flex items-center gap-2 mb-1"><CreditCard size={13} className="text-blue-500" /><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Sans espèces</p></div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmt(revenue.sanEspeces)} F</p>
          <p className="text-xs text-gray-400 mt-0.5">Panier moyen : {fmt(totals.avgOrderValue)} F</p>
        </div>
      </div>

      {/* ── GRAPHIQUES PRINCIPAUX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenus 30j */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Revenus & commissions</h2>
              <p className="text-xs text-gray-400">30 derniers jours</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />Revenus</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-500 rounded inline-block" />Commission</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={charts.daily} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenus" stroke="#10b981" strokeWidth={2} fill="url(#gR)" dot={false} />
              <Area type="monotone" dataKey="comm"    stroke="#8b5cf6" strokeWidth={2} fill="url(#gC)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition statuts */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Statuts des courses</h2>
          <p className="text-xs text-gray-400 mb-3">Distribution globale</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v, name) => [`${v}`, String(name)]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-500 dark:text-gray-400">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{d.value.toLocaleString("fr-FR")}</span>
                  <span className="text-gray-400">({totals.orders > 0 ? Math.round(d.value / totals.orders * 100) : 0}%)</span>
                </div>
              </div>
            ))}
          </div>
          {/* Annulées alerte */}
          {totals.orders > 0 && (100 - totals.completionRate) > 20 && (
            <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
              <p className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                <XCircle size={11} /> Taux d'annulation élevé : {100 - totals.completionRate}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── TOP DRIVERS + TOP VÉHICULES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top chauffeurs */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Top 10 chauffeurs</h2>
            <span className="text-xs text-gray-400 ml-auto">Par CA généré</span>
          </div>
          <div className="space-y-3">
            {topDrivers.slice(0, 10).map((d, i) => {
              const pct = topDrivers[0]?.revenue > 0 ? (d.revenue / topDrivers[0].revenue) * 100 : 0
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{d.name || "—"}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{d.courses} courses</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(d.revenue)} F</span>
                      <span className="text-[10px] text-violet-500">{fmt(d.commission)} F comm.</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-[#1E2D45] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {topDrivers.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucune donnée</p>}
          </div>
        </div>

        {/* Top véhicules + revenus aujourd'hui */}
        <div className="space-y-4">

          {/* Top véhicules */}
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Car size={15} className="text-sky-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Top véhicules</h2>
              <span className="text-xs text-gray-400 ml-auto">Par revenus</span>
            </div>
            <div className="space-y-2.5">
              {topVehicles.map((v, i) => {
                const pct = topVehicles[0]?.revenue > 0 ? (v.revenue / topVehicles[0].revenue) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{v.name}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2">{fmt(v.revenue)} F</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-[#1E2D45] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Revenus par heure aujourd'hui */}
          {charts.hourly.length > 0 && (
            <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Revenus aujourd'hui</h2>
              <p className="text-xs text-gray-400 mb-3">Par heure</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={charts.hourly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`${fmt(Number(v))} FCFA`]} />
                  <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── MODE DE PAIEMENT ── */}
      {charts.payments.length > 0 && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Modes de paiement</h2>
          <div className="flex flex-wrap gap-4">
            {charts.payments.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#080F1E] border border-gray-100 dark:border-[#1E2D45]">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.value} courses · {totals.completed > 0 ? Math.round(p.value / totals.completed * 100) : 0}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
