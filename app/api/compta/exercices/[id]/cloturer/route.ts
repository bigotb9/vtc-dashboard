/**
 * POST /api/compta/exercices/[id]/cloturer
 *
 * Clôture définitive d'un exercice (Phase 4.2 Module 2 §3.4).
 * Refus si présence de brouillons. Calcule le résultat net + crée
 * l'exercice suivant en 'ouvert' automatiquement.
 *
 * ⚠ Irréversible : les opérations de l'exercice clos sont verrouillées
 * par le trigger BD `enforce_exercice_clos_lock`.
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { cloturerExercice } from "@/lib/compta/exercices/cloturerExercice"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 25

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_exercices")
  if (!auth.ok) return auth.response
  const { id } = await ctx.params

  const res = await cloturerExercice(id, auth.user.id)
  if (!res.ok) {
    // Mapping vers codes errors.ts
    const codeMap: Record<string, "CONFLICT" | "NOT_FOUND" | "DB_ERROR"> = {
      BROUILLONS_PRESENTS: "CONFLICT",
      ALREADY_CLOSED:      "CONFLICT",
      NOT_FOUND:           "NOT_FOUND",
      DB_ERROR:            "DB_ERROR",
    }
    const code = codeMap[res.code] ?? "INTERNAL_ERROR"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return comptaError(code as any, res.details as Record<string, unknown> | undefined, res.message)
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.exercice.cloturer",
    entity:  id,
    details: {
      resultat_net:    res.data.resultat_net,
      next_exercice_id: res.data.next_exercice_id,
    },
  })

  return comptaOk(res.data)
}
