/**
 * Construit le HTML de l'en-tête société commun à tous les PDF (Phase 4 §5.3).
 *
 * Fields lus depuis `parametres_module_compta` (cf. Écran 7 migration) :
 *   raison_sociale, numero_rccm, numero_contribuable, adresse_fiscale,
 *   telephone, email_comptable.
 *
 * Conventions :
 *  - Si raison_sociale absente → "Boyah Group SARL" en fallback (jamais vide).
 *  - Champs optionnels masqués si absents/vides (pas de ligne fantôme).
 */

import { escapeHtml } from "@/lib/pdf/formatters"

export interface SocieteHeaderData {
  raison_sociale:      string | null
  numero_rccm:         string | null
  numero_contribuable: string | null
  adresse_fiscale:     string | null
  telephone:           string | null
  email_comptable:     string | null
  /** Phase 4.2 — additions optionnelles depuis `societe_parametres`. */
  nom_commercial?:     string | null
  numero_cc?:          string | null
  capital_social?:     number | null
  /** Signed URL Supabase Storage du logo (TTL ~5min). Affiché à gauche du nom. */
  logo_signed_url?:    string | null
}

export interface PdfHeaderProps {
  societe:    SocieteHeaderData
  titre:      string
  dateFrom:   string
  dateTo:     string
  /** Optionnel : sous-titre additionnel sous le titre. */
  sousTitre?: string
}

/** Renvoie le HTML d'un en-tête à coller en haut de chaque template. */
export function renderPdfHeader({ societe, titre, dateFrom, dateTo, sousTitre }: PdfHeaderProps): string {
  // Préférence : raison_sociale → nom_commercial → fallback
  const raison  = societe.raison_sociale?.trim() || societe.nom_commercial?.trim() || "Boyah Group SARL"
  const lines: string[] = []
  // Phase 4.2 — Priorité numero_cc (nouveau champ) sinon numero_contribuable
  const ccLabel = (societe.numero_cc ?? societe.numero_contribuable)?.trim()
  if (societe.numero_rccm?.trim())         lines.push(`RCCM : ${escapeHtml(societe.numero_rccm.trim())}`)
  if (ccLabel)                              lines.push(`N° CC : ${escapeHtml(ccLabel)}`)
  if (societe.adresse_fiscale?.trim())     lines.push(escapeHtml(societe.adresse_fiscale.trim()))
  const contact: string[] = []
  if (societe.telephone?.trim())           contact.push(escapeHtml(societe.telephone.trim()))
  if (societe.email_comptable?.trim())     contact.push(escapeHtml(societe.email_comptable.trim()))
  if (contact.length > 0) lines.push(contact.join(" · "))
  if (societe.capital_social && societe.capital_social > 0) {
    lines.push(`Capital : ${societe.capital_social.toLocaleString("fr-FR").replace(/ /g, " ")} F`)
  }

  const periode = `du ${formatDateInline(dateFrom)} au ${formatDateInline(dateTo)}`
  // Phase 4.2 — Logo (image ou fallback texte)
  const logoBlock = societe.logo_signed_url
    ? `<img src="${escapeHtml(societe.logo_signed_url)}" alt="Logo" class="pdf-logo" />`
    : ""

  return `<header class="pdf-header">
  <div class="company-block">
    ${logoBlock}
    <div class="company-text">
      <div class="company-name">${escapeHtml(raison)}</div>
      ${lines.length > 0 ? `<div class="company-meta">${lines.join("<br>")}</div>` : ""}
    </div>
  </div>
  <div class="doc-block">
    <div class="doc-type">Document comptable</div>
    <div class="doc-title">${escapeHtml(titre)}</div>
    <div class="doc-period">${escapeHtml(periode)}</div>
    ${sousTitre ? `<div class="doc-period">${escapeHtml(sousTitre)}</div>` : ""}
  </div>
</header>`
}

/** "2026-04-15" → "15/04/2026". (Évite l'import du formatter pour rester local.) */
function formatDateInline(s: string): string {
  if (!s) return "—"
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
