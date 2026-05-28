/**
 * GET /api/compta/plan-comptable
 *
 * Liste complète du plan comptable SYSCOHADA (Écran 10 Phase 3) + compteurs
 * d'usage par compte (nb_caisses, nb_comptes, nb_categories) + stats globales.
 *
 * Note schéma : la colonne est `parent_code` (pas `parent`) et `type` (pas
 * `type_compte`) — on expose les deux noms pour faciliter la consommation UI.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"

export const dynamic     = "force-dynamic"
export const maxDuration = 20

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  try {
    // 1. Charger tous les comptes SYSCOHADA + tous les usages en parallèle
    const [comptesSys, caissesRefs, comptesRefs, catsRefs] = await Promise.all([
      supabaseAdmin
        .from("comptes_syscohada")
        .select("code, libelle, classe, parent_code, ordre, type, actif")
        .order("classe", { ascending: true })
        .order("ordre",  { ascending: true })
        .order("code",   { ascending: true }),
      supabaseAdmin.from("caisses").select("compte_syscohada_code").not("compte_syscohada_code", "is", null),
      supabaseAdmin.from("comptes").select("compte_syscohada_code").not("compte_syscohada_code", "is", null),
      supabaseAdmin.from("categories_operations").select("compte_syscohada_code").not("compte_syscohada_code", "is", null),
    ])

    if (comptesSys.error) return comptaError("DB_ERROR", { hint: comptesSys.error.message })

    // 2. Construire les compteurs en mémoire
    const counterCaisses    = new Map<string, number>()
    const counterComptes    = new Map<string, number>()
    const counterCategories = new Map<string, number>()
    for (const r of caissesRefs.data ?? []) {
      const c = r.compte_syscohada_code
      if (c) counterCaisses.set(c, (counterCaisses.get(c) ?? 0) + 1)
    }
    for (const r of comptesRefs.data ?? []) {
      const c = r.compte_syscohada_code
      if (c) counterComptes.set(c, (counterComptes.get(c) ?? 0) + 1)
    }
    for (const r of catsRefs.data ?? []) {
      const c = r.compte_syscohada_code
      if (c) counterCategories.set(c, (counterCategories.get(c) ?? 0) + 1)
    }

    // 3. Mapper la réponse
    const comptes = (comptesSys.data ?? []).map(c => {
      const nbCaisses    = counterCaisses.get(c.code)    ?? 0
      const nbComptes    = counterComptes.get(c.code)    ?? 0
      const nbCategories = counterCategories.get(c.code) ?? 0
      return {
        code:           c.code,
        libelle:        c.libelle,
        classe:         c.classe,
        parent:         c.parent_code ?? null,
        ordre:          c.ordre ?? 0,
        type_compte:    c.type ?? null,
        actif:          !!c.actif,
        nb_caisses:     nbCaisses,
        nb_comptes:     nbComptes,
        nb_categories:  nbCategories,
        total_usage:    nbCaisses + nbComptes + nbCategories,
      }
    })

    // 4. Stats globales
    const total      = comptes.length
    const nbUtilises = comptes.filter(c => c.total_usage > 0).length
    const classesSet = new Set(comptes.map(c => c.classe))
    const stats = {
      total_comptes:     total,
      nb_utilises:       nbUtilises,
      nb_disponibles:    total - nbUtilises,
      classes_presentes: Array.from(classesSet).sort((a, b) => a - b),
    }

    return comptaOk({ stats, comptes })
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
