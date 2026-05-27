/**
 * Template HTML du Rapport mensuel synthétique (Phase 4 §4.5).
 *
 * 7 sections (1 par page si nécessaire) :
 *   1. Couverture
 *   2. Résumé exécutif + 4 KPIs + commentaire auto
 *   3. Évolution 6 mois (line chart SVG)
 *   4. Top 5 catégories (table + bar chart)
 *   5. Top 5 véhicules (table)
 *   6. Soldes trésorerie (bar chart)
 *   7. Health check + Annexes (top 20 ops)
 *
 * Tous les charts sont en SVG inline (Puppeteer rend les SVG sans souci).
 */

import { renderPdfHeader, type SocieteHeaderData } from "@/lib/pdf/buildHeader"
import { formatMontantPdf, formatDateFr, formatDateFrLong, escapeHtml } from "@/lib/pdf/formatters"
import type {
  RapportMensuelData, RapportMensuelKpis, MoisPoint, TopCategorie,
  TopVehicule, SoldeContenant, RapportMensuelHealth, OperationAnnexe,
} from "@/lib/compta/exports/buildRapportMensuel"

export function renderRapportMensuelTemplate(args: {
  data:    RapportMensuelData
  societe: SocieteHeaderData
}): string {
  const { data, societe } = args

  return [
    renderCouverture(data, societe),
    renderResumeExecutif(data),
    renderEvolution(data.evolution_6_mois),
    renderTopCategories(data.top_categories),
    renderTopVehicules(data.top_vehicules),
    renderSoldes(data.soldes),
    renderHealthAndAnnexes(data.health, data.top_operations),
  ].join("\n")
}

// ─── 1. Couverture ───────────────────────────────────────────────────────────

function renderCouverture(d: RapportMensuelData, s: SocieteHeaderData): string {
  const raison = s.raison_sociale?.trim() || "Boyah Group SARL"
  return `<section style="height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
  <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3em; color: #6B7280; margin-bottom: 8mm;">
    Document comptable interne
  </div>
  <h1 style="font-size: 36pt; color: #1F4E79; font-weight: 700; margin: 0; letter-spacing: -0.02em;">
    Rapport mensuel
  </h1>
  <div style="font-size: 22pt; color: #4B5563; font-style: italic; margin-top: 4mm;">
    ${escapeHtml(d.periode_libelle)}
  </div>
  <div style="margin-top: 14mm; padding: 6mm 10mm; background: rgba(31, 78, 121, 0.06); border-radius: 4mm; border-left: 4px solid #1F4E79;">
    <div style="font-size: 16pt; color: #1F4E79; font-weight: 700;">${escapeHtml(raison)}</div>
    ${s.numero_rccm ? `<div style="font-size: 10pt; color: #6B7280; margin-top: 2mm;">RCCM : ${escapeHtml(s.numero_rccm)}</div>` : ""}
  </div>
  <div style="margin-top: 30mm; font-size: 9pt; color: #6B7280;">
    Document généré le ${formatDateFrLong(new Date().toISOString())}
  </div>
</section>
<div class="page-break-after"></div>`
}

// ─── 2. Résumé exécutif ──────────────────────────────────────────────────────

