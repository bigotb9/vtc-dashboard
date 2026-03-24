"use client"

import { useState } from "react"
import { Search } from "lucide-react"

type Depense = {
  id_depense:      string
  date_depense:    string
  montant:         number
  type_depense:    string
  description:     string
  immatriculation: string
}

export default function DepensesTable({ depenses }: { depenses: Depense[] }) {

  const [search, setSearch] = useState("")

  const filtered = depenses.filter(d =>
    [d.type_depense, d.description, d.immatriculation]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white">
          Liste des dépenses
        </h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm min-w-[560px]">

            <thead className="sticky top-0 bg-white dark:bg-gray-900">
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-2.5 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Date</th>
                <th className="text-left py-2.5 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Véhicule</th>
                <th className="text-left py-2.5 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                <th className="text-right py-2.5 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Montant</th>
                <th className="text-left py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Description</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-gray-400 dark:text-gray-600">
                    Aucune dépense trouvée
                  </td>
                </tr>
              ) : filtered.map(d => (
                <tr key={d.id_depense}
                  className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">

                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(d.date_depense).toLocaleDateString("fr-FR")}
                  </td>

                  <td className="py-3 pr-4">
                    {d.immatriculation
                      ? <span className="font-mono text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg">
                          {d.immatriculation}
                        </span>
                      : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                    }
                  </td>

                  <td className="py-3 pr-4">
                    {d.type_depense
                      ? <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-lg">
                          {d.type_depense}
                        </span>
                      : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                    }
                  </td>

                  <td className="py-3 pr-4 text-right font-semibold text-red-600 whitespace-nowrap">
                    {d.montant?.toLocaleString("fr-FR")} FCFA
                  </td>

                  <td className="py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                    {d.description || "—"}
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
          {filtered.length} dépense{filtered.length > 1 ? "s" : ""}
          {search && ` · filtrée${filtered.length > 1 ? "s" : ""}`}
        </p>
      )}

    </div>
  )
}
