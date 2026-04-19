"use client"

import { useState, useMemo } from "react"
import { Search, ChevronLeft, ChevronRight as ChevronRightIcon, FileDown } from "lucide-react"
import AnimatedRow from "@/components/AnimatedRow"

type Recette = {
  Horodatage: string
  chauffeur?: string
  "Montant net": number
  "Nom de contrepartie"?: string
  "Nom d'utilisateur"?: string
  "Numéro de téléphone de contrepartie"?: string
}

/** Priorité : jointure → Counterparty Name → User Name → numéro de tél → — */
function nomChauffeur(r: Recette): string {
  return r.chauffeur
    || r["Nom de contrepartie"]
    || r["Nom d'utilisateur"]
    || r["Numéro de téléphone de contrepartie"]
    || "—"
}

const PAGE_SIZE = 10

export default function RecettesTable({ recettes }: { recettes: Recette[] }) {
  const [search, setSearch] = useState("")
  const [page,   setPage]   = useState(1)

  const filtered = useMemo(() =>
    recettes.filter(r =>
      !search || nomChauffeur(r).toLowerCase().includes(search.toLowerCase())
    ), [recettes, search]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalNet   = filtered.reduce((s, r) => s + Number(r["Montant net"] || 0), 0)

  // Réinitialiser la page si la recherche change
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Dernières recettes</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{filtered.length} transaction{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher un chauffeur..."
              value={search} onChange={e => handleSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52" />
          </div>
          <button
            onClick={async () => {
              const { exportRecettesPdf } = await import("@/lib/exportPdf")
              exportRecettesPdf(filtered)
            }}
            title="Exporter PDF"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
          >
            <FileDown size={13} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="bg-white dark:bg-[#0D1424]">
            <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Date</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Chauffeur</th>
              <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Montant</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0
              ? <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-600">Aucune recette</td></tr>
              : paginated.map((r, i) => (
                <AnimatedRow key={`${r.Horodatage}-${i}`} index={i} className="border-b border-gray-50 dark:border-[#1A2235]">
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                    {r.Horodatage ? new Date(r.Horodatage).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{nomChauffeur(r)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-bold font-numeric text-emerald-600 dark:text-emerald-400">
                      {Number(r["Montant net"] || 0).toLocaleString("fr-FR")}
                      <span className="text-[10px] font-semibold text-emerald-500/70 ml-1">FCFA</span>
                    </span>
                  </td>
                </AnimatedRow>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Footer : total + pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 dark:border-[#1A2235]">
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </p>
          {filtered.length > 0 && (
            <span className="text-xs font-bold font-numeric text-emerald-600 dark:text-emerald-400">
              Total : {totalNet.toLocaleString("fr-FR")} <span className="opacity-60 font-normal">FCFA</span>
            </span>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-numeric text-gray-500 dark:text-gray-500 px-2">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRightIcon size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
