/**
 * Template HTML du Grand Livre (Phase 4 §4.1).
 *
 * Pas un composant React rendu : renvoie directement une string HTML.
 * On évite renderToStaticMarkup ici pour rester léger côté serverless
 * et garder un contrôle 100% du HTML final.
 */

import { renderPdfHeader, type SocieteHeaderData } from "@/lib/pdf/buildHeader"
import { formatMontantPdf, formatDateFr, escapeHtml } from "@/lib/pdf/formatters"
import type { GrandLivreData, GrandLivreCompte, GrandLivreLigne } from "@/lib/compta/exports/buildGrandLivre"

export function renderGrandLivreTemplate(args: {
  data:    GrandLivreData
  societe: SocieteHeaderData
}): string {
  const { data, societe } = args
  const headerHtml = renderPdfHeader({
    societe,
    titre:    "Grand Livre",
    dateFrom: data.date_from,
    dateTo:   data.date_to,
  })

  if (data.comptes.length === 0) {
    return headerHtml + `<div class="pdf-empty">Aucune écriture comptable sur la période sélectionnée.</div>`
  }

  // Table des matières (optionnelle pour > 10 comptes)
  const tocHtml = data.comptes.length > 10 ? renderToc(data.comptes) : ""

  // Bloc par compte
  const comptesHtml = data.comptes.map(c => renderCompte(c)).join("")

  // Totaux globaux
  const totauxHtml = `<div class="solde-line" style="margin-top: 8mm; background: #047857;">
  <span class="label">Totaux Grand Livre</span>
  <span class="value">${formatMontantPdf(data.total_debit)} F &nbsp;·&nbsp; ${formatMontantPdf(data.total_credit)} F</span>
</div>`

  return headerHtml + tocHtml + comptesHtml + totauxHtml
}

function renderToc(comptes: GrandLivreCompte[]): string {
  const rows = comptes.map(c => `<tr>
    <td class="code">${escapeHtml(c.code)}</td>
    <td>${escapeHtml(c.libelle)}</td>
    <td class="num">${c.lignes.length}</td>
  </tr>`).join("")
  return `<section class="no-break" style="margin-bottom: 8mm;">
  <h2 class="pdf-section">Sommaire des comptes</h2>
  <table class="pdf-table">
    <thead><tr><th>Code</th><th>Libellé</th><th class="num">N° lignes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
<div class="page-break-before"></div>`
}

function renderCompte(c: GrandLivreCompte): string {
  const lignesHtml = c.lignes.map((l: GrandLivreLigne) => `<tr>
    <td class="date">${formatDateFr(l.date_ecriture)}</td>
    <td class="code">${escapeHtml(l.numero)}</td>
    <td>${escapeHtml(l.libelle_ligne || l.libelle)}</td>
    <td class="num">${l.debit > 0 ? formatMontantPdf(l.debit) : "—"}</td>
    <td class="num">${l.credit > 0 ? formatMontantPdf(l.credit) : "—"}</td>
  </tr>`).join("")

  const natureLabel = c.nature === "debiteur"
    ? "Solde débiteur"
    : c.nature === "crediteur"
      ? "Solde créditeur"
      : "Soldé"
  const soldeValue = c.nature === "debiteur"
    ? formatMontantPdf(c.solde)
    : c.nature === "crediteur"
      ? formatMontantPdf(-c.solde)
      : "—"

  return `<section class="compte-block no-break">
  <div class="compte-header">
    <span class="compte-code">${escapeHtml(c.code)}</span>
    <span class="compte-libelle">${escapeHtml(c.libelle)}</span>
    <span class="compte-classe">Classe ${c.classe}</span>
  </div>
  <table class="pdf-table">
    <thead>
      <tr>
        <th style="width:70px">Date</th>
        <th style="width:90px">N°</th>
        <th>Libellé</th>
        <th class="num" style="width:90px">Débit</th>
        <th class="num" style="width:90px">Crédit</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="3">Totaux du compte (${c.lignes.length} ligne${c.lignes.length > 1 ? "s" : ""})</td>
        <td class="num">${formatMontantPdf(c.total_debit)}</td>
        <td class="num">${formatMontantPdf(c.total_credit)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="solde-line">
    <span class="label">${natureLabel}</span>
    <span class="value">${soldeValue} F</span>
  </div>
</section>`
}
