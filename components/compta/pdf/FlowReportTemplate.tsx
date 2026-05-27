/**
 * Template HTML pour le PDF "Rapport flux" (Dépenses ou Recettes).
 * Phase 4.x Vague 3.5 §2.2.7.
 *
 * Sections : en-tête société + bandeau période + 4 KPIs + table opérations + total.
 */

import type { FlowKind, FlowOperationItem, FlowStatsResponse } from "@/types/compta-ui"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

function formatF(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ | /g, " ")
}
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const SOURCE_LABELS: Record<string, string> = {
  manuel:            "Manuel",
  recette_wave:      "Wave",
  depense_vehicule:  "Véhicule",
  versement_client:  "Versement",
  transfert_interne: "Transfert",
  dotation_amort:    "Dotation",
  import_csv:        "Import",
}

export function renderFlowReportTemplate(opts: {
  kind:        FlowKind
  data:        FlowOperationItem[]
  stats:       FlowStatsResponse
  periode:     { from: string; to: string }
  societe:     SocieteHeaderData
  generated_at: string
}): string {
  const { kind, data, stats, periode, societe, generated_at } = opts
  const isDep = kind === "depenses"
  const title = isDep ? "Rapport Dépenses" : "Rapport Recettes"
  const accent = isDep ? "#E11D48" : "#059669"
  const accentLight = isDep ? "#FEE2E2" : "#DCFCE7"
  const sign = isDep ? "−" : "+"
  const dateFr = `${formatDateFr(periode.from)} – ${formatDateFr(periode.to)}`

  // En-tête société (Phase 4.2 — avec logo)
  const raisonSociale = societe.raison_sociale ?? societe.nom_commercial ?? "Boyah Group SARL"
  const logoImg = societe.logo_signed_url
    ? `<img src="${esc(societe.logo_signed_url)}" alt="Logo" style="width:16mm; height:16mm; object-fit:contain; flex-shrink:0;" />`
    : ""
  const societeBloc = `
    <div style="margin-bottom: 10mm; display:flex; align-items:flex-start; gap:5mm;">
      ${logoImg}
      <div style="flex:1;">
        <div style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; letter-spacing: -0.5px;">
          ${esc(raisonSociale)}
        </div>
        <div style="font-size: 9pt; color: #6B7280; margin-top: 1mm;">
          ${[
            societe.adresse_fiscale,
            societe.numero_rccm ? `RCCM ${esc(societe.numero_rccm)}` : null,
            (societe.numero_cc ?? societe.numero_contribuable) ? `N° CC ${esc(((societe.numero_cc ?? societe.numero_contribuable) as string))}` : null,
            societe.telephone,
          ].filter(Boolean).map(esc).join(" · ")}
        </div>
      </div>
    </div>
  `

  // Bandeau titre
  const titleBloc = `
    <div style="background: ${accent}; color: white; padding: 5mm 6mm; border-radius: 3mm; margin-bottom: 6mm;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 4mm;">
        <div>
          <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 2px; opacity: 0.85;">Synthèse</div>
          <div style="font-size: 20pt; font-weight: 900; margin-top: 1mm;">${title}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85;">Période</div>
          <div style="font-size: 11pt; font-weight: 700; margin-top: 1mm; font-family: 'Courier New', monospace;">${esc(dateFr)}</div>
        </div>
      </div>
    </div>
  `

  // 4 KPIs
  const trendStr = stats.trend_pct === null
    ? "—"
    : `${stats.trend_pct >= 0 ? "↑" : "↓"} ${Math.abs(stats.trend_pct).toFixed(0)}%`
  const topCats = stats.top_categories.slice(0, 3).map(c =>
    `<div style="display:flex; justify-content:space-between; gap:2mm; font-size:8.5pt;"><span>${esc(c.libelle)}</span><span style="font-family:'Courier New',monospace; font-weight:700;">${formatF(c.total)} F</span></div>`,
  ).join("") || `<div style="font-size:8.5pt; color:#9CA3AF; font-style:italic;">Aucune</div>`
  const top3 = isDep ? stats.top_tiers : stats.top_chauffeurs
  const top3Label = isDep ? "Top tiers" : "Top chauffeurs"
  const top3Html = top3.slice(0, 3).map(c =>
    `<div style="display:flex; justify-content:space-between; gap:2mm; font-size:8.5pt;"><span>${esc(c.libelle)}</span><span style="font-family:'Courier New',monospace; font-weight:700;">${formatF(c.total)} F</span></div>`,
  ).join("") || `<div style="font-size:8.5pt; color:#9CA3AF; font-style:italic;">Aucun</div>`

  const kpisBloc = `
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 6mm;">
      <div style="background: white; border: 0.5pt solid #E7E2D2; border-radius: 2mm; padding: 3mm;">
        <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280;">${isDep ? "Total dépenses" : "Total recettes"}</div>
        <div style="font-size: 14pt; font-weight: 900; color: ${accent}; margin-top: 1mm; font-family: 'Courier New', monospace;">
          ${sign}${formatF(stats.total_period)} F
        </div>
        <div style="font-size: 7.5pt; color: #6B7280; margin-top: 1mm;">${trendStr} vs période préc.</div>
      </div>
      <div style="background: white; border: 0.5pt solid #E7E2D2; border-radius: 2mm; padding: 3mm;">
        <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280; margin-bottom: 2mm;">Top catégories</div>
        ${topCats}
      </div>
      <div style="background: white; border: 0.5pt solid #E7E2D2; border-radius: 2mm; padding: 3mm;">
        <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280; margin-bottom: 2mm;">${top3Label}</div>
        ${top3Html}
      </div>
      <div style="background: white; border: 0.5pt solid #E7E2D2; border-radius: 2mm; padding: 3mm;">
        <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280;">Moyenne / jour</div>
        <div style="font-size: 14pt; font-weight: 900; color: #1F4E79; margin-top: 1mm; font-family: 'Courier New', monospace;">
          ${formatF(stats.avg_per_day)} F
        </div>
        <div style="font-size: 7.5pt; color: #6B7280; margin-top: 1mm;">Sur ${stats.count_days} jour${stats.count_days > 1 ? "s" : ""}</div>
      </div>
    </div>
  `

  // Tableau opérations
  const rows = data.map(op => `
    <tr style="border-top: 0.3pt solid #E7E2D2;">
      <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 8pt; white-space: nowrap;">${formatDateFr(op.date_op)}</td>
      <td style="padding: 1.3mm 2mm; font-size: 8.5pt;">
        ${esc(op.libelle)}
        ${op.tiers || op.vehicule ? `<br/><span style="font-size:7pt; color:#6B7280;">${[op.tiers?.nom, op.vehicule?.immatriculation, op.tiers?.compte_syscohada_code].filter(Boolean).map(esc).join(" · ")}</span>` : ""}
      </td>
      <td style="padding: 1.3mm 2mm; font-size: 8pt; color: #4B5563;">${esc(op.categorie?.libelle ?? "—")}</td>
      <td style="padding: 1.3mm 2mm; font-size: 8pt; color: #4B5563;">${esc(op.caisse?.libelle ?? "—")}</td>
      <td style="padding: 1.3mm 2mm; font-size: 7.5pt; color: #6B7280; text-transform: uppercase; letter-spacing: 1px;">${esc(SOURCE_LABELS[op.source] ?? op.source)}</td>
      <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; text-align: right; color: ${accent};">${sign}${formatF(op.montant)}</td>
    </tr>
  `).join("")

  const tableBloc = `
    <div>
      <div style="font-size: 10pt; font-weight: 900; color: #1F4E79; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2mm; padding-bottom: 1mm; border-bottom: 0.5pt solid #E7E2D2;">
        Opérations · ${stats.count_period}
      </div>
      ${data.length === 0
        ? `<div style="text-align:center; padding: 10mm; font-size: 10pt; color: #9CA3AF; font-style: italic;">Aucune opération sur la période.</div>`
        : `<table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="background: ${accentLight}; color: ${accent};">
                <th style="text-align:left; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Date</th>
                <th style="text-align:left; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Libellé</th>
                <th style="text-align:left; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Catégorie</th>
                <th style="text-align:left; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Caisse</th>
                <th style="text-align:left; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Source</th>
                <th style="text-align:right; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Montant (F)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="border-top: 1.5pt solid ${accent}; background: ${accentLight};">
                <td colspan="5" style="padding: 2mm; font-weight: 900; color: ${accent}; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1px;">Total période</td>
                <td style="padding: 2mm; font-family: 'Courier New', monospace; font-size: 11pt; font-weight: 900; text-align: right; color: ${accent};">
                  ${sign}${formatF(stats.total_period)} F
                </td>
              </tr>
            </tfoot>
          </table>`}
    </div>
  `

  const footBloc = `
    <div style="margin-top: 10mm; padding-top: 3mm; border-top: 0.4pt solid #E7E2D2; font-size: 8pt; color: #9CA3AF; text-align: center;">
      Document généré le ${formatDateFr(generated_at.slice(0, 10))} · Fleet Boyah · Module Comptabilité
    </div>
  `

  return `${societeBloc}${titleBloc}${kpisBloc}${tableBloc}${footBloc}`
}
