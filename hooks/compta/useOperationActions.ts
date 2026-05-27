"use client"

/**
 * Hook d'actions sur une opération (valider / annuler / supprimer).
 * Référence : doc Phase 3 Écran 2 §5.2.
 *
 * Chaque action :
 *   - met `loading` à true le temps de l'appel
 *   - capture l'erreur si elle survient (sans afficher de toast — c'est à
 *     la page de gérer)
 *   - retourne true en cas de succès, false sinon
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"

type State = {
  loading: false | "valider" | "annuler" | "supprimer"
  error:   string | null
}

export function useOperationActions(id: string) {
  const [state, setState] = useState<State>({ loading: false, error: null })

  const call = useCallback(async (
    method: "POST" | "DELETE",
    url:    string,
    body?:  Record<string, unknown>,
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status: number }> => {
    try {
      const res = await authFetch(url, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: (json as { error?: string }).error ?? `HTTP ${res.status}`, status: res.status }
      }
      return { ok: true, data: json.data }
    } catch (e) {
      return { ok: false, error: (e as Error).message, status: 0 }
    }
  }, [])

  const valider = useCallback(async (): Promise<boolean> => {
    setState({ loading: "valider", error: null })
    const r = await call("POST", `/api/compta/operations/${id}/valider`)
    if (r.ok) { setState({ loading: false, error: null }); return true }
    setState({ loading: false, error: r.error })
    return false
  }, [call, id])

  const annuler = useCallback(async (raison?: string): Promise<boolean> => {
    setState({ loading: "annuler", error: null })
    const r = await call("POST", `/api/compta/operations/${id}/annuler`, raison ? { raison } : undefined)
    if (r.ok) { setState({ loading: false, error: null }); return true }
    setState({ loading: false, error: r.error })
    return false
  }, [call, id])

  const supprimer = useCallback(async (): Promise<boolean> => {
    setState({ loading: "supprimer", error: null })
    const r = await call("DELETE", `/api/compta/operations/${id}`)
    if (r.ok) { setState({ loading: false, error: null }); return true }
    setState({ loading: false, error: r.error })
    return false
  }, [call, id])

  return { ...state, valider, annuler, supprimer }
}
