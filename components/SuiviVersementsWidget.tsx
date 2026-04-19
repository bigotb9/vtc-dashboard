"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, RefreshCw, Sparkles,
} from "lucide-react"
import { toast } from "@/lib/toast"

type Stats = {
  paye_complet:      number
  paye_insuffisant:  number
  paye_justifie:     number
  manquant:          number
  manquant_justifie: number
  jour_ferie_auto:   number
  en_cours:          number
  non_ouvre:         number
  pre_service?:      number
}

type Response = {
  ok: boolean
  taux_completion: number
  stats: Stats
  cases: {
    date:            string
    immatriculation: string
    statut:          string
    montant_attendu: number
    montant_recu:    number
  }[]
}

export default function SuiviVersementsWidget() {
  const [loading,  setLoading]  = useState(true)
  const [data,     setData]     = useState<Response | null>(null)
  const [recalcul, setRecalcul] = useState(false)

  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const to   = new Date().toISOString().slice(0, 10)

  const load = async () => {
    setLoading(true)
    const res  = await fetch(`/api/completude?from=${from}&to=${to}`)
    const d    = await res.json()
    setData(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const recalculer = async () => {
    setRecalcul(true)
    const res = await fetch("/api/recettes/attribution", { method: "POST" })
    const d   = await res.json()
    if (d.ok) {
      const parts = [`${d.attributions_count} attributions`]
      if (d.skipped_no_chauffeur > 0)    parts.push(`${d.skipped_no_chauffeur} sans chauffeur`)
      if (d.skipped_no_affectation > 0)  parts.push(`${d.skipped_no_affectation} sans affectation`)
      if (d.skipped_no_phone > 0)        parts.push(`${d.skipped_no_phone} sans tél`)
      toast.success(parts.join(" · "), 8000)
      await load()
    } else {
      toast.error(d.error || "Erreur de recalcul")
    }
    setRecalcul(false)
  }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const isSundayToday  = new Date().getDay() === 0
  const casesToday     = data?.cases.filter(c => c.date === today) || []
  const isHolidayToday = casesToday.length > 0 && casesToday.every(c => c.statut === "jour_ferie_auto" || c.statut === "paye_complet")
    && casesToday.some(c => c.statut === "jour_ferie_auto")

  const alertesHier = data?.cases.filter(c => c.date === yesterday && (c.statut === "manquant" || c.statut === "paye_insuffisant")) || []
  const enCoursAuj  = casesToday.filter(c => c.statut === "en_cours").length
  const payesAuj    = casesToday.filter(c => c.statut === "paye_complet").length
  const insuffAuj   = casesToday.filter(c => c.statut === "paye_insuffisant").length
  const totalAuj    = payesAuj + enCoursAuj + insuffAuj

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">

      {/* Header avec dégradé subtle */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-violet-50/30 to-transparent dark:from-indigo-500/5 dark:via-violet-500/5" />
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <ClipboardCheck size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Suivi versements</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-600">7 derniers jours · lun → sam</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={recalculer} disabled={recalcul || loading}
              title="Recalculer l'attribution"
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition disabled:opacity-50">
              {recalcul
                ? <RefreshCw size={13} className="animate-spin text-indigo-500" />
                : <Sparkles size={13} />
              }
            </button>
            <Link href="/recettes/suivi"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition">
              Calendrier complet <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="py-10 text-center text-sm text-gray-400">Erreur de chargement</div>
      ) : (
        <div className="p-5 space-y-4">

          {/* Taux de complétion avec cercle animé */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <svg width={80} height={80} className="-rotate-90">
                <circle cx={40} cy={40} r={32} fill="none" strokeWidth={7} className="stroke-gray-100 dark:stroke-[#1A2235]" />
                <motion.circle
                  cx={40} cy={40} r={32} fill="none" strokeWidth={7}
                  className={`${data.taux_completion >= 90 ? "stroke-emerald-500" : data.taux_completion >= 70 ? "stroke-amber-500" : "stroke-red-500"}`}
                  strokeLinecap="round"
                  strokeDasharray={201}
                  initial={{ strokeDashoffset: 201 }}
                  animate={{ strokeDashoffset: 201 - (data.taux_completion / 100) * 201 }}
                  transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`text-xl font-black font-numeric ${
                    data.taux_completion >= 90 ? "text-emerald-600 dark:text-emerald-400" :
                    data.taux_completion >= 70 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-600 dark:text-red-400"
                  }`}>
                  {data.taux_completion}%
                </motion.span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Taux de complétude</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.paye_complet + data.stats.paye_justifie} complets sur {data.stats.paye_complet + data.stats.paye_justifie + data.stats.paye_insuffisant + data.stats.manquant + data.stats.manquant_justifie + data.stats.jour_ferie_auto} jours ouvrés
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {data.stats.paye_complet} payés
                </span>
                {data.stats.paye_insuffisant > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {data.stats.paye_insuffisant} insuff.
                  </span>
                )}
                {data.stats.manquant > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {data.stats.manquant} manquants
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Aujourd'hui */}
          <div className="grid grid-cols-2 gap-2">
            {isSundayToday ? (
              <div className="rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-white/[0.02] dark:to-white/[0.01] border border-gray-200/50 dark:border-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={11} className="text-gray-400" />
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aujourd&apos;hui</p>
                </div>
                <p className="text-lg font-black font-numeric text-gray-400 dark:text-gray-500">Dimanche</p>
                <p className="text-[10px] text-gray-400 mt-0.5">jour non ouvré</p>
              </div>
            ) : isHolidayToday ? (
              <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/5 dark:to-purple-500/5 border border-violet-200/50 dark:border-violet-500/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={11} className="text-violet-500" />
                  <p className="text-[10px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">Aujourd&apos;hui</p>
                </div>
                <p className="text-lg font-black font-numeric text-violet-700 dark:text-violet-400">Férié</p>
                <p className="text-[10px] text-gray-400 mt-0.5">justification auto</p>
              </div>
            ) : (
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 border border-emerald-200/50 dark:border-emerald-500/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Aujourd&apos;hui</p>
                </div>
                <p className="text-lg font-black font-numeric text-gray-900 dark:text-white">{payesAuj}<span className="text-sm opacity-50">/{totalAuj}</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">versements reçus</p>
              </div>
            )}
            <div className={`rounded-xl border p-3 ${
              alertesHier.length === 0
                ? "bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-500/5 dark:to-sky-500/5 border-emerald-200/50 dark:border-emerald-500/20"
                : "bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/5 dark:to-orange-500/5 border-red-200/50 dark:border-red-500/20"
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {alertesHier.length === 0
                  ? <CheckCircle2 size={11} className="text-emerald-500" />
                  : <AlertTriangle size={11} className="text-red-500" />
                }
                <p className={`text-[10px] font-bold uppercase tracking-wider ${alertesHier.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>Hier</p>
              </div>
              <p className={`text-lg font-black font-numeric ${alertesHier.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {alertesHier.length === 0 ? "✓" : alertesHier.length}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{alertesHier.length === 0 ? "tous versés" : "à traiter"}</p>
            </div>
          </div>

          {/* Alertes à traiter (7j) */}
          {(data.stats.manquant > 0 || data.stats.paye_insuffisant > 0) && (
            <Link href="/recettes/suivi" className="block">
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-500/5 dark:to-red-500/5 border border-amber-200 dark:border-amber-500/30 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={12} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                      {data.stats.manquant + data.stats.paye_insuffisant} à traiter
                    </p>
                    <p className="text-[10px] text-red-600/70 dark:text-red-500/70">
                      {data.stats.manquant > 0 && `${data.stats.manquant} manquants`}
                      {data.stats.manquant > 0 && data.stats.paye_insuffisant > 0 && " · "}
                      {data.stats.paye_insuffisant > 0 && `${data.stats.paye_insuffisant} insuffisants`}
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-red-400" />
              </motion.div>
            </Link>
          )}

          {/* Dernières alertes */}
          {alertesHier.length > 0 && (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alertes hier</p>
              {alertesHier.slice(0, 4).map((c, i) => (
                <motion.div
                  key={`${c.immatriculation}-${c.date}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.statut === "manquant" ? "bg-red-500" : "bg-amber-500"}`} />
                    <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{c.immatriculation}</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${c.statut === "manquant" ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                    {c.statut === "manquant"
                      ? "Aucun versement"
                      : `${Math.round(c.montant_recu).toLocaleString("fr-FR")}/${Math.round(c.montant_attendu).toLocaleString("fr-FR")}`
                    }
                  </span>
                </motion.div>
              ))}
            </div>
          )}

          {/* État optimal */}
          {data.stats.manquant === 0 && data.stats.paye_insuffisant === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 border border-emerald-200/50 dark:border-emerald-500/20">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                Tous les versements sont à jour sur les 7 derniers jours
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
