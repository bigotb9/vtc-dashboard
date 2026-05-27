"use client"

/**
 * Hook qui charge en parallèle toutes les listes de référence nécessaires au
 * formulaire de saisie d'opération (Écran 4 Phase 3) :
 *  - caisses (GET /api/compta/caisses?avec_solde=true)
 *  - comptes bancaires (GET /api/compta/comptes?avec_solde=true)
 *    → fusionnés en une seule liste `caisses_comptes` triée
 *  - catégories filtrées par `sens` (corrélé au type) :
 *      type='entree' → sens='credit'
 *      type='sortie' → sens='debit'
 *  - véhicules / chauffeurs / clients pour les selects "Liens métier"
 *
 * Référence : doc Phase 3 Écran 4 §4.5.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type {
  CaisseRefForm,
  CategorieForm,
  VehiculeFormRef,
  ChauffeurFormRef,
  ClientFormRef,
  FormReferences,
  TypeOperation,
} from "@/types/compta-ui"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): unknown[] {
  if (Array.isArray(v)) return v
  if (Array.isArray(v?.data)) return v.data
  if (Array.isArray(v?.clients)) return v.clients
  if (Array.isArray(v?.vehicules)) return v.vehicules
  if (Array.isArray(v?.chauffeurs)) return v.chauffeurs
  return []
}

type State = {
  refs:     FormReferences | null
  loading:  boolean
  error:    string | null
}

export function useFormReferences(type: TypeOperation) {
  const [state, setState] = useState<State>({ refs: null, loading: true, error: null })
  // On charge UNE FOIS les "static" refs (caisses, comptes, vehicules, chauffeurs, clients)
  // et on refilter les catégories quand `type` change.
  const staticLoaded = useRef(false)
  const staticDataRef = useRef<Omit<FormReferences, "categories"> | null>(null)

  const reload = useCallback(async (typeForCats: TypeOperation) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const sens = typeForCats === "entree" ? "credit" : "debit"
      // Capturer l'état pour éviter race condition StrictMode
      const wasStaticLoaded = staticLoaded.current

      // Promises lancées en parallèle.
      const promises: Promise<Response>[] = []
      if (!wasStaticLoaded) {
        promises.push(
          authFetch("/api/compta/caisses?avec_solde=true"),
          authFetch("/api/compta/comptes?avec_solde=true"),
          authFetch("/api/vehicules/list"),
          authFetch("/api/chauffeurs/list"),
          authFetch("/api/clients/list"),
        )
      }
      promises.push(authFetch(`/api/compta/categories?sens=${sens}&actif=true`))

      const responses = await Promise.all(promises)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonAll: any[] = await Promise.all(responses.map(r => r.json().catch(() => null)))

      let caissesRaw: unknown[]    = []
      let comptesRaw: unknown[]    = []
      let vehiculesRaw: unknown[]  = []
      let chauffeursRaw: unknown[] = []
      let clientsRaw: unknown[]    = []
      let categoriesRaw: unknown[] = []

      if (!wasStaticLoaded) {
        caissesRaw    = asArray(jsonAll[0])
        comptesRaw    = asArray(jsonAll[1])
        vehiculesRaw  = asArray(jsonAll[2])
        chauffeursRaw = asArray(jsonAll[3])
        clientsRaw    = asArray(jsonAll[4])
        categoriesRaw = asArray(jsonAll[5])
      } else {
        categoriesRaw = asArray(jsonAll[0])
      }

      // Mapping caisses
      const caisses: CaisseRefForm[] = caissesRaw.map(r => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        return {
          id:                       String(row.id),
          libelle:                  String(row.libelle ?? ""),
          code:                     row.code ?? null,
          type_cible:               "caisse" as const,
          compte_syscohada_code:    row.compte_syscohada_code ?? null,
          compte_syscohada_libelle: row.compte_syscohada_libelle ?? null,
          solde_courant:            row.solde_courant != null ? Number(row.solde_courant) : null,
          actif:                    !!row.actif,
        }
      })

      // Mapping comptes
      const comptes: CaisseRefForm[] = comptesRaw.map(r => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        return {
          id:                       String(row.id),
          libelle:                  String(row.libelle ?? ""),
          code:                     row.code ?? null,
          type_cible:               "compte" as const,
          compte_syscohada_code:    row.compte_syscohada_code ?? null,
          compte_syscohada_libelle: row.compte_syscohada_libelle ?? null,
          solde_courant:            row.solde_courant != null ? Number(row.solde_courant) : null,
          actif:                    !!row.actif,
        }
      })

      // Fusion + tri : caisses d'abord, puis comptes, alpha par libellé dans chaque groupe.
      const caisses_comptes = [...caisses, ...comptes].sort((a, b) => {
        if (a.type_cible !== b.type_cible) return a.type_cible === "caisse" ? -1 : 1
        return a.libelle.localeCompare(b.libelle, "fr")
      })

      const vehicules: VehiculeFormRef[] = vehiculesRaw.map(v => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = v as any
        return {
          id:               Number(row.id_vehicule ?? row.id),
          immatriculation:  row.immatriculation ?? null,
          type_vehicule:    row.type_vehicule ?? null,
        }
      })

      const chauffeurs: ChauffeurFormRef[] = chauffeursRaw.map(c => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = c as any
        return {
          id:    Number(row.id_chauffeur ?? row.id),
          nom:   row.nom ?? null,
          actif: row.actif !== false,
        }
      })

      const clients: ClientFormRef[] = clientsRaw.map(c => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = c as any
        return {
          id:  Number(row.id),
          nom: row.nom ?? null,
        }
      })

      const categories: CategorieForm[] = categoriesRaw.map(c => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = c as any
        return {
          id:                       String(row.id),
          libelle:                  String(row.libelle ?? ""),
          type:                     String(row.type ?? ""),
          sens:                     row.sens ?? null,
          compte_syscohada_code:    row.compte_syscohada_code ?? null,
          compte_syscohada_libelle: row.compte_syscohada_libelle ?? null,
          journal_par_defaut:       row.journal_par_defaut ?? null,
          actif:                    !!row.actif,
          mapping_complet:          !!row.mapping_complet,
        }
      })

      if (!wasStaticLoaded) {
        staticLoaded.current = true
        staticDataRef.current = { caisses_comptes, vehicules, chauffeurs, clients }
      }

      const refs: FormReferences = {
        caisses_comptes: staticDataRef.current!.caisses_comptes,
        vehicules:       staticDataRef.current!.vehicules,
        chauffeurs:      staticDataRef.current!.chauffeurs,
        clients:         staticDataRef.current!.clients,
        categories,
      }

      setState({ refs, loading: false, error: null })
    } catch (e) {
      setState({ refs: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    reload(type)
  }, [type, reload])

  return state
}