function renderResumeExecutif(d: RapportMensuelData): string {
  const headerHtml = renderPdfHeader({
    societe:  { raison_sociale: null, numero_rccm: null, numero_contribuable: null, adresse_fiscale: null, telephone: null, email_comptable: null },
    titre:    "Résumé exécutif",
    dateFrom: d.date_from,
    dateTo:   d.date_to,
  })

  const k = d.kpis
  const kpisHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 6mm;">
    ${renderKpi("Chiffre d'affaires",  k.ca,            k.ca_prev,            false)}
    ${renderKpi("Dépenses",            k.depenses,      k.depenses_prev,      true)}
    ${renderKpi("Résultat net",        k.resultat_net,  k.resultat_prev,      false, true)}
    ${renderKpi("Trésorerie globale",  k.tresorerie,    null,                 false, true)}
  </div>`

  const commentaire = `<div style="margin-top: 8mm; padding: 5mm 6mm; background: rgba(31, 78, 121, 0.04); border-left: 3px solid #1F4E79; border-radius: 2px;">
    <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; font-weight: 700; margin-bottom: 3mm;">
      Synthèse
    </div>
    <p style="margin: 0; font-size: 11pt; line-height: 1.6; color: #1A1A1A;">
      ${escapeHtml(d.commentaire)}
    </p>
  </div>`

  return headerHtml + kpisHtml + commentaire + `<div class="page-break-after"></div>`
}

function renderKpi(label: string, value: number, prev: number | null, inverseColor: boolean, allowNeg = false): string {
  let trendHtml = ""
  if (prev !== null && prev !== 0) {
    const pct = ((value - prev) / Math.abs(prev)) * 100
    const isGood = inverseColor ? (pct < 0) : (pct > 0)
    const color = Math.abs(pct) < 0.5 ? "#6B7280" : isGood ? "#047857" : "#B45309"
    const arrow = pct >= 0 ? "▲" : "▼"
    trendHtml = `<div style="font-size: 9pt; color: ${color}; margin-top: 2mm;">
      ${arrow} ${Math.abs(pct).toFixed(1)}% vs période précédente
    </div>`
  }
  const valueColor = allowNeg && value < 0 ? "#991B1B" : "#1F4E79"
  return `<div style="padding: 5mm; background: white; border: 1px solid #E5E7EB; border-radius: 4px;">
    <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; font-weight: 700;">
      ${escapeHtml(label)}
    </div>
    <div style="font-size: 22pt; font-weight: 700; font-family: 'Courier New', monospace; color: ${valueColor}; margin-top: 2mm;">
      ${value < 0 ? "−" : ""}${formatMontantPdf(Math.abs(value))} <span style="font-size: 12pt; color: #9CA3AF;">F</span>
    </div>
    ${trendHtml}
  </div>`
}

// ─── 3. Évolution 6 mois (line chart SVG) ────────────────────────────────────

function renderEvolution(points: MoisPoint[]): string {
  const W = 700, H = 280, padL = 60, padR = 20, padT = 20, padB = 40
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  if (points.length === 0) {
    return `<section><h2 class="pdf-section">Évolution sur 6 mois</h2><div class="pdf-empty">Aucune donnée.</div></section><div class="page-break-after"></div>`
  }

  const max = Math.max(1, ...points.map(p => Math.max(p.ca, p.depenses)))
  // Nice round-up
  const niceMax = (() => {
    const mag = Math.pow(10, Math.floor(Math.log10(max)))
    for (const m of [1, 2, 2.5, 5, 10]) {
      const v = m * mag
      if (v >= max) return v
    }
    return max
  })()

  const n = points.length
  const xAt = (i: number) => padL + (i / Math.max(1, n - 1)) * innerW
  const yAt = (v: number) => padT + innerH - (v / niceMax) * innerH
  const moisLabel = (ym: string) => {
    const m = Number(ym.slice(5, 7))
    return ["Jan","Fév","Mar","Avr","Mai","Jui","Jul","Aoû","Sep","Oct","Nov","Déc"][m - 1] ?? ym
  }

  const caPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.ca).toFixed(1)}`).join(" ")
  const dePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.depenses).toFixed(1)}`).join(" ")

  // Y axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: padT + innerH - t * innerH, v: t * niceMax }))

  const ticksSvg = ticks.map(t => `
    <line x1="${padL}" x2="${W - padR}" y1="${t.y}" y2="${t.y}" stroke="#E5E7EB" stroke-width="0.5" stroke-dasharray="${t.v === 0 ? "0" : "2 3"}"/>
    <text x="${padL - 6}" y="${t.y + 3}" text-anchor="end" font-family="Courier New" font-size="8pt" fill="#9CA3AF">
      ${formatMontantPdf(t.v)}
    </text>
  `).join("")

  const pointsSvg = points.map((p, i) => {
    const x = xAt(i)
    return `
      <circle cx="${x}" cy="${yAt(p.ca)}" r="3" fill="#047857"/>
      <circle cx="${x}" cy="${yAt(p.depenses)}" r="3" fill="#B45309"/>
      <text x="${x}" y="${H - 12}" text-anchor="middle" font-family="Georgia" font-size="9pt" fill="#6B7280">
        ${moisLabel(p.mois)}
      </text>
    `
  }).join("")

  const legend = `
    <g transform="translate(${padL}, ${H - 4})">
      <circle cx="0" cy="0" r="3" fill="#047857"/>
      <text x="8" y="3" font-family="Georgia" font-size="9pt" fill="#374151">Chiffre d'affaires</text>
      <circle cx="130" cy="0" r="3" fill="#B45309"/>
      <text x="138" y="3" font-family="Georgia" font-size="9pt" fill="#374151">Dépenses</text>
    </g>
  `

  const chartSvg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
    ${ticksSvg}
    <path d="${caPath}" stroke="#047857" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${dePath}" stroke="#B45309" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${pointsSvg}
    ${legend}
  </svg>`

  return `<section><h2 class="pdf-section">Évolution sur 6 mois</h2>
    <p style="font-size: 10pt; color: #6B7280; margin: 0 0 4mm 0;">CA et dépenses cumulés par mois calendaire.</p>
    ${chartSvg}
  </section>
  <div class="page-break-after"></div>`
}

