"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Search, ExternalLink, ChevronUp, ChevronDown, Download } from "lucide-react"
import AnimatedRow from "@/components/AnimatedRow"

type Vehicule = {
  id_vehicule: number; immatriculation: string; proprietaire: string
  statut: string; ca_aujourdhui: number; ca_mensuel: number; profit: number
}
type SortKey = "immatriculation" | "ca_aujourdhui" | "ca_mensuel" | "profit" | "statut"
type SortDir = "asc" | "desc"

function SortTh({ label, sortKey, current, dir, onSort, align = "left" }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align?: "left" | "right" | "center"
}) {
  const active = current === sortKey
  return (
    <th className={`px-4 py-3 text-${align}`}>
      <button onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition">
        {label}
        {active
          ? (dir === "asc" ? <ChevronUp size={10} className="text-indigo-500" /> : <ChevronDown size={10} className="text-indigo-500" />)
          : <ChevronUp size={10} className="opacity-20" />
        }
      </button>
    </th>
  )
}

export default function VehiculesTable({ vehicules }: { vehicules: Vehicule[] }) {
  const [search,  setSearch]  = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("ca_mensuel")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString("fr-FR")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = vehicules.filter(v =>
      [v.immatriculation, v.proprietaire].some(s => s?.toLowerCase().includes(q))
    )
    return [...list].sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [vehicules, search, sortKey, sortDir])

  const exportCSV = () => {
    const rows = [["Immatriculation","Propriétaire","CA Aujourd'hui","CA Mensuel","Profit","Statut"]]
    filtered.forEach(v => rows.push([v.immatriculation, v.proprietaire || "", String(v.ca_aujourdhui || 0), String(v.ca_mensuel || 0), String(v.profit || 0), v.statut]))
    const csv = rows.map(r => r.join(";")).join("\n")
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `vehicules_${new Date().toISOString().split("T")[0]}.csv`,
    })
    a.click()
  }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Flotte véhicules</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{vehicules.length} véhicule{vehicules.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Immatriculation..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44" />
          </div>
          <button onClick={exportCSV} title="Exporter CSV"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition">
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424]">
              <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
                <SortTh label="Immatriculation" sortKey="immatriculation" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Propriétaire</th>
                <SortTh label="CA Auj."  sortKey="ca_aujourdhui" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh label="CA Mois"  sortKey="ca_mensuel"   current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh label="Profit"   sortKey="profit"       current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                <SortTh label="Statut"   sortKey="statut"       current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
                      <Search size={28} className="opacity-30" />
                      <p className="text-sm font-medium">Aucun véhicule trouvé</p>
                      {search && <p className="text-xs">Essayez un autre terme de recherche</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v, i) => (
                  <AnimatedRow key={v.id_vehicule} index={i} className="border-b border-gray-50 dark:border-[#1A2235]">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-white/10 px-2.5 py-1 rounded-lg">
                        {v.immatriculation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{v.proprietaire || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold font-numeric text-emerald-600 dark:text-emerald-400">
                        {v.ca_aujourdhui ? fmt(v.ca_aujourdhui) : "—"}
                        {v.ca_aujourdhui ? <span className="text-[10px] opacity-60 ml-1">FCFA</span> : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold font-numeric text-indigo-600 dark:text-indigo-400">
                        {v.ca_mensuel ? fmt(v.ca_mensuel) : "—"}
                        {v.ca_mensuel ? <span className="text-[10px] opacity-60 ml-1">FCFA</span> : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold font-numeric ${v.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {v.profit >= 0 ? "" : "−"}{fmt(Math.abs(v.profit))}
                        <span className="text-[10px] opacity-60 ml-1">FCFA</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold
                        ${v.statut === "ACTIF"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-500"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.statut === "ACTIF" ? "bg-emerald-500" : "bg-gray-400"}`} />
                        {v.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/vehicules/${v.id_vehicule}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition">
                        Voir <ExternalLink size={11} />
                      </Link>
                    </td>
                  </AnimatedRow>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
