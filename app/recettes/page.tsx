import { supabase } from "@/lib/supabaseClient"
import RecettesTable from "@/components/RecettesTable"
import RecettesChart from "@/components/RecettesChart"
import Link from "next/link"
import { TrendingUp, Wallet, Activity, Plus } from "lucide-react"

export default async function RecettesPage() {

  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })

  type Recette = { Horodatage: string; "Montant net": number }
  const list = (recettes as Recette[]) || []

  const totalRecettes  = list.reduce((s, r) => s + (r["Montant net"] || 0), 0)
  const transactions   = list.length
  const today          = new Date()
  const recettesAujourd = list
    .filter(r => {
      const d = new Date(r.Horodatage)
      return d.getDate()===today.getDate() && d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear()
    })
    .reduce((s, r) => s + (r["Montant net"] || 0), 0)

  const graphData = list.map(r => ({ date: r.Horodatage, montant: r["Montant net"] }))

  const kpis = [
    { label: "Recettes totales",    value: totalRecettes.toLocaleString("fr-FR"),    unit: "FCFA", icon: TrendingUp, color: "from-emerald-400 to-emerald-600",  glow: "bg-emerald-500" },
    { label: "Recettes aujourd'hui",value: recettesAujourd.toLocaleString("fr-FR"),  unit: "FCFA", icon: Wallet,     color: "from-indigo-400 to-blue-600",       glow: "bg-indigo-500" },
    { label: "Transactions",        value: transactions.toLocaleString("fr-FR"),      unit: "",     icon: Activity,   color: "from-violet-400 to-purple-600",     glow: "bg-violet-500" },
  ]

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recettes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Suivi des encaissements Wave</p>
        </div>
        <Link href="/recettes/create">
          <button className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 text-sm font-semibold transition">
            <Plus size={15} />Ajouter une recette
          </button>
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-all">
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.glow}`} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 break-words">
                    {k.value}{k.unit && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600 ml-1">{k.unit}</span>}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CHART */}
      <RecettesChart data={graphData} />

      {/* TABLE */}
      <RecettesTable recettes={recettes || []} />

    </div>
  )
}
