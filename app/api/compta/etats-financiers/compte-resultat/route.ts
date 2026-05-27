/**
 * GET /api/compta/etats-financiers/compte-resultat
 *   ?exercice_id=…&date_debut=…&date_fin=…
 *
 * Phase 4.2 Module 3b §5.
 */

import type { NextRequest } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { calculerCompteResultat } from "@/lib/compta/etats-financiers/calculerCompteResultat"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 20

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const exerciceId = url.searchParams.get("exercice_id")
  if (!exerciceId) return comptaError("INVALID_PAYLOAD", { reason: "exercice_id requis" })
  const dateDebut = url.searchParams.get("date_debut") ?? undefined
  const dateFin   = url.searchParams.get("date_fin")   ?? undefined

  try {
    const data = await calculerCompteResultat(exerciceId, dateDebut, dateFin)
    return comptaOk(data)
  } catch (e) {
    console.error("[compte-resultat.get]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
  }
}
