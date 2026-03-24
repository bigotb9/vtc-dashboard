"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Car, Building2, Users, CheckCircle } from "lucide-react"

export default function VehiculesKpi(){

  const [stats,setStats] = useState({
    total:0,
    societe:0,
    clients:0,
    actifs:0
  })

  useEffect(()=>{
    const loadStats = async () => {

      const { data } = await supabase
        .from("vehicules")
        .select("*")

      if(!data) return

      const total = data.length

      const societe =
        data.filter(v =>
          v.proprietaire?.toUpperCase() === "SOCIETE"
        ).length

      const clients =
        data.filter(v =>
          v.proprietaire?.toUpperCase() !== "SOCIETE"
        ).length

      const actifs =
        data.filter(v =>
          v.statut?.toUpperCase() === "ACTIF"
        ).length

      setStats({
        total,
        societe,
        clients,
        actifs
      })

    }

    loadStats()
  },[])

  return(

    <div className="grid grid-cols-4 gap-6 mb-8">

      <Kpi
        title="Total véhicules"
        value={stats.total}
        icon={<Car size={22}/>}
      />

      <Kpi
        title="Véhicules société"
        value={stats.societe}
        icon={<Building2 size={22}/>}
      />

      <Kpi
        title="Véhicules clients"
        value={stats.clients}
        icon={<Users size={22}/>}
      />

      <Kpi
        title="Véhicules actifs"
        value={stats.actifs}
        icon={<CheckCircle size={22}/>}
      />

    </div>

  )

}

function Kpi({title,value,icon}:{title:string;value:number;icon:React.ReactNode}){

  return(

    <div className="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center">

      <div>

        <p className="text-gray-500 text-sm">
          {title}
        </p>

        <h2 className="text-3xl font-bold text-gray-900 mt-1">
          {value}
        </h2>

      </div>

      <div className="text-indigo-600">
        {icon}
      </div>

    </div>

  )

}