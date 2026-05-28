/**
 * POST /api/compta/transferts/preview
 *
 * Endpoint léger : calcule l'écriture comptable qui serait générée par un
 * transfert interne, SANS rien créer en base. Sert au wizard étape 2 (preview
 * SYSCOHADA live).
 *
 * Body identique à POST /api/compta/transferts (TransfertPayload).
 * Réponse : { data: TransfertPreview }
 */

import type { NextRequest } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { safeParse, transfertSchema } from "@/lib/compta/validators"
import { buildTransfertPreview } from "@/lib/compta/transferts/previewTransfert"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  let body: unknown = {}
  try { body = await req.json() } catch { /* body vide */ }

  const parsed = safeParse(transfertSchema, body)
  if (!parsed.ok) {
    return comptaError("INVALID_PAYLOAD", { issues: parsed.details })
  }

  const r = await buildTransfertPreview(parsed.data)
  if (!r.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return comptaError(r.code as any, undefined, r.message)
  }
  return comptaOk(r.preview)
}
