/**
 * GET /api/compta/health/anomalies?section=<id>&limit=<n>
 *
 * Retourne TOUTES les anomalies (jusqu'à `limit`) d'une section donnée pour
 * alimenter la page "voir tout" /comptabilite/health/[section] (Écran 8 §4.2).
 *
 * Sections supportées :
 *   - equilibre
 *   - coherence_ops_ecritures
 *   - mappings_syscohada
 *   - coherence_journaux
 */

import type { NextRequest } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { getAllAnomaliesForSection } from "@/lib/compta/healthDetailed"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

const ALLOWED = new Set([
  "equilibre", "coherence_ops_ecritures", "mappings_syscohada", "coherence_journaux",
])

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url     = new URL(req.url)
  const section = url.searchParams.get("section")
  const limit   = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? "100")))

  if (!section || !ALLOWED.has(section)) {
    return comptaError("INVALID_PAYLOAD", { allowed: [...ALLOWED] }, "Section inconnue")
  }

  try {
    const out = await getAllAnomaliesForSection(section, limit)
    return comptaOk(out)
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
