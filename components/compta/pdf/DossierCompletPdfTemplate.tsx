/**
 * Template PDF "Dossier complet États Financiers" (Phase 4.3 Module 4).
 *
 * Wrapper unifié qui rend 4 sections en 1 seule passe Puppeteer :
 *   - Page de garde (Logo + identité + titre + exercice)
 *   - Bilan        (≈ 2 pages)
 *   - Compte de résultat (≈ 2 pages)
 *   - TFT          (≈ 2 pages)
 *   - Notes annexes (≈ 4-6 pages)
 *   - Page finale : signature + hash + QR
 *
 * Total estimé : 10-12 pages. Un seul hash SHA-256 calculé sur l'ensemble
 * du JSON unifié → archive `etats_financiers_archives.type_etat='dossier_complet'`.
 */

import type { BilanData, CompteResultatData, NotesAnnexesData, TftData } from "@/types/compta-ui"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"
import { renderBilanPdfTemplate }            from "./BilanPdfTemplate"
import { renderCompteResultatPdfTemplate }   from "./CompteResultatPdfTemplate"
import { renderTftPdfTemplate }              from "./TftPdfTemplate"
import { renderNotesAnnexesPdfTemplate }     from "./NotesAnnexesPdfTemplate"

function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function esc(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export interface DossierCompletTraceability {
  uuid:         string
  hash_sha256:  string
  generated_at: string
  verify_url:   string
  qr_data_url:  string
}

export interface DossierCompletInput {
  bilan:           BilanData
  compteResultat:  CompteResultatData
  tft:             TftData
  notesAnnexes:    NotesAnnexesData
}

export function renderDossierCompletPdfTemplate(opts: {
  data:         DossierCompletInput
  societe:      SocieteHeaderData
  traceability: DossierCompletTraceability
}): string {
  const { data, societe, traceability } = opts
  const raison = societe.raison_sociale ?? societe.nom_commercial ?? "Boyah Group SARL"
  const cc = (societe.numero_cc ?? societe.numero_contribuable)?.trim()

  // ─── Page de garde ────────────────────────────────────────────────────────
  const logoBig = societe.logo_signed_url
    ? `<img src="${esc(societe.logo_signed_url)}" alt="Logo" style="width: 50mm; height: 50mm; object-fit: contain; margin: 0 auto 8mm;" />`
    : ""
  const pageGarde = `
    <div style="page-break-after: always; min-height: 240mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20mm 10mm;">
      ${logoBig}
      <div style="font-family: Georgia, serif; font-size: 26pt; font-weight: 900; color: #1F4E79; margin-bottom: 4mm; letter-spacing: 1px;">${esc(raison)}</div>
      <div style="font-size: 11pt; color: #4B5563; max-width: 140mm; line-height: 1.6;">
        ${[societe.adresse_fiscale, societe.numero_rccm ? `RCCM ${esc(societe.numero_rccm)}` : null, cc ? `N° CC ${esc(cc)}` : null].filter(Boolean).map(esc).join(" · ")}
      </div>
      <div style="margin: 22mm 0 6mm; padding: 6mm 10mm; background: #1F4E79; color: white; border-radius: 3mm; box-shadow: 0 2pt 4pt rgba(0,0,0,0.1);">
        <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 3px; opacity: 0.8; margin-bottom: 2mm;">États financiers</div>
        <div style="font-family: Georgia, serif; font-size: 22pt; font-weight: 900;">Dossier complet</div>
        <div style="font-size: 11pt; margin-top: 1.5mm; opacity: 0.92;">Exercice ${esc(data.bilan.exercice_libelle)} · arrêté au ${fmtDateFr(data.bilan.date_arrete)}</div>
      </div>
      <div style="font-size: 10pt; color: #6B7280; margin-top: 8mm; line-height: 1.7; max-width: 160mm;">
        Conforme au référentiel <strong>SYSCOHADA révisé</strong> (Acte uniforme OHADA, révision 2017).<br/>
        Document contenant : Bilan · Compte de résultat (9 SIG) · Tableau des Flux de Trésorerie · Notes annexes (6 notes).
      </div>
      <div style="font-size: 8.5pt; color: #9CA3AF; margin-top: 20mm; font-style: italic;">
        Généré le ${fmtDateFr(traceability.generated_at.slice(0,10))} à ${esc(traceability.generated_at.slice(11,19))}
      </div>
    </div>`

  // ─── Sub-sections — header masqué (page de garde fait office), footer masqué ─
  // (le footer unique sera en dernière page avec QR + hash global)
  const sectionBilan = renderBilanPdfTemplate({
    data: data.bilan, societe,
    traceability: { uuid: traceability.uuid, hash_sha256: traceability.hash_sha256, generated_at: traceability.generated_at,
      verify_url: traceability.verify_url, qr_data_url: traceability.qr_data_url },
  })
  // Hack pour ajouter page-break-before — le sub-template ne le sait pas
  const wrapSection = (html: string, addPageBreak = true): string =>
    `<div style="${addPageBreak ? "page-break-before: always;" : ""}">${html}</div>`

  const sectionCR = renderCompteResultatPdfTemplate({
    data: data.compteResultat, societe,
    traceability: { uuid: traceability.uuid, hash_sha256: traceability.hash_sha256, generated_at: traceability.generated_at,
      verify_url: traceability.verify_url, qr_data_url: traceability.qr_data_url },
  })
  const sectionTft = renderTftPdfTemplate({
    data: data.tft, societe,
    traceability: { uuid: traceability.uuid, hash_sha256: traceability.hash_sha256, generated_at: traceability.generated_at,
      verify_url: traceability.verify_url, qr_data_url: traceability.qr_data_url },
    hideHeader: false, hideFooter: true,
  })
  const sectionNotes = renderNotesAnnexesPdfTemplate({
    data: data.notesAnnexes, societe,
    traceability: { uuid: traceability.uuid, hash_sha256: traceability.hash_sha256, generated_at: traceability.generated_at,
      verify_url: traceability.verify_url, qr_data_url: traceability.qr_data_url },
    hideHeader: false, hideFooter: true,
  })

  // ─── Page finale : signature + hash + QR ──────────────────────────────────
  const pageFinale = `
    <div style="page-break-before: always; min-height: 240mm; display: flex; flex-direction: column; justify-content: space-between; padding: 20mm 0;">
      <div style="text-align:center;">
        <h2 style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; margin: 0 0 4mm;">Attestation et signature</h2>
        <p style="font-size: 10pt; color: #4B5563; max-width: 150mm; margin: 0 auto; line-height: 1.7;">
          Le présent dossier d&apos;états financiers, comprenant le Bilan, le Compte de résultat, le Tableau des Flux
          de Trésorerie et les Notes annexes, a été établi en conformité avec le référentiel SYSCOHADA révisé.
          Sa signature numérique est garantie par l&apos;empreinte SHA-256 ci-dessous.
        </p>
      </div>

      <div style="text-align: center; margin: 15mm 0;">
        <div style="display:inline-block; margin: 0 auto;">
          <div style="font-style: italic; color: #6B7280; margin-bottom: 20mm; font-size: 10pt;">Le directeur</div>
          <div style="min-width: 80mm; border-top: 0.6pt solid #1F4E79; padding-top: 2mm; font-weight: 700; color: #1F4E79;">${esc(raison)}</div>
        </div>
      </div>

      <div style="border-top: 1pt solid #1F4E79; padding-top: 6mm; margin-top: auto;">
        <div style="display:flex; justify-content: space-between; gap: 8mm; align-items: flex-end;">
          <div style="flex:1; font-size: 8.5pt; color: #4B5563; line-height: 1.6;">
            <div><strong style="color:#1F4E79;">Empreinte SHA-256 du dossier :</strong></div>
            <div style="font-family: 'Courier New', monospace; font-size: 8pt; word-break: break-all; margin-top: 1mm; color: #1F2937;">${esc(traceability.hash_sha256)}</div>
            <div style="margin-top: 3mm;"><strong style="color:#1F4E79;">Vérification :</strong> <span style="font-family: 'Courier New', monospace;">${esc(traceability.verify_url)}</span></div>
            <div style="margin-top: 1mm;"><strong style="color:#1F4E79;">Identifiant document :</strong> <span style="font-family: 'Courier New', monospace; font-size: 8pt;">${esc(traceability.uuid)}</span></div>
            <div style="margin-top: 2mm; font-style: italic; color: #6B7280;">Scannez le QR code ou saisissez l&apos;URL dans un navigateur pour vérifier l&apos;authenticité.</div>
          </div>
          <div style="flex-shrink: 0; text-align: center;">
            <img src="${esc(traceability.qr_data_url)}" alt="QR de vérification" style="width: 80px; height: 80px; display: block;" />
            <div style="font-size: 7pt; color: #9CA3AF; margin-top: 1.5mm; text-transform: uppercase; letter-spacing: 1px;">vérifier l&apos;authenticité</div>
          </div>
        </div>
      </div>
    </div>`

  // ─── Assemblage final ─────────────────────────────────────────────────────
  return `${pageGarde}
    ${wrapSection(sectionBilan, true)}
    ${wrapSection(sectionCR, true)}
    ${wrapSection(sectionTft, true)}
    ${wrapSection(sectionNotes, true)}
    ${pageFinale}`
}
