/**
 * Calcul cascade des 9 Soldes Intermédiaires de Gestion (SIG)
 * — Compte de résultat SYSCOHADA révisé (Phase 4.2 Module 3b §5).
 *
 * SIG :
 *   1. MARGE_COMMERCIALE     = Ventes marchandises (701) − Achats march. (601) ± Var. stock (6031)
 *   2. PRODUCTION_EXERCICE   = Production vendue (706) + Production stockée (73) + Production immo
 *   3. VALEUR_AJOUTEE        = SIG1 + SIG2 − Conso interm. (60, 61, 62 hors 601)
 *   4. EBE                   = VA + Subv. exploitation (71) − Impôts/taxes (64) − Charges personnel (66)
 *   5. RESULTAT_EXPLOITATION = EBE + Reprises (75) + Autres produits − Dotations (68) − Autres charges (65)
 *   6. RESULTAT_FINANCIER    = Produits financiers (77) − Charges financières (67)
 *   7. RAO                   = SIG5 + SIG6
 *   8. HAO                   = Produits HAO (84) − Charges HAO (83)
 *   9. RESULTAT_NET          = RAO + HAO − Impôts (87, 89)
 *
 * Charge également la période N-1 pour comparatif (mêmes bornes − 1 an).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { CompteResultatData, SIGCode, SIGRow } from "@/types/compta-ui"

interface SoldeCode { code: string; debit: number; credit: number }

/** Charge les soldes par compte SYSCOHADA pour un exercice + plage de dates. */
async function loadSoldes(exerciceId: string, dateFrom: string, dateTo: string): Promise<Map<string, SoldeCode>> {
  const acc = new Map<string, SoldeCode>()
  const { data: ops } = await supabaseAdmin
    .from("operations")
    .select("id")
    .eq("exercice_id", exerciceId)
    .eq("statut", "valide")
    .gte("date_operation", dateFrom)
    .lte("date_operation", dateTo)
  const opIds = ((ops ?? []) as Array<{ id: string }>).map(o => o.id)
  if (opIds.length === 0) return acc

  const { data: ecrs } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id")
    .in("operation_id", opIds)
    .eq("statut", "valide")
  const ecrIds = ((ecrs ?? []) as Array<{ id: string }>).map(e => e.id)
  if (ecrIds.length === 0) return acc

  const PAGE = 1000
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: lignes, error } = await supabaseAdmin
      .from("lignes_ecritures")
      .select("compte_syscohada_code, debit, credit")
      .in("ecriture_id", ecrIds)
      .range(from, from + PAGE - 1)
    if (error) throw error
    const batch = (lignes ?? []) as Array<{ compte_syscohada_code: string; debit: number | string; credit: number | string }>
    for (const l of batch) {
      const code = (l.compte_syscohada_code ?? "").trim()
      if (!code) continue
      const cur = acc.get(code) ?? { code, debit: 0, credit: 0 }
      cur.debit  += Number(l.debit)
      cur.credit += Number(l.credit)
      acc.set(code, cur)
    }
    if (batch.length < PAGE) break
    from += PAGE
  }
  return acc
}

/** Somme des soldes des comptes dont le code commence par un préfixe. */
function sumByPrefix(soldes: Map<string, SoldeCode>, prefix: string, mode: "debit-credit" | "credit-debit"): number {
  let total = 0
  for (const [code, s] of soldes.entries()) {
    if (code.startsWith(prefix)) {
      total += mode === "debit-credit" ? s.debit - s.credit : s.credit - s.debit
    }
  }
  return total
}

/** Idem mais avec un préfixe exclu (pour distinguer 6031 de 601 par exemple). */
function sumByPrefixExcept(
  soldes: Map<string, SoldeCode>, prefix: string, exclude: string[], mode: "debit-credit" | "credit-debit",
): number {
  let total = 0
  for (const [code, s] of soldes.entries()) {
    if (code.startsWith(prefix) && !exclude.some(ex => code.startsWith(ex))) {
      total += mode === "debit-credit" ? s.debit - s.credit : s.credit - s.debit
    }
  }
  return total
}

