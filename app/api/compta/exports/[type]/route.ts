/**
 * POST /api/compta/exports/[type]
 *
 * Dispatcher de génération PDF — Phase 4 complète (Vague 1 + 2).
 *
 * Types implémentés :
 *   - grand-livre         → Grand Livre A4 portrait
 *   - balance             → Balance A4 paysage
 *   - journaux            → Journaux A4 portrait (filtre journaux[])
 *   - releves-caisses     → Relevés A4 portrait (filtre caisses_ids[])
 *   - rapport-mensuel     → Rapport mensuel A4 portrait (8-12 pages, SVG charts)
 *
 * Body : { date_from, date_to, journaux?, caisses_ids? }
 * Réponse : application/pdf + Content-Disposition: attachment
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { generatePdfFromHtml, wrapHtml } from "@/lib/pdf/generatePdf"
import { pdfStyles } from "@/lib/pdf/pdfStyles"
import { buildGrandLivre }    from "@/lib/compta/exports/buildGrandLivre"
import { buildBalance }       from "@/lib/compta/exports/buildBalance"
import { buildJournaux }      from "@/lib/compta/exports/buildJournaux"
import { buildReleves }       from "@/lib/compta/exports/buildReleves"
import { buildRapportMensuel } from "@/lib/compta/exports/buildRapportMensuel"
import { renderGrandLivreTemplate }    from "@/components/compta/pdf/GrandLivreTemplate"
import { renderBalanceTemplate }       from "@/components/compta/pdf/BalanceTemplate"
import { renderJournauxTemplate }      from "@/components/compta/pdf/JournauxTemplate"
import { renderRelevesTemplate }       from "@/components/compta/pdf/RelevesTemplate"
import { renderRapportMensuelTemplate } from "@/components/compta/pdf/RapportMensuelTemplate"
import { loadSocieteInfo, validatePeriod } from "@/lib/compta/exports/common"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 30

type RouteCtx = { params: Promise<{ type: string }> }

const IMPLEMENTED = new Set([
  "grand-livre", "balance",
  "journaux", "releves-caisses", "rapport-mensuel",
])

interface ExportBody {
  date_from?:    string
  date_to?:      string
  journaux?:     string[]
  caisses_ids?:  string[]
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  const { type } = await ctx.params
  if (!IMPLEMENTED.has(type)) {
    return comptaError("NOT_FOUND", { type }, `Type de rapport inconnu : ${type}`)
  }

  // 1. Body
  let body: ExportBody = {}
  try { body = (await req.json()) as ExportBody } catch { /* body vide ok */ }
  const dateFrom = body.date_from ?? defaultDateFrom()
  const dateTo   = body.date_to   ?? defaultDateTo()

  const check = validatePeriod(dateFrom, dateTo)
  if (!check.ok) return comptaError("INVALID_PAYLOAD", { reason: check.error })

  try {
    const societe = await loadSocieteInfo()

    let htmlBody: string
    let filename:  string
    let format:    "A4" | "A4-landscape" = "A4"

    if (type === "grand-livre") {
      const data = await buildGrandLivre(dateFrom, dateTo)
      htmlBody = renderGrandLivreTemplate({ data, societe })
      filename = `grand-livre-boyah-${dateFrom}_to_${dateTo}.pdf`
    } else if (type === "balance") {
      const data = await buildBalance(dateFrom, dateTo)
      htmlBody = renderBalanceTemplate({ data, societe })
      filename = `balance-boyah-${dateFrom}_to_${dateTo}.pdf`
      format   = "A4-landscape"
    } else if (type === "journaux") {
      const data = await buildJournaux(dateFrom, dateTo, { journaux: body.journaux })
      htmlBody = renderJournauxTemplate({ data, societe, filtreJournaux: body.journaux })
      filename = `journaux-boyah-${dateFrom}_to_${dateTo}.pdf`
    } else if (type === "releves-caisses") {
      const data = await buildReleves(dateFrom, dateTo, { caisses_ids: body.caisses_ids })
      htmlBody = renderRelevesTemplate({ data, societe })
      filename = `releves-tresorerie-boyah-${dateFrom}_to_${dateTo}.pdf`
    } else {
      // rapport-mensuel
      const data = await buildRapportMensuel(dateFrom, dateTo)
      htmlBody = renderRapportMensuelTemplate({ data, societe })
      filename = `rapport-mensuel-boyah-${dateFrom}_to_${dateTo}.pdf`
    }

    const html = wrapHtml(htmlBody, pdfStyles)
    const pdfBuffer = await generatePdfFromHtml(html, { format })

    return new NextResponse(pdfBuffer as BodyInit, {
      status:  200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    })
  } catch (e) {
    console.error(`[exports/${type}]`, e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Erreur lors de la génération du PDF")
  }
}

function defaultDateFrom(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function defaultDateTo(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
