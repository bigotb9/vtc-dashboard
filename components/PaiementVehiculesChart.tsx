"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

export default function PaiementVehiculesChart({ data: externalData }: any) {

  const [data,setData] = useState([
    { name:"Payés", value:0, color:"#22c55e" },
    { name:"Non payés", value:0, color:"#ef4444" }
  ])

  useEffect(()=>{
    load()
  },[])

  async function load(){

    const today = new Date().toISOString().split("T")[0]

    const { data:vehicules } =
      await supabase
        .from("vehicules")
        .select("id_vehicule")

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
    const nonPayes = totalVehicules - payes

    setData([
      { name:"Payés", value:payes, color:"#22c55e" },
      { name:"Non payés", value:nonPayes, color:"#ef4444" }
    ])

  }

  return(
    <div className="bg-white p-6 rounded-xl shadow h-[350px]">

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Paiement Véhicules
      </h2>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>

          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={95}
          >

            {data.map((entry,index)=>(
              <Cell key={index} fill={entry.color}/>
            ))}

          </Pie>

          <Tooltip formatter={(v)=>`${v} véhicule(s)`} />

          <Legend
            verticalAlign="bottom"
            height={40}
            wrapperStyle={{ paddingTop:"10px" }}
          />

        </PieChart>
      </ResponsiveContainer>

    </div>
  )
}