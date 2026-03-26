"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts"
import { Car, CheckCircle, XCircle, AlertTriangle, Search } from "lucide-react"

type Vehicle = {
  id: string; brand: string; model: string
  plate: string; status: string; year: number
}

const STATUS_LABELS: Record<string, string> = {
  working:     "En service",
  not_working: "Hors service",
  blocked:     "Bloqué",
}
const STATUS_COLORS: Record<string, string> = {
  working:     "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  not_working: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  blocked:     "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
}
const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"]

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")

  useEffect(() => {
    fetch("/api/yango/vehicles")
      .then(r => r.json())
      .then(data => {
        const formatted = (data.cars || []).map((v: { id: string; brand: string; model: string; number: string; status: string; year: number }) => ({
          id: v.id, brand: v.brand, model: v.model, plate: v.number, status: v.status, year: v.year,
        }))
        setVehicles(formatted)
      })
      .finally(() => setLoading(false))
  }, [])

  const working     = vehicles.filter(v => v.status === "working").length
  const notWorking  = vehicles.filter(v => v.status === "not_working").length
  const blocked     = vehicles.filter(v => v.status === "blocked").length
  const other       = vehicles.length - working - notWorking - blocked

  const modelData = useMemo(() => {
    const map: Record<string, number> = {}
    vehicles.forEach(v => {
      const k = `${v.brand} ${v.model}`.trim() || "N/A"
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [vehicles])

  const pieData = [
    { name: "En service",  value: working,    color: PIE_COLORS[0] },
    { name: "Hors service",value: notWorking,  color: PIE_COLORS[1] },
    { name: "Bloqué",      value: blocked,     color: PIE_COLORS[2] },
    { name: "Autre",       value: other,       color: PIE_COLORS[3] },
  ].filter(d => d.value > 0)

  const brandData = useMemo(() => {
    const map: Record<string, number> = {}
    vehicles.forEach(v => { map[v.brand || "N/A"] = (map[v.brand || "N/A"] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [vehicles])

  const filtered = vehicles.filter(v =>
    `${v.brand} ${v.model} ${v.plate}`
      .toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Chargement des véhicules…
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Véhicules</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Flotte Yango enregistrée</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "Total flotte",  value: vehicles.length, sub: "véhicules",    icon: Car,           grad: "from-indigo-400 to-blue-500",   glow: "bg-indigo-400" },
          { label: "En service",    value: working,         sub: `${(working / Math.max(vehicles.length, 1) * 100).toFixed(0)}% de la flotte`, icon: CheckCircle, grad: "from-emerald-400 to-teal-500", glow: "bg-emerald-400" },
          { label: "Hors service",  value: notWorking,      sub: `${(notWorking / Math.max(vehicles.length, 1) * 100).toFixed(0)}% de la flotte`, icon: XCircle, grad: "from-red-400 to-rose-500", glow: "bg-red-400" },
          { label: "Bloqués",       value: blocked,         sub: "nécessitent attention", icon: AlertTriangle, grad: "from-amber-400 to-orange-500", glow: "bg-amber-400" },
        ] as const).map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-3 sm:p-5 overflow-hidden hover:shadow-md transition-all">
              <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-10 blur-2xl ${k.glow}`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5">{k.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                </div>
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${k.grad} flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top modèles */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Top modèles</h2>
          <p className="text-xs text-gray-400 mb-4">Nombre de véhicules par modèle</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={modelData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={100} />
              <Tooltip formatter={(v) => [`${v} véhicule(s)`, "Quantité"]} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie statuts */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Statuts</h2>
          <p className="text-xs text-gray-400 mb-3">Répartition de la flotte</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} véhicule(s)`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{d.name}</span>
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{d.value}</span>
              </div>
            ))}
          </div>

          {/* Top marques */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#1E2D45]">
            <p className="text-xs font-semibold text-gray-500 mb-3">Top marques</p>
            <div className="space-y-2">
              {brandData.slice(0, 4).map((b, i) => {
                const pct = brandData[0].value > 0 ? (b.value / brandData[0].value) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{b.name}</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{b.value}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-[#1E2D45] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Liste des véhicules</span>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg">{filtered.length}</span>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Rechercher véhicule…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 text-xs bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 dark:text-gray-300 w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-gray-50 dark:bg-[#080F1E] sticky top-0">
              <tr>
                {["Marque", "Modèle", "Plaque", "Année", "Statut"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <Car size={14} className="text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{v.brand}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{v.model}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-[#1E2D45] text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-lg font-semibold tracking-wide">{v.plate}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{v.year || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[v.status] || STATUS_COLORS.not_working}`}>
                      {STATUS_LABELS[v.status] || v.status || "Inconnu"}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Aucun véhicule trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