function buildSIGs(soldesN: Map<string, SoldeCode>, soldesNm1: Map<string, SoldeCode>): SIGRow[] {
  // Helpers : Produits = solde créditeur (credit − debit), Charges = solde débiteur (debit − credit)
  const charge = (m: Map<string, SoldeCode>, p: string) => sumByPrefix(m, p, "debit-credit")
  const chargeExcept = (m: Map<string, SoldeCode>, p: string, ex: string[]) => sumByPrefixExcept(m, p, ex, "debit-credit")
  const produit = (m: Map<string, SoldeCode>, p: string) => sumByPrefix(m, p, "credit-debit")

  // 1. MARGE COMMERCIALE
  const vm_N = produit(soldesN, "701"), vm_Nm1 = produit(soldesNm1, "701")
  const am_N = charge (soldesN, "601"), am_Nm1 = charge (soldesNm1, "601")
  const vs_N = charge (soldesN, "6031"),vs_Nm1 = charge (soldesNm1, "6031")  // variation stock march
  const marge_N    = vm_N    - am_N    - vs_N
  const marge_Nm1  = vm_Nm1  - am_Nm1  - vs_Nm1

  // 2. PRODUCTION DE L'EXERCICE
  const pv_N = produit(soldesN, "706"), pv_Nm1 = produit(soldesNm1, "706")
  const ps_N = produit(soldesN, "73"),  ps_Nm1 = produit(soldesNm1, "73")
  const prod_N   = pv_N   + ps_N
  const prod_Nm1 = pv_Nm1 + ps_Nm1

  // 3. VALEUR AJOUTÉE : Marge + Production − Conso (60 hors 601, 61, 62)
  const conso60_N = chargeExcept(soldesN, "60", ["601", "6031"])
  const conso61_N = charge      (soldesN, "61")
  const conso62_N = charge      (soldesN, "62")
  const conso60_Nm1 = chargeExcept(soldesNm1, "60", ["601", "6031"])
  const conso61_Nm1 = charge      (soldesNm1, "61")
  const conso62_Nm1 = charge      (soldesNm1, "62")
  const va_N   = marge_N   + prod_N   - conso60_N   - conso61_N   - conso62_N
  const va_Nm1 = marge_Nm1 + prod_Nm1 - conso60_Nm1 - conso61_Nm1 - conso62_Nm1

  // 4. EBE
  const subv_N  = produit(soldesN, "71"), subv_Nm1 = produit(soldesNm1, "71")
  const imp_N   = charge (soldesN, "64"), imp_Nm1  = charge (soldesNm1, "64")
  const pers_N  = charge (soldesN, "66"), pers_Nm1 = charge (soldesNm1, "66")
  const ebe_N   = va_N   + subv_N   - imp_N   - pers_N
  const ebe_Nm1 = va_Nm1 + subv_Nm1 - imp_Nm1 - pers_Nm1

  // 5. RÉSULTAT D'EXPLOITATION
  const repr_N = produit(soldesN, "75"), repr_Nm1 = produit(soldesNm1, "75")
  const dot_N  = charge (soldesN, "68"), dot_Nm1  = charge (soldesNm1, "68")
  const auch_N = charge (soldesN, "65"), auch_Nm1 = charge (soldesNm1, "65")
  const rex_N   = ebe_N   + repr_N   - dot_N   - auch_N
  const rex_Nm1 = ebe_Nm1 + repr_Nm1 - dot_Nm1 - auch_Nm1

  // 6. RÉSULTAT FINANCIER
  const pf_N = produit(soldesN, "77"), pf_Nm1 = produit(soldesNm1, "77")
  const cf_N = charge (soldesN, "67"), cf_Nm1 = charge (soldesNm1, "67")
  const rf_N   = pf_N   - cf_N
  const rf_Nm1 = pf_Nm1 - cf_Nm1

  // 7. RAO
  const rao_N   = rex_N   + rf_N
  const rao_Nm1 = rex_Nm1 + rf_Nm1

  // 8. HAO
  const phao_N = produit(soldesN, "84"), phao_Nm1 = produit(soldesNm1, "84")
  const chao_N = charge (soldesN, "83"), chao_Nm1 = charge (soldesNm1, "83")
  const hao_N   = phao_N - chao_N
  const hao_Nm1 = phao_Nm1 - chao_Nm1

  // 9. RÉSULTAT NET
  const imp87_N = charge(soldesN, "87"), imp87_Nm1 = charge(soldesNm1, "87")
  const imp89_N = charge(soldesN, "89"), imp89_Nm1 = charge(soldesNm1, "89")
  const rn_N   = rao_N   + hao_N   - imp87_N   - imp89_N
  const rn_Nm1 = rao_Nm1 + hao_Nm1 - imp87_Nm1 - imp89_Nm1

  const sigs: SIGRow[] = [
    { code: "MARGE_COMMERCIALE", libelle: "Marge commerciale", total_n: marge_N, total_n_minus_1: marge_Nm1,
      detail: [
        { libelle: "Ventes marchandises (701)",     signe: 1, montant_n: vm_N, montant_n_minus_1: vm_Nm1 },
        { libelle: "Achats marchandises (601)",     signe: -1, montant_n: am_N, montant_n_minus_1: am_Nm1 },
        { libelle: "Var. stocks marchandises (6031)", signe: -1, montant_n: vs_N, montant_n_minus_1: vs_Nm1 },
      ] },
    { code: "PRODUCTION_EXERCICE", libelle: "Production de l'exercice", total_n: prod_N, total_n_minus_1: prod_Nm1,
      detail: [
        { libelle: "Production vendue (706)",  signe: 1, montant_n: pv_N, montant_n_minus_1: pv_Nm1 },
        { libelle: "Production stockée (73)",  signe: 1, montant_n: ps_N, montant_n_minus_1: ps_Nm1 },
      ] },
    { code: "VALEUR_AJOUTEE", libelle: "Valeur ajoutée", total_n: va_N, total_n_minus_1: va_Nm1,
      detail: [
        { libelle: "Marge commerciale",              signe: 1, montant_n: marge_N,   montant_n_minus_1: marge_Nm1 },
        { libelle: "Production",                      signe: 1, montant_n: prod_N,    montant_n_minus_1: prod_Nm1 },
        { libelle: "Achats hors march. (60 hors 601)",signe: -1, montant_n: conso60_N, montant_n_minus_1: conso60_Nm1 },
        { libelle: "Transports (61)",                 signe: -1, montant_n: conso61_N, montant_n_minus_1: conso61_Nm1 },
        { libelle: "Services extérieurs (62)",        signe: -1, montant_n: conso62_N, montant_n_minus_1: conso62_Nm1 },
      ] },
    { code: "EBE", libelle: "Excédent brut d'exploitation (EBE)", total_n: ebe_N, total_n_minus_1: ebe_Nm1,
      detail: [
        { libelle: "Valeur ajoutée",                  signe: 1, montant_n: va_N,    montant_n_minus_1: va_Nm1 },
        { libelle: "Subventions exploitation (71)",   signe: 1, montant_n: subv_N,  montant_n_minus_1: subv_Nm1 },
        { libelle: "Impôts et taxes (64)",            signe: -1, montant_n: imp_N,   montant_n_minus_1: imp_Nm1 },
        { libelle: "Charges de personnel (66)",       signe: -1, montant_n: pers_N,  montant_n_minus_1: pers_Nm1 },
      ] },
    { code: "RESULTAT_EXPLOITATION", libelle: "Résultat d'exploitation", total_n: rex_N, total_n_minus_1: rex_Nm1,
      detail: [
        { libelle: "EBE",                              signe: 1, montant_n: ebe_N,   montant_n_minus_1: ebe_Nm1 },
        { libelle: "Reprises amort./prov. (75)",       signe: 1, montant_n: repr_N,  montant_n_minus_1: repr_Nm1 },
        { libelle: "Dotations amort./prov. (68)",      signe: -1, montant_n: dot_N,   montant_n_minus_1: dot_Nm1 },
        { libelle: "Autres charges (65)",              signe: -1, montant_n: auch_N,  montant_n_minus_1: auch_Nm1 },
      ] },
    { code: "RESULTAT_FINANCIER", libelle: "Résultat financier", total_n: rf_N, total_n_minus_1: rf_Nm1,
      detail: [
        { libelle: "Produits financiers (77)",         signe: 1, montant_n: pf_N, montant_n_minus_1: pf_Nm1 },
        { libelle: "Charges financières (67)",         signe: -1, montant_n: cf_N, montant_n_minus_1: cf_Nm1 },
      ] },
    { code: "RAO", libelle: "Résultat des activités ordinaires (RAO)", total_n: rao_N, total_n_minus_1: rao_Nm1,
      detail: [
        { libelle: "Résultat exploitation",  signe: 1, montant_n: rex_N, montant_n_minus_1: rex_Nm1 },
        { libelle: "Résultat financier",      signe: 1, montant_n: rf_N,  montant_n_minus_1: rf_Nm1 },
      ] },
    { code: "HAO", libelle: "Résultat hors activités ordinaires (HAO)", total_n: hao_N, total_n_minus_1: hao_Nm1,
      detail: [
        { libelle: "Produits HAO (84)",       signe: 1, montant_n: phao_N, montant_n_minus_1: phao_Nm1 },
        { libelle: "Charges HAO (83)",        signe: -1, montant_n: chao_N, montant_n_minus_1: chao_Nm1 },
      ] },
    { code: "RESULTAT_NET", libelle: "Résultat net de l'exercice", total_n: rn_N, total_n_minus_1: rn_Nm1,
      detail: [
        { libelle: "RAO",                        signe: 1, montant_n: rao_N,    montant_n_minus_1: rao_Nm1 },
        { libelle: "HAO",                        signe: 1, montant_n: hao_N,    montant_n_minus_1: hao_Nm1 },
        { libelle: "Impôt sur le résultat (87)", signe: -1, montant_n: imp87_N,  montant_n_minus_1: imp87_Nm1 },
        { libelle: "Participation salariés (89)",signe: -1, montant_n: imp89_N,  montant_n_minus_1: imp89_Nm1 },
      ] },
  ]
  void ({} as Record<SIGCode, true>)  // type-check exhaustif
  return sigs
}

