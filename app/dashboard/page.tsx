export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import KpiCards from "@/components/KpiCards"
import RecettesTable from "@/components/RecettesTable"
import DepensesCategorieChart from "@/components/DepensesCategorieChart"
import PaiementVehiculesChart from "@/components/PaiementVehiculesChart"
import AlertesPaiements from "@/components/AlertesPaiements"
import CaChart from "@/components/CaChart"

export default async function DashboardPage() {

  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })
    .limit(10)

  const { data: depenses }          = await supabase.from("vue_depenses_categories").select("*")
  const { data: paiementVehicules } = await supabase.from("vue_voitures_payees").select("*")

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Données en direct</span>
        </div>
      </div>

      {/* KPI */}
      <KpiCards />

      {/* CA CHART */}
      <CaChart />

      {/* RECETTES TABLE */}
      <RecettesTable recettes={recettes || []} />

      {/* ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DepensesCategorieChart data={depenses || []} />
        <PaiementVehiculesChart data={paiementVehicules || []} />
        <AlertesPaiements data={paiementVehicules || []} />
      </div>

    </div>
  )
}
