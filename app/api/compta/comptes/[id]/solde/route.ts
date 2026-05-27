/**
 * GET /api/compta/comptes/[id]/solde
 *
 * Solde d'un compte bancaire à une date donnée (par défaut aujourd'hui).
 * Réservé directeur. Référence : doc Phase 2 §4.5.
 *
 * Query :
 *   - date : YYYY-MM-DD (facultatif, défaut = aujourd'hui)
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { getSoldeCompteDetail } from "@/lib/compta/soldes"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const url    = new URL(req.url)
  const date   = url.searchParams.get("date") ?? undefined

  if (date && !DATE_RE.test(date)) {
    return comptaError("INVALID_PAYLOAD", { field: "date" }, "Format YYYY-MM-DD attendu")
  }

  // Vérifier l'existence du compte avant le calcul (évite l'exception interne)
  const { data: c } = await supabaseAdmin
    .from("comptes")
    .select("id")
    .eq("id", id)
    .maybeSingle()
  if (!c) return comptaError("NOT_FOUND")

  try {
    const detail = await getSoldeCompteDetail(id, date)
    return comptaOk(detail)
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
