"use client"

import { useEffect, useState } from "react"
import {
  Brain, Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Clock, MessageSquare, RefreshCw, BarChart3, Users, Zap, Target,
  ChevronRight, Phone, Send, Shield, Activity, Bot, CalendarClock,
  Workflow, ChevronDown, ChevronUp, ArrowUpRight, Star, FileDown, Filter,
} from "lucide-react"
import Link from "next/link"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts"
import { supabase } from "@/lib/supabaseClient"

type DriverInfo      = { id_chauffeur: number; nom: string; numero_wave: string | null }
type VehiculeDrivers = Record<string, DriverInfo[]>

type ScoreSante     = { global: number; financier: number; operationnel: number; croissance: number; commentaire: string }
type Recommandation = { titre: string; description: string; impact_estime: string; delai_mise_en_oeuvre: string; priorite: "critique"|"haute"|"normale"; categorie: string }
type Alerte         = { titre: string; description: string; urgence: "critique"|"haute"|"normale"; action_immediate: string }
type Analysis = {
  resume_executif?: string
  score_sante?: ScoreSante
  analyse_financiere?: { bilan: string; points_forts: string[]; points_faibles: string[]; opportunites: string[] }
  benchmark_marche?: { marge_moyenne_secteur: string; positionnement: string; comparaison: string; sources_comparatives: string }
  performance_chauffeurs?: { analyse: string; dispersion_revenus: string; recommandations: string[] }
  recommandations?: Recommandation[]
  alertes?: Alerte[]
  plan_action_30j?: string[]
  parse_error?: boolean
}
type RetardVehicule = { id_vehicule?: number; immatriculation: string; chauffeur: string; telephone: string|null; ca_mensuel: number; statut: string }
type ApiResult = {
  ok: boolean; analysis: Analysis; retardVehicules: RetardVehicule[]
  isAfterNoon: boolean; totalVehicules: number; generatedAt: string
  triggeredBy?: string; error?: string
}
type ChartData = {
  caJournalier: { date: string; ca: number }[]
  caMensuel: { mois: string; ca: number }[]
  depensesCat: { name: string; value: number; color: string }[]
  topChauffeurs: { nom: string; ca: number; pct: number }[]
  caTotal: number; depensesTotal: number; marge: number; profit: number
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => s >= 75 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400"
const scoreRing  = (s: number) => s >= 75 ? "stroke-emerald-500" : s >= 50 ? "stroke-amber-500" : "stroke-red-500"
const scoreBg    = (s: number) => s >= 75 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-red-500"
const fmt        = (v: number) => Number(v).toLocaleString("fr-FR")

const PIE_COLORS = ["#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e","#f97316","#eab308"]

const urgenceCfg = (u: string) => ({
  "critique": { bg:"bg-red-500/10 border-red-500/30",    text:"text-red-400",   dot:"bg-red-500",   badge:"bg-red-500/20 text-red-400",    label:"Critique" },
  "haute":    { bg:"bg-amber-500/10 border-amber-500/30", text:"text-amber-400", dot:"bg-amber-500", badge:"bg-amber-500/20 text-amber-400", label:"Haute"    },
}[u] ?? {    bg:"bg-blue-500/10 border-blue-500/30",    text:"text-blue-400",  dot:"bg-blue-500",  badge:"bg-blue-500/20 text-blue-400",  label:"Normale"  })

const prioriteCfg = (p: string) => ({
  "critique": { bg:"bg-red-500/10",    text:"text-red-400",    label:"Critique" },
  "haute":    { bg:"bg-amber-500/10",  text:"text-amber-400",  label:"Haute"    },
}[p] ?? {    bg:"bg-indigo-500/10", text:"text-indigo-400", label:"Normale"  })

function catIcon(cat: string) {
  if (cat === "revenus")    return TrendingUp
  if (cat === "couts")      return TrendingDown
  if (cat === "operations") return Activity
  return Users
}

// ─── COMPOSANTS ───────────────────────────────────────────────────────────────
function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r    = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={6} className="stroke-white/10" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={6}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            className={`transition-all duration-1000 ${scoreRing(score)}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${size >= 100 ? "text-3xl" : "text-lg"} ${scoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider text-center">{label}</span>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-bold ${scoreColor(value)}`}>{value}/100</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${scoreBg(value)}`}
          style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function KpiMini({ title, value, sub, gradient, up }: {
  title: string; value: string; sub?: string; gradient: string; up?: boolean | null
}) {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 shadow-sm relative overflow-hidden">
      <div className={`absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-10 blur-xl ${gradient}`} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">{title}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight break-words">{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {up !== undefined && up !== null && (
            <ArrowUpRight size={10} className={up ? "text-emerald-500" : "text-red-500 rotate-90"} />
          )}
          <span className={`text-[10px] font-semibold ${up === true ? "text-emerald-500" : up === false ? "text-red-500" : "text-gray-400 dark:text-gray-600"}`}>{sub}</span>
        </div>
      )}
    </div>
  )
}

function AnalysisBadge({ triggeredBy, generatedAt }: { triggeredBy?: string; generatedAt?: string }) {
  if (!generatedAt) return null
  const isAuto  = triggeredBy === "auto"
  const dateStr = new Date(generatedAt).toLocaleString("fr-FR")
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-semibold
      ${isAuto
        ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
        : "bg-sky-500/10 border-sky-500/20 text-sky-400"
      }`}>
      {isAuto ? <CalendarClock size={10} /> : <Bot size={10} />}
      {isAuto ? `Auto — ${dateStr}` : `Manuel — ${dateStr}`}
    </div>
  )
}

