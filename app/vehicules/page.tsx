export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import VehiclesTable from "@/components/VehiclesTable"
import VehiculesChart from "@/components/VehiculesChart"
import Link from "next/link"
import { Car, CheckCircle, TrendingUp, DollarSign, Plus } from "lucide-react"

export default async function VehiculesPage() {

  const { data: vehicules } = await supabase.from("vue_dashboard_vehicules").select("*")
  const { data: graph }     = await supabase.from("vue_ca_vehicule_jour").select("*").order("date_recette")

  const totalVehicules  = vehicules?.length || 0
  const vehiculesActifs = vehicules?.filter(v => v.statut === "ACTIF").length || 0
  const caTotal         = vehicules?.reduce((s, v) => s + (v.ca_mensuel || 0), 0) || 0
  const profitTotal     = vehicules?.reduce((s, v) => s + (v.profit     || 0), 0) || 0

  const kpis = [
    { label: "Total véhicules",   value: totalVehicules,                         unit: "",     icon: Car,          color: "from-indigo-400 to-blue-600",    glow: "bg-indigo-500",  size: "lg" },
    { label: "Véhicules actifs",  value: vehiculesActifs,                        unit: "",     icon: CheckCircle,  color: "from-emerald-400 to-teal-600",   glow: "bg-emerald-500", size: "lg" },
    { label: "CA flotte mensuel", value: caTotal.toLocaleString("fr-FR"),        unit: "FCFA", icon: TrendingUp,   color: "from-sky-400 to-cyan-600",       glow: "bg-sky-500",     size: "sm" },
    { label: "Profit flotte",     value: profitTotal.toLocaleString("fr-FR"),    unit: "FCFA", icon: DollarSign,   color: "from-violet-400 to-purple-600",  glow: "bg-violet-500",  size: "sm" },
  ]

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Véhicules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Gestion de la flotte</p>
        </div>
        <Link href="/vehicules/create">
          <button className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-md shadow-indigo-500/20 text-sm font-semibold transition">
            <Plus size={15} />Ajouter un véhicule
          </button>
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-all">
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.glow}`} />
              <div className="flex items-start justify-between relative">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className={`font-bold text-gray-900 dark:text-white mt-1 break-words ${k.size === "lg" ? "text-3xl" : "text-xl"}`}>
                    {k.value}
                    {k.unit && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600 ml-1">{k.unit}</span>}
                  </p>
                </div>
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* TABLE */}
      <VehiclesTable vehicules={vehicules || []} />

      {/* CHART */}
      <VehiculesChart data={graph || []} />

    </div>
  )
}
