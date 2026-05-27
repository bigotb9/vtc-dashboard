"use client"

/**
 * /comptabilite/etats-financiers/notes-annexes — Notes annexes SYSCOHADA.
 * Phase 4.3 Module 2.
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileText, FileDown, Loader2, BookOpen, Building, TrendingDown, Banknote, Wallet, ShieldCheck } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { NotesAnnexesData, ExerciceItem } from "@/types/compta-ui"

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (Math.abs(n) < 1) return "—"
  return (n < 0 ? "−" : "+") + fmt(n)
}
function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

const LABEL_METHODE_AMORT: Record<string, string> = {
  lineaire:  "Linéaire",
  degressif: "Dégressif",
}
const LABEL_METHODE_STOCKS: Record<string, string> = {
  fifo: "FIFO",
  cmp:  "CMP",
  lifo: "LIFO",
}

export default function NotesAnnexesPage() {
  const params = useSearchParams()
  const [exercices, setExercices] = useState<ExerciceItem[]>([])
  const [exerciceId, setExerciceId] = useState<string | null>(params.get("exercice_id"))
  const [data, setData] = useState<NotesAnnexesData | null>(null)
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
      const res = await authFetch(`/api/compta/etats-financiers/notes-annexes?exercice_id=${exerciceId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string })?.error ?? `HTTP ${res.status}`); setData(null); return
      }
      setData((json as { data: NotesAnnexesData }).data)
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
      const res = await authFetch("/api/compta/etats-financiers/notes-annexes/export-pdf", {
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
      a.href = url; a.download = m?.[1] ?? "notes-annexes.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success("Notes annexes PDF téléchargées")
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
        <span className="text-gray-700 dark:text-gray-300">États financiers · Notes annexes</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">Notes annexes SYSCOHADA</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              6 notes essentielles · Conformes au dépôt fiscal DGI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exerciceId ?? ""} onChange={e => setExerciceId(e.target.value || null)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            {exercices.length === 0 && <option value="">— Aucun exercice —</option>}
            {exercices.map(e => (<option key={e.id} value={e.id}>{e.libelle}</option>))}
          </select>
          <button type="button" onClick={handleExportPdf} disabled={!exerciceId || exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-semibold shadow-md shadow-amber-500/25 transition disabled:opacity-50"
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* Note 1 */}
          <NoteCard num={1} icon={<FileText size={18} />} titre="Méthodes comptables" tone="indigo">
            <div className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.methodes_comptables}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill label={`Amortissement : ${LABEL_METHODE_AMORT[data.methode_amortissement] ?? data.methode_amortissement}`} />
              <Pill label={`Stocks : ${LABEL_METHODE_STOCKS[data.methode_stocks] ?? data.methode_stocks}`} />
            </div>
            <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-500">
              Modifiable dans <Link href="/comptabilite/parametres-societe" className="underline">Paramètres société</Link>.
            </div>
          </NoteCard>

          {/* Note 2 */}
          <NoteCard num={2} icon={<Building size={18} />} titre="État des immobilisations" tone="blue">
            {data.immobilisations.length === 0 ? (
              <EmptyState message="Aucune immobilisation enregistrée à la clôture." />
            ) : (
              <ImmoTable rows={data.immobilisations} />
            )}
          </NoteCard>

          {/* Note 3 */}
          <NoteCard num={3} icon={<TrendingDown size={18} />} titre="Dotations aux amortissements" tone="red">
            {data.amortissements.length === 0 ? (
              <EmptyState message="Aucune dotation aux amortissements pour l'exercice." />
            ) : (
              <AmortTable rows={data.amortissements} />
            )}
          </NoteCard>

          {/* Note 4 */}
          <NoteCard num={4} icon={<Banknote size={18} />} titre="Créances et dettes" tone="emerald">
            <p className="text-[11px] text-gray-500 dark:text-gray-500 italic mb-3">
              V1 simplifiée : toutes les créances/dettes considérées à échéance −1 an.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <CDTable label="Créances" rows={data.creances} tone="emerald" emptyMsg="Aucune créance." />
              <CDTable label="Dettes"   rows={data.dettes}   tone="red"     emptyMsg="Aucune dette." />
            </div>
          </NoteCard>

          {/* Note 5 */}
          <NoteCard num={5} icon={<Wallet size={18} />} titre="Variation des capitaux propres" tone="violet">
            {data.capitaux_propres.length === 0 ? (
              <EmptyState message="Aucune variation des capitaux propres." />
            ) : (
              <CapitauxTable rows={data.capitaux_propres} />
            )}
          </NoteCard>

          {/* Note 6 */}
          <NoteCard num={6} icon={<ShieldCheck size={18} />} titre="Engagements hors bilan" tone="amber">
            <div className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.engagements_hors_bilan}</div>
            <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-500">
              Modifiable dans <Link href="/comptabilite/parametres-societe" className="underline">Paramètres société</Link>.
            </div>
          </NoteCard>

          <div className="text-[11px] text-gray-500 dark:text-gray-500 italic text-right">
            Exercice {data.exercice_libelle} — arrêté au {fmtDateFr(data.date_arrete)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composants de présentation ──────────────────────────────────────────────
const TONE_CLASSES: Record<string, { bg: string; ring: string; chip: string; iconBg: string }> = {
  indigo:  { bg: "bg-indigo-500/5",  ring: "ring-indigo-500/20",  chip: "bg-indigo-500/10  text-indigo-700 dark:text-indigo-300",  iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-700" },
  blue:    { bg: "bg-blue-500/5",    ring: "ring-blue-500/20",    chip: "bg-blue-500/10    text-blue-700 dark:text-blue-300",     iconBg: "bg-gradient-to-br from-blue-500 to-blue-700" },
  red:     { bg: "bg-red-500/5",     ring: "ring-red-500/20",     chip: "bg-red-500/10     text-red-700 dark:text-red-300",       iconBg: "bg-gradient-to-br from-red-500 to-rose-700" },
  emerald: { bg: "bg-emerald-500/5", ring: "ring-emerald-500/20", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", iconBg: "bg-gradient-to-br from-emerald-500 to-teal-700" },
  violet:  { bg: "bg-violet-500/5",  ring: "ring-violet-500/20",  chip: "bg-violet-500/10  text-violet-700 dark:text-violet-300",  iconBg: "bg-gradient-to-br from-violet-500 to-purple-700" },
  amber:   { bg: "bg-amber-500/5",   ring: "ring-amber-500/20",   chip: "bg-amber-500/10   text-amber-700 dark:text-amber-300",    iconBg: "bg-gradient-to-br from-amber-500 to-orange-700" },
}

function NoteCard({ num, icon, titre, tone, children }: { num: number; icon: React.ReactNode; titre: string; tone: keyof typeof TONE_CLASSES; children: React.ReactNode }) {
  const t = TONE_CLASSES[tone]
  return (
    <div className={`rounded-2xl ${t.bg} ring-1 ${t.ring} border border-gray-200/70 dark:border-white/[0.06] p-5`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${t.iconBg} flex items-center justify-center text-white shadow-md`}>
          {icon}
        </div>
        <div>
          <div className={`inline-flex items-center px-2 py-0.5 rounded-md ${t.chip} text-[10px] font-bold uppercase tracking-wider`}>Note {num}</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mt-0.5">{titre}</h2>
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-[11px] font-semibold text-gray-700 dark:text-gray-300">
      {label}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-gray-100/60 dark:bg-white/[0.03] border border-dashed border-gray-200 dark:border-white/[0.08] p-4 text-center text-sm text-gray-500 dark:text-gray-400 italic">
      {message}
    </div>
  )
}

function ImmoTable({ rows }: { rows: NotesAnnexesData["immobilisations"] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className="text-left px-3 py-2">Catégorie</th>
            <th className="text-right px-3 py-2">Début N</th>
            <th className="text-right px-3 py-2">Acquis.</th>
            <th className="text-right px-3 py-2">Cessions</th>
            <th className="text-right px-3 py-2">Fin N</th>
            <th className="text-right px-3 py-2">Amort.</th>
            <th className="text-right px-3 py-2">VNC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.categorie_code} className="border-t border-gray-100 dark:border-white/[0.04]">
              <td className="px-3 py-1.5 text-[12.5px]"><span className="font-mono text-[10.5px] mr-1.5 text-gray-500">{r.categorie_code}</span>{r.categorie_libelle}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums">{fmt(r.solde_debut)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-emerald-700 dark:text-emerald-400">{r.acquisitions > 0 ? "+" + fmt(r.acquisitions) : "—"}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-red-700 dark:text-red-400">{r.cessions > 0 ? "−" + fmt(r.cessions) : "—"}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums font-bold">{fmt(r.solde_fin)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-red-700 dark:text-red-400">{fmt(r.amort_cumule)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums font-bold text-blue-700 dark:text-blue-300">{fmt(r.vnc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AmortTable({ rows }: { rows: NotesAnnexesData["amortissements"] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className="text-left px-3 py-2">Catégorie</th>
            <th className="text-right px-3 py-2">Valeur origine</th>
            <th className="text-right px-3 py-2">Amort. début</th>
            <th className="text-right px-3 py-2">Dotation N</th>
            <th className="text-right px-3 py-2">Amort. fin</th>
            <th className="text-right px-3 py-2">VNC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.categorie_code} className="border-t border-gray-100 dark:border-white/[0.04]">
              <td className="px-3 py-1.5 text-[12.5px]"><span className="font-mono text-[10.5px] mr-1.5 text-gray-500">{r.categorie_code}</span>{r.categorie_libelle}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums">{fmt(r.valeur_origine)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums">{fmt(r.amort_debut)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums font-bold text-red-700 dark:text-red-400">{r.dotation_exercice > 0 ? "+" + fmt(r.dotation_exercice) : "—"}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums">{fmt(r.amort_fin)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums font-bold text-blue-700 dark:text-blue-300">{fmt(r.vnc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CDTable({ label, rows, tone, emptyMsg }: { label: string; rows: NotesAnnexesData["creances"]; tone: "emerald" | "red"; emptyMsg: string }) {
  const accent = tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
  if (rows.length === 0) return <div><div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">{label}</div><EmptyState message={emptyMsg} /></div>
  return (
    <div>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${accent} mb-2`}>{label}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(r => (
            <tr key={r.compte_root + r.libelle} className="border-t border-gray-100 dark:border-white/[0.04]">
              <td className="px-2 py-1.5 text-[12px]"><span className="font-mono text-[10.5px] mr-1.5 text-gray-500">{r.compte_root}</span>{r.libelle}</td>
              <td className="px-2 py-1.5 text-right font-mono text-[12px] tabular-nums font-bold">{fmt(r.montant_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CapitauxTable({ rows }: { rows: NotesAnnexesData["capitaux_propres"] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className="text-left px-3 py-2">Poste</th>
            <th className="text-right px-3 py-2">Solde début N</th>
            <th className="text-right px-3 py-2">Variation</th>
            <th className="text-right px-3 py-2">Solde fin N</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const tone = r.variation > 0 ? "text-emerald-700 dark:text-emerald-400" : r.variation < 0 ? "text-red-700 dark:text-red-400" : "text-gray-500"
            return (
              <tr key={r.compte_root} className="border-t border-gray-100 dark:border-white/[0.04]">
                <td className="px-3 py-1.5 text-[12.5px]"><span className="font-mono text-[10.5px] mr-1.5 text-gray-500">{r.compte_root}</span>{r.libelle}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums">{fmt(r.solde_debut)}</td>
                <td className={`px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums ${tone}`}>{fmtSigne(r.variation)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums font-bold text-blue-700 dark:text-blue-300">{fmt(r.solde_fin)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
