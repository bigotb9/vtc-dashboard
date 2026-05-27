"use client"

/**
 * /comptabilite/etats-financiers/compte-resultat — Cascade 9 SIG.
 * Phase 4.2 Module 3b §5.2.
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { TrendingUp, FileDown, Loader2 } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { CompteResultatData, ExerciceItem, SIGRow } from "@/types/compta-ui"

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (Math.abs(n) < 1) return "—"
  return (n < 0 ? "−" : "+") + fmt(n)
}

const SIG_TONE: Record<string, { bg: string; text: string; ring: string }> = {
  MARGE_COMMERCIALE:     { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-500/30" },
  PRODUCTION_EXERCICE:   { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-500/30" },
  VALEUR_AJOUTEE:        { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-300",       ring: "ring-blue-500/30" },
  EBE:                   { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30" },
  RESULTAT_EXPLOITATION: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30" },
  RESULTAT_FINANCIER:    { bg: "bg-indigo-500/10",  text: "text-indigo-700 dark:text-indigo-300",   ring: "ring-indigo-500/30" },
  RAO:                   { bg: "bg-indigo-500/10",  text: "text-indigo-700 dark:text-indigo-300",   ring: "ring-indigo-500/30" },
  HAO:                   { bg: "bg-pink-500/10",    text: "text-pink-700 dark:text-pink-300",       ring: "ring-pink-500/30" },
  RESULTAT_NET:          { bg: "bg-[#1F4E79]",      text: "text-white",                              ring: "ring-blue-900" },
}

export default function CompteResultatPage() {
  const params = useSearchParams()
  const [exercices, setExercices] = useState<ExerciceItem[]>([])
  const [exerciceId, setExerciceId] = useState<string | null>(params.get("exercice_id"))
  const [data, setData] = useState<CompteResultatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    authFetch("/api/compta/exercices").then(r => r.ok ? r.json() : null).then(j => {
      if (cancelled || !j) return
      const arr = ((j.data ?? []) as ExerciceItem[]).sort((a, b) => b.annee - a.annee)
      setExercices(arr)
      if (!exerciceId && arr.length > 0) setExerciceId(arr[0].id)
    }).catch((e: Error) => {
      // Lot O (26/05/2026 audit) : ne plus avaler silencieusement.
      if (!cancelled) setError(`Impossible de charger la liste des exercices : ${e.message}`)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refetch = useCallback(async () => {
    if (!exerciceId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/compta/etats-financiers/compte-resultat?exercice_id=${exerciceId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string })?.error ?? `HTTP ${res.status}`); setData(null); return
      }
      setData((json as { data: CompteResultatData }).data)
    } catch (e) {
      setError((e as Error).message); setData(null)
    } finally {
      setLoading(false)
    }
  }, [exerciceId])
  useEffect(() => { refetch() }, [refetch])

  async function handleExportPdf() {
    if (!exerciceId) return
    setExporting(true)
    try {
      const res = await authFetch("/api/compta/etats-financiers/compte-resultat/export-pdf", {
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
      a.href = url; a.download = m?.[1] ?? "compte-resultat.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success("Compte de résultat PDF téléchargé")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">États financiers · Compte de résultat</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">Compte de résultat SYSCOHADA</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Cascade des 9 Soldes Intermédiaires de Gestion · Comparatif N-1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exerciceId ?? ""} onChange={e => setExerciceId(e.target.value || null)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {exercices.length === 0 && <option value="">— Aucun exercice —</option>}
            {exercices.map(e => (<option key={e.id} value={e.id}>{e.libelle}</option>))}
          </select>
          <button type="button" onClick={handleExportPdf} disabled={!exerciceId || exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 transition disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Exporter PDF officiel
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur : {error}. <button onClick={refetch} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left  px-3 py-2.5">Soldes intermédiaires de gestion</th>
                <th className="text-right px-3 py-2.5 w-[22%]">Net N</th>
                <th className="text-right px-3 py-2.5 w-[20%]">Net N-1</th>
              </tr>
            </thead>
            <tbody>
              {data.sigs.map(sig => <SIGBloc key={sig.code} sig={sig} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SIGBloc({ sig }: { sig: SIGRow }) {
  const tone = SIG_TONE[sig.code] ?? SIG_TONE.VALEUR_AJOUTEE
  const isFinal = sig.code === "RESULTAT_NET"
  return (
    <>
      {sig.detail.map((d, i) => (
        <tr key={i} className="border-t border-gray-100 dark:border-white/[0.04]">
          <td className="pl-8 pr-3 py-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
            <span className="font-mono text-[10px] mr-1">{d.signe < 0 ? "−" : "+"}</span>
            {d.libelle}
          </td>
          <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums">{fmt(d.montant_n)}</td>
          <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-gray-400">{fmt(d.montant_n_minus_1)}</td>
        </tr>
      ))}
      <tr className={`${tone.bg} ${isFinal ? "border-t-2 border-blue-900" : "border-t border-gray-200 dark:border-white/[0.08]"}`}>
        <td className={`px-3 py-2 font-bold text-[12px] uppercase tracking-wider ${tone.text}`}>
          = {sig.libelle}
        </td>
        <td className={`px-3 py-2 text-right font-mono font-bold tabular-nums ${isFinal ? "text-base text-white" : `${tone.text}`}`}>
          {fmtSigne(sig.total_n)}
        </td>
        <td className={`px-3 py-2 text-right font-mono tabular-nums ${isFinal ? "text-sm text-gray-300" : "text-gray-500"}`}>
          {fmtSigne(sig.total_n_minus_1)}
        </td>
      </tr>
    </>
  )
}
