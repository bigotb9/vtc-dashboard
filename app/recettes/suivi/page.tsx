"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  ClipboardCheck, RefreshCw, ChevronLeft, ChevronRight, ArrowLeft,
  AlertTriangle, CheckCircle2, Clock, Ban, PartyPopper,
} from "lucide-react"
import { toast } from "@/lib/toast"
import JustificationModal from "@/components/JustificationModal"
import type { CaseStatut } from "@/app/api/completude/route"

type CaseData = {
  date:             string
  id_vehicule:      number
  immatriculation:  string
  montant_attendu:  number
  montant_recu:     number
  nb_transactions:  number
  statut:           CaseStatut
  justification?:   { type: string; motif: string | null; auto: boolean }
  types_attribution?: string[]
  chauffeurs?:      { nom: string; montant: number }[]
}

const STATUS_META: Record<CaseStatut, { bg: string; label: string; icon: string }> = {
  paye_complet:      { bg: "bg-emerald-500",             label: "Payé",                 icon: "✓" },
  paye_insuffisant:  { bg: "bg-amber-500",               label: "Insuffisant",          icon: "!" },
  paye_justifie:     { bg: "bg-blue-500",                label: "Insuffisant justifié", icon: "✓" },
  manquant:          { bg: "bg-red-500",                 label: "Manquant",             icon: "✗" },
  manquant_justifie: { bg: "bg-indigo-400",              label: "Manquant justifié",    icon: "i" },
  jour_ferie_auto:   { bg: "bg-violet-500",              label: "Jour férié",           icon: "⚑" },
  en_cours:          { bg: "bg-sky-400",                 label: "En cours",             icon: "…" },
  non_ouvre:         { bg: "bg-gray-200 dark:bg-gray-800",  label: "Dimanche",          icon: "—" },
  pre_service:       { bg: "bg-gray-100 dark:bg-[#1A2235]", label: "Hors flotte",       icon: "" },
  futur:             { bg: "bg-gray-100 dark:bg-gray-900",  label: "À venir",           icon: "" },
}

function formatMoney(n: number) {
  return Math.round(n).toLocaleString("fr-FR")
}

// ── Tooltip dynamique ──────────────────────────────────────────────────────────
function CaseTooltip({ c }: { c: CaseData }) {
  const meta = STATUS_META[c.statut]
  const gap  = c.montant_attendu - c.montant_recu

  return (
    <div className="bg-[#0D1424] text-white rounded-xl px-3.5 py-3 shadow-2xl border border-[#1E2D45] min-w-[220px] text-xs space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        <span className="font-mono text-indigo-400 font-bold">{c.immatriculation}</span>
        <span className="text-gray-400">·</span>
        <span>{new Date(c.date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${meta.bg}`} />
        <span className="font-semibold">{meta.label}</span>
      </div>
      {c.montant_attendu > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-white/10">
          <div className="flex justify-between"><span className="text-gray-400">Attendu</span><span className="font-numeric">{formatMoney(c.montant_attendu)} F</span></div>
          <div className="flex justify-between">
            <span className="text-gray-400">Reçu</span>
            <span className={`font-numeric font-semibold ${c.montant_recu >= c.montant_attendu * 0.99 ? "text-emerald-400" : c.montant_recu > 0 ? "text-amber-400" : "text-red-400"}`}>
              {formatMoney(c.montant_recu)} F
            </span>
          </div>
          {gap > 0 && c.montant_recu > 0 && (
            <div className="flex justify-between"><span className="text-gray-400">Écart</span><span className="font-numeric text-red-400">−{formatMoney(gap)} F</span></div>
          )}
          {c.nb_transactions > 0 && (
            <div className="flex justify-between"><span className="text-gray-400">Transactions</span><span>{c.nb_transactions}</span></div>
          )}
        </div>
      )}
      {c.chauffeurs && c.chauffeurs.length > 0 && (
        <div className="pt-1 border-t border-white/10 space-y-0.5">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
            {c.chauffeurs.length > 1 ? "Chauffeurs" : "Chauffeur"}
          </p>
          {c.chauffeurs.map(ch => (
            <div key={ch.nom} className="flex justify-between gap-3">
              <span className="text-gray-200 truncate">{ch.nom}</span>
              <span className="font-numeric text-gray-400 text-[10px]">{formatMoney(ch.montant)} F</span>
            </div>
          ))}
        </div>
      )}
      {c.types_attribution && c.types_attribution.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-white/10">
          {c.types_attribution.map(t => (
            <span key={t} className="text-[9px] font-mono bg-white/10 rounded px-1.5 py-0.5 uppercase">{t}</span>
          ))}
        </div>
      )}
      {c.justification && (
        <div className="pt-1 border-t border-white/10">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
            Justifié{c.justification.auto ? " (auto)" : ""} · {c.justification.type.replace("_", " ")}
          </p>
          {c.justification.motif && <p className="text-[10px] text-gray-300 italic">{c.justification.motif}</p>}
        </div>
      )}
    </div>
  )
}

// ── Cellule calendrier ─────────────────────────────────────────────────────────
function CalCell({ c, onClick, dimmed, highlighted }: { c: CaseData; onClick: () => void; dimmed?: boolean; highlighted?: boolean }) {
  const [hover, setHover] = useState(false)
  const meta = STATUS_META[c.statut]
  const isClickable = c.statut === "manquant" || c.statut === "paye_insuffisant" || c.statut === "manquant_justifie" || c.statut === "paye_justifie"
  const hasPulse = c.statut === "en_cours"

  return (
    <div className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={onClick}
        disabled={!isClickable}
        className={`relative w-full aspect-square rounded-md transition-all ${meta.bg} ${isClickable ? "cursor-pointer hover:scale-110 hover:z-10" : "cursor-default"} ${hasPulse ? "animate-pulse" : ""} ${dimmed ? "opacity-20" : ""} ${highlighted ? "ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-[#0D1424] z-10 scale-110" : ""}`}
      >
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${c.statut === "non_ouvre" || c.statut === "futur" ? "text-gray-400 dark:text-gray-600" : "text-white"}`}>
          {meta.icon}
        </span>
        {c.justification && (
          <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-white" />
        )}
      </button>
      {hover && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <CaseTooltip c={c} />
        </div>
      )}
    </div>
  )
}

