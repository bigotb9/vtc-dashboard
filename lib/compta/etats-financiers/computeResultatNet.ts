/**
 * Calcul rapide du résultat net SYSCOHADA (utilisé par clôture exercice
 * + cohérent avec le Compte de résultat Module 3b).
 *
 * Approximation V1 :
 *   Résultat net = Σ Produits (classe 7) − Σ Charges (classe 6) − Charges HAO (classe 83)
 *                  + Produits HAO (classe 84) − Impôts (classe 87, 89)
 *
 * Pour la cascade SIG complète (9 niveaux), voir `calculerCompteResultat.ts`.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function computeResultatNet(
  exerciceId: string, dateDebut: string, dateFin: string,
): Promise<number> {
  // Charger toutes les lignes d'écriture d'opérations validées de l'exercice
  // sur la période (typiquement = bornes exercice complet pour la clôture).
  const { data: ops, error: opErr } = await supabaseAdmin
    .from("operations")
    .select("id")
    .eq("exercice_id", exerciceId)
    .eq("statut", "valide")
    .gte("date_operation", dateDebut)
    .lte("date_operation", dateFin)
  if (opErr) throw opErr
  const opIds = (ops ?? []).map(o => (o as { id: string }).id)
  if (opIds.length === 0) return 0

  const { data: ecrs } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id, operation_id")
    .in("operation_id", opIds)
    .eq("statut", "valide")
  const ecrIds = ((ecrs ?? []) as Array<{ id: string }>).map(e => e.id)
  if (ecrIds.length === 0) return 0

  // Charger les lignes en pagination (potentiellement > 1000 lignes)
  let totalCharges  = 0   // classe 6
  let totalProduits = 0   // classe 7
  let totalHaoCh    = 0   // classe 83 (charges HAO)
  let totalHaoPr    = 0   // classe 84 (produits HAO)
  let totalImpots   = 0   // classes 87, 89

  const PAGE = 1000
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: lignes, error: lErr } = await supabaseAdmin
      .from("lignes_ecritures")
      .select("compte_syscohada_code, debit, credit")
      .in("ecriture_id", ecrIds)
      .range(from, from + PAGE - 1)
    if (lErr) throw lErr
    const batch = (lignes ?? []) as Array<{ compte_syscohada_code: string; debit: number | string; credit: number | string }>
    for (const l of batch) {
      const code = (l.compte_syscohada_code ?? "").trim()
      const d = Number(l.debit), c = Number(l.credit)
      // Fix 26/05/2026 (Lot E audit) : les tests 83/84/87/89 étaient placés
      // sous `if startsWith("6")` ou `if startsWith("7")` → branches mortes
      // (un code ne peut pas commencer par "6" ET par "87"). On teste les
      // sous-classes 8xx en premier, puis on retombe sur 6xx et 7xx.
      if (code.startsWith("87") || code.startsWith("89")) {
        totalImpots  += d - c
      } else if (code.startsWith("83")) {
        totalHaoCh   += d - c
      } else if (code.startsWith("84")) {
        totalHaoPr   += c - d
      } else if (code.startsWith("6")) {
        totalCharges += d - c
      } else if (code.startsWith("7")) {
        totalProduits += c - d
      }
    }
    if (batch.length < PAGE) break
    from += PAGE
  }

  // Résultat net = (Produits − Charges) + (HAO produits − HAO charges) − Impôts
  return totalProduits - totalCharges + totalHaoPr - totalHaoCh - totalImpots
}
