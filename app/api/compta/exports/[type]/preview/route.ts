/**
 * POST /api/compta/exports/[type]/preview
 *
 * Retourne le HTML brut du rapport (text/html), sans passer par Puppeteer.
 * L'UI ouvre dans un nouvel onglet pour avoir un aperçu navigateur instantané.
 *
 * Économise ~3-5s de génération PDF + ressources serverless.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { wrapHtml } from "@/lib/pdf/generatePdf"
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
export const maxDuration = 20

type RouteCtx = { params: Promise<{ type: string }> }

const IMPLEMENTED = new Set([
  "grand-livre", "balance",
  "journaux", "releves-caisses", "rapport-mensuel",
])

interface PreviewBody {
  date_from?:    string
  date_to?:      string
  journaux?:     string[]
  caisses_ids?:  string[]
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { type } = await ctx.params
  if (!IMPLEMENTED.has(type)) {
    return comptaError("NOT_FOUND", { type }, `Type de rapport inconnu : ${type}`)
  }

  let body: PreviewBody = {}
  try { body = (await req.json()) as PreviewBody } catch { /* ok */ }
  const dateFrom = body.date_from ?? defaultDateFrom()
  const dateTo   = body.date_to   ?? defaultDateTo()

  const check = validatePeriod(dateFrom, dateTo)
  if (!check.ok) return comptaError("INVALID_PAYLOAD", { reason: check.error })

  try {
    const societe = await loadSocieteInfo()
    let htmlBody: string
    if (type === "grand-livre") {
      const data = await buildGrandLivre(dateFrom, dateTo)
      htmlBody = renderGrandLivreTemplate({ data, societe })
    } else if (type === "balance") {
      const data = await buildBalance(dateFrom, dateTo)
      htmlBody = renderBalanceTemplate({ data, societe })
    } else if (type === "journaux") {
      const data = await buildJournaux(dateFrom, dateTo, { journaux: body.journaux })
      htmlBody = renderJournauxTemplate({ data, societe, filtreJournaux: body.journaux })
    } else if (type === "releves-caisses") {
      const data = await buildReleves(dateFrom, dateTo, { caisses_ids: body.caisses_ids })
      htmlBody = renderRelevesTemplate({ data, societe })
    } else {
      const data = await buildRapportMensuel(dateFrom, dateTo)
      htmlBody = renderRapportMensuelTemplate({ data, societe })
    }

    const wrapper = `<div style="max-width: 210mm; margin: 20px auto; padding: 20mm 15mm; background: #FAFAF8; box-shadow: 0 4px 24px rgba(0,0,0,0.08); font-family: Georgia, serif;">${htmlBody}</div>`
    const html = wrapHtml(wrapper, pdfStyles)

    return new NextResponse(html, {
      status:  200,
      headers: {
        "Content-Type":  "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error(`[exports/${type}/preview]`, e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
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
