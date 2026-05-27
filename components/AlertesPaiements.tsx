/**
 * @deprecated Composant supprimé le 21/05/2026 (Bug 2).
 *
 * La logique d'origine ("les N premières recettes du jour correspondent
 * aux N premiers véhicules") était un placeholder cassé qui marquait
 * arbitrairement les premiers véhicules comme "payés" sans aucun matching
 * réel avec les versements.
 *
 * La fonctionnalité (liste des véhicules en retard du jour avec leurs
 * immatriculations) est désormais intégrée dans
 * `components/SuiviVersementsWidget.tsx` sous la section
 * "En retard aujourd'hui", qui utilise /api/completude comme source de
 * vérité (cohérent avec le reste du widget).
 *
 * À supprimer définitivement du repo (`git rm`) lors du prochain nettoyage.
 */

export default function AlertesPaiements() {
  return null
}
