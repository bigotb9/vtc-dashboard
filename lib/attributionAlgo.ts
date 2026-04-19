/**
 * Algorithme d'attribution des versements Wave au jour d'exploitation réel.
 *
 * Règles métier :
 * - Les voitures roulent lundi → samedi (dimanche non ouvré)
 * - Une recette Wave reçue un jour N compte par défaut pour le jour ouvré précédent (N-1,
 *   en sautant le dimanche). Ex: reçue dimanche → compte pour samedi.
 * - Si plusieurs recettes Wave le même jour pour le même véhicule :
 *     1ère → jour ouvré précédent
 *     2ème+ → le jour de réception lui-même (si ouvré)
 * - Si le montant ≈ 2× montant attendu (tolérance 1%) → split sur 2 jours ouvrés consécutifs
 * - Jours fériés : montant attendu = 15 000 FCFA (fixe pour tous)
 * - Tolérance frais Wave : 1% (ex: 22 000 → ≥ 21 780 considéré comme complet)
 */

export type RecetteRaw = {
  id:              number
  id_vehicule:     number | null
  Horodatage:      string
  "Montant net":   number
  /** Si présent, utilisé à la place de l'id_vehicule pour les SPLITS qui doivent aller sur un jour antérieur.
   *  Permet de gérer les changements d'affectation : au moment du jour d'exploitation, le chauffeur
   *  était peut-être sur un autre véhicule. Le composant appelant peut pré-résoudre cet id. */
  id_vehicule_pour_jour_prec?: number | null
}

export type VehiculeInfo = {
  id_vehicule:          number
  montant_recette_jour: number
}

export type Attribution = {
  id_recette:        number
  id_vehicule:       number
  jour_exploitation: string   // YYYY-MM-DD
  montant_attribue:  number
  type_attribution:  "normal" | "jour_meme" | "split_2j" | "retard"
}

const TOLERANCE = 0.99            // 1% de frais Wave acceptés
const JOUR_FERIE_MONTANT = 15000  // par défaut

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isSunday(d: Date): boolean {
  return d.getUTCDay() === 0
}

/** Retourne le jour ouvré précédent (saute le dimanche) en UTC */
function prevWorkday(d: Date): Date {
  const prev = new Date(d)
  prev.setUTCDate(prev.getUTCDate() - 1)
  while (isSunday(prev)) {
    prev.setUTCDate(prev.getUTCDate() - 1)
  }
  return prev
}

/** Diff en jours calendaires (absolu) entre 2 dates */
function diffDays(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / 86400000))
}

/** Extrait la date UTC (YYYY-MM-DD) d'un horodatage */
function dateOf(horodatage: string): Date {
  // Force UTC pour éviter les surprises de fuseau
  const d = new Date(horodatage)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Lance l'attribution pour un ensemble de transactions.
 * @param recettes    Toutes les recettes Wave triables
 * @param vehicules   Map id_vehicule → info
 * @param feries      Map "YYYY-MM-DD" → montant férié
 */
export function attribuerRecettes(
  recettes: RecetteRaw[],
  vehicules: Map<number, VehiculeInfo>,
  feries:    Map<string, number>
): Attribution[] {
  const attributions: Attribution[] = []

  // Groupe par véhicule
  const parVehicule = new Map<number, RecetteRaw[]>()
  for (const r of recettes) {
    if (r.id_vehicule == null) continue
    if (!parVehicule.has(r.id_vehicule)) parVehicule.set(r.id_vehicule, [])
    parVehicule.get(r.id_vehicule)!.push(r)
  }

  for (const [id_vehicule, txs] of parVehicule) {
    const v = vehicules.get(id_vehicule)
    if (!v) continue   // seulement skip si le véhicule n'existe pas en base

    // Si pas de montant configuré → on attribue quand même, mais sans détection de split
    const expectedBase = v.montant_recette_jour > 0 ? v.montant_recette_jour : 0

    // Tri chronologique
    txs.sort((a, b) => a.Horodatage.localeCompare(b.Horodatage))

    // Set des jours d'exploitation déjà attribués pour ce véhicule.
    // Permet de détecter les conflits multi-chauffeurs : si 2 chauffeurs paient pour le même
    // véhicule sur des dates Wave qui pointent vers le même jour d'exploitation, on bascule
    // le second sur le jour Wave lui-même (jour_meme) plutôt que d'écraser.
    const attributedDays = new Set<string>()

    for (const r of txs) {
      const dWave    = dateOf(r.Horodatage)
      const dWaveISO = toISODate(dWave)
      const montant  = Number(r["Montant net"] || 0)
      if (montant <= 0) continue

      const feriesMontant = feries.get(dWaveISO)
      const expected = feriesMontant ?? expectedBase

      // Cas 1 : split multi-jours (skip les jours déjà pris, remonte plus loin)
      if (expected > 0) {
        const ratio = montant / expected
        const n = Math.round(ratio)
        if (n >= 2 && Math.abs(montant - n * expected) <= expected * 0.05) {
          const part = montant / n
          let jour = dWave
          let placed = 0
          let safety = 15
          while (placed < n && safety > 0) {
            jour = prevWorkday(jour)
            safety--
            const jourISO = toISODate(jour)
            if (attributedDays.has(jourISO)) continue
            attributions.push({
              id_recette: r.id, id_vehicule,
              jour_exploitation: jourISO,
              montant_attribue: part,
              type_attribution: "split_2j",
            })
            attributedDays.add(jourISO)
            placed++
          }
          continue
        }
      }

      // Cas 2 : attribution simple avec détection de conflit
      const targetDay = prevWorkday(dWave)
      const targetISO = toISODate(targetDay)

      if (!attributedDays.has(targetISO)) {
        // Jour cible libre → normal ou retard
        const gap = diffDays(dWave, targetDay)
        attributions.push({
          id_recette: r.id, id_vehicule,
          jour_exploitation: targetISO,
          montant_attribue: montant,
          type_attribution: gap > 1 ? "retard" : "normal",
        })
        attributedDays.add(targetISO)
      } else if (!isSunday(dWave)) {
        // Jour cible pris → bascule vers le 1er jour ouvré disponible à partir de dWave
        let finalDay = new Date(dWave)
        let finalISO = dWaveISO
        let safety = 15
        while (attributedDays.has(finalISO) && safety > 0) {
          finalDay.setUTCDate(finalDay.getUTCDate() + 1)
          while (isSunday(finalDay)) {
            finalDay.setUTCDate(finalDay.getUTCDate() + 1)
          }
          finalISO = toISODate(finalDay)
          safety--
        }
        attributions.push({
          id_recette: r.id, id_vehicule,
          jour_exploitation: finalISO,
          montant_attribue: montant,
          type_attribution: "jour_meme",
        })
        attributedDays.add(finalISO)
      } else {
        // Wave dimanche + samedi cible pris → on accepte le doublon sur samedi
        // (pas d'autre option logique, dimanche n'est pas ouvré)
        attributions.push({
          id_recette: r.id, id_vehicule,
          jour_exploitation: targetISO,
          montant_attribue: montant,
          type_attribution: "normal",
        })
      }
    }
  }

  return attributions
}
