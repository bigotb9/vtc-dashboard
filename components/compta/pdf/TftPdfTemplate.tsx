/**
 * Template PDF Tableau Flux de Trésorerie SYSCOHADA (Phase 4.3 Module 3).
 *
 * 3 sections (A opérationnel, B investissement, C financement) + variation
 * nette + réconciliation avec la trésorerie du Bilan.
 */

import type { TftData, TftSection } from "@/types/compta-ui"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (Math.abs(n) < 1) return "—"
  return (n < 0 ? "−" : "+") + fmt(n)
}
function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function esc(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const SECTION_TONE: Record<TftSection["code"], { bg: string; text: string }> = {
  OPERATIONNEL:    { bg: "#DCFCE7", text: "#166534" },
  INVESTISSEMENT:  { bg: "#DBEAFE", text: "#1E40AF" },
  FINANCEMENT:     { bg: "#FEF3C7", text: "#92400E" },
}

export interface TftPdfTraceability {
  uuid:         string
  hash_sha256:  string
  generated_at: string
  verify_url?:  string
  qr_data_url?: string
}

export function renderTftPdfTemplate(opts: {
  data:         TftData
  societe:      SocieteHeaderData
  traceability: TftPdfTraceability
  hideHeader?:  boolean
  hideFooter?:  boolean
}): string {
  const { data, societe, traceability, hideHeader, hideFooter } = opts
  const raison = societe.raison_sociale ?? societe.nom_commercial ?? "Boyah Group SARL"
  const cc = (societe.numero_cc ?? societe.numero_contribuable)?.trim()

  const logoImg = societe.logo_signed_url
    ? `<img src="${esc(societe.logo_signed_url)}" alt="Logo" style="width:18mm; height:18mm; object-fit:contain; flex-shrink:0;" />`
    : ""
  const headerBloc = hideHeader ? "" : `
    <div style="display:flex; align-items:flex-start; gap:5mm; padding-bottom:5mm; border-bottom: 1.5pt solid #1F4E79; margin-bottom: 8mm;">
      ${logoImg}
      <div style="flex:1;">
        <div style="font-family: Georgia, serif; font-size: 16pt; font-weight: 900; color: #1F4E79;">${esc(raison)}</div>
        <div style="font-size: 8.5pt; color: #4B5563; margin-top: 1mm;">
          ${[societe.adresse_fiscale, societe.numero_rccm ? `RCCM ${esc(societe.numero_rccm)}` : null, cc ? `N° CC ${esc(cc)}` : null, societe.telephone].filter(Boolean).map(esc).join(" · ")}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280;">État financier</div>
        <div style="font-size: 11pt; font-weight: 700; color: #1F4E79; margin-top: 1mm;">SYSCOHADA révisé</div>
      </div>
    </div>`
  const titleBloc = `
    <div style="text-align:center; margin-bottom: 6mm;">
      <h1 style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; margin: 0;">TABLEAU DES FLUX DE TRÉSORERIE</h1>
      <p style="font-size: 10pt; color: #4B5563; margin: 1mm 0 0;">Exercice ${esc(data.exercice_libelle)} · arrêté au ${fmtDateFr(data.date_arrete)}</p>
    </div>`

  // ─── Sections A, B, C ────────────────────────────────────────────────────
  function renderSection(sec: TftSection, letter: "A" | "B" | "C"): string {
    const tone = SECTION_TONE[sec.code]
    let lignes = ""
    for (const l of sec.lignes) {
      const sign = l.signe > 0 ? "+" : "−"
      lignes += `
        <tr style="border-top: 0.3pt solid #E7E2D2;">
          <td style="padding: 1.3mm 2mm 1.3mm 8mm; font-size: 9pt; color: #4B5563;">${esc(sign)} ${esc(l.libelle)}</td>
          <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right;">${fmt(l.montant_n)}</td>
          <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right; color: #9CA3AF;">${fmt(l.montant_n_minus_1)}</td>
        </tr>`
    }
    return `
      <tr style="background: #1F4E79; color: white;">
        <td colspan="3" style="padding: 2mm; font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">${letter} — ${esc(sec.libelle)}</td>
      </tr>
      ${lignes}
      <tr style="background: ${tone.bg}; color: ${tone.text}; border-top: 0.7pt solid ${tone.text};">
        <td style="padding: 2mm; font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">FLUX ${letter}</td>
        <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10.5pt; font-weight: 900; text-align: right;">${fmtSigne(sec.total_n)}</td>
        <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 700; text-align: right;">${fmtSigne(sec.total_n_minus_1)}</td>
      </tr>
      <tr><td colspan="3" style="padding: 0; height: 3mm;"></td></tr>`
  }

  let bodyRows = ""
  data.sections.forEach((sec, i) => {
    const letter = (["A", "B", "C"] as const)[i]
    bodyRows += renderSection(sec, letter)
  })

  // Variation nette
  bodyRows += `
    <tr style="background: #1F4E79; color: white; border-top: 1pt solid #1F4E79;">
      <td style="padding: 2.5mm 2mm; font-size: 10.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">VARIATION NETTE DE TRÉSORERIE (A + B + C)</td>
      <td style="padding: 2.5mm 2mm; font-family: 'Courier New', monospace; font-size: 12pt; font-weight: 900; text-align: right;">${fmtSigne(data.variation_n)}</td>
      <td style="padding: 2.5mm 2mm; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 700; text-align: right;">${fmtSigne(data.variation_n_minus_1)}</td>
    </tr>`

  const tableBloc = `
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #F2EEDF; color: #1F4E79;">
          <th style="text-align:left;  padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Composante</th>
          <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 22%;">Net N</th>
          <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 22%;">Net N-1</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`

  // ─── Réconciliation Bilan ────────────────────────────────────────────────
  const ecartOk = Math.abs(data.ecart_reconciliation) < 1
  const reconBloc = `
    <div style="margin-top: 6mm; padding: 4mm; border-radius: 2mm; ${ecartOk
      ? "background: #DCFCE7; color: #166534; border: 1pt solid #16653433;"
      : "background: #FEE2E2; color: #991B1B; border: 1pt solid #99131933;"}">
      <div style="font-size: 9.5pt; font-weight: 700; margin-bottom: 2mm; text-transform: uppercase; letter-spacing: 1px;">
        ${ecartOk ? "✓ TFT cohérent avec le Bilan" : "✗ TFT incohérent avec le Bilan"}
      </div>
      <table style="width: 100%; font-size: 9pt;">
        <tr><td style="padding: 0.8mm 0;">Trésorerie au début de l'exercice</td>
            <td style="padding: 0.8mm 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 700;">${fmt(data.treso_debut_n)} F</td></tr>
        <tr><td style="padding: 0.8mm 0;">+ Variation nette (A + B + C)</td>
            <td style="padding: 0.8mm 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 700;">${fmtSigne(data.variation_n)} F</td></tr>
        <tr style="border-top: 0.5pt solid currentColor;"><td style="padding: 1mm 0;"><strong>= Trésorerie attendue à la fin</strong></td>
            <td style="padding: 1mm 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 900;">${fmt(data.treso_debut_n + data.variation_n)} F</td></tr>
        <tr><td style="padding: 0.8mm 0;">Trésorerie réelle à la fin (Bilan)</td>
            <td style="padding: 0.8mm 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 700;">${fmt(data.treso_fin_n)} F</td></tr>
        ${!ecartOk ? `<tr style="border-top: 0.5pt solid currentColor;"><td style="padding: 1mm 0;"><strong>Écart de réconciliation</strong></td>
          <td style="padding: 1mm 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 900;">${fmtSigne(data.ecart_reconciliation)} F</td></tr>` : ""}
      </table>
      ${!ecartOk ? `<p style="font-size: 8.5pt; margin: 2mm 0 0; font-style: italic;">Cause probable : écritures incomplètes, mouvements de trésorerie non rattachés à un flux opérationnel/investissement/financement, ou erreur de classification de compte.</p>` : ""}
    </div>`

  // ─── Footer traçabilité ──────────────────────────────────────────────────
  const verifyUrl = traceability.verify_url ?? "—"
  const qrBloc = traceability.qr_data_url
    ? `<img src="${esc(traceability.qr_data_url)}" alt="QR de vérification" style="width:50px; height:50px; display:block;" />`
    : ""
  const traceBloc = hideFooter ? "" : `
    <div style="margin-top: 10mm; padding-top: 4mm; border-top: 0.5pt solid #E7E2D2; font-size: 7.5pt; color: #6B7280;">
      <div style="display:flex; justify-content: space-between; gap: 5mm; align-items: flex-start;">
        <div style="flex:1; min-width: 0;">
          <div><strong>Document généré le ${fmtDateFr(traceability.generated_at.slice(0,10))}</strong> à ${esc(traceability.generated_at.slice(11,19))}</div>
          <div style="margin-top: 1mm; font-family: 'Courier New', monospace; font-size: 7pt;">ID : ${esc(traceability.uuid)}</div>
          <div style="margin-top: 0.5mm; font-family: 'Courier New', monospace; font-size: 7pt; word-break: break-all;">Hash : ${esc(traceability.hash_sha256)}</div>
          <div style="margin-top: 1.5mm;"><strong style="color:#1F4E79;">Vérification :</strong> <span style="font-family: 'Courier New', monospace;">${esc(verifyUrl)}</span></div>
        </div>
        <div style="display:flex; gap: 4mm; align-items: flex-start; flex-shrink: 0;">
          <div style="text-align:right; min-width: 42mm;">
            <div style="font-style: italic; margin-bottom: 10mm;">Le directeur</div>
            <div style="border-top: 0.4pt solid #6B7280; padding-top: 1mm;">${esc(raison)}</div>
          </div>
          ${qrBloc ? `<div style="flex-shrink:0; text-align:center;">${qrBloc}<div style="font-size: 6pt; color:#9CA3AF; margin-top: 0.5mm;">vérifier</div></div>` : ""}
        </div>
      </div>
    </div>`

  return `${headerBloc}${titleBloc}${tableBloc}${reconBloc}${traceBloc}`
}
