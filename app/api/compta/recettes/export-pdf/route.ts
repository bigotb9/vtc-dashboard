/**
 * POST /api/compta/recettes/export-pdf
 *
 * Miroir de /api/compta/depenses/export-pdf pour les ENTRÉES.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { generatePdfFromHtml, wrapHtml } from "@/lib/pdf/generatePdf"
import { pdfStyles } from "@/lib/pdf/pdfStyles"
import { fetchFlowOperations } from "@/lib/compta/flow/queryOperations"
import { computeFlowStats } from "@/lib/compta/flow/computeStats"
import { loadSocieteInfo, validatePeriod } from "@/lib/compta/exports/common"
import { renderFlowReportTemplate } from "@/components/compta/pdf/FlowReportTemplate"
import type { FlowFilters } from "@/types/compta-ui"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 25

interface Body { from?: string; to?: string; filters?: Partial<FlowFilters> }

function defaultRange(): { from: string; to: string } {
  const d   = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const y   = d.getFullYear()
  const m   = d.getMonth()
  const last = new Date(y, m + 1, 0)
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last.getDate())}` }
}

export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  let body: Body = {}
  try { body = (await req.json()) as Body } catch { /* body vide */ }
  const def = defaultRange()
  const from = body.from ?? def.from
  const to   = body.to   ?? def.to

  const check = validatePeriod(from, to)
  if (!check.ok) return comptaError("INVALID_PAYLOAD", { reason: check.error })

  const filters: FlowFilters = {
    from, to, page: 1, page_size: 2000,
    sort_by: "date_op", sort_order: "desc",
    ...(body.filters ?? {}),
  }

  try {
    const [societe, list, stats] = await Promise.all([
      loadSocieteInfo(),
      fetchFlowOperations({ kind: "recettes", filters, from, to }),
      computeFlowStats("recettes", filters, from, to),
    ])
    const htmlBody = renderFlowReportTemplate({
      kind:        "recettes",
      data:        list.data,
      stats,
      periode:     { from, to },
      societe,
      generated_at: new Date().toISOString(),
    })
    const html      = wrapHtml(htmlBody, pdfStyles)
    const pdfBuffer = await generatePdfFromHtml(html, { format: "A4" })

    const filename = `recettes-boyah-${from}_to_${to}.pdf`
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    })
  } catch (e) {
    console.error("[compta.recettes.export-pdf]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Erreur lors de la génération du PDF")
  }
}
