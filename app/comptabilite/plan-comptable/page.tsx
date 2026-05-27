"use client"

/**
 * /comptabilite/plan-comptable — Écran 10 Phase 3 (DERNIER écran).
 *
 * Plan comptable SYSCOHADA en lecture seule. Sections accordéon par classe
 * (fermées par défaut sauf si un filtre classe est appliqué). Filtres tabs +
 * recherche. Modal détail au click. Export CSV + Impression.
 */

export const dynamic = "force-dynamic"

import { useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PlanComptableHeader } from "@/components/compta/PlanComptableHeader"
import { PlanComptableKpis } from "@/components/compta/PlanComptableKpis"
import { PlanComptableFilters } from "@/components/compta/PlanComptableFilters"
import { PlanClasseSection } from "@/components/compta/PlanClasseSection"
import { PlanCompteDetailModal } from "@/components/compta/PlanCompteDetailModal"
import { usePlanComptable } from "@/hooks/compta/usePlanComptable"
import { ALL_CLASSES, type SyscoClasse } from "@/components/compta/planComptableConstants"
import { exportPlanComptableCsv } from "@/lib/compta/exportCsv"
import { toast } from "@/lib/toast"
import type { PlanCompteRow, PlanComptableClasseFilter } from "@/types/compta-ui"

export default function PlanComptablePage() {
  const router = useRouter()
  const params = useSearchParams()

  const { data, loading, error, refetch } = usePlanComptable()

  // État filtres dérivé de l'URL
  const classe: PlanComptableClasseFilter = useMemo(() => {
    const c = params.get("classe")
    if (!c) return "all"
    if (c === "all" || (Number(c) >= 1 && Number(c) <= 9)) return c as PlanComptableClasseFilter
    return "all"
  }, [params])
  const search = params.get("search") ?? ""

  function updateUrl(updates: { classe?: PlanComptableClasseFilter; search?: string }) {
    const p = new URLSearchParams()
    const nextClasse = updates.classe  ?? classe
    const nextSearch = updates.search  ?? search
    if (nextClasse !== "all") p.set("classe", nextClasse)
    if (nextSearch)           p.set("search", nextSearch)
    const qs = p.toString()
    router.replace(`/comptabilite/plan-comptable${qs ? "?" + qs : ""}`)
  }

  // Modal détail
  const [detailCode, setDetailCode] = useState<string | null>(null)

  // État ouvert/fermé par classe (state local).
  // Logique : la classe sélectionnée via le filtre s'ouvre AUTOMATIQUEMENT.
  const [openOverrides, setOpenOverrides] = useState<Partial<Record<SyscoClasse, boolean>>>({})

  function isOpen(c: SyscoClasse): boolean {
    // Si classe filtrée → ouvert (sauf override explicite à false)
    if (classe !== "all" && classe === String(c)) {
      return openOverrides[c] !== false
    }
    return openOverrides[c] === true
  }
  function toggleOpen(c: SyscoClasse) {
    setOpenOverrides(prev => ({ ...prev, [c]: !isOpen(c) }))
  }

  // Filtrage côté client
  const filteredAll = useMemo(() => {
    if (!data) return [] as PlanCompteRow[]
    const q = search.trim().toLowerCase()
    return data.comptes.filter(c => {
      if (q && !c.code.toLowerCase().includes(q) && !c.libelle.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search])

  // Compteurs par classe (du dataset complet — pour les pills filtre)
  const countsByClasse = useMemo(() => {
    const out: Record<number, number> = {}
    if (!data) return out
    for (const c of data.comptes) {
      out[c.classe] = (out[c.classe] ?? 0) + 1
    }
    return out
  }, [data])

  // Regroupement par classe pour rendu
  const rowsByClasse = useMemo(() => {
    const out: Record<number, PlanCompteRow[]> = {}
    for (const r of filteredAll) {
      const list = out[r.classe] ?? []
      list.push(r)
      out[r.classe] = list
    }
    return out
  }, [filteredAll])

  const classesToRender = useMemo<SyscoClasse[]>(() => {
    if (classe === "all") return ALL_CLASSES
    const c = Number(classe) as SyscoClasse
    return [c]
  }, [classe])

  const handlePick = useCallback((row: PlanCompteRow) => {
    setDetailCode(row.code)
  }, [])

  const handleExportCsv = useCallback(() => {
    if (filteredAll.length === 0) {
      toast.error("Aucun compte à exporter")
      return
    }
    exportPlanComptableCsv(filteredAll)
    toast.success(`Export CSV · ${filteredAll.length} lignes`)
  }, [filteredAll])

  const handlePrint = useCallback(() => {
    // Force l'ouverture de toutes les classes visibles avant impression
    // (CSS print s'occupe du reste).
    setTimeout(() => window.print(), 50)
  }, [])

  return (
    <div className="space-y-5">
      <PlanComptableHeader
        nbClasses={data?.stats.classes_presentes.length ?? 0}
        nbComptes={data?.stats.total_comptes ?? 0}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
      />

      <PlanComptableKpis stats={data?.stats ?? null} loading={loading} />

      <PlanComptableFilters
        classe={classe}
        search={search}
        countsByClasse={countsByClasse}
        onClasseChange={c => updateUrl({ classe: c })}
        onSearchChange={s => updateUrl({ search: s })}
        onReset={() => router.replace("/comptabilite/plan-comptable")}
      />

      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[70px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filteredAll.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-dashed border-gray-300 dark:border-white/[0.10] p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucun compte correspondant aux filtres.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {classesToRender.map(c => {
            const rows = rowsByClasse[c] ?? []
            if (rows.length === 0 && classe !== "all") return null
            if (rows.length === 0) return null
            return (
              <PlanClasseSection
                key={c}
                classe={c}
                rows={rows}
                open={isOpen(c)}
                onToggle={() => toggleOpen(c)}
                onPick={handlePick}
              />
            )
          })}
        </div>
      )}

      <PlanCompteDetailModal
        code={detailCode}
        onClose={() => setDetailCode(null)}
      />
    </div>
  )
}
