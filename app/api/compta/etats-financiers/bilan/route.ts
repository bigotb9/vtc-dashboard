/**
 * GET /api/compta/etats-financiers/bilan?exercice_id=…
 *
 * Phase 4.2 Module 3a — Calcul + retour Bilan SYSCOHADA.
 */

import type { NextRequest } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { calculerBilan } from "@/lib/compta/etats-financiers/calculerBilan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 20

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const exerciceId = url.searchParams.get("exercice_id")
  if (!exerciceId) return comptaError("INVALID_PAYLOAD", { reason: "exercice_id requis" })

  try {
    const data = await calculerBilan(exerciceId)
    return comptaOk(data)
  } catch (e) {
    console.error("[bilan.get]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }
}
