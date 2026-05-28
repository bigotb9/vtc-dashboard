/**
 * GET /api/compta/depenses/stats
 *
 * KPIs + top + évolution + répartitions pour la page /depenses
 * (Phase 4.x Vague 3.5 §3.1.1).
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
    const stats = await computeFlowStats("depenses", filters, from, to)
    return comptaOk(stats)
  } catch (e) {
    console.error("[compta.depenses.stats]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
