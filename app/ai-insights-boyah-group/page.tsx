"use client"

import { useEffect, useState } from "react"
import {
  Brain, Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Clock, MessageSquare, RefreshCw, BarChart3, Users, Zap, Target,
  ChevronRight, Phone, Send, Shield, Activity, Bot, CalendarClock,
  Workflow
} from "lucide-react"

// ─── TYPES ────────────────────────────────────────────────────────────────────
type ScoreSante      = { global: number; financier: number; operationnel: number; croissance: number; commentaire: string }
type Recommandation  = { titre: string; description: string; impact_estime: string; delai_mise_en_oeuvre: string; priorite: "critique"|"haute"|"normale"; categorie: string }
type Alerte          = { titre: string; description: string; urgence: "critique"|"haute"|"normale"; action_immediate: string }
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
type RetardVehicule = { immatriculation: string; chauffeur: string; telephone: string|null; ca_mensuel: number; statut: string }
type ApiResult = {
  ok: boolean
  analysis: Analysis
  retardVehicules: RetardVehicule[]
  isAfterNoon: boolean
  totalVehicules: number
  generatedAt: string
  triggeredBy?: string
  error?: string
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => s >= 75 ? "text-emerald-500" : s >= 50 ? "text-amber-500" : "text-red-500"
const scoreRing  = (s: number) => s >= 75 ? "stroke-emerald-500" : s >= 50 ? "stroke-amber-500" : "stroke-red-500"

const urgenceCfg = (u: string) => ({
  "critique": { bg: "bg-red-500/10 border-red-500/30",    text: "text-red-400",    dot: "bg-red-500",    label: "Critique" },
  "haute":    { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400",  dot: "bg-amber-500",  label: "Haute" },
}[u] ?? {    bg: "bg-blue-500/10 border-blue-500/30",    text: "text-blue-400",   dot: "bg-blue-500",   label: "Normale" })

const prioriteCfg = (p: string) => ({
  "critique": { bg: "bg-red-500/10",    text: "text-red-400",    label: "Critique" },
  "haute":    { bg: "bg-amber-500/10",  text: "text-amber-400",  label: "Haute" },
}[p] ?? {    bg: "bg-indigo-500/10", text: "text-indigo-400", label: "Normale" })

function catIcon(cat: string) {
  if (cat === "revenus") return TrendingUp
  if (cat === "couts")   return TrendingDown
  if (cat === "operations") return Activity
  return Users
}

// ─── COMPOSANTS ───────────────────────────────────────────────────────────────
function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = (size - 12) / 2
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
          <span className={`font-bold text-lg ${scoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider text-center">{label}</span>
    </div>
  )
}

function WhatsAppBtn({ v }: { v: RetardVehicule }) {
  const msg   = encodeURIComponent(`Bonjour ${v.chauffeur}, votre versement Wave du jour pour le véhicule ${v.immatriculation} n'a pas encore été reçu. Merci de régulariser maintenant. — Boyah Group`)
  const phone = v.telephone?.replace(/\D/g, "")
  return (
    <a href={phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`}
      target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm shadow-emerald-500/20">
      <MessageSquare size={12} />{phone ? "WhatsApp" : "Message"}
    </a>
  )
}

function AnalysisBadge({ triggeredBy, generatedAt }: { triggeredBy?: string; generatedAt?: string }) {
  if (!generatedAt) return null
  const isAuto  = triggeredBy === "auto"
  const dateStr = generatedAt ? new Date(generatedAt).toLocaleString("fr-FR") : ""
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold
      ${isAuto
        ? "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400"
        : "bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20 text-sky-700 dark:text-sky-400"
      }`}>
      {isAuto ? <CalendarClock size={12} /> : <Bot size={12} />}
      {isAuto ? `Auto 12h01 — ${dateStr}` : `Manuel — ${dateStr}`}
    </div>
  )
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export default function AiInsightsBoyahGroup() {
  const [result,    setResult]    = useState<ApiResult | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [activeTab, setActiveTab] = useState<"analyse"|"recommandations"|"plan">("analyse")

  // ── Charge le dernier résultat auto au montage ──────────────────
  useEffect(() => {
    fetch("/api/ai-insights/latest")
      .then(r => r.json())
      .then((d) => {
        if (d.ok && d.analysis) setResult(d as ApiResult)
      })
      .catch(() => {})
      .finally(() => setLoadingLatest(false))
  }, [])

  // ── Déclenche analyse manuelle via n8n webhook ──────────────────
  const triggerAnalysis = async () => {
    setTriggering(true)
    try {
      const res  = await fetch("/api/ai-insights/trigger", { method: "POST" })
      const data = await res.json() as ApiResult
      if (data.ok) setResult({ ...data, triggeredBy: "manual" })
      else setResult({ ok: false, analysis: {}, retardVehicules: result?.retardVehicules || [], isAfterNoon: false, totalVehicules: 0, generatedAt: "", error: data.error })
    } catch {
      setResult(prev => ({ ...prev!, ok: false, error: "Erreur réseau ou n8n inaccessible" }))
    } finally {
      setTriggering(false)
    }
  }

  const analysis    = result?.analysis
  const retard      = result?.retardVehicules || []
  const hasAnalysis = !!analysis?.resume_executif

  return (
    <div className="space-y-6 animate-in">

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Brain size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Insights Boyah Group</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 ml-11">
            Piloté par n8n • Analyse IA quotidienne • Alertes WhatsApp automatiques
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Badge mode n8n */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20
            text-violet-700 dark:text-violet-400">
            <Workflow size={12} />n8n
          </div>

          {/* Bouton analyse manuelle */}
          <button onClick={triggerAnalysis} disabled={triggering}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
              bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700
              shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {triggering
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />n8n traite...</>
              : <><Sparkles size={15} />{hasAnalysis ? "Relancer via n8n" : "Lancer l'analyse IA"}</>
            }
          </button>
        </div>
      </div>

      {/* ── BANNER N8N (si pas encore configuré) ─────────────────── */}
      {!loadingLatest && !result && (
        <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <Workflow size={16} className="text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">Configuration n8n requise</p>
            <p className="text-xs text-violet-600 dark:text-violet-500 mt-0.5">
              Importez les workflows depuis <code className="bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded text-[10px]">n8n-workflows/</code>,
              créez la table Supabase via <code className="bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded text-[10px]">supabase/migration-ai-insights.sql</code>,
              puis ajoutez <code className="bg-violet-100 dark:bg-violet-500/20 px-1.5 py-0.5 rounded text-[10px]">N8N_WEBHOOK_ANALYSE_URL</code> dans .env.local
            </p>
          </div>
        </div>
      )}

      {/* ── ALERTES PAIEMENTS ────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center">
              <AlertTriangle size={13} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Alertes paiements — Aujourd'hui</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-600">
                Versements Wave dus avant 12h00 • n8n envoie WhatsApp automatiquement à 12h01
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result?.isAfterNoon && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-500/20">
                <Clock size={11} />Passé 12h00
              </span>
            )}
            {result && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border
                ${retard.length === 0
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                  : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                }`}>
                {retard.length === 0 ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                {retard.length} en retard / {result.totalVehicules || "—"} véhicules
              </span>
            )}
          </div>
        </div>

        {loadingLatest && (
          <div className="flex items-center justify-center py-10 gap-3 text-gray-400 dark:text-gray-600">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        )}

        {!loadingLatest && result && retard.length === 0 && (
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
              {retard.map((v, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">{v.chauffeur?.[0]?.toUpperCase() || "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-lg">{v.immatriculation}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{v.chauffeur}</span>
                    </div>
                    {v.telephone && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                        <Phone size={9} />{v.telephone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">Non payé</span>
                    <WhatsAppBtn v={v} />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-[#1E2D45] bg-gray-50/50 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                n8n envoie automatiquement les WhatsApp à 12h01 •
                <span className="ml-1 text-emerald-600 dark:text-emerald-400">ou envoi manuel ci-dessous</span>
              </p>
              <button onClick={() => {
                retard.forEach((v, i) => setTimeout(() => {
                  const msg   = encodeURIComponent(`Bonjour ${v.chauffeur}, votre versement Wave du jour pour le véhicule ${v.immatriculation} n'a pas encore été reçu. Merci de régulariser. — Boyah Group`)
                  const phone = v.telephone?.replace(/\D/g, "")
                  window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank")
                }, i * 300))
              }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all">
                <Send size={11} />Alerter tous manuellement ({retard.length})
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── LOADER ANALYSE ───────────────────────────────────────── */}
      {triggering && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-12 flex flex-col items-center gap-4 shadow-sm">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <Brain size={22} className="absolute inset-0 m-auto text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">n8n traite l'analyse</p>
            <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">
              Collecte données • Appel Claude • Sauvegarde en base...
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTATS ────────────────────────────────────────────── */}
      {!triggering && hasAnalysis && analysis && (
        <>
          {/* Résumé + scores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Zap size={15} className="text-violet-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Résumé exécutif</h2>
                <div className="ml-auto">
                  <AnalysisBadge triggeredBy={result?.triggeredBy} generatedAt={result?.generatedAt} />
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.resume_executif}</p>

              {analysis.benchmark_marche && (
                <div className={`mt-4 flex items-center gap-3 p-3 rounded-xl border
                  ${analysis.benchmark_marche.positionnement === "leader"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                    : analysis.benchmark_marche.positionnement === "en_dessous"
                    ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                    : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                  }`}>
                  <BarChart3 size={16} className={
                    analysis.benchmark_marche.positionnement === "leader"    ? "text-emerald-500" :
                    analysis.benchmark_marche.positionnement === "en_dessous"? "text-red-500" : "text-amber-500"
                  } />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Positionnement : {
                        analysis.benchmark_marche.positionnement === "leader"     ? "Leader du marché" :
                        analysis.benchmark_marche.positionnement === "en_dessous" ? "En dessous de la moyenne" :
                        "Dans la moyenne du marché"
                      }
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Marge secteur VTC AO : {analysis.benchmark_marche.marge_moyenne_secteur}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {analysis.score_sante && (
              <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={15} className="text-indigo-500" />
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Score de santé</h2>
                </div>
                <div className="flex justify-center mb-4">
                  <ScoreRing score={analysis.score_sante.global} label="Global" size={96} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ScoreRing score={analysis.score_sante.financier}    label="Finance"    size={64} />
                  <ScoreRing score={analysis.score_sante.operationnel} label="Opérations" size={64} />
                  <ScoreRing score={analysis.score_sante.croissance}   label="Croissance" size={64} />
                </div>
                {analysis.score_sante.commentaire && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-3 text-center leading-relaxed">
                    {analysis.score_sante.commentaire}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#0D1424] rounded-xl border border-gray-200 dark:border-[#1E2D45] w-fit overflow-x-auto">
            {(["analyse", "recommandations", "plan"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                  ${activeTab === tab
                    ? "bg-white dark:bg-[#1A2A45] text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                  }`}>
                {tab === "analyse" ? "Analyse & Benchmark" : tab === "recommandations" ? "Recommandations" : "Plan 30 jours"}
              </button>
            ))}
          </div>

          {/* Tab Analyse */}
          {activeTab === "analyse" && (
            <div className="space-y-4">
              {analysis.analyse_financiere && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title: "Points forts",  items: analysis.analyse_financiere.points_forts,  icon: CheckCircle,   color: "text-emerald-500", ring: "bg-emerald-500/10", arrow: "text-emerald-500" },
                    { title: "Points faibles", items: analysis.analyse_financiere.points_faibles, icon: TrendingDown, color: "text-red-500",     ring: "bg-red-500/10",     arrow: "text-red-400" },
                    { title: "Opportunités",  items: analysis.analyse_financiere.opportunites,   icon: Target,        color: "text-indigo-500",  ring: "bg-indigo-500/10",  arrow: "text-indigo-400" },
                  ].map(({ title, items, icon: Icon, color, ring, arrow }) => (
                    <div key={title} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-6 h-6 rounded-lg ${ring} flex items-center justify-center`}>
                          <Icon size={13} className={color} />
                        </div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">{title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {(items || []).map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <ChevronRight size={12} className={`${arrow} mt-0.5 flex-shrink-0`} />{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analysis.benchmark_marche && (
                  <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 size={15} className="text-violet-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Benchmark marché VTC AO</h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{analysis.benchmark_marche.comparaison}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 italic">{analysis.benchmark_marche.sources_comparatives}</p>
                  </div>
                )}
                {analysis.performance_chauffeurs && (
                  <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={15} className="text-sky-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Performance chauffeurs</h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{analysis.performance_chauffeurs.analyse}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic mb-3">{analysis.performance_chauffeurs.dispersion_revenus}</p>
                    <ul className="space-y-1.5">
                      {(analysis.performance_chauffeurs.recommandations || []).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <ChevronRight size={12} className="text-sky-400 mt-0.5 flex-shrink-0" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(analysis.alertes || []).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-500" />Alertes détectées par Claude
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(analysis.alertes || []).map((a, i) => {
                      const cfg = urgenceCfg(a.urgence)
                      return (
                        <div key={i} className={`rounded-xl border p-4 ${cfg.bg}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{a.titre}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{a.description}</p>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">→ {a.action_immediate}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Recommandations */}
          {activeTab === "recommandations" && (
            <div className="space-y-3">
              {(analysis.recommandations || []).map((r, i) => {
                const pCfg = prioriteCfg(r.priorite)
                const Icon = catIcon(r.categorie)
                return (
                  <div key={i} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{r.titre}</h3>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${pCfg.bg} ${pCfg.text}`}>{pCfg.label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-600 capitalize px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5">{r.categorie}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{r.description}</p>
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-bold">Impact estimé</p>
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{r.impact_estime}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-bold">Délai</p>
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{r.delai_mise_en_oeuvre}</p>
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
                <RefreshCw size={15} className="text-indigo-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Plan d'action sur 30 jours</h2>
              </div>
              <div className="space-y-4">
                {(analysis.plan_action_30j || []).map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm shadow-indigo-500/20">
                      {i + 1}
                    </div>
                    <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-1.5">{step}</p>
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

      {/* Erreur */}
      {!triggering && result?.ok === false && result.error && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-red-200 dark:border-red-500/20 p-8 text-center shadow-sm">
          <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Erreur lors de l'analyse</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">{result.error}</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
            Vérifiez que N8N_WEBHOOK_ANALYSE_URL est configuré et que n8n est actif
          </p>
        </div>
      )}

    </div>
  )
}
