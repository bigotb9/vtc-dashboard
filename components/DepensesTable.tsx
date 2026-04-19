"use client"

import { useState, useMemo } from "react"
import { Search, ChevronUp, ChevronDown, Download, FileDown } from "lucide-react"

type Depense = {
  id_depense:      string
  date_depense:    string
  montant:         number
  type_depense:    string
  description:     string
  immatriculation: string
}
type SortKey = "date_depense" | "montant" | "type_depense" | "immatriculation"
type SortDir = "asc" | "desc"

function SortTh({ label, sortKey, current, dir, onSort, align = "left" }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align?: "left" | "right"
}) {
  const active = current === sortKey
  return (
    <th className={`py-2.5 pr-4 text-${align}`}>
      <button onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition">
        {label}
        {active
          ? (dir === "asc" ? <ChevronUp size={10} className="text-red-500" /> : <ChevronDown size={10} className="text-red-500" />)
          : <ChevronUp size={10} className="opacity-20" />
        }
      </button>
    </th>
  )
}

export default function DepensesTable({ depenses }: { depenses: Depense[] }) {
  const [search,  setSearch]  = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("date_depense")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = depenses.filter(d =>
      [d.type_depense, d.description, d.immatriculation]
        .some(v => v?.toLowerCase().includes(q))
    )
    return [...list].sort((a, b) => {
      const va = sortKey === "montant" ? Number(a.montant || 0) : String(a[sortKey] || "")
      const vb = sortKey === "montant" ? Number(b.montant || 0) : String(b[sortKey] || "")
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [depenses, search, sortKey, sortDir])

  const totalFiltered = filtered.reduce((s, d) => s + Number(d.montant || 0), 0)

  const exportCSV = () => {
    const rows = [["Date","Véhicule","Type","Montant (FCFA)","Description"]]
    filtered.forEach(d => rows.push([
      d.date_depense,
      d.immatriculation || "",
      d.type_depense || "",
      String(d.montant || 0),
      d.description || ""
    ]))
    const csv = rows.map(r => r.join(";")).join("\n")
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `depenses_${new Date().toISOString().split("T")[0]}.csv`,
    })
    a.click()
  }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl shadow-sm border border-gray-100 dark:border-[#1E2D45] p-5">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Liste des dépenses</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{depenses.length} entrée{depenses.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 w-44"
            />
          </div>
          <button onClick={exportCSV} title="Exporter CSV"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/40 transition">
            <Download size={13} />
          </button>
          <button
            onClick={async () => {
              const { exportDepensesPdf } = await import("@/lib/exportPdf")
              exportDepensesPdf(filtered)
            }}
            title="Exporter PDF"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/40 transition">
            <FileDown size={13} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="sticky top-0 bg-white dark:bg-[#0D1424]">
              <tr className="border-b border-gray-100 dark:border-[#1E2D45]">
                <SortTh label="Date"     sortKey="date_depense"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Véhicule" sortKey="immatriculation" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Type"     sortKey="type_depense"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Montant"  sortKey="montant"         current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                <th className="py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
                      <Search size={28} className="opacity-30" />
                      <p className="text-sm font-medium">Aucune dépense trouvée</p>
                      {search && <p className="text-xs">Essayez un autre terme de recherche</p>}
                    </div>
                  </td>
                </tr>
              ) : filtered.map(d => (
                <tr key={d.id_depense}
                  className="border-b border-gray-50 dark:border-[#1A2235] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                  <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                    {d.date_depense ? new Date(d.date_depense).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {d.immatriculation
                      ? <span className="font-mono text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg">{d.immatriculation}</span>
                      : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                    }
                  </td>
                  <td className="py-3 pr-4">
                    {d.type_depense
                      ? <span className="text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-lg">{d.type_depense}</span>
                      : <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                    }
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-sm font-bold font-numeric text-red-600 dark:text-red-400">
                      {Number(d.montant || 0).toLocaleString("fr-FR")}
                      <span className="text-[10px] opacity-60 ml-1">FCFA</span>
                    </span>
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
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-[#1A2235]">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {filtered.length} dépense{filtered.length > 1 ? "s" : ""}
            {search && ` · filtrée${filtered.length > 1 ? "s" : ""}`}
          </p>
          <p className="text-xs font-bold font-numeric text-red-600 dark:text-red-400">
            Total : {totalFiltered.toLocaleString("fr-FR")} <span className="opacity-60">FCFA</span>
          </p>
        </div>
      )}
    </div>
  )
}
