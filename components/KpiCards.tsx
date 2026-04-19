"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Wallet, TrendingUp, Car, Users, BarChart3, CreditCard, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { motion } from "framer-motion"
import Card3D from "@/components/Card3D"
import AnimatedCounter from "@/components/AnimatedCounter"

type KpiData = {
  caTotal: number; depensesTotal: number; profit: number
  caJour: number; caMois: number; vehicules: number; chauffeurs: number
  caMoisPrecedent: number; caJourHier: number; depensesMoisPrecedent: number
}

function TrendBadge({ current, previous, inverseColor = false }: { current: number; previous: number; inverseColor?: boolean }) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const isUp = pct >= 0
  const isNeutral = Math.abs(pct) < 0.5

  const color = isNeutral
    ? "text-gray-500 bg-gray-100 dark:bg-gray-800"
    : (isUp !== inverseColor)
      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
      : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"

  const Icon = isNeutral ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
      <Icon size={10} />
      {isNeutral ? "=" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  )
}

function KpiCard({
  title, value, icon: Icon, gradient, currency = true, size = "normal", index = 0,
  previous, previousLabel = "vs mois préc.", inverseColor = false
}: {
  title: string; value: number; icon: React.ElementType
  gradient: string; currency?: boolean; size?: "normal" | "large"; index?: number
  previous?: number; previousLabel?: string; inverseColor?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card3D className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45]" depth={10}>
        <div className="p-5 overflow-hidden relative">
          {/* subtle bg glow */}
          <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${gradient}`} />

          <div className="flex items-start justify-between relative">
            <div className="space-y-1.5 flex-1 min-w-0 pr-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{title}</p>
              <div className={`font-bold text-gray-900 dark:text-white leading-tight break-words ${size === "large" ? "text-2xl" : "text-xl"}`}>
                <AnimatedCounter
                  value={value}
                  suffix={currency ? " FCFA" : ""}
                  duration={1.4}
                />
              </div>
              {previous !== undefined && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <TrendBadge current={value} previous={previous} inverseColor={inverseColor} />
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">{previousLabel}</span>
                </div>
              )}
            </div>
            <motion.div
              className={`flex-shrink-0 w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shadow-md`}
              whileHover={{ scale: 1.15, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Icon size={18} className="text-white" />
            </motion.div>
          </div>
        </div>
      </Card3D>
    </motion.div>
  )
}

export default function KpiCards() {
  const [kpi, setKpi] = useState<KpiData>({
    caTotal: 0, depensesTotal: 0, profit: 0,
    caJour: 0, caMois: 0, vehicules: 0, chauffeurs: 0,
    caMoisPrecedent: 0, caJourHier: 0, depensesMoisPrecedent: 0,
  })

  useEffect(() => {
    const fetchKpi = async () => {
      const today     = new Date().toISOString().split("T")[0]
      const tomorrow  = new Date(Date.now() + 86400000).toISOString().split("T")[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

      const [caJourRes, caHierRes, caAllRes, depensesRes, vehRes, chauffRes] = await Promise.all([
        supabase.from("recettes_wave").select('"Montant net"').gte("Horodatage", today).lt("Horodatage", tomorrow),
        supabase.from("recettes_wave").select('"Montant net"').gte("Horodatage", yesterday).lt("Horodatage", today),
        supabase.from("vue_ca_mensuel").select("chiffre_affaire").order("annee", { ascending: false }).order("mois", { ascending: false }),
        supabase.from("vue_depenses_categories").select("total_depenses"),
        supabase.from("vehicules").select("*", { count: "exact", head: true }),
        supabase.from("chauffeurs").select("*", { count: "exact", head: true }),
      ])

      const caJour            = (caJourRes.data || []).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
      const caHier            = (caHierRes.data || []).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
      const totalDep          = (depensesRes.data || []).reduce((s, r) => s + Number(r.total_depenses || 0), 0)
      const caMois            = Number(caAllRes.data?.[0]?.chiffre_affaire || 0)
      const caMoisPrecedent   = Number(caAllRes.data?.[1]?.chiffre_affaire || 0)
      const caTotal           = (caAllRes.data || []).reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)

      setKpi({
        caTotal,
        depensesTotal:          totalDep,
        profit:                 caTotal - totalDep,
        caJour,
        caMois,
        vehicules:              vehRes.count   || 0,
        chauffeurs:             chauffRes.count || 0,
        caMoisPrecedent,
        caJourHier:             caHier,
        depensesMoisPrecedent:  0,
      })
    }
    fetchKpi()
  }, [])

  return (
    <div className="space-y-4" style={{ perspective: "1200px" }}>

      {/* Ligne 1 – Finance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="CA Total"         value={kpi.caTotal}       icon={BarChart3}    gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" size="large" index={0}
          previous={kpi.caMoisPrecedent} previousLabel="vs mois préc." />
        <KpiCard title="Dépenses Totales" value={kpi.depensesTotal} icon={CreditCard}   gradient="bg-gradient-to-br from-red-400 to-rose-600"         size="large" index={1}
          inverseColor />
        <KpiCard title="Profit Net"       value={kpi.profit}        icon={TrendingDown} gradient="bg-gradient-to-br from-violet-500 to-indigo-600"    size="large" index={2}
          previous={kpi.caMoisPrecedent} previousLabel="vs mois préc." />
      </div>

      {/* Ligne 2 – Opérations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="CA Aujourd'hui" value={kpi.caJour}      icon={Wallet}     gradient="bg-gradient-to-br from-green-400 to-teal-500"    index={3}
          previous={kpi.caJourHier} previousLabel="vs hier" />
        <KpiCard title="CA Mensuel"     value={kpi.caMois}      icon={TrendingUp} gradient="bg-gradient-to-br from-indigo-400 to-blue-600"   index={4}
          previous={kpi.caMoisPrecedent} previousLabel="vs mois préc." />
        <KpiCard title="Véhicules"      value={kpi.vehicules}   icon={Car}        gradient="bg-gradient-to-br from-sky-400 to-cyan-600"      index={5} currency={false} />
        <KpiCard title="Chauffeurs"     value={kpi.chauffeurs}  icon={Users}      gradient="bg-gradient-to-br from-purple-400 to-violet-600" index={6} currency={false} />
      </div>

    </div>
  )
}
