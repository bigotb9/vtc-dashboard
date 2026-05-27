/**
 * Template HTML du PDF Relevés de trésorerie (Phase 4 §4.4).
 *
 * Une "page" (section .page-break-before) par caisse/compte avec :
 *   - Header contenant : libellé + code interne + SYSCOHADA
 *   - Bloc soldes : initial · final · variation
 *   - Table des mouvements avec solde cumulé
 *   - Sous-totaux entrées/sorties + variation
 */

import { renderPdfHeader, type SocieteHeaderData } from "@/lib/pdf/buildHeader"
import { formatMontantPdf, formatMontantSign, formatDateFr, escapeHtml } from "@/lib/pdf/formatters"
import type { RelevesData, ReleveContenant } from "@/lib/compta/exports/buildReleves"

export function renderRelevesTemplate(args: {
  data:    RelevesData
  societe: SocieteHeaderData
}): string {
  const { data, societe } = args
  const headerHtml = renderPdfHeader({
    societe,
    titre:    "Relevés de trésorerie",
    dateFrom: data.date_from,
    dateTo:   data.date_to,
  })

  if (data.contenants.length === 0) {
    return headerHtml + `<div class="pdf-empty">Aucun contenant sélectionné ou aucun mouvement sur la période.</div>`
  }

  const totauxHtml = renderSyntheseGlobale(data)
  const sections = data.contenants.map((c, idx) => renderContenant(c, idx === 0)).join("")

  return headerHtml + totauxHtml + sections
}

function renderSyntheseGlobale(d: RelevesData): string {
  const variation = d.total_final - d.total_initial
  return `<section class="no-break" style="margin-bottom: 8mm;">
  <h2 class="pdf-section">Synthèse globale</h2>
  <table class="pdf-table">
    <thead><tr>
      <th class="num">Solde initial</th>
      <th class="num">Entrées</th>
      <th class="num">Sorties</th>
      <th class="num">Solde final</th>
      <th class="num">Variation</th>
    </tr></thead>
    <tbody><tr>
      <td class="num">${formatMontantPdf(d.total_initial)}</td>
      <td class="num pos">+ ${formatMontantPdf(d.total_entrees)}</td>
      <td class="num amber">− ${formatMontantPdf(d.total_sorties)}</td>
      <td class="num">${formatMontantPdf(d.total_final)}</td>
      <td class="num"><strong>${variation >= 0 ? "+" : "−"}${formatMontantPdf(Math.abs(variation))}</strong></td>
    </tr></tbody>
  </table>
</section>`
}

function renderContenant(c: ReleveContenant, isFirst: boolean): string {
  const variation = c.solde_final - c.solde_initial
  const subtypeLabel = c.type_cible === "caisse"
    ? (c.sous_type === "mobile_money" ? `Mobile money${c.operateur_banque ? ` · ${c.operateur_banque}` : ""}` : "Caisse cash")
    : `Compte bancaire${c.operateur_banque ? ` · ${c.operateur_banque}` : ""}`

  const lignesHtml = c.mouvements.length === 0
    ? `<tr><td colspan="6" style="text-align:center; color:#6B7280; font-style:italic; padding: 8mm 0;">Aucun mouvement sur la période</td></tr>`
    : c.mouvements.map(m => `<tr>
        <td class="date">${formatDateFr(m.date_operation)}</td>
        <td>${escapeHtml(m.libelle)}</td>
        <td>${escapeHtml(m.categorie ?? "—")}</td>
        <td class="num pos">${m.type === "entree" ? "+ " + formatMontantPdf(m.montant) : "—"}</td>
        <td class="num amber">${m.type === "sortie" ? "− " + formatMontantPdf(m.montant) : "—"}</td>
        <td class="num"><strong>${formatMontantSign(m.solde_cumule)}</strong></td>
      </tr>`).join("")

  return `<section class="compte-block ${isFirst ? "" : "page-break-before"}">
  <div class="compte-header">
    <span class="compte-code">${escapeHtml(c.code ?? c.id.slice(0, 6))}</span>
    <span class="compte-libelle">${escapeHtml(c.libelle)}</span>
    <span class="compte-classe">${escapeHtml(c.type_cible.toUpperCase())} · ${escapeHtml(subtypeLabel)}</span>
  </div>
  ${c.syscohada_code ? `<div style="font-size: 9pt; color: #6B7280; margin: 1mm 0 4mm 4px;">
    Compte SYSCOHADA : <span style="font-family: 'Courier New', monospace; color: #6B21A8; font-weight: 700;">${escapeHtml(c.syscohada_code)}</span> ${c.syscohada_libelle ? `— ${escapeHtml(c.syscohada_libelle)}` : ""}
  </div>` : ""}

  <table class="pdf-table" style="margin-bottom: 4mm;">
    <thead><tr>
      <th class="num">Solde initial</th>
      <th class="num">Σ Entrées</th>
      <th class="num">Σ Sorties</th>
      <th class="num">Solde final</th>
      <th class="num">Variation</th>
    </tr></thead>
    <tbody><tr>
      <td class="num">${formatMontantSign(c.solde_initial)}</td>
      <td class="num pos">+ ${formatMontantPdf(c.total_entrees)}</td>
      <td class="num amber">− ${formatMontantPdf(c.total_sorties)}</td>
      <td class="num"><strong>${formatMontantSign(c.solde_final)}</strong></td>
      <td class="num"><strong>${variation >= 0 ? "+" : "−"}${formatMontantPdf(Math.abs(variation))}</strong></td>
    </tr></tbody>
  </table>

  <h3 class="pdf-subsection" style="margin-top: 4mm;">Mouvements de la période (${c.mouvements.length})</h3>
  <table class="pdf-table">
    <thead>
      <tr>
        <th style="width:60px">Date</th>
        <th>Libellé</th>
        <th style="width:90px">Catégorie</th>
        <th class="num" style="width:80px">Entrée</th>
        <th class="num" style="width:80px">Sortie</th>
        <th class="num" style="width:90px">Solde</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>
</section>`
}
