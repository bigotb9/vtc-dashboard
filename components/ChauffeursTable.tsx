"use client"

import Link from "next/link"
import { useState } from "react"
import { Search, ExternalLink } from "lucide-react"

type Chauffeur = { id_chauffeur: number; nom: string; numero_wave?: string; actif: boolean }
type Classement = { nom: string; ca: number }

export default function ChauffeursTable({ chauffeurs, classement }: { chauffeurs: Chauffeur[]; classement: Classement[] }) {
  const [search, setSearch] = useState("")

  const getCA = (nom: string) => classement?.find(c => c.nom === nom)?.ca || 0

  const filtered = chauffeurs.filter(c =>
    c.nom?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Liste des chauffeurs</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{chauffeurs.length} chauffeur{chauffeurs.length > 1 ? "s" : ""}</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424]">
              <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Chauffeur</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Téléphone</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">CA mensuel</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Statut</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">Aucun chauffeur trouvé</td></tr>
                : filtered.map(c => (
                  <tr key={c.id_chauffeur} className="border-b border-gray-50 dark:border-[#1A2235] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {c.nom?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{c.nom}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-500 font-mono">
                      {c.numero_wave || "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {getCA(c.nom).toLocaleString("fr-FR")}
                        <span className="text-[10px] font-semibold opacity-60 ml-1">FCFA</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold
                        ${c.actif
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.actif ? "bg-emerald-500" : "bg-red-500"}`} />
                        {c.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Link href={`/chauffeurs/${c.id_chauffeur}`}
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
