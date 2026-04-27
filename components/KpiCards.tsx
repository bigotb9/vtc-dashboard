"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Wallet, TrendingUp, Car, Users, BarChart3, CreditCard, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { motion } from "framer-motion"

type KpiData = {
  caTotal: number; depensesTotal: number; profit: number
  caJour: number; caMois: number; vehicules: number; chauffeurs: number
  caMoisPrecedent: number; caJourHier: number; depensesMoisPrecedent: number
}

// ── Trend badge ────────────────────────────────────────────────────────────────
function TrendBadge({ current, previous, inverseColor = false }: { current: number; previous: number; inverseColor?: boolean }) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const isUp = pct >= 0
  const isNeutral = Math.abs(pct) < 0.5

  const color = isNeutral
    ? "text-gray-400 bg-gray-500/10"
    : (isUp !== inverseColor)
      ? "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20"
      : "text-red-400 bg-red-500/10 ring-1 ring-red-500/20"

  const Icon = isNeutral ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
      <Icon size={10} />
      {isNeutral ? "stable" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  )
}

// ── Accent colors per card ─────────────────────────────────────────────────────
type Accent = "emerald" | "red" | "violet" | "teal" | "indigo" | "sky" | "purple"
const ACCENT_MAP: Record<Accent, {
  bar: string; glow: string; iconGrad: string; iconShadow: string
}> = {
  emerald: {
    bar:        "from-emerald-400 via-teal-400 to-emerald-500",
    glow:       "rgba(16,185,129,0.12)",
    iconGrad:   "from-emerald-400 to-teal-500",
    iconShadow: "shadow-emerald-500/30",
  },
  red: {
    bar:        "from-red-400 via-rose-400 to-red-500",
    glow:       "rgba(239,68,68,0.10)",
    iconGrad:   "from-red-400 to-rose-500",
    iconShadow: "shadow-red-500/30",
  },
  violet: {
    bar:        "from-violet-400 via-purple-400 to-indigo-500",
    glow:       "rgba(139,92,246,0.12)",
    iconGrad:   "from-violet-400 to-indigo-500",
    iconShadow: "shadow-violet-500/30",
  },
  teal: {
    bar:        "from-teal-400 via-emerald-400 to-green-500",
    glow:       "rgba(20,184,166,0.10)",
    iconGrad:   "from-teal-400 to-green-500",
    iconShadow: "shadow-teal-500/30",
  },
  indigo: {
    bar:        "from-indigo-400 via-blue-400 to-indigo-500",
    glow:       "rgba(99,102,241,0.12)",
    iconGrad:   "from-indigo-400 to-blue-500",
    iconShadow: "shadow-indigo-500/30",
  },
  sky: {
    bar:        "from-sky-400 via-cyan-400 to-sky-500",
    glow:       "rgba(14,165,233,0.10)",
    iconGrad:   "from-sky-400 to-cyan-500",
    iconShadow: "shadow-sky-500/30",
  },
  purple: {
    bar:        "from-purple-400 via-violet-400 to-purple-500",
    glow:       "rgba(168,85,247,0.12)",
    iconGrad:   "from-purple-400 to-violet-500",
    iconShadow: "shadow-purple-500/30",
  },
}

