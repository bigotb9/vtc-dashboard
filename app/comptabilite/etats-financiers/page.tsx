"use client"

/**
 * /comptabilite/etats-financiers — Hub états financiers (Phase 4.3 Module 4).
 *
 * Une carte par état + une carte synthèse "Dossier complet" pour le dépôt
 * fiscal annuel (1 seul PDF unifié 10-12 pages).
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { FileBarChart2, TrendingUp, ArrowDownUp, BookOpen, Archive, Loader2, FileDown, CheckCircle2 } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { ExerciceItem } from "@/types/compta-ui"

export default function EtatsFinanciersHubPage() {
  const [exercices, setExercices] = useState<ExerciceItem[]>([])
  const [exerciceId, setExerciceId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch("/api/compta/exercices").then(r => r.ok ? r.json() : null).then(j => {
      if (cancelled || !j) return
      const arr = ((j.data ?? []) as ExerciceItem[]).sort((a, b) => b.annee - a.annee)
      setExercices(arr)
      if (arr.length > 0) setExerciceId(arr[0].id)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleExportDossier = useCallback(async () => {
    if (!exerciceId) return
    setExporting(true)
    try {
      const res = await authFetch("/api/compta/etats-financiers/dossier-complet/export-pdf", {
        method: "POST",
        body:   JSON.stringify({ exercice_id: exerciceId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error((j as { error?: string })?.error ?? `HTTP ${res.status}`); return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const dispo = res.headers.get("Content-Disposition") ?? ""
      const m = /filename="([^"]+)"/.exec(dispo)
      a.href = url; a.download = m?.[1] ?? "dossier-etats-financiers.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success("Dossier complet PDF téléchargé")
    } finally {
      setExporting(false)
    }
  }, [exerciceId])

  const currentExercice = exercices.find(e => e.id === exerciceId)

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">États financiers</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
            <FileBarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">États financiers SYSCOHADA</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Bilan · Compte de résultat · TFT · Notes annexes — conformes au dépôt DGI
            </p>
          </div>
        </div>
        <div>
          <select
            value={exerciceId ?? ""} onChange={e => setExerciceId(e.target.value || null)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {exercices.length === 0 && <option value="">— Aucun exercice —</option>}
            {exercices.map(e => (<option key={e.id} value={e.id}>{e.libelle}</option>))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* Carte Dossier complet */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-500/5 to-indigo-500/10 ring-1 ring-blue-500/30 border border-blue-200/70 dark:border-blue-500/20 p-5 sm:p-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/40 flex-shrink-0">
                <Archive size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  Dépôt DGI / Banque
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Dossier complet — 1 PDF unifié</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                  Page de garde · Bilan · Compte de résultat · TFT · Notes annexes · Signature + hash.
                  10 à 12 pages, prêt à déposer.
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Bilan SYSCOHADA</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Compte de résultat (9 SIG)</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Tableau Flux de Trésorerie</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> 6 notes annexes</li>
                </ul>
              </div>
              <div>
                <button type="button" onClick={handleExportDossier} disabled={!exerciceId || exporting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white text-sm font-bold shadow-lg shadow-blue-500/30 transition disabled:opacity-50">
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                  Générer le dossier complet
                </button>
                {currentExercice && (
                  <div className="text-[11px] text-gray-500 mt-2 text-right">Exercice {currentExercice.libelle}</div>
                )}
              </div>
            </div>
          </div>

          {/* Grille des 4 états individuels */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-3">États individuels</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <EtatCard href={`/comptabilite/etats-financiers/bilan${exerciceId ? `?exercice_id=${exerciceId}` : ""}`}
                        icon={<FileBarChart2 size={20} className="text-white" />}
                        gradient="from-blue-500 to-indigo-700"
                        titre="Bilan"
                        sousTitre="Actif / Passif" />
              <EtatCard href={`/comptabilite/etats-financiers/compte-resultat${exerciceId ? `?exercice_id=${exerciceId}` : ""}`}
                        icon={<TrendingUp size={20} className="text-white" />}
                        gradient="from-emerald-500 to-teal-700"
                        titre="Compte de résultat"
                        sousTitre="Cascade 9 SIG" />
              <EtatCard href={`/comptabilite/etats-financiers/tft${exerciceId ? `?exercice_id=${exerciceId}` : ""}`}
                        icon={<ArrowDownUp size={20} className="text-white" />}
                        gradient="from-cyan-500 to-blue-700"
                        titre="TFT"
                        sousTitre="Flux de trésorerie" />
              <EtatCard href={`/comptabilite/etats-financiers/notes-annexes${exerciceId ? `?exercice_id=${exerciceId}` : ""}`}
                        icon={<BookOpen size={20} className="text-white" />}
                        gradient="from-amber-500 to-orange-700"
                        titre="Notes annexes"
                        sousTitre="6 notes simplifiées" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EtatCard({ href, icon, gradient, titre, sousTitre }: { href: string; icon: React.ReactNode; gradient: string; titre: string; sousTitre: string }) {
  return (
    <Link href={href}
          className="block rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 hover:border-gray-300 dark:hover:border-white/[0.12] hover:shadow-md transition group">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition`}>
        {icon}
      </div>
      <div className="mt-3">
        <div className="text-sm font-bold text-gray-900 dark:text-white">{titre}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{sousTitre}</div>
      </div>
    </Link>
  )
}
