"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { CheckCircle, AlertTriangle } from "lucide-react"

export default function AlertesPaiements() {

  const [stats,setStats] = useState({
    payes:0,
    retard:0
  })

  const [vehiculesRetard,setVehiculesRetard] = useState<string[]>([])

  useEffect(()=>{
    load()
  },[])

  async function load(){

    const today = new Date().toISOString().split("T")[0]

    const { data:vehicules } =
      await supabase
        .from("vehicules")
        .select("id_vehicule, immatriculation")

    const { data:recettes } =
      await supabase
        .from("recettes_wave")
        .select("Horodatage")

    const totalVehicules = vehicules?.length || 0

    const recettesToday =
      recettes?.filter(r =>
        r.Horodatage?.startsWith(today)
      ).length || 0

    const payes = recettesToday
    const retard = totalVehicules - payes

    setStats({
      payes,
      retard
    })

    /* ---------------------------
       LISTE VEHICULES NON PAYES
    ---------------------------- */

    const vehiculesPayes = vehicules
      ?.slice(0,payes)
      .map(v => v.immatriculation) || []

    const nonPayes =
      vehicules
        ?.filter(v =>
          !vehiculesPayes.includes(v.immatriculation)
        )
        .map(v => v.immatriculation) || []

    setVehiculesRetard(nonPayes)

  }

  return(

    <div className="bg-white p-6 rounded-xl shadow h-[350px] flex flex-col">

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Alertes paiements
      </h2>

      <div className="space-y-4 mb-4">

        <div className="flex justify-between items-center">

          <div className="flex items-center gap-3">

            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="text-green-600" size={20}/>
            </div>

            <span className="text-gray-700">
              Véhicules payés aujourd'hui
            </span>

          </div>

          <span className="text-green-600 font-bold text-lg">
            {stats.payes}
          </span>

        </div>


        <div className="flex justify-between items-center">

          <div className="flex items-center gap-3">

            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="text-red-600" size={20}/>
            </div>

            <span className="text-gray-700">
              Véhicules en retard
            </span>

          </div>

          <span className="text-red-600 font-bold text-lg">
            {stats.retard}
          </span>

        </div>

      </div>

      {/* LISTE VEHICULES */}

      <div className="border-t pt-3 flex-1 overflow-auto">

        <p className="text-sm font-semibold text-gray-700 mb-2">
          Véhicules non payés
        </p>

        {vehiculesRetard.length === 0 ? (

          <p className="text-gray-400 text-sm">
            Aucun véhicule en retard
          </p>

        ) : (

          <ul className="space-y-2 text-sm text-gray-900 font-medium">

            {vehiculesRetard.map((v,index)=>(
              <li
                key={index}
                className="flex justify-between border-b pb-1"
              >
                <span>{v}</span>

                <span className="text-red-500">
                  non payé
                </span>

              </li>
            ))}

          </ul>

        )}

      </div>

    </div>

  )

}