// ── Premium KPI card ───────────────────────────────────────────────────────────
function KpiCard({
  title, value, icon: Icon,
  accent = "indigo", currency = true, size = "normal", index = 0,
  previous, previousLabel = "vs mois préc.", inverseColor = false,
}: {
  title: string; value: number; icon: React.ElementType
  accent?: Accent; currency?: boolean; size?: "normal" | "large"; index?: number
  previous?: number; previousLabel?: string; inverseColor?: boolean
}) {
  const [displayed, setDisplayed] = useState(0)
  const a = ACCENT_MAP[accent]

  // Smooth counter animation
  useEffect(() => {
    if (value === 0) { setDisplayed(0); return }
    let frame = 0
    const total = 48
    const timer = setInterval(() => {
      frame++
      const progress = frame / total
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(eased * value))
      if (frame >= total) { setDisplayed(value); clearInterval(timer) }
    }, 16)
    return () => clearInterval(timer)
  }, [value])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
      className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden group cursor-default"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px -8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)" }}
    >
      {/* Accent bar — top edge */}
      <div className={`absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r ${a.bar} transition-opacity duration-300 opacity-60 group-hover:opacity-100`} />

      {/* Glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${a.glow}, transparent)` }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Label */}
            <p className="text-[10.5px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3 truncate">
              {title}
            </p>

            {/* Value */}
            <div className={`font-black tracking-tight text-gray-900 dark:text-white leading-none font-numeric ${size === "large" ? "text-[1.75rem]" : "text-[1.4rem]"}`}>
              {currency
                ? <>{displayed.toLocaleString("fr-FR")}<span className="text-sm font-semibold text-gray-400 dark:text-gray-600 ml-1.5">F</span></>
                : displayed.toLocaleString("fr-FR")
              }
            </div>

            {/* Trend */}
            {previous !== undefined && (
              <div className="flex items-center gap-1.5 mt-3">
                <TrendBadge current={value} previous={previous} inverseColor={inverseColor} />
                <span className="text-[10px] text-gray-400 dark:text-gray-600">{previousLabel}</span>
              </div>
            )}
          </div>

          {/* Icon */}
          <motion.div
            className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${a.iconGrad} flex items-center justify-center shadow-lg ${a.iconShadow} opacity-75 group-hover:opacity-100 transition-opacity`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Icon size={17} className="text-white" />
          </motion.div>
        </div>
      </div>

      {/* Bottom shimmer line on hover */}
      <div className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r ${a.bar} opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
    </motion.div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
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

      const caJour           = (caJourRes.data  || []).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
      const caHier           = (caHierRes.data  || []).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
      const totalDep         = (depensesRes.data || []).reduce((s, r) => s + Number(r.total_depenses || 0), 0)
      const caMois           = Number(caAllRes.data?.[0]?.chiffre_affaire || 0)
      const caMoisPrecedent  = Number(caAllRes.data?.[1]?.chiffre_affaire || 0)
      const caTotal          = (caAllRes.data || []).reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)

      setKpi({
        caTotal,
        depensesTotal:         totalDep,
        profit:                caTotal - totalDep,
        caJour,
        caMois,
        vehicules:             vehRes.count    || 0,
        chauffeurs:            chauffRes.count || 0,
        caMoisPrecedent,
        caJourHier:            caHier,
        depensesMoisPrecedent: 0,
      })
    }
    fetchKpi()
  }, [])

  return (
    <div className="space-y-3">
      {/* Row 1 — Finance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard title="CA Total"         value={kpi.caTotal}       icon={BarChart3}    accent="emerald" size="large" index={0} previous={kpi.caMoisPrecedent} previousLabel="vs mois préc." />
        <KpiCard title="Dépenses Totales" value={kpi.depensesTotal} icon={CreditCard}   accent="red"     size="large" index={1} inverseColor />
        <KpiCard title="Profit Net"       value={kpi.profit}        icon={TrendingDown} accent="violet"  size="large" index={2} previous={kpi.caMoisPrecedent} previousLabel="vs mois préc." />
      </div>
      {/* Row 2 — Opérations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="CA Aujourd'hui" value={kpi.caJour}     icon={Wallet}     accent="teal"   index={3} previous={kpi.caJourHier}      previousLabel="vs hier" />
        <KpiCard title="CA Mensuel"     value={kpi.caMois}     icon={TrendingUp} accent="indigo" index={4} previous={kpi.caMoisPrecedent} previousLabel="vs mois préc." />
        <KpiCard title="Véhicules"      value={kpi.vehicules}  icon={Car}        accent="sky"    index={5} currency={false} />
        <KpiCard title="Chauffeurs"     value={kpi.chauffeurs} icon={Users}      accent="purple" index={6} currency={false} />
      </div>
    </div>
  )
}
