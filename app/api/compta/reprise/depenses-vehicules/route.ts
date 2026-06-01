/**
 * POST /api/compta/reprise/depenses-vehicules
 *
 * Réingestion incrémentale des dépenses véhicule (lecture depenses_vehicules)
 * vers operations (source='depense_vehicule').
 *
 * Idempotent : dédup manuelle (SELECT source_ref existants + filter + INSERT)
 * + index UNIQUE PARTIEL operations(source, source_ref). Rejouable sans créer
 * de doublons. Réservé directeur (manage_comptabilite).
 *
 * Créé au L5 (01/06/2026) pour rattraper les dépenses orphelines dont la
 * cascade legacy -> operations n'a jamais été déclenchée (saisies hors du
 * flux /api/depenses/create qui lance la reprise par jour).
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
import { repriseDepensesVehicules } from "@/lib/compta/reprise"

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
    stats = await repriseDepensesVehicules(auth.user.id, parsed.data)
  } catch (e) {
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.reprise.depenses_vehicules",
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