// ─── 4. Top 5 catégories ─────────────────────────────────────────────────────

function renderTopCategories(cats: TopCategorie[]): string {
  if (cats.length === 0) {
    return `<section><h2 class="pdf-section">Top 5 catégories</h2><div class="pdf-empty">Aucune catégorie utilisée sur la période.</div></section>`
  }
  const max = Math.max(1, ...cats.map(c => c.volume_total))

  const tableHtml = `<table class="pdf-table">
    <thead><tr>
      <th style="width: 40px">#</th>
      <th>Catégorie</th>
      <th style="width: 60px">Sens</th>
      <th class="num" style="width: 70px">Ops</th>
      <th class="num" style="width: 110px">Volume</th>
      <th style="width: 180px">Part</th>
    </tr></thead>
    <tbody>
      ${cats.map((c, i) => {
        const pct = (c.volume_total / max) * 100
        const sensCol = c.sens === "credit" ? "pos" : c.sens === "debit" ? "amber" : ""
        const senLab = c.sens === "credit" ? "Entrée" : c.sens === "debit" ? "Sortie" : "—"
        return `<tr>
          <td class="num"><strong>${i + 1}</strong></td>
          <td>${escapeHtml(c.libelle)}</td>
          <td class="${sensCol}">${senLab}</td>
          <td class="num">${c.nb_operations}</td>
          <td class="num"><strong>${formatMontantPdf(c.volume_total)}</strong></td>
          <td>
            <div style="height: 8px; background: #F3F4F6; border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${pct.toFixed(1)}%; background: linear-gradient(to right, #1F4E79, #4F86C6);"></div>
            </div>
          </td>
        </tr>`
      }).join("")}
    </tbody>
  </table>`

  return `<section><h2 class="pdf-section">Top 5 catégories par volume</h2>
    <p style="font-size: 10pt; color: #6B7280; margin: 0 0 4mm 0;">Classement par montant cumulé sur la période.</p>
    ${tableHtml}
  </section>`
}

// ─── 5. Top 5 véhicules ──────────────────────────────────────────────────────

function renderTopVehicules(vehs: TopVehicule[]): string {
  if (vehs.length === 0) {
    return `<section style="margin-top: 8mm;"><h2 class="pdf-section">Top 5 véhicules</h2><div class="pdf-empty">Aucun véhicule actif sur la période.</div></section><div class="page-break-after"></div>`
  }
  const tableHtml = `<table class="pdf-table">
    <thead><tr>
      <th style="width: 40px">#</th>
      <th style="width: 110px">Immatriculation</th>
      <th class="num">Versements</th>
      <th class="num">CA</th>
      <th class="num">Dépenses</th>
      <th class="num">Solde net</th>
    </tr></thead>
    <tbody>
      ${vehs.map((v, i) => {
        const net = v.ca - v.depenses
        return `<tr>
          <td class="num"><strong>${i + 1}</strong></td>
          <td class="code">${escapeHtml(v.immatriculation ?? `#${v.vehicule_id}`)}</td>
          <td class="num">${v.nb_versements}</td>
          <td class="num pos">${formatMontantPdf(v.ca)}</td>
          <td class="num amber">${formatMontantPdf(v.depenses)}</td>
          <td class="num"><strong>${net < 0 ? "−" : ""}${formatMontantPdf(Math.abs(net))}</strong></td>
        </tr>`
      }).join("")}
    </tbody>
  </table>`
  return `<section style="margin-top: 8mm;"><h2 class="pdf-section">Top 5 véhicules</h2>
    <p style="font-size: 10pt; color: #6B7280; margin: 0 0 4mm 0;">CA et dépenses par véhicule sur la période.</p>
    ${tableHtml}
  </section>
  <div class="page-break-after"></div>`
}

