"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  ResponsiveContainer,
  Legend
} from "recharts"

const colors = ["#6366f1","#22c55e","#f97316","#ef4444","#06b6d4"]

export default function DepensesChart() {

  type DepenseRow = {
    type_depense: string
    total_depenses: number
  }

  const [data, setData] = useState<DepenseRow[]>([])

  useEffect(() => {
    const fetchData = async () => {

      const { data } = await supabase
        .from("vue_depenses_categories")
        .select("type_depense, total_depenses")

      setData(data || [])
    }

    fetchData()
  }, [])

  return (

    <div className="bg-white p-6 rounded-2xl shadow-sm border text-gray-900">

      <h2 className="text-lg font-semibold mb-4">
        Dépenses par catégorie
      </h2>

      <ResponsiveContainer width="100%" height={320}>

        <PieChart>

          <Pie
            data={data}
            dataKey="total_depenses"
            nameKey="type_depense"
            outerRadius={120}
            label
          >

            {data.map((entry, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}

          </Pie>

          <Tooltip
            formatter={(value) =>
              `${Number(value ?? 0).toLocaleString()} FCFA`
            }
          />

          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>
  )
}