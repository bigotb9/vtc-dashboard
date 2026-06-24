/**
 * lib/completude/dateDebutSuivi.ts
 *
 * Règle UNIQUE de borne du suivi des recettes, partagée par les
 * consommateurs qui décident "ce jour est-il attendu pour ce véhicule ?" :
 *   - lib/completude/calculCompletude.ts (grille /recettes/suivi, taux,
 *     Cockpit via getCompletude)
 *   - app/api/agent/process/route.ts (BoyahBot)
 *
 * La borne vit dans vehicules.date_debut_suivi (défaut = 1ère affectation,
 * modifiable, NULL = pas encore suivi). Voir migration
 * 20260624120000_vehicules_date_debut_suivi.sql.
 *
 * Remplace l'ancienne borne "1ère attribution" (premierMap) qui ratait les
 * véhicules sans aucune attribution → impayés fantômes.
 */

/**
 * Vrai si le jour est AVANT le début du suivi du véhicule (→ hors flotte /
 * pre_service, ni attendu ni manquant).
 *
 * Fail-safe : si date_debut_suivi est NULL/undefined (véhicule pas encore
 * suivi), on considère TOUS les jours comme hors flotte — jamais "manquant".
 *
 * @param jour            date du jour testé, format YYYY-MM-DD
 * @param dateDebutSuivi  vehicules.date_debut_suivi (YYYY-MM-DD ou null)
 */
export function avantDebutSuivi(
  jour: string,
  dateDebutSuivi: string | null | undefined,
): boolean {
  if (!dateDebutSuivi) return true
  return jour < String(dateDebutSuivi).slice(0, 10)
}
