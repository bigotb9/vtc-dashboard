/**
 * lib/format/montant.ts
 *
 * Point d'entrée canonique pour le formatage des montants F CFA dans Fleet.
 * Cree au Lot S (audit 27/05/2026) pour centraliser les 136 `.toLocaleString`
 * dispatches dans 99 fichiers.
 *
 * 5 fonctions exportees :
 *   - formatMontant(n)            : "1 240 000" (sans suffix, le plus courant)
 *   - formatMontantAvecF(n)       : "1 240 000 F" (avec suffix F CFA)
 *   - formatMontantCompact(n)     : "1,24 M F" si > 1M, sinon standard avec suffix
 *   - formatMontantSigne(n, type) : "+1 240 000" / "−1 240 000" selon entree/sortie
 *   - formatMontantPdf(n)         : "1 234 567" pour templates PDF (parentheses negatifs)
 *   - parseMontant(s)             : "1 240 000 F" → 1240000 (inverse pour formulaires)
 *
 * Compatibilite :
 *   - lib/compta/formatMontantCompact.ts continue d'exposer formatMontantCompact /
 *     formatMontantFull / formatMontantSigne (re-exportes ici)
 *   - lib/pdf/formatters.ts continue d'exposer formatMontantPdf (re-exporte ici)
 *
 * Cible : import { formatMontant } from "@/lib/format/montant"
 */

import {
  formatMontantCompact as _formatMontantCompact,
  formatMontantFull   as _formatMontantFull,
  formatMontantSigne  as _formatMontantSigne,
} from "@/lib/compta/formatMontantCompact"
import { formatMontantPdf as _formatMontantPdf } from "@/lib/pdf/formatters"

/**
 * Format standard : "1 240 000" (espaces de milliers, sans decimales, sans suffix).
 * Pattern majoritaire dans Fleet (~60% des cas).
 *
 * @example formatMontant(1240000)  // "1 240 000"
 * @example formatMontant(0)        // "0"
 * @example formatMontant(null)     // "0"
 */
export function formatMontant(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0"
  return Math.round(Math.abs(n)).toLocaleString("fr-FR")
}

/**
 * Format standard avec suffix " F" (F CFA). Pratique pour l'affichage standalone.
 *
 * @example formatMontantAvecF(1240000) // "1 240 000 F"
 */
export function formatMontantAvecF(n: number | null | undefined): string {
  return `${formatMontant(n)} F`
}

/**
 * Format compact : "1,24 M F" pour les grands montants, sinon standard.
 * Util pour KPI tops, axes de graphiques. Cf. lib/compta/formatMontantCompact.
 *
 * @example formatMontantCompact(1850000) // "1,85 M F"
 * @example formatMontantCompact(320000)  // "320 k F"
 * @example formatMontantCompact(850)     // "850 F"
 */
export const formatMontantCompact = _formatMontantCompact

/**
 * Format complet avec suffix " F" (alias historique de formatMontantAvecF).
 * Re-exporte depuis lib/compta/formatMontantCompact pour cohérence.
 */
export const formatMontantFull = _formatMontantFull

/**
 * Format signé pour montants d'operations comptables.
 *
 * @example formatMontantSigne(50000, "entree") // "+50 000 F"
 * @example formatMontantSigne(50000, "sortie") // "−50 000 F"
 */
export const formatMontantSigne = _formatMontantSigne

/**
 * Format pour templates PDF : espaces insecables, parentheses pour negatifs,
 * dash pour zeros. Pas de suffix " F" (ajoute au choix dans le template).
 *
 * @example formatMontantPdf(1234567)  // "1 234 567"
 * @example formatMontantPdf(-1234567) // "(1 234 567)"
 * @example formatMontantPdf(0)        // "—"
 */
export const formatMontantPdf = _formatMontantPdf

/**
 * Inverse de formatMontant. Parse une chaine "1 240 000 F" en nombre.
 * Tolerant aux suffixes (F, FCFA, F CFA, XOF), aux signes, aux decimales virgule.
 *
 * @example parseMontant("1 240 000 F")    // 1240000
 * @example parseMontant("-50 000")         // -50000
 * @example parseMontant("1,5 M F")         // NaN (format compact non supporte)
 * @example parseMontant("")                // NaN
 */
export function parseMontant(s: string | null | undefined): number {
  if (s == null) return NaN
  // Retire suffixes monetaires et espaces (y compris insecable U+00A0)
  const cleaned = String(s)
    .replace(/[\sFCFAXOFf cfa]/g, "")  // retire "F", "FCFA", "F CFA", "XOF"
    .replace(/,/g, ".")                 // virgule decimale -> point
  if (cleaned === "" || cleaned === "-") return NaN
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}
