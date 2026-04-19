"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"

type ChauffeurOpts = {
  nom: string; email?: string; numeroWave?: string; numeroPermis?: string
  numeroCni?: string; domicile?: string; garant?: string
  caTotal: number; caMensuel: number; transactions: number
  rang?: number; totalChauffeurs?: number; actif: boolean
  recettes?: { date: string; montantNet: number; montantBrut: number }[]
}

type VehiculeOpts = {
  immatriculation: string; type?: string; proprietaire?: string; statut: string
  kmActuel?: number; caMensuel: number; caAujourdhui: number; profitMensuel: number
  assuranceExp?: string; visiteExp?: string; carteStatExp?: string; patenteExp?: string
  recettes?: { date: string; chauffeur: string; montantNet: number }[]
}

type Props =
  | { type: "chauffeur"; opts: ChauffeurOpts }
  | { type: "vehicule";  opts: VehiculeOpts  }

export default function ExportFicheButton(props: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    if (props.type === "chauffeur") {
      const { exportChauffeurFichePdf } = await import("@/lib/exportPdf")
      await exportChauffeurFichePdf(props.opts)
    } else {
      const { exportVehiculeFichePdf } = await import("@/lib/exportPdf")
      await exportVehiculeFichePdf(props.opts)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#1E2D45] text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm disabled:opacity-50"
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        : <FileDown size={14} />
      }
      PDF
    </button>
  )
}
