"use client"

/**
 * Hook qui fusionne GET /api/compta/caisses + GET /api/compta/comptes en
 * une seule liste pour l'Écran 5 (liste Comptes & Caisses).
 *
 * Référence : doc Phase 3 Écran 5 §2.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { ComptesCaissesListItem } from "@/types/compta-ui"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): unknown[] {
  if (Array.isArray(v)) return v
  if (Array.isArray(v?.data)) return v.data
  return []
}

type State = {
  items:   ComptesCaissesListItem[]
  loading: boolean
  error:   string | null
}

export function useComptesCaissesList() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const [resCaisses, resComptes] = await Promise.all([
        authFetch("/api/compta/caisses?avec_solde=true"),
        authFetch("/api/compta/comptes?avec_solde=true"),
      ])
      const [jsonCaisses, jsonComptes] = await Promise.all([
        resCaisses.json().catch(() => null),
        resComptes.json().catch(() => null),
      ])
      if (reqId !== requestIdRef.current) return

      const caisses = asArray(jsonCaisses).map(r => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        return {
          id:                       String(row.id),
          libelle:                  String(row.libelle ?? ""),
          code:                     row.code ?? null,
          type_cible:               "caisse" as const,
          type:                     row.type ?? null,
          operateur:                row.operateur ?? null,
          banque:                   null,
          compte_syscohada_code:    row.compte_syscohada_code ?? null,
          compte_syscohada_libelle: row.compte_syscohada_libelle ?? null,
          actif:                    !!row.actif,
          solde:                    row.solde_courant != null ? Number(row.solde_courant) : null,
          derniere_operation:       row.derniere_operation ?? null,
          nb_mouvements:            0, // pas fourni par la liste, calculé côté détail
        }
      }) as ComptesCaissesListItem[]

      const comptes = asArray(jsonComptes).map(r => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        return {
          id:                       String(row.id),
          libelle:                  String(row.libelle ?? ""),
          code:                     row.code ?? null,
          type_cible:               "compte" as const,
          type:                     null,
          operateur:                null,
          banque:                   row.banque ?? null,
          compte_syscohada_code:    row.compte_syscohada_code ?? null,
          compte_syscohada_libelle: row.compte_syscohada_libelle ?? null,
          actif:                    !!row.actif,
          solde:                    row.solde_courant != null ? Number(row.solde_courant) : null,
          derniere_operation:       row.derniere_operation ?? null,
          nb_mouvements:            0,
        }
      }) as ComptesCaissesListItem[]

      // Tri : actifs avant inactifs, puis alpha
      const all = [...caisses, ...comptes].sort((a, b) => {
        if (a.actif !== b.actif) return a.actif ? -1 : 1
        return a.libelle.localeCompare(b.libelle, "fr")
      })

      setState({ items: all, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ items: [], loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
