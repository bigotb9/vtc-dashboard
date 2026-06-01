/**
 * GET /api/finance/marge-test?mois=YYYY-MM
 *
 * Route de TEST TEMPORAIRE — sert UNIQUEMENT à valider les chiffres du helper
 * `getMargeConsolidee` (lib/finance/margeConsolidee.ts) avant tout branchement
 * Cockpit / BoyahBot. À retirer ou re-sécuriser après validation par Emmanuel.
 *
 * Réservé directeur (manage_comptabilite). Retourne le JSON brut MargeConsolidee.
 *
 * Exemple : /api/finance/marge-test?mois=2026-05
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { getMargeConsolidee } from "@/lib/finance/margeConsolidee"

export const dynamic     = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  const mois = req.nextUrl.searchParams.get("mois")?.trim() ?? ""
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) {
    return comptaError("INVALID_PAYLOAD", { reason: "Paramètre 'mois' attendu au format 'YYYY-MM'" })
  }

  try {
    const marge = await getMargeConsolidee(supabaseAdmin, mois)
    return comptaOk(marge)
  } catch (e) {
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }
}
