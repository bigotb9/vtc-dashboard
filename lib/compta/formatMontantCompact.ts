/**
 * Format compact des montants F CFA — Phase 4.x Vague 3.5 §7.2.
 *
 * Règles :
 *   - >= 1 000 000  → "1,85 M"  (1 décimale, séparateur virgule, format FR)
 *   - >= 1 000      → "320 k"   ou "12,5 k" selon précision utile
 *   - < 1 000       → "850 F"
 *
 * Format complet (pour la liste / KPIs principaux) :
 *   formatMontantFull(1850000) → "1 850 000 F"
 */

/** Format compact pour KPIs top-list et axes graphiques. */
export function formatMontantCompact(n: number, withSuffix = true): string {
  if (!Number.isFinite(n) || n === 0) return withSuffix ? "0 F" : "0"
  const abs = Math.abs(n)
  const sign = n < 0 ? "−" : ""

  if (abs >= 1_000_000) {
    // 1 850 000 → 1.85 → "1,85 M"
    const val = abs / 1_000_000
    const str = formatFr(val, val >= 10 ? 1 : 2).replace(/[,.]?0+$/, "")
    return `${sign}${str} M${withSuffix ? " F" : ""}`
  }
  if (abs >= 1_000) {
    // 320 000 → 320 → "320 k", 12 500 → 12.5 → "12,5 k"
    const val = abs / 1_000
    const str = val >= 100
      ? Math.round(val).toString()
      : formatFr(val, 1).replace(/[,.]?0+$/, "")
    return `${sign}${str} k${withSuffix ? " F" : ""}`
  }
  return `${sign}${Math.round(abs)}${withSuffix ? " F" : ""}`
}

/** Format complet avec séparateurs d'espaces (cohérent avec le reste du module). */
export function formatMontantFull(n: number, withSuffix = true): string {
  if (!Number.isFinite(n)) return withSuffix ? "0 F" : "0"
  const abs = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  const formatted = Math.round(abs).toLocaleString("fr-FR").replace(/ | /g, " ")
  return `${sign}${formatted}${withSuffix ? " F" : ""}`
}

/** Format signé avec préfixe explicite "+/−" (pour montants opération). */
export function formatMontantSigne(n: number, type: "entree" | "sortie"): string {
  const prefix = type === "entree" ? "+" : "−"
  return `${prefix}${formatMontantFull(Math.abs(n))}`
}

// ── Helper interne ───────────────────────────────────────────────────────────
function formatFr(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(".", ",")
}
