"use client"

/**
 * Hook de fetch de la liste des catégories avec stats agrégées + filtres.
 * Référence : doc Phase 3 Écran 6 §2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { CategorieListItem, CategorieSensFilter } from "@/types/compta-ui"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): unknown[] {
  if (Array.isArray(v)) return v
  if (Array.isArray(v?.data)) return v.data
  return []
}

export interface UseCategoriesListOpts {
  /** Si fournie, applique côté serveur. */
  sens?:         CategorieSensFilter
  /** Filtre type métier. */
  type?:         string
  /** Inclure les inactives ? défaut false. */
  inactives?:    boolean
}

type State = {
  items:   CategorieListItem[]
  loading: boolean
  error:   string | null
}

export function useCategoriesList(opts: UseCategoriesListOpts = {}) {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })
  const requestIdRef = useRef(0)

  const key = useMemo(() => JSON.stringify(opts), [opts])

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const p = new URLSearchParams()
      p.set("avec_stats", "true")
      if (opts.sens === "entrees") p.set("sens", "credit")
      if (opts.sens === "sorties") p.set("sens", "debit")
      if (opts.type) p.set("type", opts.type)
      if (!opts.inactives) p.set("actif", "true")

      const res = await authFetch(`/api/compta/categories?${p.toString()}`)
      const json = await res.json().catch(() => null)
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ items: [], loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      const list = asArray(json).map(r => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        return {
          id:                       String(row.id),
          libelle:                  String(row.libelle ?? ""),
          type:                     String(row.type ?? ""),
          sens:                     row.sens ?? null,
          compte_syscohada_code:    row.compte_syscohada_code ?? null,
          compte_syscohada_libelle: row.compte_syscohada_libelle ?? null,
          compte_syscohada_classe:  row.compte_syscohada_classe ?? null,
          journal_par_defaut:       row.journal_par_defaut ?? null,
          journal_libelle:          row.journal_libelle ?? null,
          description:              row.description ?? null,
          actif:                    !!row.actif,
          ordre:                    Number(row.ordre ?? 0),
          created_at:               row.created_at ?? null,
          mapping_complet:          !!row.mapping_complet,
          nb_operations:            Number(row.nb_operations ?? 0),
          volume_total:             Number(row.volume_total ?? 0),
        }
      }) as CategorieListItem[]
      setState({ items: list, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ items: [], loading: false, error: (e as Error).message })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