// Custom Recharts tooltips
const CaTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A2A45] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white">{fmt(payload[0].value)} <span className="text-xs font-normal text-gray-400">FCFA</span></p>
    </div>
  )
}

const DepTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A2A45] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-400 mb-0.5">{payload[0].name}</p>
      <p className="text-sm font-bold text-white">{fmt(payload[0].value)} <span className="text-xs font-normal text-gray-400">FCFA</span></p>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function AiInsightsBoyahGroup() {
  const [result,        setResult]        = useState<ApiResult | null>(null)
  const [triggering,    setTriggering]    = useState(false)
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [activeTab,     setActiveTab]     = useState<"analyse"|"recommandations"|"plan">("analyse")
  const [vehiculeDrivers, setVehiculeDrivers] = useState<VehiculeDrivers>({})
  const [expandedMsg,   setExpandedMsg]   = useState<string | null>(null)
  const [liveRetard,    setLiveRetard]    = useState<RetardVehicule[]>([])
  const [liveTotalVeh,  setLiveTotalVeh]  = useState(0)
  const [chartData,     setChartData]     = useState<ChartData | null>(null)
  const [expandedResume,  setExpandedResume]  = useState(false)
  const [expandedReco,    setExpandedReco]    = useState<number | null>(null)
  // Filtres
  const [recoFilter,      setRecoFilter]      = useState<"all"|"critique"|"haute"|"normale">("all")
  const [alerteFilter,    setAlerteFilter]    = useState<"all"|"critique"|"haute"|"normale">("all")
  const [exportingPdf,    setExportingPdf]    = useState(false)

  // ── Retards paiement live ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0]
      const [{ data: vehicules }, { data: recettes }] = await Promise.all([
        supabase.from("vehicules").select("id_vehicule, immatriculation"),
        supabase.from("recettes_wave").select("Horodatage"),
      ])
      if (!vehicules) return
      const recettesCount = recettes?.filter(r => r.Horodatage?.startsWith(today)).length || 0
      const nonPayes      = Math.max(0, vehicules.length - recettesCount)
      const enRetard      = vehicules
        .slice(vehicules.length - nonPayes)
        .map(v => ({ id_vehicule: v.id_vehicule, immatriculation: v.immatriculation, chauffeur: "—", telephone: null, ca_mensuel: 0, statut: "" }))
      setLiveRetard(enRetard)
      setLiveTotalVeh(vehicules.length)
    }
    load()
  }, [])

  // ── Données graphiques depuis Supabase ──────────────────────────
  useEffect(() => {
    const loadCharts = async () => {
      const [caJRes, caMRes, depRes, topRes] = await Promise.all([
        supabase.from("vue_ca_journalier").select("date, chiffre_affaire").order("date", { ascending: true }).limit(7),
        supabase.from("vue_ca_mensuel").select("mois, annee, chiffre_affaire").order("annee", { ascending: false }).order("mois", { ascending: false }).limit(6),
        supabase.from("vue_depenses_categories").select("categorie, total_depenses"),
        supabase.from("classement_chauffeurs").select("nom, ca").order("ca", { ascending: false }).limit(5),
      ])
      const caJournalier = (caJRes.data || []).map(d => ({
        date: new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        ca: Number(d.chiffre_affaire || 0)
      }))
      const caMensuel = [...(caMRes.data || [])].reverse().map(d => ({
        mois: `${String(d.mois).padStart(2,"0")}/${String(d.annee).slice(2)}`,
        ca: Number(d.chiffre_affaire || 0)
      }))
      const depensesCat = (depRes.data || []).map((d, i) => ({
        name: d.categorie || "Autre",
        value: Number(d.total_depenses || 0),
        color: PIE_COLORS[i % PIE_COLORS.length]
      }))
      const maxCa = Math.max(...(topRes.data || []).map(d => Number(d.ca || 0)), 1)
      const topChauffeurs = (topRes.data || []).map(d => ({
        nom: d.nom || "—",
        ca: Number(d.ca || 0),
        pct: Math.round(Number(d.ca || 0) / maxCa * 100)
      }))
      const caTotal       = caMensuel.at(-1)?.ca || 0
      const depensesTotal = depensesCat.reduce((s, d) => s + d.value, 0)
      const marge         = caTotal > 0 ? Math.round((caTotal - depensesTotal) / caTotal * 100) : 0
      setChartData({ caJournalier, caMensuel, depensesCat, topChauffeurs, caTotal, depensesTotal, marge, profit: caTotal - depensesTotal })
    }
    loadCharts()
  }, [])

  // ── Dernier rapport en base ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/ai-insights/latest")
      .then(r => r.json())
      .then((d) => { if (d.ok && d.analysis) setResult(d as ApiResult) })
      .catch(() => {})
      .finally(() => setLoadingLatest(false))
  }, [])

  // ── Chauffeurs affectés aux véhicules en retard ──────────────────
  useEffect(() => {
    if (liveRetard.length === 0) return
    ;(async () => {
      const { data: vData } = await supabase
        .from("vehicules").select("id_vehicule, immatriculation")
        .in("immatriculation", liveRetard.map(v => v.immatriculation))
      if (!vData?.length) return
      const idMap: Record<number, string> = {}
      vData.forEach(v => { idMap[v.id_vehicule] = v.immatriculation })
      const { data: affData } = await supabase
        .from("affectation_chauffeurs_vehicules").select("id_vehicule, id_chauffeur")
        .in("id_vehicule", vData.map(v => v.id_vehicule)).is("date_fin", null)
      if (!affData?.length) return
      const chauffeurIds = [...new Set(affData.map(a => a.id_chauffeur))]
      const { data: cData } = await supabase
        .from("chauffeurs").select("id_chauffeur, nom, numero_wave")
        .in("id_chauffeur", chauffeurIds)
      if (!cData?.length) return
      const cMap: Record<number, DriverInfo> = {}
      cData.forEach(c => { cMap[c.id_chauffeur] = c })
      const map: VehiculeDrivers = {}
      affData.forEach(a => {
        const immat = idMap[a.id_vehicule]
        const driver = cMap[a.id_chauffeur]
        if (!immat || !driver) return
        if (!map[immat]) map[immat] = []
        map[immat].push(driver)
      })
      setVehiculeDrivers(map)
    })()
  }, [liveRetard])

  // ── Déclenchement manuel ─────────────────────────────────────────
  const triggerAnalysis = async () => {
    setTriggering(true)
    try {
      const res  = await fetch("/api/ai-insights/trigger", { method: "POST" })
      const data = await res.json() as ApiResult
      if (data.ok) setResult({ ...data, triggeredBy: "manual" })
      else setResult({ ok: false, analysis: {}, retardVehicules: [], isAfterNoon: false, totalVehicules: 0, generatedAt: "", error: data.error })
    } catch {
      setResult(prev => ({ ...prev!, ok: false, error: "Erreur réseau ou n8n inaccessible" }))
    } finally { setTriggering(false) }
  }

  const analysis    = result?.analysis
  const retard      = liveRetard
  const totalVeh    = liveTotalVeh || result?.totalVehicules || 0
  const hasAnalysis = !!analysis?.resume_executif

  const resumeText = (() => {
    let text = analysis?.resume_executif || ""
    if (!text) return ""
    const trimmed = text.trim()
    if (trimmed.startsWith("```") || trimmed.startsWith("{")) {
      try {
        const cleaned = trimmed
          .replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim()
        const parsed = JSON.parse(cleaned)
        if (typeof parsed.resume_executif === "string") text = parsed.resume_executif
      } catch {
        // regex fallback — extrait la valeur du champ resume_executif même si le JSON est invalide
        const m = text.match(/"resume_executif"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        if (m) text = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
      }
    }
    return text.trim()
  })()

  return (
    <div className="space-y-6 animate-in">

      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Brain size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Insights Boyah Group</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 ml-11">Piloté par n8n • Analyse IA quotidienne • Alertes WhatsApp automatiques</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date génération prominente */}
          {result?.generatedAt && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] text-gray-600 dark:text-gray-400">
              <CalendarClock size={12} />
              {new Date(result.generatedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400">
            <Workflow size={12} />n8n
          </div>
          {hasAnalysis && (
            <button
              onClick={async () => {
                setExportingPdf(true)
                const { exportInsightsPdf } = await import("@/lib/exportPdf")
                await exportInsightsPdf({
                  score:          analysis?.score_sante?.global ?? 0,
                  generatedAt:    result?.generatedAt ?? "",
                  resumeExecutif: result?.analysis?.resume_executif ?? "",
                  recommandations: analysis?.recommandations ?? [],
                  alertes:        analysis?.alertes ?? [],
                  plan30j:        analysis?.plan_action_30j ?? [],
                  retardVehicules: retard,
                  caTotal:        chartData?.caTotal ?? 0,
                  depensesTotal:  chartData?.depensesTotal ?? 0,
                })
                setExportingPdf(false)
              }}
              disabled={exportingPdf}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition disabled:opacity-50">
              {exportingPdf
                ? <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                : <FileDown size={13} />
              }
              PDF
            </button>
          )}
          <button onClick={triggerAnalysis} disabled={triggering}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {triggering
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />n8n traite...</>
              : <><Sparkles size={15} />{hasAnalysis ? "Relancer via n8n" : "Lancer l'analyse IA"}</>}
          </button>
        </div>
      </div>

      {/* ── BANNER SETUP ──────────────────────────────────────────── */}
      {!loadingLatest && !result && (
        <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <Workflow size={16} className="text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">Configuration n8n requise</p>
            <p className="text-xs text-violet-600 dark:text-violet-500 mt-0.5">
              Importez les workflows depuis <code className="bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded text-[10px]">n8n-workflows/</code>,
              créez la table via <code className="bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded text-[10px]">supabase/migration-ai-insights.sql</code>,
              puis ajoutez <code className="bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded text-[10px]">N8N_WEBHOOK_ANALYSE_URL</code> dans .env.local
            </p>
          </div>
        </div>
      )}

      {/* ── ALERTES PAIEMENTS ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center">
              <AlertTriangle size={13} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Alertes paiements — Aujourd'hui</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-600">Versements Wave dus avant 12h00 • n8n envoie WhatsApp automatiquement à 12h01</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result?.isAfterNoon && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-500/20">
                <Clock size={11} />Passé 12h00
              </span>
            )}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border
              ${retard.length === 0
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
              }`}>
              {retard.length === 0 ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
              {retard.length} en retard / {totalVeh || "—"} véhicules
            </span>
          </div>
        </div>

        {loadingLatest && (
          <div className="flex items-center justify-center py-10 gap-3 text-gray-400 dark:text-gray-600">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />Chargement...
          </div>
        )}

        {!loadingLatest && retard.length === 0 && (
          <div className="flex items-center gap-3 px-5 py-8 text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={20} />
            <div>
              <p className="font-semibold text-sm">Tous les véhicules sont à jour</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Aucun retard de paiement enregistré aujourd'hui</p>
            </div>
          </div>
        )}

        {retard.length > 0 && (
          <>
            <div className="divide-y divide-gray-50 dark:divide-[#1A2235]">
              {retard.map((v, i) => {
                const drivers    = vehiculeDrivers[v.immatriculation] || []
                const msgText    = `Bonjour, votre versement Wave du jour pour le véhicule ${v.immatriculation} n'a pas encore été reçu. Merci de régulariser maintenant. — Boyah Group`
                const isExpanded = expandedMsg === v.immatriculation
                return (
                  <div key={i} className="px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{v.immatriculation?.[0] || "?"}</span>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        {v.id_vehicule
                          ? <Link href={`/vehicules/${v.id_vehicule}`}
                              className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition">
                              {v.immatriculation}
                            </Link>
                          : <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-lg">{v.immatriculation}</span>
                        }
                        <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">Non payé</span>
                      </div>
                      <button onClick={() => setExpandedMsg(isExpanded ? null : v.immatriculation)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                        Message {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </div>
                    {drivers.length > 0 && (
                      <div className="mt-2 ml-11 flex flex-col gap-1.5">
                        {drivers.map((d, j) => (
                          <div key={j} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{d.nom}</span>
                            {d.numero_wave && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                <Phone size={9} />{d.numero_wave}
                              </span>
                            )}
                            <a href={`https://wa.me/${d.numero_wave?.replace(/\D/g,"")}?text=${encodeURIComponent(`Bonjour ${d.nom}, ${msgText}`)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition">
                              <MessageSquare size={9} />WhatsApp
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && (
                      <div className="mt-2 ml-11 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{msgText}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-[#1E2D45] bg-gray-50/50 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                n8n envoie automatiquement les WhatsApp à 12h01 •
                <span className="ml-1 text-emerald-600 dark:text-emerald-400">ou envoi manuel ci-dessous</span>
              </p>
              <button onClick={() => {
                let delay = 0
                retard.forEach(v => {
                  const drivers = vehiculeDrivers[v.immatriculation] || []
                  const targets = drivers.length > 0 ? drivers : [{ nom: v.chauffeur, numero_wave: v.telephone }]
                  targets.forEach(d => {
                    setTimeout(() => {
                      const msg   = encodeURIComponent(`Bonjour ${d.nom}, votre versement Wave du jour pour le véhicule ${v.immatriculation} n'a pas encore été reçu. Merci de régulariser. — Boyah Group`)
                      const phone = d.numero_wave?.replace(/\D/g, "")
                      window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank")
                    }, delay)
                    delay += 300
                  })
                })
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all">
                <Send size={11} />Alerter tous manuellement ({retard.length})
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── LOADER ────────────────────────────────────────────────── */}
      {triggering && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-12 flex flex-col items-center gap-4 shadow-sm">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <Brain size={22} className="absolute inset-0 m-auto text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">n8n traite l'analyse</p>
            <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">Collecte données • Appel Claude • Sauvegarde en base...</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          RÉSULTATS PREMIUM
      ═══════════════════════════════════════════════════════════════ */}
      {!triggering && hasAnalysis && analysis && (
        <>

          {/* ── KPI ROW ──────────────────────────────────────────── */}
          {chartData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiMini title="CA du mois"   value={`${fmt(chartData.caTotal)} FCFA`}       gradient="bg-emerald-500" />
              <KpiMini title="Dépenses"     value={`${fmt(chartData.depensesTotal)} FCFA`}  gradient="bg-red-500" />
              <KpiMini title="Marge nette"  value={`${chartData.marge} %`}
                sub={chartData.marge >= 30 ? "Bonne marge" : chartData.marge >= 15 ? "Marge correcte" : "Marge faible"}
                up={chartData.marge >= 30 ? true : chartData.marge >= 15 ? null : false}
                gradient="bg-violet-500" />
              <KpiMini title="Profit net"   value={`${fmt(chartData.profit)} FCFA`}
                sub={chartData.profit > 0 ? "Bénéficiaire" : "Déficitaire"}
                up={chartData.profit > 0}
                gradient="bg-indigo-500" />
            </div>
          )}

          {/* ── SCORE + RÉSUMÉ ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Score card dark premium */}
            {analysis.score_sante && (
              <div className="bg-gradient-to-br from-[#0D1424] via-[#111D35] to-[#1A2A45] rounded-2xl border border-[#1E2D45] p-5 shadow-lg relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
                <div className="flex items-center gap-2 mb-5 relative">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Shield size={12} className="text-indigo-400" />
                  </div>
                  <h2 className="text-sm font-bold text-white">Score de Santé</h2>
                </div>
                <div className="flex justify-center mb-5 relative">
                  <ScoreRing score={analysis.score_sante.global} label="Score Global" size={120} />
                </div>
                <div className="space-y-3 relative">
                  <ScoreBar label="Financier"  value={analysis.score_sante.financier} />
                  <ScoreBar label="Opérations" value={analysis.score_sante.operationnel} />
                  <ScoreBar label="Croissance" value={analysis.score_sante.croissance} />
                </div>
                {analysis.score_sante.commentaire && (
                  <p className="text-[11px] text-gray-400 mt-4 leading-relaxed border-t border-white/5 pt-4 relative">
                    {analysis.score_sante.commentaire}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-white/5 relative">
                  <AnalysisBadge triggeredBy={result?.triggeredBy} generatedAt={result?.generatedAt} />
                </div>
              </div>
            )}

            {/* Résumé exécutif */}
            <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden shadow-sm flex flex-col">
              <div className="px-5 py-3.5 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent border-b border-gray-100 dark:border-[#1E2D45] flex items-center gap-2">
                <Zap size={13} className="text-violet-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Résumé Exécutif</h2>
              </div>
              <div className="p-5 flex-1 space-y-3">
                {resumeText && (() => {
                  const sentences = resumeText.split(/(?<=\.)\s+/).filter(Boolean)
                  const preview   = sentences.slice(0, 2).join(" ")
                  const rest      = sentences.slice(2).join(" ")
                  return (
                    <>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{preview}</p>
                      {rest && (
                        <>
                          {expandedResume && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{rest}</p>
                          )}
                          <button onClick={() => setExpandedResume(v => !v)}
                            className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-400 transition">
                            {expandedResume ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expandedResume ? "Réduire" : "Lire la suite"}
                          </button>
                        </>
                      )}
                    </>
                  )
                })()}
                {analysis.benchmark_marche && (
                  <div className={`flex items-start gap-3 p-3.5 rounded-xl border mt-2
                    ${analysis.benchmark_marche.positionnement === "leader"
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                      : analysis.benchmark_marche.positionnement === "en_dessous"
                      ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                      : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                    }`}>
                    <BarChart3 size={15} className={`flex-shrink-0 mt-0.5
                      ${analysis.benchmark_marche.positionnement === "leader"     ? "text-emerald-500" :
                        analysis.benchmark_marche.positionnement === "en_dessous" ? "text-red-500" : "text-amber-500"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-0.5">
                        Benchmark : {
                          analysis.benchmark_marche.positionnement === "leader"     ? "Leader du marché VTC AO" :
                          analysis.benchmark_marche.positionnement === "en_dessous" ? "En dessous de la moyenne" :
                          "Dans la moyenne du marché"
                        }
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{analysis.benchmark_marche.comparaison}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 italic">{analysis.benchmark_marche.sources_comparatives}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── CHARTS ROW 1 — CA 7j + Top Chauffeurs ────────────── */}
          {chartData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CA 7 jours — area chart */}
              <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={13} className="text-emerald-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Chiffre d'affaires — 7 derniers jours</h3>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5">FCFA</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData.caJournalier} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CaTooltip />} />
                    <Area type="monotone" dataKey="ca" stroke="#10b981" strokeWidth={2.5}
                      fill="url(#caGrad)" dot={{ fill: "#10b981", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top 5 Chauffeurs */}
              <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={13} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top 5 Chauffeurs</h3>
                </div>
                <div className="space-y-3.5">
                  {chartData.topChauffeurs.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-bold w-5 text-center flex-shrink-0
                            ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-500 dark:text-gray-600"}`}>
                            #{i+1}
                          </span>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{c.nom}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white flex-shrink-0 ml-2">{fmt(c.ca)}</span>
                      </div>
                      <div className="h-1 bg-gray-100 dark:bg-white/5 rounded-full ml-7 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000
                          ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : "bg-indigo-400/70"}`}
                          style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {!chartData.topChauffeurs.length && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">Aucune donnée</p>
                  )}
                </div>
                {analysis.performance_chauffeurs?.dispersion_revenus && (() => {
                  const t = analysis.performance_chauffeurs!.dispersion_revenus
                  const short = t.length > 100 ? t.slice(0, 100).trimEnd() + "…" : t
                  return (
                    <p className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400 dark:text-gray-600 leading-relaxed" title={t}>
                      {short}
                    </p>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── CHARTS ROW 2 — CA mensuel + Dépenses ─────────────── */}
          {chartData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CA mensuel 6 mois */}
              <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={13} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">CA Mensuel — 6 mois</h3>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5">FCFA</span>
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={chartData.caMensuel} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CaTooltip />} />
                    <Bar dataKey="ca" radius={[4,4,0,0]} maxBarSize={36}>
                      {chartData.caMensuel.map((_, idx) => (
                        <Cell key={idx}
                          fill={idx === chartData.caMensuel.length - 1 ? "#8b5cf6" : "#6366f1"}
                          opacity={idx === chartData.caMensuel.length - 1 ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Dépenses par catégorie */}
              <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown size={13} className="text-red-500" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dépenses par catégorie</h3>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex-shrink-0">
                    <ResponsiveContainer width={130} height={130}>
                      <PieChart>
                        <Pie data={chartData.depensesCat} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={2}>
                          {chartData.depensesCat.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<DepTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {chartData.depensesCat.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate flex-1">{d.name}</span>
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">{fmt(d.value)}</span>
                      </div>
                    ))}
                    {!chartData.depensesCat.length && (
                      <p className="text-xs text-gray-400 dark:text-gray-600">Aucune donnée</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ALERTES CLAUDE ────────────────────────────────────── */}
          {(analysis.alertes || []).length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle size={13} className="text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Alertes détectées par Claude</h3>
                <span className="text-xs text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full font-semibold">
                  {(analysis.alertes || []).length}
                </span>
                {/* Filtres urgence */}
                <div className="ml-auto flex items-center gap-1 bg-gray-100 dark:bg-[#0D1424] rounded-lg p-0.5">
                  {(["all","critique","haute","normale"] as const).map(f => (
                    <button key={f} onClick={() => setAlerteFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
                        alerteFilter === f
                          ? "bg-white dark:bg-[#1A2A45] text-amber-600 dark:text-amber-400 shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}>
                      {f === "all" ? "Tout" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(analysis.alertes || []).filter(a => alerteFilter === "all" || a.urgence === alerteFilter).map((a, i) => {
                  const cfg = urgenceCfg(a.urgence)
                  return (
                    <div key={i} className={`rounded-2xl border p-4 ${cfg.bg}`}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                        <span className={`text-xs font-bold truncate ${cfg.text}`}>{a.titre}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2.5 line-clamp-3">{a.description}</p>
                      <div className={`flex items-start gap-1.5 text-xs font-semibold ${cfg.text}`}>
                        <ChevronRight size={12} className="mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{a.action_immediate}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TABS ──────────────────────────────────────────────── */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#0D1424] rounded-xl border border-gray-200 dark:border-[#1E2D45] w-fit overflow-x-auto">
            {(["analyse","recommandations","plan"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                  ${activeTab === tab
                    ? "bg-white dark:bg-[#1A2A45] text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"}`}>
                {tab === "analyse" ? "Analyse détaillée" : tab === "recommandations" ? "Recommandations" : "Plan 30 jours"}
              </button>
            ))}
          </div>

          {/* Tab Analyse */}
          {activeTab === "analyse" && (
            <div className="space-y-4">
              {analysis.analyse_financiere && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title:"Points forts",   items: analysis.analyse_financiere.points_forts,   icon: CheckCircle, color:"text-emerald-500", ring:"bg-emerald-500/10", dot:"bg-emerald-500", border:"border-emerald-100 dark:border-emerald-500/10" },
                    { title:"Points faibles", items: analysis.analyse_financiere.points_faibles,  icon: TrendingDown,color:"text-red-500",     ring:"bg-red-500/10",     dot:"bg-red-500",     border:"border-red-100 dark:border-red-500/10"         },
                    { title:"Opportunités",   items: analysis.analyse_financiere.opportunites,    icon: Target,      color:"text-indigo-500",  ring:"bg-indigo-500/10",  dot:"bg-indigo-500",  border:"border-indigo-100 dark:border-indigo-500/10"   },
                  ].map(({ title, items, icon: Icon, color, ring, dot, border }) => (
                    <div key={title} className={`bg-white dark:bg-[#0D1424] rounded-2xl border ${border} p-5 shadow-sm`}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-7 h-7 rounded-xl ${ring} flex items-center justify-center`}>
                          <Icon size={13} className={color} />
                        </div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">{title}</h3>
                        <span className="ml-auto text-[10px] font-bold text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full">{(items||[]).length}</span>
                      </div>
                      <ul className="space-y-2.5">
                        {(items || []).map((p, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0 mt-1.5`} />{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {analysis.performance_chauffeurs && (
                <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={13} className="text-sky-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Performance & RH Chauffeurs</h3>
                  </div>
                  <ul className="space-y-2">
                    {(analysis.performance_chauffeurs.recommandations || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <ChevronRight size={12} className="text-sky-400 mt-0.5 flex-shrink-0" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Tab Recommandations */}
          {activeTab === "recommandations" && (
            <div className="space-y-3">
              {/* Filtres priorité */}
              <div className="flex flex-wrap items-center gap-2">
                <Filter size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Priorité :</span>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#0D1424] rounded-lg p-0.5">
                  {(["all","critique","haute","normale"] as const).map(f => (
                    <button key={f} onClick={() => setRecoFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
                        recoFilter === f
                          ? "bg-white dark:bg-[#1A2A45] text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}>
                      {f === "all" ? "Tout" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-600 ml-1">
                  {(analysis.recommandations || []).filter(r => recoFilter === "all" || r.priorite === recoFilter).length} résultat{(analysis.recommandations || []).filter(r => recoFilter === "all" || r.priorite === recoFilter).length > 1 ? "s" : ""}
                </span>
              </div>
              {(analysis.recommandations || []).filter(r => recoFilter === "all" || r.priorite === recoFilter).map((r, i) => {
                const pCfg    = prioriteCfg(r.priorite)
                const Icon    = catIcon(r.categorie)
                const isOpen  = expandedReco === i
                const descMax = 120
                const short   = r.description?.length > descMax ? r.description.slice(0, descMax).trimEnd() + "…" : r.description
                return (
                  <div key={i} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${pCfg.bg} ${pCfg.text}`}>{pCfg.label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-600 capitalize px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5">{r.categorie}</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">{r.titre}</h3>
                        {/* Description tronquée */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
                          {isOpen ? r.description : short}
                        </p>
                        {r.description?.length > descMax && (
                          <button onClick={() => setExpandedReco(isOpen ? null : i)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition mb-2.5">
                            {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            {isOpen ? "Réduire" : "Voir le détail"}
                          </button>
                        )}
                        {/* Métriques clés */}
                        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-white/5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Impact</span>
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 max-w-[180px] truncate" title={r.impact_estime}>{r.impact_estime}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Délai</span>
                            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">{r.delai_mise_en_oeuvre}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!(analysis.recommandations?.length) && (
                <p className="text-sm text-gray-400 text-center py-8">Aucune recommandation générée</p>
              )}
            </div>
          )}

          {/* Tab Plan 30j */}
          {activeTab === "plan" && (
            <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <RefreshCw size={13} className="text-indigo-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Plan d'action sur 30 jours</h2>
              </div>
              <div className="relative space-y-0">
                <div className="absolute left-4 top-4 bottom-4 w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/20 to-transparent" />
                {(analysis.plan_action_30j || []).map((step, i) => (
                  <div key={i} className="flex items-start gap-4 pb-5 last:pb-0 relative">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm shadow-indigo-500/20 z-10">
                      {i + 1}
                    </div>
                    <div className="flex-1 bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 border border-gray-100 dark:border-white/5 mt-0.5">
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">{step}</p>
                    </div>
                  </div>
                ))}
                {!(analysis.plan_action_30j?.length) && (
                  <p className="text-sm text-gray-400 text-center py-6">Plan non disponible</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ERREUR ────────────────────────────────────────────────── */}
      {!triggering && result?.ok === false && result.error && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-red-200 dark:border-red-500/20 p-8 text-center shadow-sm">
          <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Erreur lors de l'analyse</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">{result.error}</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Vérifiez que N8N_WEBHOOK_ANALYSE_URL est configuré et que n8n est actif</p>
        </div>
      )}

    </div>
  )
}
