export const dynamic = 'force-dynamic'

import Link from "next/link"
import { LayoutDashboard } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { PageHeader } from "@/components/PageHeader"
import KpiCards from "@/components/KpiCards"
import RecettesTable from "@/components/RecettesTable"
import DepensesCategorieChart from "@/components/DepensesCategorieChart"
import PaiementVehiculesChart from "@/components/PaiementVehiculesChart"
import AlertesPaiements from "@/components/AlertesPaiements"
import AlerteDocuments from "@/components/AlerteDocuments"
import CaChart from "@/components/CaChart"
import CaDepensesChart from "@/components/CaDepensesChart"
import ErrorBoundary from "@/components/ErrorBoundary"
import DashboardRefresh from "@/components/DashboardRefresh"
import TachesSuiviWidget from "@/components/TachesSuiviWidget"
import SuiviVersementsWidget from "@/components/SuiviVersementsWidget"

export default async function DashboardPage() {

  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })
    .limit(20)
  const { data: depenses }          = await supabase.from("vue_depenses_categories").select("*")
  const { data: paiementVehicules } = await supabase.from("vue_voitures_payees").select("*")

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <PageHeader
        title="Dashboard"
        subtitle={today}
        icon={LayoutDashboard}
        accent="indigo"
        actions={
          <>
            <Link href="/chauffeurs/create"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm">
              + Chauffeur
            </Link>
            <Link href="/vehicules/create"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm">
              + Véhicule
            </Link>
            <Link href="/recettes/create"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm shadow-indigo-500/25 ring-1 ring-indigo-500/30">
              + Recette
            </Link>
            <DashboardRefresh />
          </>
        }
      />

      {/* KPI */}
      <ErrorBoundary label="Impossible de charger les KPIs">
        <KpiCards />
      </ErrorBoundary>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary label="Impossible de charger le graphique CA">
          <CaChart />
        </ErrorBoundary>
        <ErrorBoundary label="Impossible de charger le graphique CA vs Dépenses">
          <CaDepensesChart />
        </ErrorBoundary>
      </div>

      {/* RECETTES TABLE */}
      <ErrorBoundary label="Impossible de charger les recettes">
        <RecettesTable recettes={recettes || []} />
      </ErrorBoundary>

      {/* ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ErrorBoundary label="Impossible de charger les dépenses par catégorie">
          <DepensesCategorieChart data={depenses || []} />
        </ErrorBoundary>
        <ErrorBoundary label="Impossible de charger les paiements véhicules">
          <PaiementVehiculesChart data={paiementVehicules || []} />
        </ErrorBoundary>
        <ErrorBoundary label="Impossible de charger les alertes paiements">
          <AlertesPaiements data={paiementVehicules || []} />
        </ErrorBoundary>
      </div>

      {/* SUIVI VERSEMENTS */}
      <ErrorBoundary label="Impossible de charger le suivi des versements">
        <SuiviVersementsWidget />
      </ErrorBoundary>

      {/* ALERTES DOCUMENTS + RÉPARATIONS À PROGRAMMER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary label="Impossible de charger les alertes documents">
          <AlerteDocuments />
        </ErrorBoundary>
        <ErrorBoundary label="Impossible de charger les réparations à programmer">
          <TachesSuiviWidget />
        </ErrorBoundary>
      </div>

    </div>
  )
}
