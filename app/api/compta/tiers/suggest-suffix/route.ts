/**
 * GET /api/compta/tiers/suggest-suffix
 * Génère et vérifie la disponibilité d'un suffixe SYSCOHADA (Phase 4.x Vague 2).
 *
 * Query :
 *   - nom=<texte>
 *   - type=client|fournisseur|salarie|autre
 *
 * Réponse :
 *   {
 *     suffix_suggere:        "GA",
 *     compte_syscohada_code: "401-GA",
 *     disponible:            true,
 *     alternatives:          ["GA1", "GA2", "GA3"]
 *   }
 */

import type { NextRequest } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { suggestSuffixWithAvailability } from "@/lib/compta/tiers/generateSuffix"
import type { TiersType } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TYPES_VALID: ReadonlyArray<TiersType> = ["client", "fournisseur", "salarie", "autre"]

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url  = new URL(req.url)
  const nom  = (url.searchParams.get("nom") ?? "").trim()
  const type = (url.searchParams.get("type") ?? "") as TiersType

  if (!nom)                              return comptaError("INVALID_PAYLOAD", { reason: "nom requis" })
  if (!TYPES_VALID.includes(type))       return comptaError("INVALID_PAYLOAD", { reason: `type invalide : ${type}` })

  const result = await suggestSuffixWithAvailability(nom, type)
  return comptaOk(result)
}
