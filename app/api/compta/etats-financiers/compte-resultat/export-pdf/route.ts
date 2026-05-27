/**
 * POST /api/compta/etats-financiers/compte-resultat/export-pdf
 * Phase 4.2 Module 3b §6.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { generatePdfFromHtml, wrapHtml } from "@/lib/pdf/generatePdf"
import { pdfStyles } from "@/lib/pdf/pdfStyles"
import { loadSocieteInfo } from "@/lib/compta/exports/common"
import { calculerCompteResultat } from "@/lib/compta/etats-financiers/calculerCompteResultat"
import { computeHashSha256, newTraceabilityUuid } from "@/lib/compta/etats-financiers/computeHash"
import { buildVerifyQr } from "@/lib/compta/etats-financiers/buildVerifyQr"
import { renderCompteResultatPdfTemplate } from "@/components/compta/pdf/CompteResultatPdfTemplate"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

interface Body { exercice_id?: string; date_debut?: string; date_fin?: string }

export async function POST(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  let body: Body = {}
  try { body = await req.json() } catch { /* body vide */ }
  if (!body.exercice_id) return comptaError("INVALID_PAYLOAD", { reason: "exercice_id requis" })

  try {
    const [societe, data] = await Promise.all([
      loadSocieteInfo(),
      calculerCompteResultat(body.exercice_id, body.date_debut, body.date_fin),
    ])
    const uuid        = newTraceabilityUuid()
    const generatedAt = new Date().toISOString()
    const hash        = computeHashSha256({ type: "compte_resultat", data })
    const qr          = await buildVerifyQr(uuid)

    const htmlBody = renderCompteResultatPdfTemplate({
      data, societe,
      traceability: {
        uuid,
        hash_sha256: hash,
        generated_at: generatedAt,
        verify_url:   qr.verify_url,
        qr_data_url:  qr.qr_data_url,
      },
    })
    const html      = wrapHtml(htmlBody, pdfStyles)
    const pdfBuffer = await generatePdfFromHtml(html, { format: "A4" })

    try {
      await supabaseAdmin.from("etats_financiers_archives").insert({
        exercice_id:  body.exercice_id,
        type_etat:    "compte_resultat",
        hash_sha256:  hash,
        donnees_json: data,
        pdf_storage_path: null,
        genere_par:   auth.user.id,
        genere_at:    generatedAt,
        uuid_externe: uuid,
      })
    } catch (e) {
      console.warn("[cr.export-pdf] archive insert KO:", e)
    }

    const filename = `compte-resultat-${data.exercice_libelle.toLowerCase().replace(/\s+/g, "-")}-${data.date_fin}.pdf`
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":              "application/pdf",
        "Content-Disposition":       `attachment; filename="${filename}"`,
        "X-Etat-Financier-Hash":     hash,
        "X-Etat-Financier-Uuid":     uuid,
        "X-Etat-Financier-Short":    qr.short_uuid,
        "X-Etat-Financier-VerifyUrl": qr.verify_url,
        "Cache-Control":             "no-store",
      },
    })
  } catch (e) {
    console.error("[cr.export-pdf]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Erreur génération PDF CR")
  }
}
