"use client"

/**
 * Hook qui charge en parallèle caisses + comptes Boyah pour alimenter la liste
 * des destinations du wizard transfert interne (Phase 4.x Vague 1).
 *
 * Le résultat est unifié en `TransfertDestinationItem[]` avec shortCode pour
 * la pastille (WAV, MTN, SGCI, CP, …) et solde courant.
 */

import { useEffect, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TransfertDestinationItem } from "@/types/compta-ui"

type State = {
  items:   TransfertDestinationItem[]
  loading: boolean
  error:   string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): unknown[] {
  if (Array.isArray(v))      return v
  if (Array.isArray(v?.data)) return v.data
  return []
}

/**
 * Génère un short code (2-4 lettres majuscules) à partir du libellé ou du code.
 * Ex : "Wave Boyah" → "WAV", "Caisse principale siège" → "CP", "SGCI" → "SGCI".
 */
function makeShortCode(libelle: string, code: string | null): string {
  if (code) {
    // code snake_case : prendre les premières lettres de chaque token
    const tokens = code.toLowerCase().replace(/[^a-z0-9_]/g, "").split("_").filter(Boolean)
    if (tokens.length >= 2) return (tokens[0][0] + tokens[1][0]).toUpperCase()
    return code.slice(0, 4).toUpperCase()
  }
  // À partir du libellé
  const words = libelle.toUpperCase().split(/\s+/).filter(w => /[A-Z]/.test(w))
  if (words.length === 0) return libelle.slice(0, 3).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 3)
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function useDestinations() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      authFetch("/api/compta/caisses?avec_solde=true").then(r => r.ok ? r.json() : null).catch(() => null),
      authFetch("/api/compta/comptes?avec_solde=true").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([cs, co]) => {
      if (cancelled) return
      const out: TransfertDestinationItem[] = []
      for (const r of asArray(cs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        if (row.actif === false) continue
        out.push({
          id:             String(row.id),
          kind:           "caisse",
          libelle:        String(row.libelle ?? ""),
          code:           row.code ?? null,
          shortCode:      makeShortCode(String(row.libelle ?? ""), row.code ?? null),
          syscohada_code: row.compte_syscohada_code ?? null,
          solde_courant:  typeof row.solde_courant === "number" ? row.solde_courant : null,
          actif:          row.actif !== false,
        })
      }
      for (const r of asArray(co)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        if (row.actif === false) continue
        out.push({
          id:             String(row.id),
          kind:           "compte",
          libelle:        String(row.libelle ?? ""),
          code:           row.code ?? null,
          shortCode:      makeShortCode(String(row.libelle ?? ""), row.code ?? null),
          syscohada_code: row.compte_syscohada_code ?? null,
          solde_courant:  typeof row.solde_courant === "number" ? row.solde_courant : null,
          actif:          row.actif !== false,
        })
      }
      out.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "caisse" ? -1 : 1
        return a.libelle.localeCompare(b.libelle, "fr")
      })
      setState({ items: out, loading: false, error: null })
    }).catch(e => {
      if (cancelled) return
      setState({ items: [], loading: false, error: (e as Error).message })
    })
    return () => { cancelled = true }
  }, [])

  return state
}
