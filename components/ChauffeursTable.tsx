"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Search, ExternalLink, ChevronUp, ChevronDown, Download } from "lucide-react"
import AnimatedRow from "@/components/AnimatedRow"

type Chauffeur = { id_chauffeur: number; nom: string; numero_wave?: string; actif: boolean }
type Classement = { nom: string; ca: number }
type SortKey = "nom" | "ca" | "actif"
type SortDir = "asc" | "desc"

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp size={10} className="opacity-20" />
  return dir === "asc" ? <ChevronUp size={10} className="text-indigo-500" /> : <ChevronDown size={10} className="text-indigo-500" />
}

function SortableTh({ label, sortKey, current, dir, onSort, align = "left" }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align?: "left" | "right" | "center"
}) {
  return (
    <th className={`px-5 py-3 text-${align}`}>
      <button
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition"
      >
        {label}
        <SortIcon active={current === sortKey} dir={dir} />
      </button>
    </th>
  )
}

export default function ChauffeursTable({ chauffeurs, classement }: { chauffeurs: Chauffeur[]; classement: Classement[] }) {
  const [search,  setSearch]  = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("ca")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const getCA = (nom: string) => classement?.find(c => c.nom === nom)?.ca || 0

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = chauffeurs.filter(c => c.nom?.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      let va: string | number, vb: string | number
      if (sortKey === "nom")   { va = a.nom || ""; vb = b.nom || "" }
      else if (sortKey === "ca") { va = getCA(a.nom); vb = getCA(b.nom) }
      else                      { va = a.actif ? 1 : 0; vb = b.actif ? 1 : 0 }
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chauffeurs, classement, search, sortKey, sortDir])

  const exportCSV = () => {
    const rows = [["Nom", "Téléphone", "CA mensuel (FCFA)", "Statut"]]
    filtered.forEach(c => rows.push([c.nom, c.numero_wave || "", String(getCA(c.nom)), c.actif ? "Actif" : "Inactif"]))
    const csv = rows.map(r => r.join(";")).join("\n")
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `chauffeurs_${new Date().toISOString().split("T")[0]}.csv`,
    })
    a.click()
  }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Liste des chauffeurs</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{chauffeurs.length} chauffeur{chauffeurs.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44" />
          </div>
          <button
            onClick={exportCSV}
            title="Exporter CSV"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424]">
              <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
                <SortableTh label="Chauffeur" sortKey="nom"   current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">Téléphone</th>
                <SortableTh label="CA mensuel" sortKey="ca"  current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                <SortableTh label="Statut"     sortKey="actif" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
                      <Search size={28} className="opacity-30" />
                      <p className="text-sm font-medium">Aucun chauffeur trouvé</p>
                      {search && <p className="text-xs">Essayez un autre terme de recherche</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <AnimatedRow key={c.id_chauffeur} index={i} className="border-b border-gray-50 dark:border-[#1A2235]">
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
                      <span className="text-sm font-bold font-numeric text-indigo-600 dark:text-indigo-400">
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
