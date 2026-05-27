/**
 * Template PDF Notes annexes simplifiées (Phase 4.3 Module 2).
 *
 * Structure : 6 notes sur ~4-6 pages.
 *   Note 1 : Méthodes comptables (texte)
 *   Note 2 : État des immobilisations (tableau)
 *   Note 3 : Dotations aux amortissements (tableau)
 *   Note 4 : Créances et dettes (deux tableaux)
 *   Note 5 : Variation des capitaux propres (tableau)
 *   Note 6 : Engagements hors bilan (texte)
 */

import type { NotesAnnexesData } from "@/types/compta-ui"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

function fmtF(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSigne(n: number): string {
  if (Math.abs(n) < 1) return "—"
  return (n < 0 ? "−" : "+") + fmtF(n)
}
function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function esc(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br/>")
}

const LABEL_METHODE_AMORT: Record<string, string> = {
  lineaire:  "Linéaire",
  degressif: "Dégressif",
}
const LABEL_METHODE_STOCKS: Record<string, string> = {
  fifo: "FIFO (Premier Entré, Premier Sorti)",
  cmp:  "CMP (Coût Moyen Pondéré)",
  lifo: "LIFO (Dernier Entré, Premier Sorti)",
}

export interface NotesAnnexesPdfTraceability {
  uuid:         string
  hash_sha256:  string
  generated_at: string
  verify_url?:  string
  qr_data_url?: string
}

export function renderNotesAnnexesPdfTemplate(opts: {
  data:         NotesAnnexesData
  societe:      SocieteHeaderData
  traceability: NotesAnnexesPdfTraceability
  /** Si true, on retire le header société (utilisé dans le dossier complet). */
  hideHeader?:  boolean
  /** Si true, on retire le pied de page hash (utilisé dans le dossier complet). */
  hideFooter?:  boolean
}): string {
  const { data, societe, traceability, hideHeader, hideFooter } = opts
  const raison = societe.raison_sociale ?? societe.nom_commercial ?? "Boyah Group SARL"
  const cc = (societe.numero_cc ?? societe.numero_contribuable)?.trim()

  // ─── Header société + titre ───────────────────────────────────────────────
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
      <h1 style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; margin: 0;">NOTES ANNEXES</h1>
      <p style="font-size: 10pt; color: #4B5563; margin: 1mm 0 0;">Exercice ${esc(data.exercice_libelle)} · arrêté au ${fmtDateFr(data.date_arrete)}</p>
    </div>`

  // ─── Helpers de rendu ─────────────────────────────────────────────────────
  function note(num: number, titre: string, contenu: string, opts: { pageBreakBefore?: boolean } = {}): string {
    return `
      <div style="margin-bottom: 8mm; ${opts.pageBreakBefore ? "page-break-before: always;" : ""}">
        <div style="display:flex; align-items:baseline; gap: 3mm; margin-bottom: 3mm; padding-bottom: 1.5mm; border-bottom: 1pt solid #1F4E79;">
          <div style="background:#1F4E79; color:white; padding: 1mm 3mm; border-radius: 2mm; font-size: 9pt; font-weight: 900;">Note ${num}</div>
          <div style="font-family: Georgia, serif; font-size: 13pt; font-weight: 700; color: #1F4E79;">${esc(titre)}</div>
        </div>
        ${contenu}
      </div>`
  }

  // ─── Note 1 — Méthodes comptables ─────────────────────────────────────────
  const note1 = note(1, "Méthodes comptables", `
    <div style="font-size: 9.5pt; color: #374151; line-height: 1.6; white-space: pre-wrap;">${esc(data.methodes_comptables)}</div>
    <div style="margin-top: 4mm; padding: 3mm 4mm; background: #F2EEDF; border-left: 2pt solid #1F4E79; font-size: 9pt;">
      <strong style="color:#1F4E79;">Synthèse des méthodes en vigueur :</strong><br/>
      • Méthode d'amortissement : <strong>${esc(LABEL_METHODE_AMORT[data.methode_amortissement] ?? data.methode_amortissement)}</strong><br/>
      • Valorisation des stocks : <strong>${esc(LABEL_METHODE_STOCKS[data.methode_stocks] ?? data.methode_stocks)}</strong>
    </div>`)

  // ─── Note 2 — Immobilisations ─────────────────────────────────────────────
  let immoRows = ""
  if (data.immobilisations.length === 0) {
    immoRows = `<tr><td colspan="7" style="padding: 4mm; text-align:center; color: #6B7280; font-style: italic; font-size: 9pt;">Aucune immobilisation enregistrée à la clôture de l'exercice.</td></tr>`
  } else {
    for (const r of data.immobilisations) {
      immoRows += `
        <tr style="border-top: 0.3pt solid #E7E2D2;">
          <td style="padding: 1.5mm 2mm; font-size: 8.5pt;"><strong>${esc(r.categorie_code)}</strong> · ${esc(r.categorie_libelle)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right;">${fmtF(r.solde_debut)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color:#166534;">${r.acquisitions > 0 ? "+" + fmtF(r.acquisitions) : "—"}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color:#9C2D14;">${r.cessions > 0 ? "−" + fmtF(r.cessions) : "—"}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; font-weight: 700;">${fmtF(r.solde_fin)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color:#9C2D14;">${fmtF(r.amort_cumule)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; font-weight: 700; color:#1F4E79;">${fmtF(r.vnc)}</td>
        </tr>`
    }
  }
  const note2 = note(2, "État des immobilisations", `
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #F2EEDF; color: #1F4E79;">
          <th style="text-align:left;  padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Catégorie</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Début N</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Acquis.</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Cessions</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Fin N</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Amort.</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">VNC</th>
        </tr>
      </thead>
      <tbody>${immoRows}</tbody>
    </table>`)

  // ─── Note 3 — Dotations amortissements ────────────────────────────────────
  let amortRows = ""
  if (data.amortissements.length === 0) {
    amortRows = `<tr><td colspan="6" style="padding: 4mm; text-align:center; color: #6B7280; font-style: italic; font-size: 9pt;">Aucune dotation aux amortissements pour l'exercice.</td></tr>`
  } else {
    for (const r of data.amortissements) {
      amortRows += `
        <tr style="border-top: 0.3pt solid #E7E2D2;">
          <td style="padding: 1.5mm 2mm; font-size: 8.5pt;"><strong>${esc(r.categorie_code)}</strong> · ${esc(r.categorie_libelle)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right;">${fmtF(r.valeur_origine)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right;">${fmtF(r.amort_debut)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; font-weight: 700; color:#9C2D14;">${r.dotation_exercice > 0 ? "+" + fmtF(r.dotation_exercice) : "—"}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right;">${fmtF(r.amort_fin)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; font-weight: 700; color:#1F4E79;">${fmtF(r.vnc)}</td>
        </tr>`
    }
  }
  const note3 = note(3, "Dotations aux amortissements", `
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #F2EEDF; color: #1F4E79;">
          <th style="text-align:left;  padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Catégorie</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Valeur origine</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Amort. début</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Dotation N</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Amort. fin</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">VNC</th>
        </tr>
      </thead>
      <tbody>${amortRows}</tbody>
    </table>`, { pageBreakBefore: true })

  // ─── Note 4 — Créances + Dettes ───────────────────────────────────────────
  function tableauCD(rows: NotesAnnexesData["creances"], emptyMsg: string): string {
    if (rows.length === 0) {
      return `<tr><td colspan="5" style="padding: 4mm; text-align:center; color: #6B7280; font-style: italic; font-size: 9pt;">${emptyMsg}</td></tr>`
    }
    return rows.map(r => `
      <tr style="border-top: 0.3pt solid #E7E2D2;">
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt;">${esc(r.libelle)}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; font-weight: 700;">${fmtF(r.montant_total)}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right;">${fmtF(r.moins_un_an)}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color: #9CA3AF;">${r.un_a_cinq_ans > 0 ? fmtF(r.un_a_cinq_ans) : "—"}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; color: #9CA3AF;">${r.plus_cinq_ans > 0 ? fmtF(r.plus_cinq_ans) : "—"}</td>
      </tr>`).join("")
  }
  function tableHead(label: string): string {
    return `
      <thead>
        <tr style="background: #F2EEDF; color: #1F4E79;">
          <th style="text-align:left;  padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">${label}</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Total</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">−1 an</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">1-5 ans</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">+5 ans</th>
        </tr>
      </thead>`
  }
  const note4 = note(4, "État des créances et dettes", `
    <p style="font-size: 8.5pt; color: #6B7280; font-style: italic; margin: 0 0 3mm;">
      V1 simplifiée : toutes les créances/dettes sont considérées à échéance −1 an.
    </p>
    <div style="margin-bottom: 4mm;">
      <table style="width:100%; border-collapse: collapse;">
        ${tableHead("Créances")}
        <tbody>${tableauCD(data.creances, "Aucune créance en cours.")}</tbody>
      </table>
    </div>
    <div>
      <table style="width:100%; border-collapse: collapse;">
        ${tableHead("Dettes")}
        <tbody>${tableauCD(data.dettes, "Aucune dette en cours.")}</tbody>
      </table>
    </div>`, { pageBreakBefore: true })

  // ─── Note 5 — Variation capitaux propres ──────────────────────────────────
  let cpRows = ""
  if (data.capitaux_propres.length === 0) {
    cpRows = `<tr><td colspan="4" style="padding: 4mm; text-align:center; color: #6B7280; font-style: italic; font-size: 9pt;">Aucune variation des capitaux propres.</td></tr>`
  } else {
    for (const r of data.capitaux_propres) {
      cpRows += `
        <tr style="border-top: 0.3pt solid #E7E2D2;">
          <td style="padding: 1.5mm 2mm; font-size: 8.5pt;"><strong>${esc(r.compte_root)}</strong> · ${esc(r.libelle)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right;">${fmtF(r.solde_debut)}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; ${r.variation > 0 ? "color:#166534;" : r.variation < 0 ? "color:#9C2D14;" : "color:#6B7280;"}">${r.variation !== 0 ? fmtSigne(r.variation) : "—"}</td>
          <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; text-align: right; font-weight: 700; color:#1F4E79;">${fmtF(r.solde_fin)}</td>
        </tr>`
    }
  }
  const note5 = note(5, "Variation des capitaux propres", `
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #F2EEDF; color: #1F4E79;">
          <th style="text-align:left;  padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Poste</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Solde début N</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Variation</th>
          <th style="text-align:right; padding: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px;">Solde fin N</th>
        </tr>
      </thead>
      <tbody>${cpRows}</tbody>
    </table>`)

  // ─── Note 6 — Engagements hors bilan ──────────────────────────────────────
  const note6 = note(6, "Engagements hors bilan", `
    <div style="font-size: 9.5pt; color: #374151; line-height: 1.6; white-space: pre-wrap;">${esc(data.engagements_hors_bilan)}</div>`)

  // ─── Footer traçabilité (optionnel — masqué dans le dossier complet) ─────
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

  return `${headerBloc}${titleBloc}${note1}${note2}${note3}${note4}${note5}${note6}${traceBloc}`
}