// ── Légende cliquable (tri + surlignage) ──────────────────────────────────────
function Legend({ active, counts, onToggle }: {
  active: CaseStatut | null
  counts: Map<CaseStatut, number>
  onToggle: (s: CaseStatut) => void
}) {
  const items: { statut: CaseStatut; label: string }[] = [
    { statut: "paye_complet",      label: "Complet" },
    { statut: "paye_insuffisant",  label: "Insuffisant" },
    { statut: "paye_justifie",     label: "Justifié" },
    { statut: "manquant",          label: "Manquant" },
    { statut: "manquant_justifie", label: "Just. manquant" },
    { statut: "jour_ferie_auto",   label: "Férié" },
    { statut: "en_cours",          label: "Aujourd'hui" },
    { statut: "non_ouvre",         label: "Dimanche" },
  ]
  return (
    <div className="flex flex-wrap gap-1 text-[11px]">
      {items.map(i => {
        const isActive = active === i.statut
        const count = counts.get(i.statut) || 0
        return (
          <button key={i.statut}
            onClick={() => onToggle(i.statut)}
            title={isActive ? "Annuler le tri" : `Trier par ${i.label.toLowerCase()}`}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition ${
              isActive
                ? "bg-indigo-100 dark:bg-indigo-500/15 ring-1 ring-indigo-400 dark:ring-indigo-500/60"
                : "hover:bg-gray-100 dark:hover:bg-white/5"
            }`}>
            <span className={`w-3 h-3 rounded ${STATUS_META[i.statut].bg}`} />
            <span className={isActive ? "text-indigo-700 dark:text-indigo-300 font-bold" : "text-gray-500 dark:text-gray-400"}>
              {i.label}
            </span>
            {count > 0 && (
              <span className={`text-[9px] font-numeric font-bold px-1 rounded ${
                isActive
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400"
              }`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function SuiviVersementsPage() {
  const [loading,  setLoading]  = useState(true)
  const [recalcul, setRecalcul] = useState(false)
  const [data,     setData]     = useState<{ cases: CaseData[]; dates: string[]; vehicules: { id_vehicule: number; immatriculation: string }[]; stats: Record<string, number>; taux_completion: number } | null>(null)
  const [offset,   setOffset]   = useState(0)   // offset en jours (0 = aujourd'hui)
  const [window,   setWindow]   = useState(30)  // nombre de jours affichés
  const [modal,    setModal]    = useState<CaseData | null>(null)
  const [filter,   setFilter]   = useState<CaseStatut | null>(null)  // statut de tri/filtre

  const to   = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)
  const from = new Date(Date.now() - (offset + window - 1) * 86400000).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/completude?from=${from}&to=${to}`)
    const d   = await res.json()
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

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
      toast.error(d.error || "Erreur")
    }
    setRecalcul(false)
  }

  // Construire la matrice véhicule × jour
  const matrix = useMemo(() => {
    if (!data) return null
    const m = new Map<string, CaseData>()   // key = `${id_vehicule}|${date}`
    for (const c of data.cases) {
      m.set(`${c.id_vehicule}|${c.date}`, c)
    }
    return m
  }, [data])

  // Comptes globaux par statut (pour badges dans la légende)
  const globalCounts = useMemo(() => {
    const m = new Map<CaseStatut, number>()
    if (!data) return m
    for (const c of data.cases) m.set(c.statut, (m.get(c.statut) || 0) + 1)
    return m
  }, [data])

  // Compte de cases par véhicule pour le statut filtré (permet le tri desc)
  const perVehicleCount = useMemo(() => {
    const m = new Map<number, number>()
    if (!data || !filter) return m
    for (const c of data.cases) {
      if (c.statut === filter) m.set(c.id_vehicule, (m.get(c.id_vehicule) || 0) + 1)
    }
    return m
  }, [data, filter])

  // Véhicules triés : par compte desc quand filtre actif, sinon par immatriculation
  const sortedVehicules = useMemo(() => {
    if (!data) return []
    if (!filter) return data.vehicules
    return [...data.vehicules].sort((a, b) => {
      const ca = perVehicleCount.get(a.id_vehicule) || 0
      const cb = perVehicleCount.get(b.id_vehicule) || 0
      if (cb !== ca) return cb - ca
      return a.immatriculation.localeCompare(b.immatriculation)
    })
  }, [data, filter, perVehicleCount])

  return (
    <div className="space-y-5 animate-in">

      {/* HEADER */}
      <div className="flex items-start gap-3">
        <Link href="/recettes"
          className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <ClipboardCheck size={15} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Suivi des versements</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 ml-10">
            Attribution automatique au jour d&apos;exploitation · cycle lun → sam · tolérance frais Wave 1%
          </p>
        </div>
        <button onClick={recalculer} disabled={recalcul || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition">
          {recalcul
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Recalcul…</>
            : <><RefreshCw size={13} />Recalculer</>
          }
        </button>
      </div>

      {/* KPIs */}
      {data && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { icon: CheckCircle2,  label: "Taux complet",    value: `${data.taux_completion}%`,                          grad: "from-emerald-500 to-teal-600", text: "text-emerald-600 dark:text-emerald-400" },
            { icon: AlertTriangle, label: "À traiter",       value: String((data.stats.manquant || 0) + (data.stats.paye_insuffisant || 0)), grad: "from-amber-500 to-red-500",    text: "text-amber-600 dark:text-amber-400" },
            { icon: Ban,           label: "Manquants",       value: String(data.stats.manquant || 0),                    grad: "from-red-500 to-rose-600",     text: "text-red-600 dark:text-red-400" },
            { icon: PartyPopper,   label: "Jours fériés",    value: String(data.stats.jour_ferie_auto || 0),             grad: "from-violet-500 to-purple-600", text: "text-violet-600 dark:text-violet-400" },
          ]).map((k, i) => {
            const Icon = k.icon
            return (
              <motion.div key={k.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0  }}
                transition={{ delay: i * 0.05 }}
                className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 overflow-hidden"
              >
                <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full bg-gradient-to-br ${k.grad} opacity-10 blur-2xl`} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-2xl font-black font-numeric mt-1 ${k.text}`}>{k.value}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${k.grad} flex items-center justify-center shadow-md`}>
                    <Icon size={14} className="text-white" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* TOOLBAR */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 flex items-center justify-between flex-wrap gap-3">
        <Legend
          active={filter}
          counts={globalCounts}
          onToggle={(s) => setFilter(filter === s ? null : s)}
        />
        <div className="flex items-center gap-2">
          {/* Fenêtre */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1A2235] rounded-lg p-1">
            {[15, 30, 60].map(n => (
              <button key={n} onClick={() => { setOffset(0); setWindow(n) }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  window === n
                    ? "bg-white dark:bg-[#0D1424] text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                {n}j
              </button>
            ))}
          </div>
          {/* Navigation période */}
          <button onClick={() => setOffset(o => o + window)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-indigo-500 hover:border-indigo-300 transition">
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => setOffset(o => Math.max(0, o - window))} disabled={offset === 0}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-gray-400 hover:text-indigo-500 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* CALENDRIER */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.vehicules.length === 0 ? (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-16 text-center">
          <ClipboardCheck size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm font-semibold text-gray-500">Aucun véhicule actif</p>
          <p className="text-xs text-gray-400 mt-1">Active au moins un véhicule pour voir le calendrier.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Header mois/année + jours */}
              <div className="sticky top-0 bg-gray-50 dark:bg-[#080F1E] border-b border-gray-100 dark:border-[#1E2D45] z-10">
                {/* Ligne mois/année — groupée par mois consécutifs */}
                <div className="flex items-stretch border-b border-gray-100 dark:border-[#1A2235]">
                  <div className="w-32 flex-shrink-0 px-4 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center">Période</div>
                  <div className="flex gap-0.5 px-2 py-1">
                    {(() => {
                      // Grouper les dates par (année, mois) pour dessiner une seule barre par groupe
                      const groups: { key: string; label: string; count: number }[] = []
                      for (const d of data.dates) {
                        const dateObj = new Date(d + "T00:00:00Z")
                        const key = `${dateObj.getUTCFullYear()}-${dateObj.getUTCMonth()}`
                        const label = dateObj.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
                        const last  = groups[groups.length - 1]
                        if (last && last.key === key) last.count++
                        else groups.push({ key, label, count: 1 })
                      }
                      return groups.map((g, i) => (
                        <div key={g.key}
                          style={{ width: `${g.count * 28 + (g.count - 1) * 2}px` }}
                          className={`text-[10px] font-bold uppercase tracking-wider text-center py-1 rounded-md truncate ${
                            i % 2 === 0
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                              : "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400"
                          }`}>
                          {g.label}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
                {/* Ligne jours */}
                <div className="flex items-center">
                  <div className="w-32 flex-shrink-0 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Véhicule</div>
                  <div className="flex gap-0.5 px-2">
                    {data.dates.map(d => {
                      const dateObj = new Date(d + "T00:00:00Z")
                      const dow = dateObj.getUTCDay()
                      const isWeekend = dow === 0
                      return (
                        <div key={d} className="w-7 flex flex-col items-center py-1">
                          <span className={`text-[8px] uppercase font-semibold ${isWeekend ? "text-gray-300 dark:text-gray-700" : "text-gray-400 dark:text-gray-500"}`}>
                            {["D","L","M","M","J","V","S"][dow]}
                          </span>
                          <span className={`text-[9px] font-numeric ${isWeekend ? "text-gray-400 dark:text-gray-600" : "text-gray-600 dark:text-gray-400"} font-semibold`}>
                            {dateObj.getUTCDate().toString().padStart(2, "0")}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Lignes véhicules */}
              {sortedVehicules.map((v, rowIdx) => {
                const countForVehicle = filter ? (perVehicleCount.get(v.id_vehicule) || 0) : 0
                return (
                  <motion.div key={v.id_vehicule}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0  }}
                    transition={{ delay: rowIdx * 0.02 }}
                    className="flex items-center border-b border-gray-50 dark:border-[#1A2235] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition"
                  >
                    <Link href={`/vehicules/${v.id_vehicule}`}
                      className="w-32 flex-shrink-0 px-4 py-2 font-mono text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-indigo-500 truncate flex items-center gap-2">
                      <span className="truncate">{v.immatriculation}</span>
                      {filter && countForVehicle > 0 && (
                        <span className="ml-auto text-[9px] font-numeric font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded shrink-0">
                          {countForVehicle}
                        </span>
                      )}
                    </Link>
                    <div className="flex gap-0.5 px-2 py-1.5">
                      {data.dates.map(d => {
                        const c = matrix?.get(`${v.id_vehicule}|${d}`)
                        if (!c) return <div key={d} className="w-7 aspect-square" />
                        const matches = filter && c.statut === filter
                        return (
                          <div key={d} className="w-7">
                            <CalCell
                              c={c}
                              onClick={() => setModal(c)}
                              dimmed={!!filter && !matches}
                              highlighted={!!matches}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal justification */}
      {modal && (
        <JustificationModal
          open={!!modal}
          onClose={() => setModal(null)}
          id_vehicule={modal.id_vehicule}
          immatriculation={modal.immatriculation}
          jour_exploitation={modal.date}
          montant_attendu={modal.montant_attendu}
          montant_recu={modal.montant_recu}
          existing={modal.justification ? { type: modal.justification.type, motif: modal.justification.motif } : null}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
