/**
 * POST /api/compta/tiers/[id]/disable — Soft delete d'un tiers (Phase 4.x Vague 2).
 *
 * Pas de hard delete (conserve l'historique des opérations rattachées).
 * Le tiers reste en BD avec actif = false. Il est masqué de la liste par défaut
 * et le code SYSCOHADA est libéré (un autre tiers actif peut réutiliser le même).
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data, error } = await supabaseAdmin
    .from("tiers")
    .update({
      actif:      false,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .select("id, nom, type, compte_syscohada_code")
    .maybeSingle()

  if (error) {
    console.error("[tiers.disable] error:", error)
    return comptaError("DB_ERROR", { message: error.message })
  }
  if (!data) return comptaError("NOT_FOUND", undefined, "Tiers introuvable")

  await logActivity({
    token:   auth.token,
    action:  "compta.tiers.disable",
    entity:  id,
    details: {
      nom:                   data.nom,
      type:                  data.type,
      compte_syscohada_code: data.compte_syscohada_code,
    },
  })

  return comptaOk({ id, actif: false })
}
