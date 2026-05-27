/**
 * GET /api/compta/recettes
 *
 * Liste paginée des ENTRÉES (Phase 4.x Vague 3.5 §3.1.1) — miroir de
 * /api/compta/depenses. Voir queryOperations pour la logique partagée.
 */

import type { NextRequest } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { fetchFlowOperations } from "@/lib/compta/flow/queryOperations"
import { ensureDateRange, parseFilters } from "@/lib/compta/flow/parseFilters"
import type { FlowListResponse } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url     = new URL(req.url)
  const filters = parseFilters(url)
  const { from, to } = ensureDateRange(filters)

  try {
    const result = await fetchFlowOperations({ kind: "recettes", filters, from, to })
    const response: FlowListResponse = {
      data:         result.data,
      total:        result.total,
      page:         filters.page ?? 1,
      page_size:    filters.page_size ?? 20,
      total_period: result.total_period,
      count_period: result.count_period,
    }
    return comptaOk(response)
  } catch (e) {
    console.error("[compta.recettes.list]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
