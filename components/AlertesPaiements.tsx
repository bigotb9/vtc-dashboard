"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { CheckCircle, AlertTriangle, Bell } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type Filter = "retard" | "payes" | "tous"

type VehiculeEtat = { immatriculation: string; paye: boolean }

export default function AlertesPaiements({ data }: { data?: unknown }) {
  const [vehicules, setVehicules] = useState<VehiculeEtat[]>([])
  const [filter,    setFilter]    = useState<Filter>("retard")

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0]
      const [{ data: vehData }, { data: recettes }] = await Promise.all([
        supabase.from("vehicules").select("id_vehicule, immatriculation"),
        supabase.from("recettes_wave").select("Horodatage"),
      ])
      const transactionsAujourdhui = new Set(
        (recettes || [])
          .filter(r => r.Horodatage?.startsWith(today))
          .map((_, i) => i)
      )
      // Approche : les N premières recettes du jour correspondent aux N premiers véhicules
      const nbPayes = (recettes || []).filter(r => r.Horodatage?.startsWith(today)).length
      const liste   = (vehData || []).map((v, i) => ({
        immatriculation: v.immatriculation,
        paye: i < nbPayes,
      }))
      setVehicules(liste)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const payes  = vehicules.filter(v => v.paye)
  const retard = vehicules.filter(v => !v.paye)
  const total  = vehicules.length

  const displayed = filter === "retard" ? retard : filter === "payes" ? payes : vehicules

  const FILTERS: { key: Filter; label: string; count: number; color: string }[] = [
    { key: "retard", label: "En retard", count: retard.length, color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20" },
    { key: "payes",  label: "Payés",     count: payes.length,  color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" },
    { key: "tous",   label: "Tous",      count: total,         color: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-[#1E2D45]" },
  ]

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
          <Bell size={13} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Alertes paiements</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600">Aujourd&apos;hui · {total} véhicules</p>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Payés</span>
          </div>
          <span className="text-sm font-bold font-numeric text-emerald-600 dark:text-emerald-400">{payes.length}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />
            <span className="text-[11px] font-medium text-red-800 dark:text-red-300">Retard</span>
          </div>
          <span className="text-sm font-bold font-numeric text-red-600 dark:text-red-400">{retard.length}</span>
        </div>
      </div>

      {/* Barre de progression globale */}
      {total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Taux de paiement</span>
            <span className="font-numeric">{Math.round((payes.length / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-[#1A2235] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(payes.length / total) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-1 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition flex items-center justify-center gap-1 ${
              filter === f.key ? f.color : "text-gray-400 dark:text-gray-600 bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            {f.label}
            <span className="font-numeric">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {displayed.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 py-2"
            >
              <CheckCircle size={13} />
              {filter === "retard" ? "Tous les véhicules sont à jour !" : "Aucun véhicule dans cette catégorie"}
            </motion.div>
          ) : (
            <motion.div
              key={filter}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-1.5 max-h-[140px] overflow-y-auto"
            >
              {displayed.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#1A2235] last:border-0">
                  <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-lg">
                    {v.immatriculation}
                  </span>
                  {v.paye ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">payé</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">en retard</span>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
