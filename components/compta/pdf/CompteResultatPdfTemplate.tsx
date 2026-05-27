/**
 * Template PDF Compte de résultat SYSCOHADA révisé (Phase 4.2 §6.2).
 *
 * Cascade des 9 SIG, comparatif N-1, hash de traçabilité en footer.
 */

import type { CompteResultatData, SIGRow } from "@/types/compta-ui"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

function fmtF(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (Math.abs(n) < 1) return "—"
  return (n < 0 ? "−" : "") + fmtF(n)
}
function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function esc(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export interface PdfTraceability {
  uuid:         string
  hash_sha256:  string
  generated_at: string
  /** URL complète affichée et encodée dans le QR code (ex "fleet.boyahgroup.com/verify/abc123def456") */
  verify_url?:  string
  /** PNG base64 (data URL) du QR code pointant vers verify_url — généré côté route */
  qr_data_url?: string
  /** @deprecated — Conservé pour rétrocompatibilité. Préférer verify_url. */
  verify_base_url?: string
}

const SIG_BG: Record<string, string> = {
  MARGE_COMMERCIALE:     "#FEF3C7",   // jaune clair
  PRODUCTION_EXERCICE:   "#FEF3C7",
  VALEUR_AJOUTEE:        "#DBEAFE",   // bleu clair
  EBE:                   "#DCFCE7",   // vert clair
  RESULTAT_EXPLOITATION: "#DCFCE7",
  RESULTAT_FINANCIER:    "#E0E7FF",   // indigo clair
  RAO:                   "#E0E7FF",
  HAO:                   "#FCE7F3",   // rose clair
  RESULTAT_NET:          "#1F4E79",   // bleu marine fort
}

export function renderCompteResultatPdfTemplate(opts: {
  data: CompteResultatData
  societe: SocieteHeaderData
  traceability: PdfTraceability
}): string {
  const { data, societe, traceability } = opts
  const raison = societe.raison_sociale ?? societe.nom_commercial ?? "Boyah Group SARL"
  const cc = (societe.numero_cc ?? societe.numero_contribuable)?.trim()
  const logoImg = societe.logo_signed_url
    ? `<img src="${esc(societe.logo_signed_url)}" alt="Logo" style="width:18mm; height:18mm; object-fit:contain; flex-shrink:0;" />`
    : ""

  const headerBloc = `
    <div style="display:flex; align-items:flex-start; gap:5mm; padding-bottom:5mm; border-bottom: 1.5pt solid #1F4E79; margin-bottom: 8mm;">
      ${logoImg}
      <div style="flex:1;">
        <div style="font-family: Georgia, serif; font-size: 16pt; font-weight: 900; color: #1F4E79;">${esc(raison)}</div>
        <div style="font-size: 8.5pt; color: #4B5563; margin-top: 1mm;">
          ${[
            societe.adresse_fiscale,
            societe.numero_rccm ? `RCCM ${esc(societe.numero_rccm)}` : null,
            cc ? `N° CC ${esc(cc)}` : null,
            societe.telephone,
          ].filter(Boolean).map(esc).join(" · ")}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280;">État financier</div>
        <div style="font-size: 11pt; font-weight: 700; color: #1F4E79; margin-top: 1mm;">SYSCOHADA révisé</div>
      </div>
    </div>
  `
  const titleBloc = `
    <div style="text-align:center; margin-bottom: 6mm;">
      <h1 style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; margin: 0;">COMPTE DE RÉSULTAT</h1>
      <p style="font-size: 10pt; color: #4B5563; margin: 1mm 0 0;">${esc(data.exercice_libelle)} · du ${fmtDateFr(data.date_debut)} au ${fmtDateFr(data.date_fin)}</p>
    </div>
  `

  // Cascade des 9 SIG
  function renderSig(sig: SIGRow, opts: { isHighlight: boolean }): string {
    const bg = SIG_BG[sig.code] ?? "#F3F4F6"
    const isFinal = sig.code === "RESULTAT_NET"
    const textColor = isFinal ? "white" : "#1F4E79"
    let detailRows = ""
    for (const d of sig.detail) {
      const signPrefix = d.signe === -1 ? "−" : "+"
      detailRows += `
        <tr>
          <td style="padding: 1mm 2mm 1mm 8mm; font-size: 8.5pt; color: #4B5563;">${signPrefix} ${esc(d.libelle)}</td>
          <td style="padding: 1mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color: #4B5563;">${fmtF(d.montant_n)}</td>
          <td style="padding: 1mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color: #9CA3AF;">${fmtF(d.montant_n_minus_1)}</td>
        </tr>`
    }
    return `
      ${detailRows}
      <tr style="background: ${bg}; ${isFinal ? "color: white;" : ""} border-top: 0.5pt solid #1F4E79;">
        <td style="padding: 2mm; font-size: 9.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: ${textColor};">= ${esc(sig.libelle)}</td>
        <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 900; text-align: right; color: ${textColor};">${fmtSigne(sig.total_n)}</td>
        <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 9.5pt; font-weight: 700; text-align: right; color: ${isFinal ? "#E5E7EB" : "#6B7280"};">${fmtSigne(sig.total_n_minus_1)}</td>
      </tr>
      ${!isFinal && opts.isHighlight ? `<tr><td colspan="3" style="padding: 0; height: 2mm;"></td></tr>` : ""}
    `
  }

  let bodyRows = ""
  data.sigs.forEach((sig, i) => {
    // page-break-before sur le SIG 6 (Résultat financier) pour scinder 5 / 4 sur 2 pages A4
    if (i === 5) bodyRows += `<tr><td colspan="3" style="padding: 0; height: 0; page-break-before: always;"></td></tr>`
    bodyRows += renderSig(sig, { isHighlight: i < data.sigs.length - 1 })
  })

  const tableBloc = `
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #F2EEDF; color: #1F4E79;">
          <th style="text-align:left;  padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Soldes Intermédiaires de Gestion</th>
          <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 24%;">Net N</th>
          <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 22%;">Net N-1</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `

  // PATCH Phase 4.2 — QR code + URL courte. Voir BilanPdfTemplate pour détails.
  const verifyUrl = traceability.verify_url
    ?? `${traceability.verify_base_url ?? "https://boyahgroup.com/compta/verify"}/${traceability.uuid}`
  const qrBloc = traceability.qr_data_url
    ? `<img src="${esc(traceability.qr_data_url)}" alt="QR de vérification" style="width:50px; height:50px; display:block;" />`
    : ""
  const traceBloc = `
    <div style="margin-top: 10mm; padding-top: 4mm; border-top: 0.5pt solid #E7E2D2; font-size: 7.5pt; color: #6B7280;">
      <div style="display:flex; justify-content: space-between; gap: 5mm; align-items: flex-start;">
        <div style="flex:1; min-width: 0;">
          <div><strong>Document généré le ${fmtDateFr(traceability.generated_at.slice(0,10))}</strong> à ${esc(traceability.generated_at.slice(11,19))}</div>
          <div style="margin-top: 1mm; font-family: 'Courier New', monospace; font-size: 7pt;">ID : ${esc(traceability.uuid)}</div>
          <div style="margin-top: 0.5mm; font-family: 'Courier New', monospace; font-size: 7pt; word-break: break-all;">Hash : ${esc(traceability.hash_sha256)}</div>
          <div style="margin-top: 1.5mm;">
            <strong style="color:#1F4E79;">Vérification :</strong>
            <span style="font-family: 'Courier New', monospace;">${esc(verifyUrl)}</span>
          </div>
          <div style="margin-top: 0.5mm; font-size: 6.5pt; color: #9CA3AF; font-style: italic;">
            Scannez le QR code ou saisissez l&apos;URL dans un navigateur pour vérifier l&apos;authenticité.
          </div>
        </div>
        <div style="display:flex; gap: 4mm; align-items: flex-start; flex-shrink: 0;">
          <div style="text-align:right; min-width: 42mm;">
            <div style="font-style: italic; margin-bottom: 10mm;">Le directeur</div>
            <div style="border-top: 0.4pt solid #6B7280; padding-top: 1mm;">${esc(raison)}</div>
          </div>
          ${qrBloc ? `<div style="flex-shrink:0; text-align:center;">${qrBloc}<div style="font-size: 6pt; color:#9CA3AF; margin-top: 0.5mm;">vérifier</div></div>` : ""}
        </div>
      </div>
    </div>
  `

  return `${headerBloc}${titleBloc}${tableBloc}${traceBloc}`
}
