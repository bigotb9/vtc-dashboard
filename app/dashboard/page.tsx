import SearchBar from "@/components/SearchBar"
import KpiCards from "@/components/KpiCards"
import CaChart from "@/components/CaChart"
import DepensesChart from "@/components/DepensesChart"
import TopChauffeurs from "@/components/TopChauffeurs"
import PaiementsVehicules from "@/components/PaiementVehiculesChart"
import AlertesPaiements from "@/components/AlertesPaiements"

export default function Dashboard() {

  return (

    <div>

      <SearchBar />

      <KpiCards />

      {/* Ligne graphique + paiements + alertes */}

      <div className="grid grid-cols-4 gap-6 mb-8">

        <div className="col-span-2">
          <CaChart />
        </div>

        <PaiementsVehicules />

        <AlertesPaiements />

      </div>

      {/* Ligne suivante */}

      <div className="grid grid-cols-2 gap-6">

        <DepensesChart />

        <TopChauffeurs />

      </div>

    </div>

  )
}