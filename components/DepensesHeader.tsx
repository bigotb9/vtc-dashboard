"use client"

import Link from "next/link"
import { Plus, FileDown } from "lucide-react"
import { useState } from "react"

type Depense = {
  date_depense: string
  immatriculation: string
  type_depense: string
  montant: number
  description?: string
}

export default function DepensesHeader({ depenses }: { depenses: Depense[] }) {
  const [exporting, setExporting] = useState(false)

  const handleExportPdf = async () => {
    setExporting(true)
    const { exportDepensesPdf } = await import("@/lib/exportPdf")
    await exportDepensesPdf(depenses)
    setExporting(false)
  }

  return (
    <div className="flex flex-wrap justify-between items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dépenses</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Suivi des coûts et charges</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleExportPdf} disabled={exporting}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/40 transition disabled:opacity-50">
          {exporting
            ? <span className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            : <FileDown size={15} />
          }
          PDF
        </button>
        <Link href="/depenses/create"
          className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white px-5 py-2.5 rounded-xl shadow-md shadow-red-500/20 text-sm font-semibold transition">
          <Plus size={15} />Ajouter une dépense
        </Link>
      </div>
    </div>
  )
}
