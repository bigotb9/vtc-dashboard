"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Wallet, TrendingUp, Car, Users, BarChart3, CreditCard, TrendingDown } from "lucide-react"

type KpiData = {
  caTotal: number; depensesTotal: number; profit: number
  caJour: number; caMois: number; vehicules: number; chauffeurs: number
}

function KpiCard({
  title, value, icon: Icon, gradient, currency = true, size = "normal"
}: {
  title: string; value: number; icon: React.ElementType
  gradient: string; currency?: boolean; size?: "normal" | "large"
}) {
  return (
    <div className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden group hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 transition-all duration-200">
      {/* subtle bg glow */}
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${gradient}`} />

      <div className="flex items-start justify-between relative">
        <div className="space-y-1 flex-1 min-w-0 pr-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{title}</p>
          <p className={`font-bold text-gray-900 dark:text-white leading-tight break-words ${size === "large" ? "text-2xl" : "text-xl"}`}>
            {Number(value).toLocaleString("fr-FR")}
            {currency && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600 ml-1">FCFA</span>}
          </p>
        </div>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shadow-md`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export default function KpiCards() {
  const [kpi, setKpi] = useState<KpiData>({
    caTotal: 0, depensesTotal: 0, profit: 0,
    caJour: 0, caMois: 0, vehicules: 0, chauffeurs: 0
  })

  useEffect(() => {
    const fetchKpi = async () => {
      const today    = new Date().toISOString().split("T")[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]

      const [caJourRes, caAllRes, depensesRes, vehRes, chauffRes] = await Promise.all([
        supabase.from("recettes_wave").select('"Montant net"').gte("Horodatage", today).lt("Horodatage", tomorrow),
        supabase.from("vue_ca_mensuel").select("chiffre_affaire").order("annee", { ascending: false }).order("mois", { ascending: false }),
        supabase.from("vue_depenses_categories").select("total_depenses"),
        supabase.from("vehicules").select("*", { count: "exact", head: true }),
        supabase.from("chauffeurs").select("*", { count: "exact", head: true }),
      ])

      const caJour   = (caJourRes.data || []).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
      const totalDep = (depensesRes.data || []).reduce((s, r) => s + Number(r.total_depenses || 0), 0)
      // CA mensuel = mois le plus récent ; CA total = cumul de tous les mois
      const caMois   = Number(caAllRes.data?.[0]?.chiffre_affaire || 0)
      const caTotal  = (caAllRes.data || []).reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)

      setKpi({
        caTotal,
        depensesTotal: totalDep,
        profit:        caTotal - totalDep,
        caJour,
        caMois,
        vehicules:     vehRes.count   || 0,
        chauffeurs:    chauffRes.count || 0,
      })
    }
    fetchKpi()
  }, [])

  return (
    <div className="space-y-4">

      {/* Ligne 1 – Finance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="CA Total"          value={kpi.caTotal}       icon={BarChart3}    gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" size="large" />
        <KpiCard title="Dépenses Totales"  value={kpi.depensesTotal} icon={CreditCard}   gradient="bg-gradient-to-br from-red-400 to-rose-600"     size="large" />
        <KpiCard title="Profit Net"        value={kpi.profit}        icon={TrendingDown} gradient="bg-gradient-to-br from-violet-500 to-indigo-600" size="large" />
      </div>

      {/* Ligne 2 – Opérations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="CA Aujourd'hui" value={kpi.caJour}      icon={Wallet}     gradient="bg-gradient-to-br from-green-400 to-teal-500" />
        <KpiCard title="CA Mensuel"     value={kpi.caMois}      icon={TrendingUp} gradient="bg-gradient-to-br from-indigo-400 to-blue-600" />
        <KpiCard title="Véhicules"      value={kpi.vehicules}   icon={Car}        gradient="bg-gradient-to-br from-sky-400 to-cyan-600"   currency={false} />
        <KpiCard title="Chauffeurs"     value={kpi.chauffeurs}  icon={Users}      gradient="bg-gradient-to-br from-purple-400 to-violet-600" currency={false} />
      </div>

    </div>
  )
}
