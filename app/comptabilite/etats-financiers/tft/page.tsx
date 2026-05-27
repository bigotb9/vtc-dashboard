"use client"

/**
 * /comptabilite/etats-financiers/tft — Tableau Flux de Trésorerie SYSCOHADA.
 * Phase 4.3 Module 3.
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowDownUp, FileDown, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { TftData, TftSection, ExerciceItem } from "@/types/compta-ui"

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (Math.abs(n) < 1) return "—"
  return (n < 0 ? "−" : "+") + fmt(n)
}

const SECTION_LABEL: Record<TftSection["code"], string> = {
  OPERATIONNEL:   "A — Flux opérationnels",
  INVESTISSEMENT: "B — Flux d'investissement",
  FINANCEMENT:    "C — Flux de financement",
}
const SECTION_TONE: Record<TftSection["code"], { bg: string; text: string; ring: string; letter: string }> = {
  OPERATIONNEL:   { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30", letter: "A" },
  INVESTISSEMENT: { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-300",        ring: "ring-blue-500/30",   letter: "B" },
  FINANCEMENT:    { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-300",      ring: "ring-amber-500/30",  letter: "C" },
}

export default function TftPage() {
  const params = useSearchParams()
  const [exercices, setExercices] = useState<ExerciceItem[]>([])
  const [exerciceId, setExerciceId] = useState<string | null>(params.get("exercice_id"))
  const [data, setData] = useState<TftData | null>(null)
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
      const res = await authFetch(`/api/compta/etats-financiers/tft?exercice_id=${exerciceId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string })?.error ?? `HTTP ${res.status}`); setData(null); return
      }
      setData((json as { data: TftData }).data)
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
      const res = await authFetch("/api/compta/etats-financiers/tft/export-pdf", {
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
      a.href = url; a.download = m?.[1] ?? "tft.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success("TFT PDF téléchargé")
    } finally {
      setExporting(false)
    }
  }

  const ecartOk = data ? Math.abs(data.ecart_reconciliation) < 1 : true

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">États financiers · TFT</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0">
            <ArrowDownUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">Tableau des Flux de Trésorerie</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Cascade SYSCOHADA · 3 sections (Opérationnel, Investissement, Financement) · Réconciliation Bilan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exerciceId ?? ""} onChange={e => setExerciceId(e.target.value || null)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {exercices.length === 0 && <option value="">— Aucun exercice —</option>}
            {exercices.map(e => (<option key={e.id} value={e.id}>{e.libelle}</option>))}
          </select>
          <button type="button" onClick={handleExportPdf} disabled={!exerciceId || exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-cyan-500/25 transition disabled:opacity-50"
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left  px-3 py-2.5">Composante</th>
                  <th className="text-right px-3 py-2.5 w-[22%]">Net N</th>
                  <th className="text-right px-3 py-2.5 w-[20%]">Net N-1</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map(sec => <TftSectionBloc key={sec.code} sec={sec} />)}
                <tr className="bg-[#1F4E79] border-t-2 border-blue-900">
                  <td className="px-3 py-3 font-black text-white uppercase tracking-wider text-[12px]">
                    Variation nette de trésorerie (A + B + C)
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-black tabular-nums text-base text-white">{fmtSigne(data.variation_n)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-sm text-gray-300">{fmtSigne(data.variation_n_minus_1)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Bandeau réconciliation ──────────────────────────────────── */}
          <div className={`rounded-2xl border p-4 ${ecartOk
            ? "bg-emerald-500/5 border-emerald-500/20 ring-1 ring-emerald-500/30"
            : "bg-red-500/5 border-red-500/20 ring-1 ring-red-500/30"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ecartOk
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/15 text-red-700 dark:text-red-300"}`}>
                {ecartOk ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-base font-bold ${ecartOk ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                  {ecartOk ? "TFT cohérent avec le Bilan" : "TFT incohérent avec le Bilan"}
                </h3>
                <table className="w-full text-sm mt-3">
                  <tbody>
                    <tr><td className="py-1 text-gray-600 dark:text-gray-400">Trésorerie au début de l&apos;exercice</td>
                        <td className="py-1 text-right font-mono font-bold tabular-nums text-gray-900 dark:text-white">{fmt(data.treso_debut_n)} F</td></tr>
                    <tr><td className="py-1 text-gray-600 dark:text-gray-400">+ Variation nette (A + B + C)</td>
                        <td className="py-1 text-right font-mono font-bold tabular-nums text-gray-900 dark:text-white">{fmtSigne(data.variation_n)} F</td></tr>
                    <tr className="border-t border-current/20"><td className="py-1.5 font-bold">= Trésorerie attendue à la fin</td>
                        <td className="py-1.5 text-right font-mono font-black tabular-nums text-gray-900 dark:text-white">{fmt(data.treso_debut_n + data.variation_n)} F</td></tr>
                    <tr><td className="py-1 text-gray-600 dark:text-gray-400">Trésorerie réelle à la fin (Bilan)</td>
                        <td className="py-1 text-right font-mono font-bold tabular-nums text-gray-900 dark:text-white">{fmt(data.treso_fin_n)} F</td></tr>
                    {!ecartOk && (
                      <tr className="border-t border-current/20"><td className="py-1.5 font-bold">Écart de réconciliation</td>
                          <td className="py-1.5 text-right font-mono font-black tabular-nums text-red-700 dark:text-red-300">{fmtSigne(data.ecart_reconciliation)} F</td></tr>
                    )}
                  </tbody>
                </table>
                {!ecartOk && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-3">
                    Cause probable : écritures incomplètes, mouvements de trésorerie non rattachés à un flux opérationnel/investissement/financement, ou erreur de classification de compte.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TftSectionBloc({ sec }: { sec: TftSection }) {
  const tone = SECTION_TONE[sec.code]
  return (
    <>
      <tr className="bg-[#1F4E79]">
        <td colSpan={3} className="px-3 py-2 font-bold uppercase tracking-[0.15em] text-[11px] text-white">
          {SECTION_LABEL[sec.code]}
        </td>
      </tr>
      {sec.lignes.map((l, i) => (
        <tr key={i} className="border-t border-gray-100 dark:border-white/[0.04]">
          <td className="pl-8 pr-3 py-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
            <span className="font-mono text-[10px] mr-1">{l.signe < 0 ? "−" : "+"}</span>{l.libelle}
          </td>
          <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums">{fmt(l.montant_n)}</td>
          <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-gray-400">{fmt(l.montant_n_minus_1)}</td>
        </tr>
      ))}
      <tr className={`${tone.bg} ring-1 ${tone.ring} border-t border-gray-200 dark:border-white/[0.08]`}>
        <td className={`px-3 py-2 font-bold text-[12px] uppercase tracking-wider ${tone.text}`}>= Flux {tone.letter}</td>
        <td className={`px-3 py-2 text-right font-mono font-bold tabular-nums text-[13px] ${tone.text}`}>{fmtSigne(sec.total_n)}</td>
        <td className={`px-3 py-2 text-right font-mono tabular-nums text-[11.5px] ${tone.text} opacity-70`}>{fmtSigne(sec.total_n_minus_1)}</td>
      </tr>
    </>
  )
}
