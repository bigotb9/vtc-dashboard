/**
 * GET /api/compta/recettes/stats
 *
 * Miroir de /api/compta/depenses/stats pour les ENTRÉES.
 * (Phase 4.x Vague 3.5 §3.1.1)
 */

import type { NextRequest } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { computeFlowStats } from "@/lib/compta/flow/computeStats"
import { ensureDateRange, parseFilters } from "@/lib/compta/flow/parseFilters"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 25

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const filters = parseFilters(url)
  const { from, to } = ensureDateRange(filters)

  try {
    const stats = await computeFlowStats("recettes", filters, from, to)
    return comptaOk(stats)
  } catch (e) {
    console.error("[compta.recettes.stats]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
