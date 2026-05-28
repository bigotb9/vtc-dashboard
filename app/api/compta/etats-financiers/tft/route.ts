/**
 * GET /api/compta/etats-financiers/tft?exercice_id=…
 * Phase 4.3 Module 3.
 */

import type { NextRequest } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { calculerTft } from "@/lib/compta/etats-financiers/calculerTft"
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
    await ajusterResultatSiOuvert(exerciceId)
    const data = await calculerTft(exerciceId)
    return comptaOk(data)
  } catch (e) {
    console.error("[tft.get]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }
}
