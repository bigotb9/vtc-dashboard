/**
 * POST /api/compta/reprise/recettes-wave
 *
 * Réingestion incrémentale des recettes Wave (lecture versement_attribution).
 * Idempotent grâce à UNIQUE(source, source_ref). Réservé directeur.
 * Référence : doc Phase 2 Day 7 §3.3.
 *
 * Body (optionnel) :
 *   { date_from?: "YYYY-MM-DD", date_to?: "YYYY-MM-DD", generer_ecritures?: bool }
 *
 * Pré-requis : bootstrap doit avoir été exécuté (premier_login_effectue=true).
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { repriseSchema, safeParse } from "@/lib/compta/validators"
import { repriseRecettesWave } from "@/lib/compta/reprise"

export const dynamic     = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  // Body optionnel
  let payload: unknown = {}
  try {
    const txt = await req.text()
    if (txt && txt.trim().length > 0) payload = JSON.parse(txt)
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }
  const parsed = safeParse(repriseSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  // Vérification bootstrap
  const { data: param } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("premier_login_effectue")
    .eq("id", 1)
    .single()
  if (!param?.premier_login_effectue) {
    return comptaError("BOOTSTRAP_NOT_DONE")
  }

  // Reprise
  let stats
  try {
    stats = await repriseRecettesWave(auth.user.id, parsed.data)
  } catch (e) {
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.reprise.recettes_wave",
    entity:  null,
    details: {
      candidats:           stats.candidats,
      deja_existantes:     stats.deja_existantes,
      creees:              stats.creees,
      ecritures_generees:  stats.ecritures_generees,
      ecritures_echouees:  stats.ecritures_echouees,
      warnings_count:      stats.warnings.length,
      duree_ms:            stats.duree_ms,
      filtre: { date_from: parsed.data.date_from, date_to: parsed.data.date_to },
    },
  })

  return comptaOk(stats)
}
