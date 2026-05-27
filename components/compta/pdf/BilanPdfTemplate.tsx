/**
 * Template PDF du Bilan SYSCOHADA révisé (Phase 4.2 §6.1).
 *
 * Layout :
 *   - En-tête société (logo + identité légale)
 *   - Titre "BILAN ARRÊTÉ AU 31/12/YYYY"
 *   - Tableau Actif (colonnes : Brut, Amort, Net N, Net N-1)
 *   - Tableau Passif (colonnes : Net N, Net N-1)
 *   - Bandeau équilibre
 *   - Footer : hash de traçabilité + UUID + URL verify
 */

import type { BilanData } from "@/types/compta-ui"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

function fmtF(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (n === 0) return "—"
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

export interface BilanPdfTraceability {
  uuid:        string
  hash_sha256: string
  generated_at: string
  /** URL complète affichée et encodée dans le QR code (ex "fleet.boyahgroup.com/verify/abc123def456") */
  verify_url?:  string
  /** PNG base64 (data URL) du QR code pointant vers verify_url — généré côté route */
  qr_data_url?: string
  /** @deprecated — Conservé pour rétrocompatibilité. Préférer verify_url. */
  verify_base_url?: string
}

export function renderBilanPdfTemplate(opts: {
  data:        BilanData
  societe:     SocieteHeaderData
  traceability: BilanPdfTraceability
}): string {
  const { data, societe, traceability } = opts

  // ─── Header société (logo + identité) ─────────────────────────────────────
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
            societe.capital_social && societe.capital_social > 0 ? `Capital ${fmtF(societe.capital_social)} F` : null,
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
      <h1 style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; margin: 0;">BILAN</h1>
      <p style="font-size: 10pt; color: #4B5563; margin: 1mm 0 0;">Arrêté au ${fmtDateFr(data.date_arrete)} · ${esc(data.exercice_libelle)}</p>
    </div>
  `

  // ─── Tableau Actif ────────────────────────────────────────────────────────
  let actifRows = ""
  for (const sec of data.actif_sections) {
    actifRows += `
      <tr style="background: #1F4E79; color: white;">
        <td colspan="4" style="padding: 1.5mm 2mm; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${esc(sec.libelle)}</td>
      </tr>`
    for (const l of sec.lignes) {
      actifRows += `
        <tr style="border-top: 0.3pt solid #E7E2D2;">
          <td style="padding: 1.2mm 2mm; font-size: 9pt;">${esc(l.libelle)}</td>
          <td style="padding: 1.2mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right;">${fmtF(l.brut_n)}</td>
          <td style="padding: 1.2mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right; color: #9C2D14;">${fmtF(l.amort_n)}</td>
          <td style="padding: 1.2mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right; font-weight: 700;">${fmtF(l.net_n)}</td>
        </tr>`
    }
    actifRows += `
      <tr style="background: #F2EEDF; color: #1F4E79; border-top: 0.5pt solid #1F4E79;">
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt; font-weight: 700;">Sous-total</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; text-align: right;">${fmtF(sec.total_brut_n)}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; text-align: right;">${fmtF(sec.total_amort_n)}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; text-align: right;">${fmtF(sec.total_net_n)}</td>
      </tr>`
  }
  const actifBloc = `
    <div style="margin-bottom: 6mm;">
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #F2EEDF; color: #1F4E79;">
            <th style="text-align:left;  padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Actif</th>
            <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 24%;">Brut</th>
            <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 22%;">Amort / Prov</th>
            <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 22%;">Net N</th>
          </tr>
        </thead>
        <tbody>${actifRows}</tbody>
        <tfoot>
          <tr style="background: #1F4E79; color: white;">
            <td style="padding: 2mm; font-size: 9.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">TOTAL ACTIF</td>
            <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 900; text-align: right;">${fmtF(data.total_actif_brut_n)}</td>
            <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 900; text-align: right;">${fmtF(data.total_actif_amort_n)}</td>
            <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10.5pt; font-weight: 900; text-align: right;">${fmtF(data.total_actif_net_n)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `

  // ─── Tableau Passif ───────────────────────────────────────────────────────
  let passifRows = ""
  for (const sec of data.passif_sections) {
    passifRows += `
      <tr style="background: #1F4E79; color: white;">
        <td colspan="3" style="padding: 1.5mm 2mm; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${esc(sec.libelle)}</td>
      </tr>`
    for (const l of sec.lignes) {
      passifRows += `
        <tr style="border-top: 0.3pt solid #E7E2D2;">
          <td style="padding: 1.2mm 2mm; font-size: 9pt;">${esc(l.libelle)}</td>
          <td style="padding: 1.2mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right; font-weight: 700;">${fmtF(l.net_n)}</td>
          <td style="padding: 1.2mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; text-align: right; color: #6B7280;">${fmtF(l.net_n_minus_1)}</td>
        </tr>`
    }
    passifRows += `
      <tr style="background: #F2EEDF; color: #1F4E79; border-top: 0.5pt solid #1F4E79;">
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt; font-weight: 700;">Sous-total</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; text-align: right;">${fmtF(sec.total_net_n)}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; text-align: right; color: #6B7280;">${fmtF(sec.total_net_n_minus_1)}</td>
      </tr>`
  }
  const passifBloc = `
    <div style="margin-bottom: 6mm; page-break-before: always;">
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #F2EEDF; color: #1F4E79;">
            <th style="text-align:left;  padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Passif</th>
            <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 24%;">Net N</th>
            <th style="text-align:right; padding: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; width: 24%;">Net N-1</th>
          </tr>
        </thead>
        <tbody>${passifRows}</tbody>
        <tfoot>
          <tr style="background: #1F4E79; color: white;">
            <td style="padding: 2mm; font-size: 9.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">TOTAL PASSIF</td>
            <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10.5pt; font-weight: 900; text-align: right;">${fmtF(data.total_passif_net_n)}</td>
            <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 900; text-align: right; opacity: 0.85;">${fmtF(data.total_passif_net_n_minus_1)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `

  // ─── Bandeau équilibre ────────────────────────────────────────────────────
  const equilibreOk = Math.abs(data.ecart_n) < 1
  const equilibreBloc = `
    <div style="margin: 6mm 0; padding: 3mm 4mm; border-radius: 2mm; ${equilibreOk
      ? "background: #DCFCE7; color: #166534;"
      : "background: #FEE2E2; color: #991B1B;"} font-size: 10pt; font-weight: 700; text-align: center;">
      ${equilibreOk
        ? `✓ Équilibre comptable vérifié : Total Actif = Total Passif = ${fmtF(data.total_actif_net_n)} F`
        : `✗ Déséquilibre : écart de ${fmtSigne(data.ecart_n)} F (Total Actif ${fmtF(data.total_actif_net_n)} − Total Passif ${fmtF(data.total_passif_net_n)})`}
    </div>
  `

  // ─── Footer : signature + hash de traçabilité + QR code ──────────────────
  // PATCH Phase 4.2 — Préférence verify_url (URL courte fleet.boyahgroup.com/verify/XXX)
  // + QR code 50×50 px (≈ 13 mm) à droite. Le QR est pré-généré côté route via `qrcode` (async).
  const verifyUrl = traceability.verify_url
    ?? `${traceability.verify_base_url ?? "https://boyahgroup.com/compta/verify"}/${traceability.uuid}`
  // QR : taille HTML 50×50 px conformément à la spec — soit ≈ 13.2 mm à 96 DPI.
  // Source générée en 200 px par la route → down-scaling propre à l'impression.
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

  return `${headerBloc}${titleBloc}${actifBloc}${passifBloc}${equilibreBloc}${traceBloc}`
}
