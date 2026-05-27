"use client"

/**
 * /comptabilite/etats-financiers/bilan — Bilan SYSCOHADA révisé.
 * Phase 4.2 Module 3a §4.2.
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileBarChart2, FileDown, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { BilanData, BilanSection, ExerciceItem } from "@/types/compta-ui"

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}

export default function BilanPage() {
  const params = useSearchParams()
  const [exercices, setExercices] = useState<ExerciceItem[]>([])
  const [exerciceId, setExerciceId] = useState<string | null>(params.get("exercice_id"))
  const [data, setData] = useState<BilanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Charger exercices au mount
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

  // 2. Charger Bilan quand exerciceId change
  const refetch = useCallback(async () => {
    if (!exerciceId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/compta/etats-financiers/bilan?exercice_id=${exerciceId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string })?.error ?? `HTTP ${res.status}`); setData(null); return
      }
      setData((json as { data: BilanData }).data)
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
      const res = await authFetch("/api/compta/etats-financiers/bilan/export-pdf", {
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
      a.href = url; a.download = m?.[1] ?? "bilan.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success("Bilan PDF téléchargé")
    } finally {
      setExporting(false)
    }
  }

  const equilibreOk = data ? Math.abs(data.ecart_n) < 1 : false

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">États financiers · Bilan</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <FileBarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">Bilan SYSCOHADA</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Photographie patrimoniale à la clôture · Actif & Passif côte à côte
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exerciceId ?? ""}
            onChange={e => setExerciceId(e.target.value || null)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {exercices.length === 0 && <option value="">— Aucun exercice —</option>}
            {exercices.map(e => (
              <option key={e.id} value={e.id}>
                {e.libelle} ({e.statut === "clos" ? "clos" : "ouvert"})
              </option>
            ))}
          </select>
          <button
            type="button" onClick={handleExportPdf} disabled={!exerciceId || exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/25 transition disabled:opacity-50"
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Bandeau équilibre */}
          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${equilibreOk
            ? "bg-emerald-500/8 border-emerald-500/30"
            : "bg-red-500/8 border-red-500/30"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${equilibreOk
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
              : "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30"}`}>
              {equilibreOk
                ? <CheckCircle2 size={18} className="text-white" />
                : <AlertTriangle size={18} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold leading-tight ${equilibreOk
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"}`}>
                {equilibreOk ? "Bilan équilibré" : "Déséquilibre détecté"}
              </p>
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                Total Actif <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{fmt(data.total_actif_net_n)} F</span> ·
                Total Passif <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{fmt(data.total_passif_net_n)} F</span> ·
                Écart <span className={`font-mono font-bold ${equilibreOk ? "text-emerald-600" : "text-red-600"}`}>{fmt(data.ecart_n)} F</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BilanTable title="Actif" sections={data.actif_sections} showAmort />
            <BilanTable title="Passif" sections={data.passif_sections} showAmort={false} />
          </div>
        </>
      )}
    </div>
  )
}

function BilanTable({ title, sections, showAmort }: { title: string; sections: BilanSection[]; showAmort: boolean }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className="bg-[#1F4E79] text-white px-4 py-2.5 font-bold text-sm tracking-wider uppercase">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left px-3 py-2">Poste</th>
            {showAmort && <th className="text-right px-3 py-2 w-[18%]">Brut</th>}
            {showAmort && <th className="text-right px-3 py-2 w-[18%]">Amort</th>}
            <th className="text-right px-3 py-2 w-[20%]">Net N</th>
            <th className="text-right px-3 py-2 w-[20%]">Net N-1</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(sec => (
            <Section key={sec.code} sec={sec} showAmort={showAmort} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ sec, showAmort }: { sec: BilanSection; showAmort: boolean }) {
  return (
    <>
      <tr className="bg-indigo-500/5 dark:bg-indigo-500/[0.08]">
        <td colSpan={showAmort ? 5 : 3} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          {sec.libelle}
        </td>
      </tr>
      {sec.lignes.map(l => (
        <tr key={l.poste} className="border-t border-gray-100 dark:border-white/[0.04]">
          <td className="px-3 py-1.5 text-[12.5px] text-gray-700 dark:text-gray-200">{l.libelle}</td>
          {showAmort && <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums">{fmt(l.brut_n)}</td>}
          {showAmort && <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-red-600 dark:text-red-400">{fmt(l.amort_n)}</td>}
          <td className="px-3 py-1.5 text-right font-mono text-[12.5px] font-bold tabular-nums">{fmt(l.net_n)}</td>
          <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-gray-400">{fmt(l.net_n_minus_1)}</td>
        </tr>
      ))}
      <tr className="bg-gray-50 dark:bg-white/[0.03] border-t border-gray-200 dark:border-white/[0.06]">
        <td className="px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-200">Sous-total</td>
        {showAmort && <td className="px-3 py-1.5 text-right font-mono text-[12px] font-bold tabular-nums">{fmt(sec.total_brut_n)}</td>}
        {showAmort && <td className="px-3 py-1.5 text-right font-mono text-[12px] font-bold tabular-nums">{fmt(sec.total_amort_n)}</td>}
        <td className="px-3 py-1.5 text-right font-mono text-[12.5px] font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{fmt(sec.total_net_n)}</td>
        <td className="px-3 py-1.5 text-right font-mono text-[11.5px] font-bold tabular-nums text-gray-400">{fmt(sec.total_net_n_minus_1)}</td>
      </tr>
    </>
  )
}
