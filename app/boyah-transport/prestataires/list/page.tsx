"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Users, UserCheck, UserX, Search, TrendingUp } from "lucide-react"

type Driver = {
  id: string; nom: string; prenom: string
  telephone: string; statut: string; vehicle: string; plaque: string; solde: string
}

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

const STATUT_LABELS: Record<string, string> = {
  free: "Disponible", busy: "En course", offline: "Hors ligne",
}
const STATUT_COLORS: Record<string, string> = {
  free:    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  busy:    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  offline: "bg-gray-100 dark:bg-gray-700/30 text-gray-500 dark:text-gray-400",
}

export default function PrestatairesPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")

  useEffect(() => {
    fetch("/api/yango/drivers")
      .then(r => r.json())
      .then(d => setDrivers(d.drivers || []))
      .finally(() => setLoading(false))
  }, [])

  const free    = drivers.filter(d => d.statut === "free").length
  const busy    = drivers.filter(d => d.statut === "busy").length
  const offline = drivers.filter(d => d.statut === "offline" || (!d.statut || !["free","busy"].includes(d.statut))).length
  const soldTotal = drivers.reduce((s, d) => s + (parseFloat(d.solde || "0") || 0), 0)

  const topDrivers = useMemo(() =>
    drivers
      .map(d => ({ name: `${d.prenom} ${d.nom}`.trim() || "—", value: parseFloat(d.solde || "0") || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  , [drivers])

  const filtered = drivers.filter(d =>
    `${d.prenom} ${d.nom} ${d.telephone} ${d.plaque} ${d.vehicle}`
      .toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Chargement des prestataires…
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prestataires</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Chauffeurs partenaires Yango</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "Total",       value: drivers.length, sub: "chauffeurs",       icon: Users,     bg: "bg-indigo-50 dark:bg-indigo-500/10",   color: "text-indigo-600 dark:text-indigo-400", grad: "from-indigo-400 to-blue-500" },
          { label: "Disponibles", value: free,           sub: "en attente",       icon: UserCheck, bg: "bg-emerald-50 dark:bg-emerald-500/10", color: "text-emerald-600 dark:text-emerald-400", grad: "from-emerald-400 to-teal-500" },
          { label: "En course",   value: busy,           sub: "en ce moment",     icon: TrendingUp, bg: "bg-amber-50 dark:bg-amber-500/10",    color: "text-amber-600 dark:text-amber-400",   grad: "from-amber-400 to-orange-500" },
          { label: "Hors ligne",  value: offline,        sub: "non disponibles",  icon: UserX,     bg: "bg-gray-100 dark:bg-gray-700/30",      color: "text-gray-500 dark:text-gray-400",     grad: "from-gray-400 to-slate-500" },
        ] as const).map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{k.value}</p>
                <p className="text-xs text-gray-400">{k.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* SOLDE TOTAL */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white">
        <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">Solde cumulé des prestataires</p>
        <p className="text-3xl font-bold">{fmt(soldTotal)} <span className="text-lg font-normal opacity-70">FCFA</span></p>
        <p className="text-xs opacity-60 mt-1">Moyenne par chauffeur: {fmt(drivers.length > 0 ? soldTotal / drivers.length : 0)} FCFA</p>
      </div>

      {/* CHART + TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Top 10 chauffeurs</h2>
          <p className="text-xs text-gray-400 mb-4">Par solde</p>
          {topDrivers.length === 0
            ? <div className="flex items-center justify-center h-[300px] text-sm text-gray-400">Aucune donnée de solde</div>
            : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topDrivers} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:[&>line]:stroke-[#1E2D45]" />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v) => [`${fmt(Number(v))} FCFA`, "Solde"]} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Table */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45] flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Liste des chauffeurs</span>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-4 py-2 text-xs bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 dark:text-gray-300 w-44"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[380px] overflow-x-auto">
            <table className="w-full text-sm min-w-[540px]">
              <thead className="bg-gray-50 dark:bg-[#080F1E] sticky top-0">
                <tr>
                  {["Chauffeur", "Téléphone", "Véhicule", "Plaque", "Statut", "Solde"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">
                            {(d.prenom?.[0] || "") + (d.nom?.[0] || "")}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {d.prenom} {d.nom}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{d.telephone || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{d.vehicle || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-[#1E2D45] text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">{d.plaque || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUT_COLORS[d.statut] || STATUT_COLORS.offline}`}>
                        {STATUT_LABELS[d.statut] || d.statut || "Inconnu"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {fmt(parseFloat(d.solde || "0") || 0)} FCFA
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Aucun prestataire trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
