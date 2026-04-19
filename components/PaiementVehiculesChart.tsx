"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { CheckCircle2, XCircle } from "lucide-react"

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{payload[0].name}</p>
      <p className="text-sm font-bold" style={{ color: payload[0].payload.color }}>
        {payload[0].value} véhicule{payload[0].value > 1 ? "s" : ""}
      </p>
    </div>
  )
}

export default function PaiementVehiculesChart({ data: _ }: { data?: unknown }) {
  const [payes,    setPayes]    = useState(0)
  const [nonPayes, setNonPayes] = useState(0)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0]
      const [{ data: vehicules }, { data: recettes }] = await Promise.all([
        supabase.from("vehicules").select("id_vehicule"),
        supabase.from("recettes_wave").select("Horodatage").gte("Horodatage", today),
      ])
      const total    = vehicules?.length || 0
      const payesAuj = recettes?.length  || 0
      setPayes(Math.min(payesAuj, total))
      setNonPayes(Math.max(0, total - payesAuj))
      setLoading(false)
    }
    load()
  }, [])

  const total = payes + nonPayes
  const pct   = total > 0 ? Math.round((payes / total) * 100) : 0

  const chartData = [
    { name: "Payés",     value: payes,    color: "#22c55e" },
    { name: "Non payés", value: nonPayes, color: "#ef4444" },
  ]

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Paiements véhicules</h2>
      <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">Statut du jour</p>

      {loading ? (
        <div className="flex items-center justify-center h-[220px]">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Donut chart avec label centré */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={52}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Label centré dans le donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black font-numeric text-gray-900 dark:text-white leading-none">{pct}%</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-600 font-medium mt-0.5">payés</span>
            </div>
          </div>

          {/* Légende custom */}
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Payés <span className="font-bold font-numeric text-emerald-600 dark:text-emerald-400 ml-1">{payes}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle size={14} className="text-red-500 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Non payés <span className="font-bold font-numeric text-red-600 dark:text-red-400 ml-1">{nonPayes}</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
