/**
 * Template HTML du PDF Journaux (Phase 4 §4.3).
 *
 * Pour chaque préfixe sélectionné, sous-titre + table chronologique +
 * sous-total. Pas de table des matières (vue chronologique pure).
 */

import { renderPdfHeader, type SocieteHeaderData } from "@/lib/pdf/buildHeader"
import { formatMontantPdf, formatDateFr, escapeHtml } from "@/lib/pdf/formatters"
import type { JournauxData, JournauxGroup } from "@/lib/compta/exports/buildJournaux"

export function renderJournauxTemplate(args: {
  data:    JournauxData
  societe: SocieteHeaderData
  /** Liste des journaux sélectionnés affichée en sous-titre (optionnel). */
  filtreJournaux?: string[]
}): string {
  const { data, societe, filtreJournaux } = args

  const sousTitre = filtreJournaux && filtreJournaux.length > 0 && !filtreJournaux.includes("all")
    ? `Filtre : ${filtreJournaux.join(" · ")}`
    : "Tous les journaux"

  const headerHtml = renderPdfHeader({
    societe,
    titre:    "Journaux comptables",
    dateFrom: data.date_from,
    dateTo:   data.date_to,
    sousTitre,
  })

  if (data.groups.length === 0) {
    return headerHtml + `<div class="pdf-empty">Aucune écriture comptable sur la période sélectionnée.</div>`
  }

  const groupsHtml = data.groups.map(g => renderGroup(g)).join("")

  const totauxHtml = `<div class="solde-line" style="margin-top: 8mm; background: #047857;">
    <span class="label">Totaux Journaux</span>
    <span class="value">${formatMontantPdf(data.total_debit)} F &nbsp;·&nbsp; ${formatMontantPdf(data.total_credit)} F</span>
  </div>`

  return headerHtml + groupsHtml + totauxHtml
}

function renderGroup(g: JournauxGroup): string {
  const lignesHtml = g.lignes.map(l => `<tr>
    <td class="date">${formatDateFr(l.date_ecriture)}</td>
    <td class="code">${escapeHtml(l.numero)}</td>
    <td class="code">${escapeHtml(l.compte_code)}</td>
    <td>${escapeHtml(l.compte_libelle)}</td>
    <td>${escapeHtml(l.libelle_ln || l.libelle_ec)}</td>
    <td class="num">${l.debit  > 0 ? formatMontantPdf(l.debit)  : "—"}</td>
    <td class="num">${l.credit > 0 ? formatMontantPdf(l.credit) : "—"}</td>
  </tr>`).join("")

  return `<section class="no-break" style="margin-top: 6mm;">
  <h3 class="pdf-subsection">${escapeHtml(g.journal_libelle)} <span style="color:#6B7280; font-weight:400; font-size:9pt;">(${escapeHtml(g.journal_code)})</span></h3>
  <table class="pdf-table">
    <thead>
      <tr>
        <th style="width:60px">Date</th>
        <th style="width:90px">N°</th>
        <th style="width:70px">Compte</th>
        <th>Libellé compte</th>
        <th>Libellé écriture</th>
        <th class="num" style="width:80px">Débit</th>
        <th class="num" style="width:80px">Crédit</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="5">Sous-total ${escapeHtml(g.journal_code)} (${g.lignes.length} ligne${g.lignes.length > 1 ? "s" : ""})</td>
        <td class="num">${formatMontantPdf(g.total_debit)}</td>
        <td class="num">${formatMontantPdf(g.total_credit)}</td>
      </tr>
    </tfoot>
  </table>
</section>`
}
