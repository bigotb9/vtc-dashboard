"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Brain, Users, TrendingUp, AlertTriangle, CheckCircle, Phone,
  MessageSquare, RefreshCw, Sparkles, Copy, Check, Activity,
  Instagram, Linkedin, Facebook, Zap, Target, Clock, Award,
  ArrowUpRight, ArrowDownRight, BarChart2,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────
type DriverStat = {
  id: string; nom: string; telephone: string
  vehicle: string; plaque: string; solde: string; statut: string
  totalCourses: number; totalRevenue: number; commission: number
  lastActivity: string | null; status: "actif" | "risque" | "inactif"
  coursesWeek: number; coursesMois: number
}

const fmt   = (v: number) => Number(v).toLocaleString("fr-FR")
const fdate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"
const COMMISSION = 0.025

function statusCfg(s: "actif" | "risque" | "inactif") {
  return {
    actif:   { label: "Actif",    bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
    risque:  { label: "À risque", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",       dot: "bg-amber-400"   },
    inactif: { label: "Inactif",  bg: "bg-red-500/10 text-red-400 border-red-500/20",             dot: "bg-red-400"     },
  }[s]
}

function HealthRing({ score }: { score: number }) {
  const r    = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"
  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg width={120} height={120} className="-rotate-90">
        <circle cx={60} cy={60} r={r} fill="none" strokeWidth={8} stroke="rgba(255,255,255,0.07)" />
        <circle cx={60} cy={60} r={r} fill="none" strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" stroke={color}
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

function WhatsAppBtn({ phone, name, type }: { phone: string; name: string; type: "risque" | "inactif" }) {
  const msgs = {
    risque:  `Bonjour ${name}, nous avons remarqué une baisse de votre activité sur Boyah Transport. N'hésitez pas à reprendre les courses Yango — notre équipe est disponible. 🚗`,
    inactif: `Bonjour ${name}, cela fait un moment que nous ne vous avons pas vu sur Boyah Transport ! Vos accès Yango sont toujours actifs. Reprenez les courses dès aujourd'hui. 💪`,
  }
  const tel = phone.replace(/\s+/g, "").replace(/^\+/, "")
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(msgs[type])}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium transition border border-green-500/20">
      <MessageSquare size={12} /> WhatsApp
    </a>
  )
}

function AlerteCard({ icon: Icon, title, desc, color, action }: {
  icon: React.ElementType; title: string; desc: string; color: string; action?: React.ReactNode
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${color}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-75 mt-0.5">{desc}</p>
      </div>
      {action}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AIInsightsBoyahTransport() {
  const [loading, setLoading]           = useState(true)
  const [drivers, setDrivers]           = useState<DriverStat[]>([])
  const [tab, setTab]                   = useState<"global" | "actif" | "risque" | "inactif">("global")
  const [genLoading, setGenLoading]     = useState(false)
  const [generatedPost, setGeneratedPost] = useState<string | null>(null)
  const [platform, setPlatform]         = useState<"facebook" | "instagram" | "linkedin">("facebook")
  const [copied, setCopied]             = useState(false)
  const [lastSync, setLastSync]         = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/boyah-transport/driver-stats")
      const data = await res.json()
      if (data.ok) { setDrivers(data.stats || []); setLastSync(new Date()) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const generatePost = async () => {
    setGenLoading(true); setGeneratedPost(null)
    const actifs  = drivers.filter(d => d.status === "actif").length
    const total   = drivers.length
    const revMois = drivers.reduce((s, d) => s + d.coursesMois * (d.totalRevenue / Math.max(d.totalCourses, 1)), 0)
    const res = await fetch("/api/boyah-transport/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        stats: {
          prestataires_actifs:      actifs,
          total_prestataires:       total,
          taux_activite_pct:        total > 0 ? Math.round(actifs / total * 100) : 0,
          commission_ce_mois_fcfa:  Math.round(revMois * COMMISSION),
          courses_ce_mois:          drivers.reduce((s, d) => s + d.coursesMois, 0),
          top_driver:               drivers[0]?.nom || "",
        },
      }),
    })
    const data = await res.json()
    setGeneratedPost(data.post || data.error || "Erreur génération")
    setGenLoading(false)
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────
  const actifs   = drivers.filter(d => d.status === "actif")
  const risque   = drivers.filter(d => d.status === "risque")
  const inactifs = drivers.filter(d => d.status === "inactif")

  const revTotal   = drivers.reduce((s, d) => s + d.totalRevenue, 0)
  const commTotal  = drivers.reduce((s, d) => s + d.commission, 0)
  const commMois   = drivers.reduce((s, d) => s + d.coursesMois * (d.totalRevenue / Math.max(d.totalCourses, 1)) * COMMISSION, 0)
  const coursesWeekTotal = drivers.reduce((s, d) => s + d.coursesWeek, 0)
  const coursesMoisTotal = drivers.reduce((s, d) => s + d.coursesMois, 0)

  const avgRevPerDriver = actifs.length > 0
    ? actifs.reduce((s, d) => s + d.totalRevenue, 0) / actifs.length
    : 0

  const healthScore = drivers.length > 0
    ? Math.min(100, Math.round(
        (actifs.length / drivers.length * 60) +
        (risque.length / drivers.length * 20) +
        (coursesWeekTotal > 0 ? 20 : 0)
      ))
    : 0

  // Top performers
  const top3 = [...actifs].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3)

  // Alertes décisionnelles
  const alertes = []
  if (risque.length > 0)
    alertes.push({ type: "warn", icon: AlertTriangle, title: `${risque.length} prestataire(s) à risque`, desc: `Actifs ce mois mais absents cette semaine. Risque de départ si pas de contact.`, color: "bg-amber-500/5 border-amber-500/20 text-amber-400" })
  if (inactifs.length > drivers.length * 0.3)
    alertes.push({ type: "danger", icon: Activity, title: `${Math.round(inactifs.length / drivers.length * 100)}% de la flotte inactive`, desc: `${inactifs.length} chauffeurs n'ont pas de course ce mois. Intervention requise.`, color: "bg-red-500/5 border-red-500/20 text-red-400" })
  if (healthScore >= 75)
    alertes.push({ type: "ok", icon: CheckCircle, title: "Flotte en bonne santé", desc: `${actifs.length} chauffeurs actifs cette semaine sur ${drivers.length} — continuez ainsi.`, color: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" })
  if (coursesMoisTotal > 0 && coursesWeekTotal / coursesMoisTotal < 0.15)
    alertes.push({ type: "warn", icon: Clock, title: "Activité en baisse cette semaine", desc: `Seulement ${coursesWeekTotal} courses cette semaine vs ${coursesMoisTotal} ce mois. Tendance préoccupante.`, color: "bg-orange-500/5 border-orange-500/20 text-orange-400" })

  const displayedDrivers =
    tab === "actif"   ? actifs :
    tab === "risque"  ? risque :
    tab === "inactif" ? inactifs : drivers

  const platIcons = { facebook: Facebook, instagram: Instagram, linkedin: Linkedin }

  return (
    <div id="ai-insights-content" className="space-y-6 pb-10">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md">
              <Brain size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Insights · Boyah Transport</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analyse des prestataires & indicateurs de décision
            {lastSync && <span className="ml-2 text-gray-400">· Màj {lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 text-sm font-medium transition disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
        </div>
      </div>

      {/* ── ALERTES DÉCISIONNELLES ── */}
      {alertes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {alertes.map((a, i) => (
            <AlerteCard key={i} icon={a.icon} title={a.title} desc={a.desc} color={a.color} />
          ))}
        </div>
      )}

      {/* ── KPI PRINCIPAUX ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total flotte",        value: loading ? "—" : drivers.length,               sub: "prestataires enregistrés",               icon: Users,      color: "bg-gradient-to-br from-violet-500 to-purple-700" },
          { label: "Actifs cette semaine",value: loading ? "—" : actifs.length,                sub: drivers.length > 0 ? `${Math.round(actifs.length / drivers.length * 100)}% de la flotte` : "—", icon: CheckCircle, color: "bg-gradient-to-br from-emerald-400 to-emerald-600" },
          { label: "À risque",            value: loading ? "—" : risque.length,                sub: "actifs ce mois, absents cette semaine",   icon: AlertTriangle, color: "bg-gradient-to-br from-amber-400 to-orange-500" },
          { label: "Commission totale",   value: loading ? "—" : `${fmt(Math.round(commTotal))} F`, sub: `Ce mois : ${fmt(Math.round(commMois))} F`, icon: TrendingUp,  color: "bg-gradient-to-br from-indigo-400 to-blue-600" },
        ].map((k, i) => (
          <div key={i} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden">
            <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.color}`} />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{k.value}</p>
                {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
              </div>
              <div className={`w-10 h-10 rounded-xl ${k.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                <k.icon size={18} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── SANTÉ + ACTIVITÉ + TOP PERFORMERS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Score de santé */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 flex flex-col items-center gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Score de santé flotte</p>
          {loading
            ? <div className="w-28 h-28 rounded-full border-8 border-white/10 animate-pulse" />
            : <HealthRing score={healthScore} />
          }
          <div className="w-full space-y-2">
            {[
              { label: "Actifs",   count: actifs.length,   pct: drivers.length > 0 ? actifs.length / drivers.length * 100 : 0,   color: "bg-emerald-500" },
              { label: "À risque", count: risque.length,   pct: drivers.length > 0 ? risque.length / drivers.length * 100 : 0,   color: "bg-amber-400" },
              { label: "Inactifs", count: inactifs.length, pct: drivers.length > 0 ? inactifs.length / drivers.length * 100 : 0, color: "bg-red-500" },
            ].map(row => (
              <div key={row.label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{row.count} ({Math.round(row.pct)}%)</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs activité */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Indicateurs clés</p>
          {[
            { label: "Courses cette semaine",   value: loading ? "—" : coursesWeekTotal,                              icon: Activity,    color: "text-emerald-500" },
            { label: "Courses ce mois",         value: loading ? "—" : coursesMoisTotal,                              icon: Target,      color: "text-indigo-500"  },
            { label: "CA généré (total)",        value: loading ? "—" : `${fmt(Math.round(revTotal))} F`,              icon: BarChart2,   color: "text-sky-500"     },
            { label: "Commission Boyah (2,5%)", value: loading ? "—" : `${fmt(Math.round(commTotal))} F`,              icon: Zap,         color: "text-violet-500"  },
            { label: "CA moyen / actif",        value: loading ? "—" : `${fmt(Math.round(avgRevPerDriver))} F`,        icon: ArrowUpRight, color: "text-teal-500"   },
            { label: "Inactifs 30j+",           value: loading ? "—" : inactifs.length,                               icon: Clock,       color: "text-red-400"     },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <row.icon size={13} className={row.color} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Top 3 performers */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Award size={15} className="text-amber-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Top performers</p>
          </div>
          {loading
            ? <div className="animate-pulse space-y-3">{[0,1,2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-white/5 rounded-xl" />)}</div>
            : top3.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">Aucun chauffeur actif</p>
              : top3.map((d, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-gray-50 dark:bg-white/[0.03]"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-500 text-white" : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400"}`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{d.nom || "—"}</p>
                      <p className="text-xs text-gray-400">{d.coursesMois} courses · {fmt(Math.round(d.totalRevenue / Math.max(d.totalCourses, 1)))} F/course</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(d.totalRevenue)} F</p>
                      <p className="text-[10px] text-violet-500">{fmt(d.commission)} F</p>
                    </div>
                  </div>
                ))
          }
          {!loading && actifs.length > 3 && (
            <p className="text-xs text-gray-400 text-center">+{actifs.length - 3} autres actifs → voir tableau</p>
          )}
        </div>
      </div>

      {/* ── TABLEAU DRIVERS ── */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-[#1E2D45] overflow-x-auto">
          {[
            { key: "global",  label: "Tous",      count: drivers.length },
            { key: "actif",   label: "Actifs",    count: actifs.length  },
            { key: "risque",  label: "À risque",  count: risque.length  },
            { key: "inactif", label: "Inactifs",  count: inactifs.length},
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                tab === t.key
                  ? "border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {t.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-violet-500/15 text-violet-500" : "bg-gray-100 dark:bg-white/5 text-gray-400"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm">Analyse en cours…</span>
            </div>
          </div>
        ) : displayedDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users size={32} className="opacity-20 mb-2" />
            <p className="text-sm">Aucun prestataire dans cette catégorie</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white dark:bg-[#0D1424] z-10 border-b border-gray-100 dark:border-[#1E2D45]">
                <tr>
                  {["Prestataire", "Statut", "7 jours", "30 jours", "CA total", "Commission", "Moy/course", "Dernière activité", "Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {displayedDrivers.map((ds, i) => {
                  const cfg = statusCfg(ds.status)
                  const tel = ds.telephone || ""
                  const avgPerCourse = ds.totalCourses > 0 ? Math.round(ds.totalRevenue / ds.totalCourses) : 0
                  const trend = ds.coursesMois > 0
                    ? ds.coursesWeek / ds.coursesMois > 0.3 ? "up" : ds.coursesWeek === 0 ? "down" : "flat"
                    : "down"
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{ds.nom || "—"}</p>
                          {tel && tel !== "N/A" && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={10} />{tel}</p>
                          )}
                          {ds.vehicle && <p className="text-xs text-gray-400 mt-0.5">{ds.vehicle}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border ${cfg.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{ds.coursesWeek}</span>
                          {trend === "up"   && <ArrowUpRight   size={12} className="text-emerald-500" />}
                          {trend === "down" && <ArrowDownRight size={12} className="text-red-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{ds.coursesMois}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{fmt(ds.totalRevenue)} F</td>
                      <td className="px-4 py-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{fmt(ds.commission)} F</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{avgPerCourse > 0 ? `${fmt(avgPerCourse)} F` : "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fdate(ds.lastActivity)}</td>
                      <td className="px-4 py-3">
                        {tel && tel !== "N/A" && (ds.status === "risque" || ds.status === "inactif")
                          ? <WhatsAppBtn phone={tel} name={ds.nom} type={ds.status} />
                          : <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ENGAGEMENT WHATSAPP ── */}
      {(risque.length > 0 || inactifs.length > 0) && !loading && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-green-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Contacts prioritaires</h2>
            <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
              {risque.length + inactifs.length} à contacter
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...risque, ...inactifs].filter(d => d.telephone && d.telephone !== "N/A").slice(0, 8).map((ds, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ds.nom || "—"}</p>
                  <p className="text-xs text-gray-400">{statusCfg(ds.status).label} · {ds.coursesMois} courses ce mois · dernière activité : {fdate(ds.lastActivity)}</p>
                </div>
                <WhatsAppBtn phone={ds.telephone} name={ds.nom} type={ds.status as "risque" | "inactif"} />
              </div>
            ))}
          </div>
          {risque.length + inactifs.length > 8 && (
            <p className="text-xs text-gray-400 text-center">+{risque.length + inactifs.length - 8} autres — voir l&apos;onglet correspondant dans le tableau</p>
          )}
        </div>
      )}

      {/* ── GÉNÉRATEUR DE POSTS ── */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Générateur de posts IA</h2>
          <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">Claude AI</span>
        </div>
        <div className="flex gap-2">
          {(["facebook", "instagram", "linkedin"] as const).map(p => {
            const Icon = platIcons[p]
            return (
              <button key={p} onClick={() => setPlatform(p)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                  platform === p ? "bg-violet-500/15 border-violet-500/40 text-violet-400" : "border-gray-200 dark:border-white/10 text-gray-400 hover:border-violet-500/30"
                }`}>
                <Icon size={14} />{p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            )
          })}
        </div>
        <button onClick={generatePost} disabled={genLoading || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50 text-white text-sm font-semibold transition shadow-md">
          {genLoading ? <><RefreshCw size={14} className="animate-spin" />Génération…</> : <><Sparkles size={14} />Générer post {platform}</>}
        </button>
        {generatedPost && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.07]">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{generatedPost}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { navigator.clipboard.writeText(generatedPost); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 text-gray-600 dark:text-gray-300 text-xs font-medium transition">
                {copied ? <><Check size={12} className="text-green-500" />Copié !</> : <><Copy size={12} />Copier</>}
              </button>
              <button onClick={generatePost} disabled={genLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-xs font-medium transition disabled:opacity-50">
                <RefreshCw size={12} />Regénérer
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
