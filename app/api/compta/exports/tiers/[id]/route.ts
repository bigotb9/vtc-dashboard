/**
 * POST /api/compta/exports/tiers/[id]
 *
 * Génère le PDF "Fiche tiers" (Phase 4.x Vague 2 §4.4).
 *
 * Body (JSON) :
 *   { date_from?: string, date_to?: string }   // défaut : année courante
 *
 * Réponse : application/pdf en attachment.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { generatePdfFromHtml, wrapHtml } from "@/lib/pdf/generatePdf"
import { pdfStyles } from "@/lib/pdf/pdfStyles"
import { buildFicheTiers } from "@/lib/compta/exports/buildFicheTiers"
import { renderFicheTiersTemplate } from "@/components/compta/pdf/FicheTiersTemplate"
import { loadSocieteInfo, validatePeriod } from "@/lib/compta/exports/common"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 25

type RouteCtx = { params: Promise<{ id: string }> }

interface ExportTiersBody {
  date_from?: string
  date_to?:   string
}

function defaultRange(): { date_from: string; date_to: string } {
  const y   = new Date().getFullYear()
  return { date_from: `${y}-01-01`, date_to: `${y}-12-31` }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  let body: ExportTiersBody = {}
  try { body = (await req.json()) as ExportTiersBody } catch { /* body vide */ }
  const def = defaultRange()
  const dateFrom = body.date_from ?? def.date_from
  const dateTo   = body.date_to   ?? def.date_to

  const check = validatePeriod(dateFrom, dateTo)
  if (!check.ok) return comptaError("INVALID_PAYLOAD", { reason: check.error })

  try {
    const data = await buildFicheTiers(id, dateFrom, dateTo)
    if (!data) return comptaError("NOT_FOUND", undefined, "Tiers introuvable")

    const societe   = await loadSocieteInfo()
    const htmlBody  = renderFicheTiersTemplate({ data, societe })
    const html      = wrapHtml(htmlBody, pdfStyles)
    const pdfBuffer = await generatePdfFromHtml(html, { format: "A4" })

    const slug = (data.tiers.nom || "tiers").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    const filename = `fiche-tiers-${slug}-${dateFrom}_to_${dateTo}.pdf`

    return new NextResponse(pdfBuffer as BodyInit, {
      status:  200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    })
  } catch (e) {
    console.error("[exports.tiers]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Erreur lors de la génération du PDF")
  }
}
