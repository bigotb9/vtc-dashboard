"use client"

/**
 * /comptabilite/categories — Écran 6 Phase 3 (liste).
 *
 * Vue hybride : sections par sens (Entrées / Sorties) avec tables compactes.
 * Filtres : tabs sens, select type, recherche, toggle inactives.
 * State synchronisé avec URL ?sens=…&type=…&search=…&inactives=…
 */

export const dynamic = "force-dynamic"

import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CategoriesHeader } from "@/components/compta/CategoriesHeader"
import { CategoriesKpis } from "@/components/compta/CategoriesKpis"
import { CategoriesFilterBar } from "@/components/compta/CategoriesFilterBar"
import { CategoriesSection } from "@/components/compta/CategoriesSection"
import { useCategoriesList } from "@/hooks/compta/useCategoriesList"
import type { CategorieSensFilter } from "@/types/compta-ui"

export default function CategoriesListPage() {
  const router = useRouter()
  const params = useSearchParams()

  // Lecture URL
  const sens: CategorieSensFilter = useMemo(() => {
    const s = params.get("sens")
    return s === "entrees" || s === "sorties" ? s : "tout"
  }, [params])
  const type      = params.get("type") ?? ""
  const search    = params.get("search") ?? ""
  const inactives = params.get("inactives") === "true"

  // Push URL
  const updateUrl = useCallback((updates: { sens?: CategorieSensFilter; type?: string; search?: string; inactives?: boolean }) => {
    const p = new URLSearchParams()
    const nextSens     = updates.sens     ?? sens
    const nextType     = updates.type     ?? type
    const nextSearch   = updates.search   ?? search
    const nextInact    = updates.inactives ?? inactives
    if (nextSens !== "tout") p.set("sens", nextSens)
    if (nextType)            p.set("type", nextType)
    if (nextSearch)          p.set("search", nextSearch)
    if (nextInact)           p.set("inactives", "true")
    const qs = p.toString()
    router.replace(`/comptabilite/categories${qs ? "?" + qs : ""}`)
  }, [sens, type, search, inactives, router])

  // Fetch (le sens et inactives filtrent côté serveur ; type & search côté client)
  const { items, loading, error, refetch } = useCategoriesList({
    sens,
    inactives,
    // type filtré côté client pour éviter un rechargement à chaque changement
  })

  // Filtres locaux
  const filtered = useMemo(() => {
    let xs = items
    if (type)   xs = xs.filter(c => c.type === type)
    if (search) {
      const q = search.toLowerCase()
      xs = xs.filter(c => c.libelle.toLowerCase().includes(q))
    }
    return xs
  }, [items, type, search])

  const entrees = useMemo(() => filtered.filter(c => c.sens === "credit"), [filtered])
  const sorties = useMemo(() => filtered.filter(c => c.sens === "debit"),  [filtered])

  // Compteurs
  const counts = useMemo(() => ({
    tout:    items.length,
    entrees: items.filter(c => c.sens === "credit").length,
    sorties: items.filter(c => c.sens === "debit").length,
  }), [items])

  // Types disponibles dans la liste actuelle (pour le select)
  const typesAvailable = useMemo(() => {
    const set = new Set<string>()
    items.forEach(c => set.add(c.type))
    return Array.from(set).sort()
  }, [items])

  // Header data
  const headerData = useMemo(() => {
    const actives    = items.filter(c => c.actif)
    return {
      nbActives:     actives.length,
      nbEntrees:     actives.filter(c => c.sens === "credit").length,
      nbSorties:     actives.filter(c => c.sens === "debit").length,
      nbAvecMapping: items.filter(c => c.mapping_complet).length,
      nbTotal:       items.length,
    }
  }, [items])

  return (
    <div className="space-y-5">
      <CategoriesHeader {...headerData} />
      <CategoriesKpis items={items} loading={loading} />

      <CategoriesFilterBar
        sens={sens}
        type={type}
        search={search}
        inactives={inactives}
        typesAvailable={typesAvailable}
        counts={counts}
        onSensChange={s   => updateUrl({ sens: s })}
        onTypeChange={t   => updateUrl({ type: t })}
        onSearchChange={s => updateUrl({ search: s })}
        onInactivesChange={v => updateUrl({ inactives: v })}
        onReset={() => router.replace("/comptabilite/categories")}
      />

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-[220px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-dashed border-gray-300 dark:border-white/[0.10] p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucune catégorie correspondant aux filtres.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(sens === "tout" || sens === "entrees") && entrees.length > 0 && (
            <CategoriesSection sens="credit" rows={entrees} />
          )}
          {(sens === "tout" || sens === "sorties") && sorties.length > 0 && (
            <CategoriesSection sens="debit"  rows={sorties} />
          )}
        </div>
      )}
    </div>
  )
}
