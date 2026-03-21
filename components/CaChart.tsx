"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"

export default function CaChart() {

  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {

    const { data } = await supabase
      .from("vue_ca_journalier")
      .select("date_recette, chiffre_affaire")
      .order("date_recette", { ascending: true })

    setData(data || [])
  }

  return (

    <div className="bg-white p-6 rounded-2xl shadow-sm border mb-8">

      <h2 className="text-lg font-semibold mb-4 text-gray-900">
        Chiffre d'affaires journalier
      </h2>

      <ResponsiveContainer width="100%" height={300}>

        <LineChart data={data}>

          <XAxis dataKey="date_recette" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="chiffre_affaire"
            stroke="#6366f1"
            strokeWidth={3}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>

  )
}