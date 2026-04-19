"use client"

import { useState, useMemo } from "react"
import { CreditCard, Activity, BarChart3, Plus, FileDown } from "lucide-react"
import Link from "next/link"
import DepensesTable from "@/components/DepensesTable"
import DepensesCategorieChart from "@/components/DepensesCategorieChart"
import DepensesJourChart from "@/components/DepensesJourChart"

type Depense = {
  id_depense:      string
  date_depense:    string
  montant:         number
  type_depense:    string
  description:     string
  immatriculation: string
}

type CategorieStat = { type_depense: string; total_depenses: number }
type JourStat      = { date_depense: string; total_depenses: number }

type Period = "week" | "month" | "3m" | "all"

const PERIODS: { label: string; value: Period }[] = [
  { label: "Cette semaine", value: "week"  },
  { label: "Ce mois",       value: "month" },
  { label: "3 mois",        value: "3m"    },
  { label: "Tout",          value: "all"   },
]

function getStartDate(period: Period): string {
  const now = new Date()
  if (period === "week") {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1 // lundi = 0
    const monday = new Date(now)
    monday.setDate(now.getDate() - day)
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString().split("T")[0]
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  }
  if (period === "3m") {
    return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0]
  }
  return ""
}

export default function DepensesPageClient({
  depenses: allDepenses,
  categories,
  jours,
}: {
  depenses:   Depense[]
  categories: CategorieStat[]
  jours:      JourStat[]
}) {
  const [period,    setPeriod]    = useState<Period>("month")
  const [exporting, setExporting] = useState(false)

  const depenses = useMemo(() => {
    const cutoff = getStartDate(period)
    if (!cutoff) return allDepenses
    return allDepenses.filter(d => d.date_depense >= cutoff)
  }, [allDepenses, period])

  const totalDepenses   = depenses.reduce((s, d) => s + Number(d.montant || 0), 0)
  const totalOperations = depenses.length
  const depensesMoyenne = totalOperations > 0 ? totalDepenses / totalOperations : 0

  // Filtrer aussi les graphiques par période
  const cutoff = getStartDate(period)
  const joursFiltered = cutoff
    ? jours.filter(j => j.date_depense >= cutoff)
    : jours

  const handlePdf = async () => {
    setExporting(true)
    const { exportDepensesPdf } = await import("@/lib/exportPdf")
    await exportDepensesPdf(depenses)
    setExporting(false)
  }

  const kpis = [
    { label: "Total dépenses",  value: Math.round(totalDepenses).toLocaleString("fr-FR"),   unit: "FCFA", icon: CreditCard, gradient: "from-red-400 to-rose-600",     glow: "bg-red-500",     textColor: "text-red-600 dark:text-red-400"     },
    { label: "Opérations",      value: totalOperations.toLocaleString("fr-FR"),              unit: "",     icon: Activity,   gradient: "from-orange-400 to-amber-600",  glow: "bg-orange-500",  textColor: "text-orange-600 dark:text-orange-400" },
    { label: "Dépense moyenne", value: Math.round(depensesMoyenne).toLocaleString("fr-FR"),  unit: "FCFA", icon: BarChart3,  gradient: "from-violet-400 to-purple-600", glow: "bg-violet-500",  textColor: "text-violet-600 dark:text-violet-400" },
  ]

  return (
    <div className="space-y-6 animate-in">

      {/* Header avec filtres période */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dépenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Suivi des coûts et charges</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtres période */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1A2235] rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  period === p.value
                    ? "bg-white dark:bg-[#0D1424] text-red-600 dark:text-red-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={handlePdf} disabled={exporting}
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-all">
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.glow}`} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className={`text-2xl font-bold font-numeric mt-1 break-words ${k.textColor}`}>
                    {k.value}
                    {k.unit && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600 ml-1">{k.unit}</span>}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepensesCategorieChart data={categories} />
        <DepensesJourChart data={joursFiltered} />
      </div>

      {/* Table filtrée */}
      <DepensesTable depenses={depenses} />

    </div>
  )
}
