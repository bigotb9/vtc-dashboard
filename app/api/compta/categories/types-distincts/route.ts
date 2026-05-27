/**
 * GET /api/compta/categories/types-distincts
 *
 * Renvoie la liste des types métier distincts présents en BD pour alimenter
 * le sélecteur Type Métier (Écran 6 §4.3). Note : la BD contraint le type
 * à 10 valeurs fixes via CHECK constraint (recette, depense, apport,
 * reversement, avance, investissement, remboursement, dotation, transfert,
 * autre). On renvoie les types ACTUELLEMENT utilisés (au moins 1 catégorie)
 * + l'union avec l'ensemble fixe pour permettre la création de nouvelles
 * catégories sur n'importe quel type valide.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"

export const dynamic = "force-dynamic"

/** Ensemble figé par le CHECK constraint de la migration (Phase 1). */
const TYPES_AUTORISES = [
  "recette", "depense", "apport", "reversement", "avance",
  "investissement", "remboursement", "dotation", "transfert", "autre",
] as const

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from("categories_operations")
    .select("type")
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  // Compte les occurrences par type
  const counts = new Map<string, number>()
  for (const r of data ?? []) {
    if (!r.type) continue
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
  }

  // Liste finale : union des types autorisés + types BD, trié alphabétiquement
  const seen = new Set<string>()
  const out: { type: string; count: number; allowed: boolean }[] = []
  for (const t of TYPES_AUTORISES) {
    out.push({ type: t, count: counts.get(t) ?? 0, allowed: true })
    seen.add(t)
  }
  for (const [t, c] of counts) {
    if (!seen.has(t)) {
      // Type présent en BD mais pas dans la liste autorisée (théoriquement
      // impossible vu le CHECK constraint, mais on protège).
      out.push({ type: t, count: c, allowed: false })
    }
  }
  out.sort((a, b) => a.type.localeCompare(b.type))

  return comptaOk(out)
}
