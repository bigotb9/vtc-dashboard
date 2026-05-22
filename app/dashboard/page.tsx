export const dynamic = 'force-dynamic'

import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { PageHeader } from "@/components/PageHeader"
import KpiCards from "@/components/KpiCards"
import RecettesTable from "@/components/RecettesTable"
import DepensesCategorieChart from "@/components/DepensesCategorieChart"
// PaiementVehiculesChart retire le 22/05/2026 : remplace par grid 3 widgets
// (Marge vehicules + Bilan cash net + Depenses categorie pleine largeur).
import MargeVehiculesWidget from "@/components/MargeVehiculesWidget"
import BilanCashNetWidget from "@/components/BilanCashNetWidget"
// AlertesPaiements supprimé le 21/05/2026 (Bug 2 : logique placeholder cassée).
// La liste des véhicules en retard du jour est désormais affichée dans SuiviVersementsWidget.
import AlerteDocuments from "@/components/AlerteDocuments"
import CaChart from "@/components/CaChart"
import CaDepensesChart from "@/components/CaDepensesChart"
import ErrorBoundary from "@/components/ErrorBoundary"
import DashboardActions from "@/components/DashboardActions"
import TachesSuiviWidget from "@/components/TachesSuiviWidget"
import SuiviVersementsWidget from "@/components/SuiviVersementsWidget"

export default async function DashboardPage() {

  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })
    .limit(20)
  const { data: depenses } = await supabase.from("vue_depenses_categories").select("*")

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <PageHeader
        title="Dashboard"
        subtitle={today}
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>}
        accent="indigo"
        actions={<DashboardActions />}
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

      {/* ANALYTICS — 2 widgets synthese en haut, DepensesCategorieChart pleine largeur en bas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary label="Impossible de charger la marge par véhicule">
          <MargeVehiculesWidget />
        </ErrorBoundary>
        <ErrorBoundary label="Impossible de charger le bilan cash net">
          <BilanCashNetWidget />
        </ErrorBoundary>
        <div className="lg:col-span-2">
          <ErrorBoundary label="Impossible de charger les dépenses par catégorie">
            <DepensesCategorieChart data={depenses || []} />
          </ErrorBoundary>
        </div>
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
