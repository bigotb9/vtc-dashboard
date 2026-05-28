/**
 * GET  /api/compta/operations/[id]/justificatifs — Liste enrichie.
 * POST /api/compta/operations/[id]/justificatifs — Upload (multipart/form-data).
 *
 * Phase 4.x Vague 3 §3.3.1-2.
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { uploadJustificatif } from "@/lib/compta/justificatifs/uploadJustificatif"
import { listJustificatifs } from "@/lib/compta/justificatifs/listJustificatifs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

// ─── GET : liste enrichie + signed URLs ──────────────────────────────────────
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response
  const { id } = await ctx.params
  try {
    const items = await listJustificatifs(id)
    return comptaOk(items)
  } catch (e) {
    console.error("[justificatifs.list]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}

// ─── POST : upload multipart/form-data field 'file' ──────────────────────────
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response
  const { id: operationId } = await ctx.params

  // Parse multipart
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    return comptaError("INVALID_PAYLOAD", { reason: (e as Error).message }, "FormData invalide")
  }
  const file = formData.get("file")
  if (!file || typeof file === "string") {
    return comptaError("INVALID_PAYLOAD", { reason: "missing 'file' field" })
  }
  const f = file as File
  const arrayBuf = await f.arrayBuffer()
  const bytes = Buffer.from(arrayBuf)

  const res = await uploadJustificatif({
    operationId,
    userId:   auth.user.id,
    filename: f.name,
    mimeType: f.type,
    bytes,
    size:     bytes.byteLength,
  })

  if (!res.ok) {
    const e = res.error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return comptaError(e.code as any, e.details, e.message)
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.justificatif.upload",
    entity:  operationId,
    details: {
      justificatif_id: res.data.id,
      filename:        res.data.filename,
      mime_type:       res.data.mime_type,
      size_bytes:      res.data.size_bytes,
    },
  })

  return comptaOk(res.data, { status: 201 })
}
