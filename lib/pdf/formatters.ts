/**
 * Helpers de formatage pour les templates PDF (Phase 4 §5.5).
 *  - formatMontantPdf  : 1234567 → "1 234 567" (espace insécable)
 *  - formatMontantSign : -1234567 → "(1 234 567)" (négatif entre parenthèses)
 *  - formatDateFr      : "2026-04-15" → "15/04/2026"
 *  - formatDateFrLong  : "2026-04-15" → "15 avril 2026"
 *  - formatMois        : "2026-04" → "avril 2026"
 *  - escapeHtml        : sécurité XSS basique pour les chaînes injectées
 */

/** Espace insécable pour ne pas casser les milliers en bout de ligne. */
const NBSP = " "

export function formatMontantPdf(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const rounded = Math.round(n)
  if (rounded === 0) return "—"
  // toLocaleString fr-FR utilise des espaces insécables comme séparateurs
  return rounded.toLocaleString("fr-FR").replace(/[  ]/g, NBSP)
}

/** Avec parenthèses pour les négatifs, dash pour les zéros. */
export function formatMontantSign(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const rounded = Math.round(n)
  if (rounded === 0) return "—"
  if (rounded < 0) return `(${Math.abs(rounded).toLocaleString("fr-FR").replace(/[  ]/g, NBSP)})`
  return rounded.toLocaleString("fr-FR").replace(/[  ]/g, NBSP)
}

export function formatDateFr(s: string | null | undefined): string {
  if (!s) return "—"
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDateFrLong(s: string | null | undefined): string {
  if (!s) return "—"
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

/** "2026-04" → "avril 2026". */
export function formatMois(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const d = new Date(`${ym}-01T00:00:00`)
  if (!Number.isFinite(d.getTime())) return ym
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

/** Échappement HTML basique pour éviter qu'un libellé n'injecte du HTML dans le template. */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** "Grand Livre" → "grand-livre" pour les noms de fichiers. */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
