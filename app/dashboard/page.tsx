import { supabase } from "@/lib/supabaseClient"

import SearchBar from "@/components/SearchBar"
import KpiCards from "@/components/KpiCards"
import RecettesTable from "@/components/RecettesTable"

import DepensesCategorieChart from "@/components/DepensesCategorieChart"
import PaiementVehiculesChart from "@/components/PaiementVehiculesChart"
import AlertesPaiements from "@/components/AlertesPaiements"

export default async function DashboardPage() {

  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })
    .limit(10)

  const { data: depenses } = await supabase
    .from("vue_depenses_categories")
    .select("*")

  const { data: profits } = await supabase
    .from("vue_profit_journalier")
    .select("*")

  const { data: paiementVehicules } = await supabase
    .from("vue_voitures_payees")
    .select("*")

  return (

      <div className="min-h-screen p-6 space-y-6">


      {/* SEARCH */}
      <SearchBar />

      {/* KPI */}
      <KpiCards />

      {/* TABLE */}
      <RecettesTable recettes={recettes || []} />

      {/* ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <DepensesCategorieChart data={depenses || []} />

        <PaiementVehiculesChart data={paiementVehicules || []} />

        <AlertesPaiements data={paiementVehicules || []} />

      </div>

    </div>

  )
}