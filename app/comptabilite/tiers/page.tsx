"use client"

/**
 * /comptabilite/tiers — Liste des tiers (Phase 4.x Vague 2 §3.2).
 *
 * État dans l'URL : ?type=fournisseur&q=garage&actifs_only=false&page=2
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { TiersHeader } from "@/components/compta/TiersHeader"
import { TiersKpis } from "@/components/compta/TiersKpis"
import { TiersFilters } from "@/components/compta/TiersFilters"
import { TiersTable } from "@/components/compta/TiersTable"
import { useTiersList } from "@/hooks/compta/useTiersList"
import type { TiersFilters as TiersFiltersT, TiersType } from "@/types/compta-ui"

const ROUTE = "/comptabilite/tiers"

function readFiltersFromUrl(p: URLSearchParams): TiersFiltersT {
  const t = p.get("type")
  const type = (t === "client" || t === "fournisseur" || t === "salarie" || t === "autre")
    ? (t as TiersType) : "tout"
  return {
    type,
    q: p.get("q") ?? "",
    actifs_only: p.get("actifs_only") !== "false",
    page:        Math.max(1, parseInt(p.get("page")      ?? "1",  10)),
    page_size:   Math.max(1, parseInt(p.get("page_size") ?? "50", 10)),
  }
}

function writeFiltersToUrl(f: TiersFiltersT): string {
  const p = new URLSearchParams()
  if (f.type && f.type !== "tout") p.set("type", f.type)
  if (f.q)                          p.set("q",    f.q)
  if (f.actifs_only === false)      p.set("actifs_only", "false")
  if (f.page && f.page !== 1)       p.set("page", String(f.page))
  if (f.page_size && f.page_size !== 50) p.set("page_size", String(f.page_size))
  return p.toString()
}

export default function TiersListPage() {
  const router = useRouter()
  const params = useSearchParams()
  const filters = useMemo(() => readFiltersFromUrl(params), [params])

  const update = useCallback((next: TiersFiltersT) => {
    const qs = writeFiltersToUrl(next)
    router.replace(`${ROUTE}${qs ? "?" + qs : ""}`)
  }, [router])

  const { data, loading, error, refetch } = useTiersList(filters)

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Tiers</span>
      </nav>

      <TiersHeader totalActifs={data?.kpis.total} />
      <TiersKpis kpis={data?.kpis ?? null} loading={loading} />

      <TiersFilters
        type={filters.type ?? "tout"}
        q={filters.q ?? ""}
        actifsOnly={filters.actifs_only ?? true}
        onTypeChange={t       => update({ ...filters, type: t, page: 1 })}
        onSearchChange={q     => update({ ...filters, q, page: 1 })}
        onActifsToggle={b     => update({ ...filters, actifs_only: b, page: 1 })}
        onReset={()           => router.replace(ROUTE)}
      />

      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      <TiersTable rows={data?.data ?? []} loading={loading} />

      {data && data.total > (data.page_size ?? 50) && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Affichage page {data.page} · {data.data.length} sur {data.total}
        </div>
      )}
    </div>
  )
}
