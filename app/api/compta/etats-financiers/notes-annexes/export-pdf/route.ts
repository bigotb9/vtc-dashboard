/**
 * POST /api/compta/etats-financiers/notes-annexes/export-pdf
 * Phase 4.3 Module 2 §6.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { generatePdfFromHtml, wrapHtml } from "@/lib/pdf/generatePdf"
import { pdfStyles } from "@/lib/pdf/pdfStyles"
import { loadSocieteInfo } from "@/lib/compta/exports/common"
import { calculerNotesAnnexes } from "@/lib/compta/etats-financiers/calculerNotesAnnexes"
import { ajusterResultatSiOuvert } from "@/lib/compta/etats-financiers/ajusterResultatExercice"
import { computeHashSha256, newTraceabilityUuid } from "@/lib/compta/etats-financiers/computeHash"
import { buildVerifyQr } from "@/lib/compta/etats-financiers/buildVerifyQr"
import { renderNotesAnnexesPdfTemplate } from "@/components/compta/pdf/NotesAnnexesPdfTemplate"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

interface Body { exercice_id?: string }

export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  let body: Body = {}
  try { body = await req.json() } catch { /* body vide */ }
  if (!body.exercice_id) return comptaError("INVALID_PAYLOAD", { reason: "exercice_id requis" })

  try {
    await ajusterResultatSiOuvert(body.exercice_id)
    const [societe, data] = await Promise.all([
      loadSocieteInfo(),
      calculerNotesAnnexes(body.exercice_id),
    ])

    const uuid        = newTraceabilityUuid()
    const generatedAt = new Date().toISOString()
    const hash        = computeHashSha256({ type: "notes_annexes", data })
    const qr          = await buildVerifyQr(uuid)

    const htmlBody = renderNotesAnnexesPdfTemplate({
      data, societe,
      traceability: {
        uuid, hash_sha256: hash, generated_at: generatedAt,
        verify_url: qr.verify_url, qr_data_url: qr.qr_data_url,
      },
    })
    const html      = wrapHtml(htmlBody, pdfStyles)
    const pdfBuffer = await generatePdfFromHtml(html, { format: "A4" })

    try {
      await supabaseAdmin.from("etats_financiers_archives").insert({
        exercice_id:  body.exercice_id,
        type_etat:    "notes_annexes",
        hash_sha256:  hash,
        donnees_json: data,
        pdf_storage_path: null,
        genere_par:   auth.user.id,
        genere_at:    generatedAt,
        uuid_externe: uuid,
      })
    } catch (e) {
      console.warn("[notes-annexes.export-pdf] archive insert KO:", e)
    }

    const filename = `notes-annexes-${data.exercice_libelle.toLowerCase().replace(/\s+/g, "-")}-${data.date_arrete}.pdf`
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
    console.error("[notes-annexes.export-pdf]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Erreur génération PDF Notes annexes")
  }
}
