"use client"

import Link from "next/link"
import { useState } from "react"
import { Search, ExternalLink } from "lucide-react"

type Vehicule = {
  id_vehicule: number; immatriculation: string; proprietaire: string
  statut: string; ca_aujourdhui: number; ca_mensuel: number; profit: number
}

export default function VehiculesTable({ vehicules }: { vehicules: Vehicule[] }) {
  const [search, setSearch] = useState("")

  const filtered = vehicules.filter(v =>
    [v.immatriculation, v.proprietaire].some(s => s?.toLowerCase().includes(search.toLowerCase()))
  )

  const fmt = (n: number) => Number(n || 0).toLocaleString("fr-FR")

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Flotte véhicules</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{vehicules.length} véhicule{vehicules.length > 1 ? "s" : ""}</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Immatriculation..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424]">
              <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
                {["Immatriculation","Propriétaire","CA Aujourd'hui","CA Mensuel","Profit","Statut",""].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 text-left last:text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">Aucun véhicule trouvé</td></tr>
                : filtered.map(v => (
                  <tr key={v.id_vehicule} className="border-b border-gray-50 dark:border-[#1A2235] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-white/10 px-2.5 py-1 rounded-lg">
                        {v.immatriculation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{v.proprietaire || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {v.ca_aujourdhui ? fmt(v.ca_aujourdhui) : "—"}
                        {v.ca_aujourdhui ? <span className="text-[10px] opacity-60 ml-1">FCFA</span> : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {v.ca_mensuel ? fmt(v.ca_mensuel) : "—"}
                        {v.ca_mensuel ? <span className="text-[10px] opacity-60 ml-1">FCFA</span> : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${v.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {v.profit >= 0 ? "" : "−"}{fmt(Math.abs(v.profit))}
                        <span className="text-[10px] opacity-60 ml-1">FCFA</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
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
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
