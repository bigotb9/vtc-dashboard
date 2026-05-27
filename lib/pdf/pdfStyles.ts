/**
 * CSS commun pour tous les templates PDF (Phase 4 §5.7).
 *
 * Conventions :
 *  - Pas de Google Fonts (peuvent ne pas charger dans Puppeteer serverless)
 *  - Couleurs SYSCOHADA cohérentes
 *  - Tailles : 22pt titres, 14pt sous-titres, 11pt corps, 9pt légendes
 *  - Monospace pour montants et codes
 */

export const pdfStyles = `
@page {
  size: A4;
  margin: 20mm 15mm;
}

* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 11pt;
  color: #1A1A1A;
  background: #FAFAF8;
  line-height: 1.4;
}

/* ─── Couleurs ─────────────────────────────────────────────────── */
:root {
  --pdf-blue:   #1F4E79;
  --pdf-violet: #6B21A8;
  --pdf-green:  #047857;
  --pdf-amber:  #B45309;
  --pdf-red:    #991B1B;
  --pdf-gray:   #6B7280;
  --pdf-bg:     #FAFAF8;
}

/* ─── Casseurs de page utilitaires ────────────────────────────── */
.page-break-before { page-break-before: always; }
.page-break-after  { page-break-after:  always; }
.no-break          { page-break-inside: avoid;  break-inside: avoid; }

/* ─── En-tête commun ──────────────────────────────────────────── */
.pdf-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  border-bottom: 2px solid #1F4E79;
  padding-bottom: 12px;
  margin-bottom: 18px;
}
/* Phase 4.2 — Logo + texte côte à côte */
.pdf-header .company-block {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.pdf-header .pdf-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  flex-shrink: 0;
}
.pdf-header .company-text {
  display: flex;
  flex-direction: column;
}
.pdf-header .company-name {
  font-size: 14pt;
  font-weight: 700;
  color: #1F4E79;
  letter-spacing: 0.02em;
}
.pdf-header .company-meta {
  font-size: 8.5pt;
  color: #4B5563;
  line-height: 1.5;
  margin-top: 4px;
}
.pdf-header .doc-block {
  text-align: right;
}
.pdf-header .doc-type {
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #6B7280;
  font-weight: 700;
}
.pdf-header .doc-title {
  font-size: 16pt;
  font-weight: 700;
  color: #1F4E79;
  margin-top: 2px;
}
.pdf-header .doc-period {
  font-size: 10pt;
  color: #4B5563;
  font-style: italic;
  margin-top: 4px;
}

/* ─── Titres ─────────────────────────────────────────────────── */
h1.pdf-title {
  font-size: 22pt;
  font-weight: 700;
  color: #1F4E79;
  margin: 0 0 4mm 0;
  letter-spacing: -0.01em;
}
h2.pdf-section {
  font-size: 14pt;
  font-weight: 700;
  color: #1F4E79;
  margin: 8mm 0 3mm 0;
  padding-bottom: 2mm;
  border-bottom: 1px solid #D1D5DB;
}
h3.pdf-subsection {
  font-size: 12pt;
  font-weight: 700;
  color: #1F4E79;
  margin: 4mm 0 2mm 0;
}

/* ─── Compte SYSCOHADA bloc ──────────────────────────────────── */
.compte-block {
  margin-bottom: 6mm;
}
.compte-block .compte-header {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(31, 78, 121, 0.06);
  padding: 5px 10px;
  border-left: 3px solid #1F4E79;
  margin-bottom: 4px;
}
.compte-block .compte-code {
  font-family: "Courier New", monospace;
  font-weight: 700;
  color: #6B21A8;
  background: rgba(107, 33, 168, 0.10);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10.5pt;
}
.compte-block .compte-libelle {
  font-size: 11pt;
  font-weight: 600;
  color: #1F4E79;
  flex: 1;
}
.compte-block .compte-classe {
  font-size: 8.5pt;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ─── Tableaux ──────────────────────────────────────────────── */
table.pdf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
}
table.pdf-table thead {
  background: #1F4E79;
  color: white;
}
table.pdf-table thead th {
  text-align: left;
  font-weight: 700;
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 8px;
}
table.pdf-table thead th.num { text-align: right; }
table.pdf-table tbody td {
  padding: 4px 8px;
  border-bottom: 1px solid #E5E7EB;
  vertical-align: top;
}
table.pdf-table tbody td.num {
  text-align: right;
  font-family: "Courier New", monospace;
  white-space: nowrap;
}
table.pdf-table tbody td.code {
  font-family: "Courier New", monospace;
  color: #6B21A8;
  font-weight: 600;
  white-space: nowrap;
}
table.pdf-table tbody td.date {
  font-family: "Courier New", monospace;
  white-space: nowrap;
  color: #4B5563;
}
table.pdf-table tbody tr:nth-child(even) {
  background: rgba(31, 78, 121, 0.03);
}
table.pdf-table tfoot td {
  font-weight: 700;
  border-top: 2px solid #1F4E79;
  padding: 6px 8px;
  background: rgba(31, 78, 121, 0.08);
}
table.pdf-table tfoot td.num {
  text-align: right;
  font-family: "Courier New", monospace;
}

/* ─── Ligne Solde (Grand Livre) ─────────────────────────────── */
.solde-line {
  background: #1F4E79;
  color: white;
  padding: 5px 10px;
  margin-top: 3px;
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 10pt;
  border-radius: 2px;
}
.solde-line .label { font-size: 8.5pt; letter-spacing: 0.08em; text-transform: uppercase; }
.solde-line .value { font-family: "Courier New", monospace; }

/* ─── Bandeau d'équilibre Balance ──────────────────────────── */
.equilibre-banner {
  margin-top: 8mm;
  padding: 4mm 5mm;
  border-radius: 3px;
  font-weight: 700;
  text-align: center;
  font-size: 11pt;
}
.equilibre-banner.ok  { background: rgba(4, 120, 87, 0.10);  color: #047857; border: 1px solid rgba(4, 120, 87, 0.30); }
.equilibre-banner.err { background: rgba(153, 27, 27, 0.10); color: #991B1B; border: 1px solid rgba(153, 27, 27, 0.30); }

/* ─── Empty state ──────────────────────────────────────────── */
.pdf-empty {
  padding: 20mm 10mm;
  text-align: center;
  color: #6B7280;
  font-style: italic;
  background: rgba(107, 114, 128, 0.04);
  border: 1px dashed #D1D5DB;
}

/* ─── Couleurs sémantiques montants ────────────────────────── */
.pos { color: #047857; }
.neg { color: #B45309; }
.muted { color: #9CA3AF; }
`
