/**
 * Template HTML pour le PDF "Fiche tiers" (Phase 4.x Vague 2 §4.4).
 *
 * Pure HTML string (pas de renderToStaticMarkup, cohérent avec les autres
 * templates PDF du module). Style aligné sur Grand Livre :
 *   - Georgia serif + Courier mono pour les nombres
 *   - Palette bleu marine #1F4E79
 *   - Fond papier #FAFAF8
 *
 * Sections : en-tête société + bloc identité + bloc entreprise + bloc compta
 * + historique opérations + sous-totaux.
 */

import type { FicheTiersData } from "@/lib/compta/exports/buildFicheTiers"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

function formatF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")
}

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const TYPE_COLOR: Record<string, string> = {
  Client:      "#15803D",
  Fournisseur: "#B45309",
  Salarié:     "#0E7490",
  Autre:       "#6D28D9",
}

export function renderFicheTiersTemplate(opts: {
  data:    FicheTiersData
  societe: SocieteHeaderData
}): string {
  const { data, societe } = opts
  const t       = data.tiers
  const accent  = TYPE_COLOR[t.type_label] ?? "#1F4E79"
  const dateFr  = `${formatDateFr(data.periode.date_from)} – ${formatDateFr(data.periode.date_to)}`
  const initials = (t.nom || "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join("") || "TI"

  // ─── En-tête société (Phase 4.2 — avec logo) ──────────────────────────────
  const raisonSociale = societe.raison_sociale ?? societe.nom_commercial ?? "Boyah Group SARL"
  const numCC = (societe.numero_cc ?? societe.numero_contribuable)?.trim()
  const logoImg = societe.logo_signed_url
    ? `<img src="${esc(societe.logo_signed_url)}" alt="Logo" style="width:18mm; height:18mm; object-fit:contain; flex-shrink:0;" />`
    : ""
  const societeBloc = `
    <div style="margin-bottom: 14mm; display:flex; align-items:flex-start; gap:5mm;">
      ${logoImg}
      <div style="flex:1;">
        <div style="font-family: Georgia, serif; font-size: 18pt; font-weight: 900; color: #1F4E79; letter-spacing: -0.5px;">
          ${esc(raisonSociale)}
        </div>
        <div style="font-size: 9pt; color: #6B7280; margin-top: 1mm;">
          ${[
            societe.adresse_fiscale,
            societe.numero_rccm     ? `RCCM ${esc(societe.numero_rccm)}` : null,
            numCC                   ? `N° CC ${esc(numCC)}` : null,
            societe.telephone,
            societe.capital_social && societe.capital_social > 0
              ? `Capital ${societe.capital_social.toLocaleString("fr-FR").replace(/ /g, " ")} F`
              : null,
          ].filter(Boolean).map(esc).join(" · ")}
        </div>
      </div>
    </div>
  `

  // ─── Bandeau titre ────────────────────────────────────────────────────────
  const titleBloc = `
    <div style="background: ${accent}; color: white; padding: 5mm 6mm; border-radius: 3mm; margin-bottom: 6mm;">
      <div style="display: flex; align-items: center; gap: 5mm;">
        <div style="width: 16mm; height: 16mm; border-radius: 50%; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 16pt; font-weight: 900; letter-spacing: 1px;">
          ${esc(initials)}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 2px; opacity: 0.85;">
            Fiche ${esc(t.type_label).toLowerCase()}
          </div>
          <div style="font-size: 18pt; font-weight: 900; margin-top: 1mm;">${esc(t.nom)}</div>
          <div style="font-size: 9pt; opacity: 0.85; margin-top: 1.5mm;">
            Code SYSCOHADA <strong style="font-family: 'Courier New', monospace; font-weight: 900;">${esc(t.compte_syscohada_code)}</strong>
            ${!t.actif ? ' &nbsp;·&nbsp; <span style="background: rgba(255,255,255,0.18); padding: 0.5mm 2mm; border-radius: 2mm; font-size: 8pt; font-weight: 700;">DÉSACTIVÉ</span>' : ""}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85;">Période</div>
          <div style="font-size: 10pt; font-weight: 700; margin-top: 1mm; font-family: 'Courier New', monospace;">${esc(dateFr)}</div>
        </div>
      </div>
    </div>
  `

  // ─── Bloc Contact ─────────────────────────────────────────────────────────
  const contactRows: string[] = []
  if (t.telephone) contactRows.push(`<tr><td style="font-size:8.5pt; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; padding:1mm 4mm 1mm 0; width:30mm;">Téléphone</td><td style="font-size:10pt; font-family:'Courier New',monospace;">${esc(t.telephone)}</td></tr>`)
  if (t.email)     contactRows.push(`<tr><td style="font-size:8.5pt; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; padding:1mm 4mm 1mm 0;">Email</td><td style="font-size:10pt; font-family:'Courier New',monospace;">${esc(t.email)}</td></tr>`)
  if (t.adresse)   contactRows.push(`<tr><td style="font-size:8.5pt; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; padding:1mm 4mm 1mm 0;">Adresse</td><td style="font-size:10pt;">${esc(t.adresse)}</td></tr>`)
  const contactBloc = contactRows.length > 0
    ? `<div style="margin-bottom: 5mm;">
         <div style="font-size: 10pt; font-weight: 900; color: #1F4E79; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2mm; padding-bottom: 1mm; border-bottom: 0.5pt solid #E7E2D2;">Contact</div>
         <table style="width:100%; border-collapse: collapse;">${contactRows.join("")}</table>
       </div>`
    : ""

  // ─── Bloc Entreprise ──────────────────────────────────────────────────────
  const entRows: string[] = []
  if (t.raison_sociale)      entRows.push(`<tr><td style="font-size:8.5pt; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; padding:1mm 4mm 1mm 0; width:42mm;">Raison sociale</td><td style="font-size:10pt;">${esc(t.raison_sociale)}</td></tr>`)
  if (t.numero_rccm)         entRows.push(`<tr><td style="font-size:8.5pt; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; padding:1mm 4mm 1mm 0;">N° RCCM</td><td style="font-size:10pt; font-family:'Courier New',monospace;">${esc(t.numero_rccm)}</td></tr>`)
  if (t.numero_contribuable) entRows.push(`<tr><td style="font-size:8.5pt; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; padding:1mm 4mm 1mm 0;">N° contribuable</td><td style="font-size:10pt; font-family:'Courier New',monospace;">${esc(t.numero_contribuable)}</td></tr>`)
  const entBloc = entRows.length > 0
    ? `<div style="margin-bottom: 5mm;">
         <div style="font-size: 10pt; font-weight: 900; color: #1F4E79; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2mm; padding-bottom: 1mm; border-bottom: 0.5pt solid #E7E2D2;">Données entreprise</div>
         <table style="width:100%; border-collapse: collapse;">${entRows.join("")}</table>
       </div>`
    : ""

  // ─── Sous-totaux KPI ──────────────────────────────────────────────────────
  const netColor = data.totals.net >= 0 ? "#15803D" : "#B91C1C"
  const totalsBloc = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 5mm;">
      ${kpiCard("Opérations", String(data.totals.nb_ops), "#1F4E79")}
      ${kpiCard("Total entrées", `${formatF(data.totals.entrees)} F`, "#15803D")}
      ${kpiCard("Total sorties", `${formatF(data.totals.sorties)} F`, "#B91C1C")}
      ${kpiCard("Net (E - S)",   `${data.totals.net >= 0 ? "+" : ""}${formatF(data.totals.net)} F`, netColor)}
    </div>
  `

  // ─── Tableau historique ───────────────────────────────────────────────────
  let opsRows = ""
  for (const op of data.operations) {
    const sens = op.type === "entree" ? "Entrée" : "Sortie"
    const sensColor = op.type === "entree" ? "#15803D" : "#B91C1C"
    const montantSigne = op.type === "entree" ? `+${formatF(op.montant)}` : `−${formatF(op.montant)}`
    // Phase 4.x Vague 3 — indicateur justif dans le tableau historique
    const justifCell = op.justificatifs_count > 0
      ? `<span style="color:#1F4E79; font-weight:700;">📎 ${op.justificatifs_count}</span>`
      : `<span style="color:#9CA3AF;">—</span>`
    opsRows += `
      <tr style="border-top: 0.4pt solid #E7E2D2;">
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 8.5pt; white-space: nowrap;">${formatDateFr(op.date_operation)}</td>
        <td style="padding: 1.5mm 2mm; font-size: 9pt;">${esc(op.libelle)}${op.ref ? `<br/><span style="font-family:'Courier New',monospace; font-size:7.5pt; color:#6B7280;">${esc(op.ref)}</span>` : ""}</td>
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt; color: #4B5563;">${esc(op.categorie ?? "—")}</td>
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt; color: #4B5563;">${esc(op.caisse ?? "—")}</td>
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt; font-weight: 700; color: ${sensColor};">${sens}</td>
        <td style="padding: 1.5mm 2mm; font-size: 8.5pt; text-align: center;">${justifCell}</td>
        <td style="padding: 1.5mm 2mm; font-family: 'Courier New', monospace; font-size: 9.5pt; font-weight: 700; text-align: right; color: ${sensColor};">${montantSigne}</td>
      </tr>
    `
  }
  const opsBloc = `
    <div style="margin-top: 2mm;">
      <div style="font-size: 10pt; font-weight: 900; color: #1F4E79; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2mm; padding-bottom: 1mm; border-bottom: 0.5pt solid #E7E2D2;">
        Historique des opérations
      </div>
      ${data.operations.length === 0
        ? `<div style="text-align: center; padding: 8mm; font-size: 10pt; color: #9CA3AF; font-style: italic;">Aucune opération sur la période sélectionnée.</div>`
        : `<table style="width:100%; border-collapse: collapse; font-size: 9pt;">
             <thead>
               <tr style="background: #F2EEDF; color: #1F4E79;">
                 <th style="text-align:left; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Date</th>
                 <th style="text-align:left; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Libellé</th>
                 <th style="text-align:left; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Catégorie</th>
                 <th style="text-align:left; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Caisse / Compte</th>
                 <th style="text-align:left; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Sens</th>
                 <th style="text-align:center; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Justif.</th>
                 <th style="text-align:right; padding: 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px;">Montant (F)</th>
               </tr>
             </thead>
             <tbody>${opsRows}</tbody>
           </table>`
      }
    </div>
  `

  // ─── Notes ────────────────────────────────────────────────────────────────
  const notesBloc = t.notes
    ? `<div style="margin-top: 5mm; padding: 3mm 4mm; background: #FFF7ED; border-left: 2pt solid #F97316; font-size: 9pt; color: #57534E;">
         <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #C2410C; margin-bottom: 1mm;">Notes</div>
         ${esc(t.notes).replace(/\n/g, "<br/>")}
       </div>`
    : ""

  // ─── Annexe Justificatifs joints (Phase 4.x Vague 3 §4.1) ────────────────
  let annexeBloc = ""
  if (data.justificatifs && data.justificatifs.length > 0) {
    const jxRows = data.justificatifs.map(j => {
      const sensSign = j.operation_type === "entree" ? "+" : "−"
      const sensColor = j.operation_type === "entree" ? "#15803D" : "#B91C1C"
      const mimeShort = j.mime_type === "application/pdf" ? "PDF"
                     : j.mime_type === "image/jpeg" ? "JPG"
                     : j.mime_type === "image/png" ? "PNG" : j.mime_type
      return `
        <tr style="border-top: 0.4pt solid #E7E2D2;">
          <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 8pt; white-space: nowrap;">${formatDateFr(j.operation_date)}</td>
          <td style="padding: 1.3mm 2mm; font-size: 8.5pt;">${esc(j.operation_libelle)}</td>
          <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 8pt; font-weight: 700; text-align: right; color: ${sensColor};">${sensSign}${formatF(j.operation_montant)}</td>
          <td style="padding: 1.3mm 2mm; font-size: 8.5pt; word-break: break-all;">${esc(j.filename)}</td>
          <td style="padding: 1.3mm 2mm; font-size: 7.5pt; color: #6B7280; text-align: center;">${mimeShort}</td>
          <td style="padding: 1.3mm 2mm; font-family: 'Courier New', monospace; font-size: 8pt; color: #6B7280; white-space: nowrap;">${formatDateFr(j.uploaded_at.slice(0, 10))}</td>
        </tr>
      `
    }).join("")
    annexeBloc = `
      <div style="margin-top: 8mm; page-break-inside: avoid;">
        <div style="font-size: 10pt; font-weight: 900; color: #1F4E79; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2mm; padding-bottom: 1mm; border-bottom: 0.5pt solid #E7E2D2;">
          Annexe — Justificatifs joints sur la période · ${data.justificatifs.length}
        </div>
        <table style="width:100%; border-collapse: collapse; font-size: 9pt;">
          <thead>
            <tr style="background: #F2EEDF; color: #1F4E79;">
              <th style="text-align:left;   padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Date opération</th>
              <th style="text-align:left;   padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Libellé</th>
              <th style="text-align:right;  padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Montant</th>
              <th style="text-align:left;   padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Fichier</th>
              <th style="text-align:center; padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Format</th>
              <th style="text-align:left;   padding: 1.5mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px;">Upload</th>
            </tr>
          </thead>
          <tbody>${jxRows}</tbody>
        </table>
        <p style="margin-top: 2mm; font-size: 7.5pt; font-style: italic; color: #6B7280;">
          Les fichiers sont consultables dans l&apos;application Boyah Fleet, module Comptabilité.
        </p>
      </div>
    `
  }

  // ─── Pied de page ─────────────────────────────────────────────────────────
  const footBloc = `
    <div style="margin-top: 12mm; padding-top: 3mm; border-top: 0.4pt solid #E7E2D2; font-size: 8pt; color: #9CA3AF; text-align: center;">
      Document généré le ${formatDateFr(data.generated_at.slice(0, 10))} · Fleet Boyah · Module Comptabilité
    </div>
  `

  return `${societeBloc}${titleBloc}<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 6mm;">${contactBloc}${entBloc}</div>${totalsBloc}${opsBloc}${notesBloc}${annexeBloc}${footBloc}`
}

function kpiCard(label: string, value: string, color: string): string {
  return `
    <div style="background: white; border: 0.5pt solid #E7E2D2; border-radius: 2mm; padding: 3mm; text-align: center;">
      <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6B7280;">${label}</div>
      <div style="font-size: 13pt; font-weight: 900; color: ${color}; margin-top: 1mm; font-family: 'Courier New', monospace;">${value}</div>
    </div>
  `
}
