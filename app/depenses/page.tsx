export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"

import DepensesTable from "../../components/DepensesTable"
import DepensesCategorieChart from "../../components/DepensesCategorieChart"
import DepensesJourChart from "../../components/DepensesJourChart"
import Link from "next/link"

export default async function DepensesPage() {

  const { data: depenses } = await supabase
    .from("vue_dashboard_depenses")
    .select("*")

  const { data: categorie } = await supabase
    .from("vue_depenses_par_categorie")
    .select("*")

  const { data: jours } = await supabase
    .from("vue_depenses_journalieres")
    .select("*")

  const totalDepenses   = depenses?.reduce((sum, d) => sum + (d.montant || 0), 0) || 0
  const totalOperations = depenses?.length || 0
  const depensesMoyenne = totalOperations > 0 ? totalDepenses / totalOperations : 0

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dépenses</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Suivi des coûts et charges</p>
        </div>
        <Link href="/depenses/create">
          <button className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl shadow-sm text-sm font-semibold transition">
            + Ajouter une dépense
          </button>
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Total dépenses</p>
          <p className="text-2xl font-bold text-red-600 break-words">
            {totalDepenses.toLocaleString("fr-FR")} FCFA
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Nombre d&apos;opérations</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalOperations}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Dépense moyenne</p>
          <p className="text-2xl font-bold text-orange-600 break-words">
            {Math.round(depensesMoyenne).toLocaleString("fr-FR")} FCFA
          </p>
        </div>

      </div>

      {/* GRAPHIQUES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepensesCategorieChart data={categorie || []} />
        <DepensesJourChart data={jours || []} />
      </div>

      {/* TABLE */}
      <DepensesTable depenses={depenses || []} />

    </div>
  )
}
