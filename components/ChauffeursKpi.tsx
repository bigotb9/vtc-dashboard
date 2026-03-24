"use client"

import React, { useEffect,useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Users,CheckCircle,XCircle } from "lucide-react"

export default function ChauffeursKpi(){

  const [stats,setStats] = useState({
    total:0,
    actifs:0,
    inactifs:0
  })

  useEffect(()=>{
    const loadStats = async () => {

      const { data } = await supabase
        .from("chauffeurs")
        .select("*")

      if(!data) return

      const total = data.length

      const actifs =
        data.filter(c => c.statut === "ACTIF").length

      const inactifs =
        data.filter(c => c.statut !== "ACTIF").length

      setStats({
        total,
        actifs,
        inactifs
      })

    }

    loadStats()
  },[])

  return(

    <div className="grid grid-cols-3 gap-6">

      <Kpi
        title="Total chauffeurs"
        value={stats.total}
        icon={<Users size={20}/>}
      />

      <Kpi
        title="Chauffeurs actifs"
        value={stats.actifs}
        icon={<CheckCircle size={20}/>}
      />

      <Kpi
        title="Chauffeurs inactifs"
        value={stats.inactifs}
        icon={<XCircle size={20}/>}
      />

    </div>

  )

}

function Kpi({title,value,icon}:{title:string;value:number;icon:React.ReactNode}){

  return(

    <div className="bg-white p-6 rounded-xl shadow flex justify-between">

      <div>

        <p className="text-gray-500 text-sm">
          {title}
        </p>

        <h2 className="text-3xl font-bold text-gray-900">
          {value}
        </h2>

      </div>

      <div className="text-indigo-600">
        {icon}
      </div>

    </div>

  )

}