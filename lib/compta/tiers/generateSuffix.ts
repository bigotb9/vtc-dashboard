/**
 * Génération du suffixe SYSCOHADA depuis un nom de tiers (Phase 4.x Vague 2).
 *
 * Réplique côté Node de la fonction PostgreSQL `generate_tiers_suffix`. Sert
 * uniquement à l'endpoint `/suggest-suffix` qui prévisualise le suffixe et
 * vérifie la disponibilité avant POST. La création réelle passe TOUJOURS par
 * la RPC qui re-calcule côté BD (source de vérité).
 *
 * Règles :
 *   - Strip civilités (MME, MR, M., MLLE, DR, PROF) au début
 *   - 1 mot   → 2 premières lettres   ("Atta" → "AT")
 *   - ≥ 2 mots → initiale 1 + initiale 2 ("Garage Atta" → "GA")
 *   - Fallback "XX" si le nom ne contient aucun caractère exploitable
 *   - Toujours retourné en MAJUSCULES, longueur 2
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { TIERS_SYSCOHADA_PARENT, type TiersType } from "@/types/compta-ui"

const CIVILITES_RE = /^(MME|MR|M\.|MLLE|DR|PROF)\s+/i

function unaccentLite(s: string): string {
  // Mêmes substitutions que la fonction PG `compta_unaccent_lite`.
  const map: Record<string, string> = {
    À:"A", Á:"A", Â:"A", Ã:"A", Ä:"A", Å:"A",
    Ç:"C",
    È:"E", É:"E", Ê:"E", Ë:"E",
    Ì:"I", Í:"I", Î:"I", Ï:"I",
    Ñ:"N",
    Ò:"O", Ó:"O", Ô:"O", Õ:"O", Ö:"O",
    Ù:"U", Ú:"U", Û:"U", Ü:"U",
    Ý:"Y", Ÿ:"Y",
    Æ:"AE", Œ:"OE",
  }
  return s.toUpperCase().replace(/[ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸÆŒ]/g, ch => map[ch] ?? ch)
}

export function generateTiersSuffix(nom: string): string {
  if (!nom || !nom.trim()) return "XX"
  let clean = unaccentLite(nom.trim()).replace(CIVILITES_RE, "").trim()
  // Découpage en mots significatifs (alphanumériques)
  const words = clean.split(/[^A-Z0-9]+/).filter(Boolean)
  if (words.length === 0) return "XX"
  let suffix: string
  if (words.length === 1) {
    suffix = words[0].slice(0, 2)
    if (suffix.length < 2) suffix = (suffix + "X").slice(0, 2)
  } else {
    suffix = words[0][0] + words[1][0]
  }
  return suffix
}

/**
 * Calcule un suffixe + liste d'alternatives dispo, en vérifiant les tiers
 * actifs existants en BD. Utilisé par GET /tiers/suggest-suffix.
 */
export async function suggestSuffixWithAvailability(nom: string, type: TiersType): Promise<{
  suffix_suggere:        string
  compte_syscohada_code: string
  disponible:            boolean
  alternatives:          string[]
}> {
  const base   = generateTiersSuffix(nom)
  const parent = TIERS_SYSCOHADA_PARENT[type]

  // Récupérer tous les codes commençant par parent-base (limit 100)
  const { data } = await supabaseAdmin
    .from("tiers")
    .select("compte_syscohada_code")
    .eq("actif", true)
    .like("compte_syscohada_code", `${parent}-${base}%`)
    .limit(120)

  const taken = new Set<string>()
  for (const r of (data ?? []) as Array<{ compte_syscohada_code: string }>) {
    taken.add(r.compte_syscohada_code)
  }

  const baseCode = `${parent}-${base}`
  const disponible = !taken.has(baseCode)

  // Trouver les 3 premières alternatives libres
  const alternatives: string[] = []
  if (!disponible) {
    for (let i = 1; i <= 99 && alternatives.length < 3; i++) {
      const alt = `${parent}-${base}${i}`
      if (!taken.has(alt)) alternatives.push(`${base}${i}`)
    }
  }

  return {
    suffix_suggere:        base,
    compte_syscohada_code: baseCode,
    disponible,
    alternatives,
  }
}
