"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Search, TrendingUp, CheckCircle, XCircle, DollarSign,
  Percent, Filter, ChevronLeft, ChevronRight, RefreshCw, Download,
} from "lucide-react"
import { shouldAutoSync, runQuickSync } from "@/lib/yangoSync"

const COMMISSION_RATE = 0.025
const PAGE_LIMIT      = 100

/** Parse un prix qui peut être "3500", "3 500", "3500 XOF", etc. */
function parsePrice(raw: string | undefined | null): number {
  if (!raw) return 0
  const n = parseFloat(String(raw).replace(/[^\d.,]/g, "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Order = {
  id: string; short_id: number; status: string; category?: string
  price?: string; payment_method?: string; created_at: string
  driver_profile?: { name?: string }
  car?: { brand_model?: string; brand?: string; model?: string }
}
type FilterTab = "all" | "complete" | "cancelled"

export default function CommandesPage() {
  const [orders,      setOrders]      = useState<Order[]>([])
  const [total,       setTotal]       = useState(0)
  const [pages,       setPages]       = useState(1)
  const [page,        setPage]        = useState(0)
  const [search,      setSearch]      = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [tab,         setTab]         = useState<FilterTab>("all")
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [syncMsg,     setSyncMsg]     = useState<string | null>(null)
  // Filtres date
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo,   setDateTo]   = useState("")
  const [showDateFilter, setShowDateFilter] = useState(false)

  const [kpis, setKpis] = useState<{
    completed: number; cancelled: number; total: number
    revTotal: number; revMonth: number; commTotal: number; commMonth: number
    completionRate: number; avgOrder: number
  } | null>(null)

  const fetchKpis = useCallback(async () => {
    const r = await fetch("/api/boyah-transport/dashboard-stats")
    const d = await r.json()
    if (d.ok) setKpis({
      completed:      d.totals.completed,
      cancelled:      d.totals.cancelled,
      total:          d.totals.orders,
      revTotal:       d.revenue.total,
      revMonth:       d.revenue.month,
      commTotal:      d.commission.total,
      commMonth:      d.commission.month,
      completionRate: d.totals.completionRate,
      avgOrder:       d.totals.avgOrderValue,
    })
  }, [])

  const fetchOrders = useCallback(async (p = 0, s = search, t = tab, df = dateFrom, dt = dateTo) => {
    setLoading(true)
    const params = new URLSearchParams({
      page:  String(p),
      limit: String(PAGE_LIMIT),
      ...(t !== "all" && { status: t }),
      ...(s  && { search: s }),
      ...(df && { date_from: df }),
      ...(dt && { date_to:   dt }),
    })
    const res  = await fetch(`/api/yango/orders?${params}`)
    const data = await res.json()
    setOrders(data.orders || [])
    setTotal(data.total   || 0)
    setPages(data.pages   || 1)
    setLoading(false)
  }, [search, tab, dateFrom, dateTo])

  const showMsg = (msg: string) => {
    setSyncMsg(msg)
    setTimeout(() => setSyncMsg(null), 5000)
  }

  useEffect(() => {
    fetchKpis()
    fetchOrders(0, "", "all")
    if (shouldAutoSync()) {
      setSyncing(true)
      runQuickSync().then(async ({ synced, error }) => {
        if (synced > 0) { await fetchOrders(0, "", "all"); await fetchKpis() }
        showMsg(error ?? `+${synced} nouvelles`)
        setSyncing(false)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabChange = (t: FilterTab) => {
    setTab(t); setPage(0); fetchOrders(0, search, t)
  }
  const handleSearch = () => {
    setSearch(searchInput); setPage(0); fetchOrders(0, searchInput, tab)
  }
  const applyDateFilter = () => {
    setPage(0); fetchOrders(0, search, tab, dateFrom, dateTo)
    setShowDateFilter(false)
  }
  const clearDateFilter = () => {
    setDateFrom(""); setDateTo("")
    setPage(0); fetchOrders(0, search, tab, "", "")
    setShowDateFilter(false)
  }
  const handlePage = (p: number) => {
    setPage(p); fetchOrders(p, search, tab)
  }

  const exportCSV = () => {
    const rows = [
      ["ID","Date","Statut","Catégorie","Chauffeur","Véhicule","Paiement","Prix (FCFA)","Commission (FCFA)"],
      ...orders.map(o => {
        const price = parsePrice(o.price)
        return [
          String(o.short_id),
          new Date(o.created_at).toLocaleString("fr-FR"),
          o.status === "complete" ? "Complétée" : "Annulée",
          o.category || "",
          o.driver_profile?.name || "",
          o.car?.brand_model || (o.car?.brand ? `${o.car.brand} ${o.car.model}` : ""),
          o.payment_method || "",
          String(Math.round(price)),
          String(Math.round(price * COMMISSION_RATE)),
        ]
      }),
    ]
    const csv = rows.map(r => r.join(";")).join("\n")
    const a = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })),
      download: `commandes_${new Date().toISOString().split("T")[0]}.csv`,
    })
    a.click()
  }

  const tabCounts: Record<FilterTab, number> = {
    all:       kpis?.total     || 0,
    complete:  kpis?.completed || 0,
    cancelled: kpis?.cancelled || 0,
  }
  const tabs: { key: FilterTab; label: string; active: string; inactive: string }[] = [
    { key: "all",       label: "Toutes",     active: "bg-gray-900 dark:bg-white text-white dark:text-gray-900",  inactive: "text-gray-600 dark:text-gray-400" },
    { key: "complete",  label: "Complétées", active: "bg-emerald-500 text-white",  inactive: "text-emerald-600 dark:text-emerald-400" },
    { key: "cancelled", label: "Annulées",   active: "bg-red-500 text-white",      inactive: "text-red-500 dark:text-red-400" },
  ]

  const hasDateFilter = !!(dateFrom || dateTo)

  return (
    <div id="commandes-content" className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commandes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {kpis ? `${kpis.total.toLocaleString("fr-FR")} courses enregistrées` : "Chargement…"}
          </p>
        </div>
        {syncing ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
            <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Synchronisation…</span>
          </div>
        ) : syncMsg ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{syncMsg}</span>
          </div>
        ) : null}
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label: "CA Total",     value: `${fmt(kpis.revTotal)} F`,   icon: DollarSign,  color: "from-emerald-400 to-teal-500",  glow: "bg-emerald-400" },
            { label: "Complétées",   value: `${kpis.completed}`,          icon: CheckCircle, color: "from-sky-400 to-cyan-500",      glow: "bg-sky-400"    },
            { label: "Annulées",     value: `${kpis.cancelled} (${Math.round(kpis.cancelled / Math.max(kpis.total, 1) * 100)}%)`, icon: XCircle, color: "from-red-400 to-rose-500", glow: "bg-red-400" },
            { label: "Panier moyen", value: `${fmt(kpis.avgOrder)} F`,    icon: TrendingUp,  color: "from-indigo-400 to-blue-500",   glow: "bg-indigo-400" },
          ] as const).map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-md transition-all">
                <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-10 blur-2xl ${k.glow}`} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className="text-xl font-bold font-numeric text-gray-900 dark:text-white mt-1.5">{k.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <Icon size={16} className="text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* COMMISSION STRIP */}
      {kpis && (
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/5 dark:to-purple-500/10 rounded-2xl border border-violet-100 dark:border-violet-500/20 px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Percent size={14} className="text-violet-500" />
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Commissions Boyah (2,5%)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Ce mois",           value: kpis.commMonth, text: null },
              { label: "Total",             value: kpis.commTotal, text: null },
              { label: "Taux de complétion", value: null,          text: `${kpis.completionRate}%` },
            ].map(k => (
              <div key={k.label}>
                <p className="text-xs text-violet-500 dark:text-violet-400 mb-0.5">{k.label}</p>
                <p className="text-lg font-bold font-numeric text-violet-700 dark:text-violet-300">
                  {k.text || <>{fmt(k.value!)} <span className="text-xs font-normal opacity-60">F</span></>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45] flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-[#080F1E] rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? t.active : `${t.inactive} hover:bg-gray-200 dark:hover:bg-[#1E2D45]`}`}>
                {t.label} <span className="ml-1 opacity-70">({tabCounts[t.key].toLocaleString("fr-FR")})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Recherche */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="ID, chauffeur, catégorie…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="pl-8 pr-4 py-2 text-xs bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 dark:text-gray-300 w-44"
              />
            </div>

            {/* Filtre par date */}
            <div className="relative">
              <button onClick={() => setShowDateFilter(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                  hasDateFilter
                    ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-gray-100 dark:bg-[#080F1E] border-gray-200 dark:border-[#1E2D45] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                <Filter size={11} />Dates{hasDateFilter ? " ●" : ""}
              </button>
              {showDateFilter && (
                <div className="absolute top-full mt-1 right-0 z-20 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl p-4 shadow-xl w-64 space-y-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filtrer par période</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Du</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Au</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={clearDateFilter} className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition">Effacer</button>
                    <button onClick={applyDateFilter} className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-semibold transition">Appliquer</button>
                  </div>
                </div>
              )}
            </div>

            {/* Export CSV */}
            <button onClick={exportCSV} title="Exporter CSV"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition font-semibold">
              <Download size={11} /> CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-[#080F1E]">
                <tr>
                  {["ID","Date","Statut","Catégorie","Chauffeur","Véhicule","Paiement","Prix","Commission"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
                {orders.map((o, i) => {
                  const price = parsePrice(o.price)
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
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                        {o.car?.brand_model || (o.car?.brand ? `${o.car.brand} ${o.car.model}` : "—")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 dark:bg-[#1E2D45] text-gray-600 dark:text-gray-400 rounded-md">{o.payment_method || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold font-numeric text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(price)} F</td>
                      <td className="px-4 py-3 text-xs font-semibold font-numeric text-violet-600 dark:text-violet-400 whitespace-nowrap">{fmt(price * COMMISSION_RATE)} F</td>
                    </tr>
                  )
                })}
                {orders.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">Aucune commande trouvée</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1E2D45] flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page + 1} / {pages} · {total.toLocaleString("fr-FR")} résultats
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePage(page - 1)} disabled={page === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-[#080F1E] disabled:opacity-40 transition">
                <ChevronLeft size={13} /> Préc.
              </button>
              <button onClick={() => handlePage(page + 1)} disabled={page >= pages - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-[#080F1E] disabled:opacity-40 transition">
                Suiv. <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
