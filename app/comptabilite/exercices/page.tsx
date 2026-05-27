"use client"

/**
 * /comptabilite/exercices — Liste + workflow clôture (Phase 4.2 Module 2 §3.2).
 *
 * - Card par exercice avec statut + KPIs
 * - Bouton "Nouvel exercice" (pré-rempli année suivante)
 * - Bouton "Clôturer" si statut='ouvert' (ouvre ClotureModal)
 * - Badge "Clos" + bouton "Voir les états archivés" sinon
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Calendar, Plus, Loader2, Lock, Unlock, FileText, FileBarChart2 } from "lucide-react"
import { ClotureModal } from "@/components/compta/exercices/ClotureModal"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { ExerciceItem } from "@/types/compta-ui"

function formatF(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}

export default function ExercicesPage() {
  const [items,   setItems]   = useState<ExerciceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [clotureTarget, setClotureTarget] = useState<ExerciceItem | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch("/api/compta/exercices")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string })?.error ?? `HTTP ${res.status}`); return
      }
      setItems(((json as { data: ExerciceItem[] }).data ?? []) as ExerciceItem[])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { refetch() }, [refetch])

  async function handleNewExercice() {
    const maxAnnee = items.length > 0 ? Math.max(...items.map(i => i.annee)) : new Date().getFullYear() - 1
    const nextAnnee = maxAnnee + 1
    setCreating(true)
    try {
      const res = await authFetch("/api/compta/exercices", {
        method: "POST",
        body:   JSON.stringify({ annee: nextAnnee }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((json as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      toast.success(`Exercice ${nextAnnee} créé`)
      await refetch()
    } finally {
      setCreating(false)
    }
  }

  async function handleCloturer(exercice: ExerciceItem) {
    const res = await authFetch(`/api/compta/exercices/${exercice.id}/cloturer`, { method: "POST" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error((json as { error?: string })?.error ?? `HTTP ${res.status}`)
      return
    }
    const d = (json as { data: { resultat_net: number } }).data
    toast.success(`Exercice ${exercice.annee} clôturé · Résultat net ${formatF(d.resultat_net)} F`)
    setClotureTarget(null)
    await refetch()
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Exercices</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <Calendar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
              Exercices comptables
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Gestion des périodes annuelles. La clôture verrouille définitivement les écritures.
            </p>
          </div>
        </div>
        <button
          type="button" onClick={handleNewExercice} disabled={creating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/25 transition disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Nouvel exercice
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Aucun exercice configuré.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(e => {
          const isOpen = e.statut === "ouvert"
          return (
            <div key={e.id} className={`rounded-2xl border bg-white dark:bg-white/[0.02] p-4 ${
              isOpen ? "border-emerald-500/30" : "border-gray-200/70 dark:border-white/[0.06]"
            }`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white tabular-nums">
                      {e.libelle}
                    </h3>
                    {isOpen ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30">
                        <Unlock size={9} /> Ouvert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 ring-1 ring-gray-300 dark:ring-white/[0.1]">
                        <Lock size={9} /> Clos
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1">
                    {e.date_debut} → {e.date_fin}
                  </div>
                </div>
                {isOpen ? (
                  <button
                    type="button"
                    onClick={() => setClotureTarget(e)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Lock size={11} /> Clôturer
                  </button>
                ) : (
                  <Link
                    href={`/comptabilite/etats-financiers/bilan?exercice_id=${e.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition"
                  >
                    <FileBarChart2 size={11} /> États financiers
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <Cell label="Opérations" value={e.nb_operations.toString()} accent="indigo" />
                <Cell
                  label="Brouillons"
                  value={e.nb_brouillons.toString()}
                  accent={e.nb_brouillons > 0 ? "amber" : "gray"}
                />
                <Cell
                  label="Résultat net"
                  value={e.resultat_net != null
                    ? `${e.resultat_net >= 0 ? "+" : "−"}${formatF(e.resultat_net)} F`
                    : "—"}
                  accent={(e.resultat_net ?? 0) >= 0 ? "emerald" : "red"}
                />
              </div>

              {!isOpen && e.date_cloture && (
                <div className="mt-2 text-[10.5px] text-gray-400 italic">
                  Clôturé le {new Date(e.date_cloture).toLocaleDateString("fr-FR")}
                  {e.cloture_par_name && ` par ${e.cloture_par_name}`}
                </div>
              )}

              {!isOpen && (e.bilan_pdf_path || e.cr_pdf_path) && (
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <FileText size={11} className="text-gray-400" />
                  <span className="text-gray-500">PDF archivés</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ClotureModal
        open={!!clotureTarget}
        exercice={clotureTarget}
        onClose={() => setClotureTarget(null)}
        onConfirm={() => clotureTarget ? handleCloturer(clotureTarget) : Promise.resolve()}
      />
    </div>
  )
}

const ACCENT_BG: Record<string, string> = {
  indigo:  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red:     "bg-red-500/10 text-red-700 dark:text-red-400",
  amber:   "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  gray:    "bg-gray-500/10 text-gray-700 dark:text-gray-300",
}

function Cell({ label, value, accent }: { label: string; value: string; accent: keyof typeof ACCENT_BG }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${ACCENT_BG[accent]}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-mono tabular-nums font-bold mt-0.5">{value}</div>
    </div>
  )
}
