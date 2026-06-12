"use client"
import { authFetch } from "@/lib/authFetch"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, ChevronDown, RefreshCw, Sparkles,
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
  // Refonte 23/05/2026 : etat collapse des 2 accordeons "Versements pour hier".
  // Par defaut : "A recouvrer" ouvert (action a faire) / "Verses" replie (fait).
  const [openVerses,     setOpenVerses]     = useState(false)
  const [openARecouvrer, setOpenARecouvrer] = useState(true)

  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const to   = new Date().toISOString().slice(0, 10)

  const load = async () => {
    setLoading(true)
    const res  = await authFetch(`/api/completude?from=${from}&to=${to}`)
    const d    = await res.json()
    setData(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Patch 24/05/2026 (Bug 4) : le bouton sparkle execute desormais 3 etapes
  // en cascade et fournit un feedback detaille a l'utilisateur :
  //   1. Attribution chauffeurs (existant, /api/recettes/attribution)
  //   2. Cascade explicite recettes_wave -> operations (/api/compta/reprise/recettes-wave)
  //      Note : depuis la migration trigger du 24/05, c'est normalement deja
  //      fait automatiquement. Mais on rejoue par securite (idempotent).
  //   3. Regeneration des ecritures comptables des operations recette_wave
  //      sans ecriture_id (/api/compta/operations/regenerer-ecritures)
  const recalculer = async () => {
    setRecalcul(true)
    const parts: string[] = []
    try {
      // Etape 1 : Attribution chauffeurs
      const resAttr = await authFetch("/api/recettes/attribution", { method: "POST" })
      const dAttr = await resAttr.json()
      if (dAttr.ok) {
        parts.push(`${dAttr.attributions_count ?? 0} attributions`)
      }

      // Etape 2 : Cascade recettes_wave -> operations (idempotent)
      try {
        const resCasc = await authFetch("/api/compta/reprise/recettes-wave", { method: "POST" })
        if (resCasc.ok) {
          const dCasc = await resCasc.json()
          if (dCasc.ok && dCasc.data?.creees > 0) {
            parts.push(`${dCasc.data.creees} ops creees`)
          }
        }
      } catch { /* non bloquant */ }

      // Etape 3 : Regeneration ecritures pour ops recette_wave sans ecriture
      try {
        const resEcr = await authFetch("/api/compta/operations/regenerer-ecritures", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ source: "recette_wave" }),
        })
        if (resEcr.ok) {
          const dEcr = await resEcr.json()
          if (dEcr.ok && dEcr.data?.generees > 0) {
            parts.push(`${dEcr.data.generees} ecritures generees`)
          }
        }
      } catch { /* non bloquant - acces directeur compta requis */ }

      if (parts.length === 0) {
        toast.success("Tout est deja a jour - aucune action necessaire", 5000)
      } else {
        toast.success("Rattrapage termine : " + parts.join(" - "), 9000)
      }
      await load()
    } catch (e) {
      toast.error((e as Error).message || "Erreur de recalcul")
    } finally {
      setRecalcul(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const isSundayToday  = new Date().getDay() === 0
  const casesToday     = data?.cases?.filter(c => c.date === today) || []
  const isHolidayToday = casesToday.length > 0 && casesToday.every(c => c.statut === "jour_ferie_auto" || c.statut === "paye_complet")
    && casesToday.some(c => c.statut === "jour_ferie_auto")

  // Patch 21/05/2026 - Bug 2 + complément 22/05/2026 + correctif 22/05/2026 +
  // refonte 23/05/2026 :
  // - remplacement du composant AlertesPaiements (logique placeholder cassée)
  //   par 2 sous-sections jumelées affichant les immatriculations versées /
  //   à recouvrer.
  // - métier VTC : un chauffeur verse aujourd'hui la recette de la veille,
  //   donc filtre sur jour_exploitation = HIER (et non aujourd'hui) pour le
  //   pilotage du recouvrement quotidien.
  // - 23/05 : suppression de la variable alertesHier qui dupliquait
  //   aRecouvrerHier (filtre 100% identique) + transformation des 2
  //   sous-sections en accordéons collapsibles.
  const aRecouvrerHier = data?.cases?.filter(c =>
    c.date === yesterday && (c.statut === "manquant" || c.statut === "paye_insuffisant")
  ) || []
  const versesHier = data?.cases?.filter(c =>
    c.date === yesterday && (
      c.statut === "paye_complet" ||
      c.statut === "paye_justifie" ||
      c.statut === "jour_ferie_auto"
    )
  ) || []
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
              aRecouvrerHier.length === 0
                ? "bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-500/5 dark:to-sky-500/5 border-emerald-200/50 dark:border-emerald-500/20"
                : "bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/5 dark:to-orange-500/5 border-red-200/50 dark:border-red-500/20"
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {aRecouvrerHier.length === 0
                  ? <CheckCircle2 size={11} className="text-emerald-500" />
                  : <AlertTriangle size={11} className="text-red-500" />
                }
                <p className={`text-[10px] font-bold uppercase tracking-wider ${aRecouvrerHier.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>Hier</p>
              </div>
              <p className={`text-lg font-black font-numeric ${aRecouvrerHier.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {aRecouvrerHier.length === 0 ? "✓" : aRecouvrerHier.length}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{aRecouvrerHier.length === 0 ? "tous versés" : "à traiter"}</p>
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

          {/* Versements pour hier : 2 accordeons collapsibles (refonte 23/05/2026).
              Filtre yesterday au lieu de today - metier VTC : versement J = recettes J-1.
              Suppression du doublon "Alertes hier" qui repliquait a l'identique
              le filtre de "A recouvrer". */}
          {(versesHier.length > 0 || aRecouvrerHier.length > 0) && (
            <div className="space-y-2 border-t border-gray-100 dark:border-[#1E2D45] pt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Versements pour hier
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {versesHier.length + aRecouvrerHier.length} véhicule{versesHier.length + aRecouvrerHier.length > 1 ? "s" : ""}
                </p>
              </div>

              {/* Accordeon Verses */}
              <button
                type="button"
                onClick={() => setOpenVerses(o => !o)}
                aria-expanded={openVerses}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 border border-emerald-200/60 dark:border-emerald-500/20 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/30">
                    <CheckCircle2 size={12} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
                      Versés
                    </p>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 leading-tight">
                      {versesHier.length === 0 ? "Aucun pour l'instant" : `${versesHier.length} véhicule${versesHier.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-numeric text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {versesHier.length}
                  </span>
                  <motion.div animate={{ rotate: openVerses ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={14} className="text-emerald-500 group-hover:text-emerald-600" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence initial={false}>
                {openVerses && (
                  <motion.div
                    key="content-verses"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1.5 pb-0.5">
                      {versesHier.length === 0 ? (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 italic px-3 py-2">
                          Aucun versement reçu pour le moment.
                        </p>
                      ) : (
                        <div className="space-y-0.5 max-h-[180px] overflow-y-auto pr-1">
                          {versesHier.map((c, i) => (
                            <motion.div
                              key={`verse-hier-${c.immatriculation}-${c.date}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.025 }}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-emerald-50/50 dark:hover:bg-emerald-500/[0.03] transition"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                  {c.immatriculation}
                                </span>
                              </div>
                              <span className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {c.statut === "jour_ferie_auto"
                                  ? "Férié"
                                  : c.statut === "paye_justifie"
                                    ? "Justifié"
                                    : `${Math.round(c.montant_recu).toLocaleString("fr-FR")} F`
                                }
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Accordeon A recouvrer */}
              <button
                type="button"
                onClick={() => setOpenARecouvrer(o => !o)}
                aria-expanded={openARecouvrer}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 group ${
                  aRecouvrerHier.length === 0
                    ? "bg-gradient-to-r from-emerald-50 to-sky-50 dark:from-emerald-500/5 dark:to-sky-500/5 border-emerald-200/60 dark:border-emerald-500/20 hover:shadow-sm"
                    : "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/5 dark:to-orange-500/5 border-red-200/60 dark:border-red-500/30 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-sm ${
                    aRecouvrerHier.length === 0
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
                      : "bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/30"
                  }`}>
                    {aRecouvrerHier.length === 0
                      ? <CheckCircle2 size={12} className="text-white" />
                      : <AlertTriangle size={12} className="text-white" />
                    }
                  </div>
                  <div className="text-left">
                    <p className={`text-xs font-bold leading-tight ${
                      aRecouvrerHier.length === 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    }`}>
                      À recouvrer
                    </p>
                    <p className={`text-[10px] leading-tight ${
                      aRecouvrerHier.length === 0
                        ? "text-emerald-600/70 dark:text-emerald-500/70"
                        : "text-red-600/70 dark:text-red-500/70"
                    }`}>
                      {aRecouvrerHier.length === 0 ? "Tous versés" : `${aRecouvrerHier.length} véhicule${aRecouvrerHier.length > 1 ? "s" : ""} à relancer`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-numeric text-sm font-black tabular-nums ${
                    aRecouvrerHier.length === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {aRecouvrerHier.length === 0 ? "✓" : aRecouvrerHier.length}
                  </span>
                  <motion.div animate={{ rotate: openARecouvrer ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={14} className={
                      aRecouvrerHier.length === 0
                        ? "text-emerald-500 group-hover:text-emerald-600"
                        : "text-red-500 group-hover:text-red-600"
                    } />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence initial={false}>
                {openARecouvrer && (
                  <motion.div
                    key="content-arecouvrer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1.5 pb-0.5">
                      {aRecouvrerHier.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/[0.03]">
                          <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                            Tous les véhicules ont versé pour hier.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5 max-h-[180px] overflow-y-auto pr-1">
                          {aRecouvrerHier.map((c, i) => (
                            <motion.div
                              key={`recouv-hier-${c.immatriculation}-${c.date}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.035 }}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-red-50/40 dark:hover:bg-red-500/[0.03] transition"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${c.statut === "manquant" ? "bg-red-500" : "bg-amber-500"}`} />
                                <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                  {c.immatriculation}
                                </span>
                              </div>
                              <span className={`text-[10.5px] font-semibold tabular-nums ${c.statut === "manquant" ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                                {c.statut === "manquant"
                                  ? "Pas versé"
                                  : `${Math.round(c.montant_recu).toLocaleString("fr-FR")}/${Math.round(c.montant_attendu).toLocaleString("fr-FR")}`
                                }
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
