/**
 * DELETE /api/compta/justificatifs/[id]
 *
 * Soft delete d'un justificatif. Directeur seul.
 * Refus si dernier justif d'une op validée + sortie + tiers (CONFLICT 409).
 * Refus si opération annulée (FORBIDDEN 403).
 *
 * Phase 4.x Vague 3 §3.3.4.
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { deleteJustificatif } from "@/lib/compta/justificatifs/deleteJustificatif"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response
  const { id } = await ctx.params

  const res = await deleteJustificatif(id, auth.user.id)
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return comptaError(res.code as any, undefined, res.message)
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.justificatif.delete",
    entity:  id,
    details: { soft_delete: true },
  })

  return comptaOk({ id, deleted: true })
}
