/**
 * POST /api/compta/etats-financiers/dossier-complet/export-pdf
 * Phase 4.3 Module 4 — Dossier unifié (Bilan + CR + TFT + Notes).
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError } from "@/lib/compta/errors"
import { generatePdfFromHtml, wrapHtml } from "@/lib/pdf/generatePdf"
import { pdfStyles } from "@/lib/pdf/pdfStyles"
import { loadSocieteInfo } from "@/lib/compta/exports/common"
import { calculerBilan }          from "@/lib/compta/etats-financiers/calculerBilan"
import { calculerCompteResultat } from "@/lib/compta/etats-financiers/calculerCompteResultat"
import { calculerTft }            from "@/lib/compta/etats-financiers/calculerTft"
import { calculerNotesAnnexes }   from "@/lib/compta/etats-financiers/calculerNotesAnnexes"
import { ajusterResultatSiOuvert } from "@/lib/compta/etats-financiers/ajusterResultatExercice"
import { computeHashSha256, newTraceabilityUuid } from "@/lib/compta/etats-financiers/computeHash"
import { buildVerifyQr } from "@/lib/compta/etats-financiers/buildVerifyQr"
import { renderDossierCompletPdfTemplate } from "@/components/compta/pdf/DossierCompletPdfTemplate"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60   // ⚠ 60s — 4 calculs + 1 grosse passe Puppeteer

interface Body { exercice_id?: string }

export async function POST(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  let body: Body = {}
  try { body = await req.json() } catch { /* body vide */ }
  if (!body.exercice_id) return comptaError("INVALID_PAYLOAD", { reason: "exercice_id requis" })

  try {
    // 1. Auto-écriture résultat (1 fois pour les 4 documents)
    await ajusterResultatSiOuvert(body.exercice_id)

    // 2. Calculs parallèles
    const [societe, bilan, compteResultat, tft, notesAnnexes] = await Promise.all([
      loadSocieteInfo(),
      calculerBilan(body.exercice_id),
      calculerCompteResultat(body.exercice_id, undefined, undefined),
      calculerTft(body.exercice_id),
      calculerNotesAnnexes(body.exercice_id),
    ])

    // 3. Hash UNIQUE sur l'ensemble du dossier
    const uuid        = newTraceabilityUuid()
    const generatedAt = new Date().toISOString()
    const dossierData = { bilan, compteResultat, tft, notesAnnexes }
    const hash        = computeHashSha256({ type: "dossier_complet", data: dossierData })
    const qr          = await buildVerifyQr(uuid)

    const htmlBody = renderDossierCompletPdfTemplate({
      data:    dossierData,
      societe,
      traceability: {
        uuid, hash_sha256: hash, generated_at: generatedAt,
        verify_url:  qr.verify_url,
        qr_data_url: qr.qr_data_url,
      },
    })
    const html      = wrapHtml(htmlBody, pdfStyles)
    const pdfBuffer = await generatePdfFromHtml(html, { format: "A4" })

    // 4. Archivage
    try {
      await supabaseAdmin.from("etats_financiers_archives").insert({
        exercice_id:  body.exercice_id,
        type_etat:    "dossier_complet",
        hash_sha256:  hash,
        donnees_json: dossierData,
        pdf_storage_path: null,
        genere_par:   auth.user.id,
        genere_at:    generatedAt,
        uuid_externe: uuid,
      })
    } catch (e) {
      console.warn("[dossier-complet.export-pdf] archive insert KO:", e)
    }

    const filename = `dossier-etats-financiers-${bilan.exercice_libelle.toLowerCase().replace(/\s+/g, "-")}-${bilan.date_arrete}.pdf`
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
    console.error("[dossier-complet.export-pdf]", e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Erreur génération PDF Dossier complet")
  }
}
