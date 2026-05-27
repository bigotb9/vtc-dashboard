"use client"

/**
 * /comptabilite/comptes-caisses — Écran 5 Phase 3 (liste).
 *
 * Vue cartes en grille de toutes les caisses + comptes bancaires. KPIs
 * globaux + filter tabs (Tout / Caisses / Comptes / Actifs).
 *
 * State sync via URL ?filter=…
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ComptesCaissesHeader } from "@/components/compta/ComptesCaissesHeader"
import { ComptesCaissesKpis } from "@/components/compta/ComptesCaissesKpis"
import { ComptesCaissesFilterTabs } from "@/components/compta/ComptesCaissesFilterTabs"
import { CompteCaisseCard } from "@/components/compta/CompteCaisseCard"
import { useComptesCaissesList } from "@/hooks/compta/useComptesCaissesList"
import type { ComptesCaissesFilter } from "@/types/compta-ui"

export default function ComptesCaissesListPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { items, loading, error, refetch } = useComptesCaissesList()

  const filter: ComptesCaissesFilter = useMemo(() => {
    const f = params.get("filter")
    return f === "caisses" || f === "comptes" || f === "actifs" ? f : "tout"
  }, [params])

  const setFilter = useCallback((next: ComptesCaissesFilter) => {
    const qs = next === "tout" ? "" : `?filter=${next}`
    router.replace(`/comptabilite/comptes-caisses${qs}`)
  }, [router])

  // Filtrage côté client
  const filtered = useMemo(() => {
    switch (filter) {
      case "caisses": return items.filter(i => i.type_cible === "caisse")
      case "comptes": return items.filter(i => i.type_cible === "compte")
      case "actifs":  return items.filter(i => i.actif)
      default:        return items
    }
  }, [items, filter])

  const counts = useMemo(() => ({
    tout:    items.length,
    caisses: items.filter(i => i.type_cible === "caisse").length,
    comptes: items.filter(i => i.type_cible === "compte").length,
    actifs:  items.filter(i => i.actif).length,
  }), [items])

  // Données pour le header
  const headerData = useMemo(() => {
    const caissesAll = items.filter(i => i.type_cible === "caisse")
    const comptesAll = items.filter(i => i.type_cible === "compte")
    const tresorerie = items.reduce((s, i) => s + (i.solde ?? 0), 0)
    return {
      nbCaisses:        caissesAll.length,
      nbComptes:        comptesAll.length,
      tresorerieTotale: tresorerie,
    }
  }, [items])

  const caissesShown = filtered.filter(i => i.type_cible === "caisse")
  const comptesShown = filtered.filter(i => i.type_cible === "compte")

  return (
    <div className="space-y-5">
      <ComptesCaissesHeader {...headerData} />

      <ComptesCaissesKpis items={items} loading={loading} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ComptesCaissesFilterTabs value={filter} counts={counts} onChange={setFilter} />
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {filtered.length} élément{filtered.length > 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[160px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-dashed border-gray-300 dark:border-white/[0.10] p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucun élément correspondant.
          </p>
          <Link
            href="/comptabilite/comptes-caisses/nouveau"
            className="inline-block mt-3 text-violet-600 dark:text-violet-400 underline text-sm font-semibold"
          >
            Créer un nouvel élément
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {(filter === "tout" || filter === "caisses" || filter === "actifs") && caissesShown.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-2.5">
                Caisses ({caissesShown.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {caissesShown.map(i => <CompteCaisseCard key={i.id} item={i} />)}
              </div>
            </section>
          )}
          {(filter === "tout" || filter === "comptes" || filter === "actifs") && comptesShown.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-2.5">
                Comptes bancaires ({comptesShown.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {comptesShown.map(i => <CompteCaisseCard key={i.id} item={i} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
