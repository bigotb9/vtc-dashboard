"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { CheckCircle, AlertTriangle, Bell } from "lucide-react"

export default function AlertesPaiements({ data }: { data?: unknown }) {
  const [stats,            setStats]            = useState({ payes: 0, retard: 0 })
  const [vehiculesRetard,  setVehiculesRetard]  = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0]
      const [{ data: vehicules }, { data: recettes }] = await Promise.all([
        supabase.from("vehicules").select("id_vehicule, immatriculation"),
        supabase.from("recettes_wave").select("Horodatage"),
      ])
      const totalVehicules = vehicules?.length || 0
      const recettesToday  = recettes?.filter(r => r.Horodatage?.startsWith(today)).length || 0
      const payes  = recettesToday
      const retard = Math.max(0, totalVehicules - payes)
      setStats({ payes, retard })
      const vehiculesPayes = vehicules?.slice(0, payes).map(v => v.immatriculation) || []
      setVehiculesRetard(vehicules?.filter(v => !vehiculesPayes.includes(v.immatriculation)).map(v => v.immatriculation) || [])
    }
    load()
  }, [])

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm flex flex-col">

      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
          <Bell size={13} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Alertes paiements</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600">Aujourd'hui</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Payés aujourd'hui</span>
          </div>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.payes}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
            <span className="text-xs font-medium text-red-800 dark:text-red-300">En retard</span>
          </div>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">{stats.retard}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">
          Véhicules non payés
        </p>
        {vehiculesRetard.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={13} />Tous les véhicules sont à jour
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
            {vehiculesRetard.map((v, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#1A2235] last:border-0">
                <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-lg">{v}</span>
                <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">non payé</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
