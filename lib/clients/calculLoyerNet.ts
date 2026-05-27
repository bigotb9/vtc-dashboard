/**
 * lib/clients/calculLoyerNet.ts
 *
 * Calcul UNIQUE du loyer net Client (asset management Boyah Group).
 * Cree au Lot U (audit 27/05/2026) pour eliminer le finding 1.1 :
 * formule dupliquee dans 4 fichiers avec divergence (reversements
 * inclus/exclus selon le caller -> ecart UI vs PDF = litige client).
 *
 * Regle metier :
 *   - Boyah supporte jusqu'a 50 000 F de depenses/mois/vehicule.
 *   - Au-dela, le surplus est deduit du loyer mensuel du au Client.
 *   - Le loyer net ne peut pas etre negatif (plancher 0).
 *   - Les depenses de type "reversement" sont par DEFAUT exclues du calcul
 *     (elles representent la sortie cote Boyah du loyer, pas une charge).
 *
 * Cible : utilise par `app/api/clients/route.ts`,
 * `lib/clients/calculBeneficeCumule.ts`, `lib/clients/genererPdfClient.ts`
 * et `app/api/agent/process/route.ts`.
 */

/** Plafond mensuel pris en charge par Boyah par vehicule (F CFA). */
export const PLAFOND_BOYAH = 50_000

export type DepenseInput = {
  montant:       number
  /** Si inclut "reversement" (case-insensitive), la depense est exclue
   *  du calcul par defaut. Mettre `excludeReversements: false` pour
   *  desactiver ce filtre (cas ou les reversements sont deja filtres
   *  en amont, ex: calculBeneficeCumule). */
  type_depense?: string | null
}

export type LoyerNetResult = {
  /** Loyer net a verser au Client (>= 0). */
  loyerNet:         number
  /** Somme des depenses prises en compte dans le calcul. */
  depensesIncluses: number
  /** Somme des depenses ignorees (reversements si excludeReversements=true). */
  depensesExclues:  number
  /** Excedent au-dela du plafond Boyah (deduit du loyer). */
  surplus:          number
  /** Charge effectivement supportee par Boyah (<= PLAFOND_BOYAH). */
  chargeBoyah:      number
}

export type CalculLoyerNetOptions = {
  /** Par defaut true : les depenses de type "reversement*" sont exclues. */
  excludeReversements?: boolean
}

/**
 * Calcule le loyer net Client pour un vehicule sur une periode (typiquement
 * un mois). Idempotent, sans effet de bord.
 *
 * @example
 * calculLoyerNet(150_000, [
 *   { montant: 30_000, type_depense: "Carburant" },
 *   { montant: 20_000, type_depense: "Vidange" },
 *   { montant: 80_000, type_depense: "Reversement client (mois 2026-05)" },
 * ])
 * // {
 * //   loyerNet:         150_000,   // 150k - max(0, 50k - 50k) = 150k - 0
 * //   depensesIncluses:  50_000,
 * //   depensesExclues:   80_000,
 * //   surplus:                0,
 * //   chargeBoyah:       50_000,
 * // }
 */
export function calculLoyerNet(
  loyerBrut: number,
  depenses:  DepenseInput[],
  options:   CalculLoyerNetOptions = {},
): LoyerNetResult {
  const exclude = options.excludeReversements ?? true
  let depensesIncluses = 0
  let depensesExclues  = 0

  for (const d of depenses) {
    const m = Number(d.montant || 0)
    if (!Number.isFinite(m) || m === 0) continue
    const isReversement = String(d.type_depense ?? "")
      .toLowerCase()
      .includes("reversement")
    if (exclude && isReversement) {
      depensesExclues += m
    } else {
      depensesIncluses += m
    }
  }

  const surplus     = Math.max(0, depensesIncluses - PLAFOND_BOYAH)
  const chargeBoyah = Math.min(depensesIncluses, PLAFOND_BOYAH)
  const loyer       = Number(loyerBrut || 0)
  const loyerNet    = Math.max(0, loyer - surplus)

  return { loyerNet, depensesIncluses, depensesExclues, surplus, chargeBoyah }
}
