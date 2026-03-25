"use client"

import { useState } from "react"
import { Search } from "lucide-react"

type Recette = {
  Horodatage: string
  chauffeur?: string
  "Montant net": number
}

export default function RecettesTable({ recettes }: { recettes: Recette[] }) {
  const [search, setSearch] = useState("")

  const filtered = recettes.filter(r =>
    !search || (r.chauffeur?.toLowerCase() ?? "").includes(search.toLowerCase())
  )

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Dernières recettes</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{recettes.length} transactions</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un chauffeur..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424]">
              <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Date</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Chauffeur</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Montant</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-600">Aucune recette</td></tr>
                : filtered.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-[#1A2235] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                      {r.Horodatage ? new Date(r.Horodatage).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{r.chauffeur || "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(r["Montant net"] || 0).toLocaleString("fr-FR")}
                        <span className="text-[10px] font-semibold text-emerald-500/70 ml-1">FCFA</span>
                      </span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-50 dark:border-[#1A2235]">
          <p className="text-xs text-gray-400 dark:text-gray-600">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>
        </div>
      )}
    </div>
  )
}
