/**
 * Template HTML de la Balance des comptes (Phase 4 §4.2).
 * Format A4 paysage (plus de colonnes).
 */

import { renderPdfHeader, type SocieteHeaderData } from "@/lib/pdf/buildHeader"
import { formatMontantPdf, escapeHtml } from "@/lib/pdf/formatters"
import type { BalanceData, BalanceClasse } from "@/lib/compta/exports/buildBalance"

const CLASSE_LABEL: Record<number, string> = {
  1: "Ressources durables",
  2: "Immobilisations",
  3: "Stocks",
  4: "Tiers",
  5: "Trésorerie",
  6: "Charges",
  7: "Produits",
  8: "Autres charges/produits",
  9: "Comptabilité analytique",
}

export function renderBalanceTemplate(args: {
  data:    BalanceData
  societe: SocieteHeaderData
}): string {
  const { data, societe } = args
  const headerHtml = renderPdfHeader({
    societe,
    titre:    "Balance des comptes",
    dateFrom: data.date_from,
    dateTo:   data.date_to,
  })

  if (data.classes.length === 0) {
    return headerHtml + `<div class="pdf-empty">Aucune écriture comptable sur la période sélectionnée.</div>`
  }

  const tableHtml = `<table class="pdf-table" style="margin-top: 4mm;">
  <thead>
    <tr>
      <th style="width:70px">Code</th>
      <th>Libellé du compte</th>
      <th class="num" style="width:90px">Σ Débit</th>
      <th class="num" style="width:90px">Σ Crédit</th>
      <th class="num" style="width:90px">Solde Db</th>
      <th class="num" style="width:90px">Solde Cr</th>
    </tr>
  </thead>
  <tbody>
    ${data.classes.map(c => renderClasseBlock(c)).join("")}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2"><strong>TOTAL GÉNÉRAL</strong></td>
      <td class="num">${formatMontantPdf(data.total_debit)}</td>
      <td class="num">${formatMontantPdf(data.total_credit)}</td>
      <td class="num">${formatMontantPdf(data.total_solde_debiteur)}</td>
      <td class="num">${formatMontantPdf(data.total_solde_crediteur)}</td>
    </tr>
  </tfoot>
</table>`

  const banner = data.equilibree
    ? `<div class="equilibre-banner ok">
        ✓ Comptabilité équilibrée — Σ Débits = Σ Crédits = ${formatMontantPdf(data.total_debit)} F
      </div>`
    : `<div class="equilibre-banner err">
        ⚠ DÉSÉQUILIBRE DÉTECTÉ — écart de ${formatMontantPdf(data.ecart)} F entre Σ Débits (${formatMontantPdf(data.total_debit)} F) et Σ Crédits (${formatMontantPdf(data.total_credit)} F)
      </div>`

  return headerHtml + tableHtml + banner
}

function renderClasseBlock(c: BalanceClasse): string {
  const label = CLASSE_LABEL[c.classe] ?? `Classe ${c.classe}`
  const headRow = `<tr style="background: rgba(31, 78, 121, 0.10);">
    <td colspan="6" style="font-weight:700; color:#1F4E79; padding: 6px 8px;">
      Classe ${c.classe} — ${escapeHtml(label)}
    </td>
  </tr>`
  const compteRows = c.comptes.map(l => `<tr>
    <td class="code">${escapeHtml(l.code)}</td>
    <td>${escapeHtml(l.libelle)}</td>
    <td class="num">${formatMontantPdf(l.total_debit)}</td>
    <td class="num">${formatMontantPdf(l.total_credit)}</td>
    <td class="num pos">${l.solde_debiteur > 0 ? formatMontantPdf(l.solde_debiteur) : "—"}</td>
    <td class="num amber">${l.solde_crediteur > 0 ? formatMontantPdf(l.solde_crediteur) : "—"}</td>
  </tr>`).join("")
  const subTotalRow = `<tr style="background: rgba(31, 78, 121, 0.04); font-weight: 600;">
    <td></td>
    <td><em>Sous-total classe ${c.classe}</em></td>
    <td class="num">${formatMontantPdf(c.total_debit)}</td>
    <td class="num">${formatMontantPdf(c.total_credit)}</td>
    <td class="num pos">${formatMontantPdf(c.total_solde_debiteur)}</td>
    <td class="num amber">${formatMontantPdf(c.total_solde_crediteur)}</td>
  </tr>`
  return headRow + compteRows + subTotalRow
}
