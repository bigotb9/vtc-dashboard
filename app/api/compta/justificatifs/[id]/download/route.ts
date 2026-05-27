/**
 * GET /api/compta/justificatifs/[id]/download
 *
 * Redirige 302 vers la signed URL Supabase Storage avec
 * Content-Disposition: attachment.
 * Phase 4.x Vague 3 §3.3.3.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { getJustificatifSignedUrl } from "@/lib/compta/justificatifs/listJustificatifs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response
  const { id } = await ctx.params

  const r = await getJustificatifSignedUrl(id)
  if (!r) return comptaError("NOT_FOUND", undefined, "Justificatif introuvable")

  return NextResponse.redirect(r.signed_url, { status: 302 })
}