// ─── 6. Soldes trésorerie (bar chart) ────────────────────────────────────────

function renderSoldes(soldes: SoldeContenant[]): string {
  if (soldes.length === 0) {
    return `<section><h2 class="pdf-section">Soldes de trésorerie</h2><div class="pdf-empty">Aucune caisse ni compte.</div></section><div class="page-break-after"></div>`
  }
  const max = Math.max(1, ...soldes.map(s => Math.abs(s.solde)))
  // Bar chart horizontal
  const barRows = soldes.map(s => {
    const pct = (Math.abs(s.solde) / max) * 100
    const colorBg = s.solde >= 0
      ? "linear-gradient(to right, #047857, #34D399)"
      : "linear-gradient(to right, #991B1B, #FCA5A5)"
    const tag = s.type_cible === "caisse" ? "Caisse" : "Compte"
    return `<tr>
      <td>${escapeHtml(s.libelle)} <span style="color:#9CA3AF; font-size: 8.5pt;">· ${tag}</span></td>
      <td class="num" style="${s.solde < 0 ? "color: #991B1B;" : ""}"><strong>${s.solde < 0 ? "−" : ""}${formatMontantPdf(Math.abs(s.solde))}</strong></td>
      <td>
        <div style="height: 10px; background: #F3F4F6; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${pct.toFixed(1)}%; background: ${colorBg};"></div>
        </div>
      </td>
    </tr>`
  }).join("")

  return `<section><h2 class="pdf-section">Soldes de trésorerie</h2>
    <p style="font-size: 10pt; color: #6B7280; margin: 0 0 4mm 0;">Cumul tous temps confondus par caisse et compte bancaire.</p>
    <table class="pdf-table">
      <thead><tr><th>Contenant</th><th class="num" style="width: 100px">Solde</th><th style="width: 240px">&nbsp;</th></tr></thead>
      <tbody>${barRows}</tbody>
    </table>
  </section>
  <div class="page-break-after"></div>`
}

// ─── 7. Health + Annexes ─────────────────────────────────────────────────────

function renderHealthAndAnnexes(h: RapportMensuelHealth, ops: OperationAnnexe[]): string {
  const banner = h.ok
    ? `<div class="equilibre-banner ok">✓ Comptabilité équilibrée — ${h.nb_ecritures} écritures · ${h.nb_lignes} lignes · Σ Débit = Σ Crédit = ${formatMontantPdf(h.total_debit)} F</div>`
    : `<div class="equilibre-banner err">⚠ Déséquilibre détecté — écart de ${formatMontantPdf(Math.abs(h.ecart))} F entre Σ Débits et Σ Crédits</div>`

  const anomaliesLine = h.nb_anomalies > 0
    ? `<p style="font-size: 10pt; color: #B45309; margin-top: 3mm;">${h.nb_anomalies} anomalie(s) détectée(s) — consulter l'écran Santé compta pour investiguer.</p>`
    : `<p style="font-size: 10pt; color: #047857; margin-top: 3mm;">Aucune anomalie détectée.</p>`

  const opsTable = ops.length === 0
    ? `<div class="pdf-empty">Aucune opération supérieure à 100 000 F sur la période.</div>`
    : `<table class="pdf-table">
        <thead><tr>
          <th style="width: 60px">Date</th>
          <th>Libellé</th>
          <th>Catégorie</th>
          <th>Caisse</th>
          <th class="num" style="width: 90px">Montant</th>
        </tr></thead>
        <tbody>
          ${ops.map(o => `<tr>
            <td class="date">${formatDateFr(o.date_operation)}</td>
            <td>${escapeHtml(o.libelle)}</td>
            <td>${escapeHtml(o.categorie ?? "—")}</td>
            <td>${escapeHtml(o.caisse_libelle ?? "—")}</td>
            <td class="num ${o.type === "entree" ? "pos" : "amber"}"><strong>${o.type === "entree" ? "+" : "−"}${formatMontantPdf(o.montant)}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>`

  return `<section>
    <h2 class="pdf-section">Audit santé comptable</h2>
    ${banner}
    ${anomaliesLine}
  </section>
  <section style="margin-top: 8mm;">
    <h2 class="pdf-section">Annexes — Top 20 opérations &gt; 100 000 F</h2>
    <p style="font-size: 10pt; color: #6B7280; margin: 0 0 4mm 0;">Opérations marquantes de la période classées par montant décroissant.</p>
    ${opsTable}
  </section>`
}
