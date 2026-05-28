/**
 * GET /api/compta/etats-financiers/notes-annexes?exercice_id=…
 *
 * Phase 4.3 Module 2 — Calcul + retour Notes annexes simplifiées.
 */

import type { NextRequest } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { calculerNotesAnnexes } from "@/lib/compta/etats-financiers/calculerNotesAnnexes"
import { ajusterResultatSiOuvert } from "@/lib/compta/etats-financiers/ajusterResultatExercice"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 20

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const exerciceId = url.searchParams.get("exercice_id")
  if (!exerciceId) return comptaError("INVALID_PAYLOAD", { reason: "exercice_id requis" })

  try {
    // Resynchronise l'auto-écriture résultat avant agrégation (Note 5 reflète 13)
    await ajusterResultatSiOuvert(exerciceId)
    const data = await calculerNotesAnnexes(exerciceId)
    return comptaOk(data)
  } catch (e) {
    console.error("[notes-annexes.get]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }
}
