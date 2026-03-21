"use client"

import PaiementVehiculesChart from "./PaiementVehiculesChart"
import AlertesPaiements from "./AlertesPaiements"

export default function PaiementVehicules(){

  return(

    <div className="grid grid-cols-2 gap-6">

      {/* Camembert paiements véhicules */}

      <div className="bg-white rounded-xl shadow p-6">

        <PaiementVehiculesChart/>

      </div>

      {/* Alertes paiements */}

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Alertes paiements
        </h2>

        <AlertesPaiements/>

      </div>

    </div>

  )

}