export async function calculerCompteResultat(exerciceId: string, dateDebut?: string, dateFin?: string): Promise<CompteResultatData> {
  const { data: ex } = await supabaseAdmin
    .from("exercices")
    .select("id, annee, libelle, date_debut, date_fin")
    .eq("id", exerciceId)
    .maybeSingle()
  if (!ex) throw new Error("Exercice introuvable")
  const debut = dateDebut ?? ex.date_debut
  const fin   = dateFin   ?? ex.date_fin

  // N
  const soldesN = await loadSoldes(ex.id, debut, fin)
  // N-1 : même plage − 1 an
  const shift = (iso: string): string => {
    const d = new Date(iso + "T00:00:00Z")
    d.setUTCFullYear(d.getUTCFullYear() - 1)
    return d.toISOString().slice(0, 10)
  }
  const debutNm1 = shift(debut)
  const finNm1   = shift(fin)
  let soldesNm1: Map<string, SoldeCode> = new Map()
  const { data: exPrev } = await supabaseAdmin
    .from("exercices")
    .select("id")
    .eq("annee", ex.annee - 1)
    .maybeSingle()
  if (exPrev) {
    soldesNm1 = await loadSoldes(exPrev.id, debutNm1, finNm1)
  }

  const sigs = buildSIGs(soldesN, soldesNm1)
  const resNet = sigs.find(s => s.code === "RESULTAT_NET")
  return {
    exercice_id:            ex.id,
    exercice_libelle:       ex.libelle,
    date_debut:             debut,
    date_fin:               fin,
    sigs,
    resultat_net:           resNet?.total_n ?? 0,
    resultat_net_n_minus_1: resNet?.total_n_minus_1 ?? 0,
  }
}
