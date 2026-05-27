/**
 * PHASE 4.3 — Module 3 : Tableau Flux de Trésorerie SYSCOHADA.
 *
 * Structure officielle :
 *   A — FLUX OPÉRATIONNELS
 *     CAFG = Résultat net + Dotations 68x − Reprises 78x − ± plus/moins-values cession
 *     − Variation BFR (stocks 3x + clients 41x − fournisseurs 401)
 *   B — FLUX D'INVESTISSEMENT
 *     − Acquisitions immo (variations + classes 2x hors 28x)
 *     + Cessions immo (variations − classes 2x)
 *     − Variation immo financières (26, 27)
 *   C — FLUX DE FINANCEMENT
 *     + Augmentation capital (10x)
 *     + Souscription emprunts (16x/17x crédit)
 *     − Remboursement emprunts (16x/17x débit)
 *     − Dividendes versés (proxy : 11 var. négative — V1 simplifié)
 *
 *   VARIATION NETTE = A + B + C
 *   Réconciliation : Trésorerie début + (A+B+C) === Trésorerie fin (classe 5x)
 *
 * V1 simplifié :
 *   - Pas de séparation acquisitions/cessions au niveau ligne — on utilise
 *     directement la variation nette par compte (positive = acquisition,
 *     négative = cession). Acceptable pour V1 sans module Immo dédié.
 *   - Pas de plus/moins-values cession (compte 81 / 82) — calcul approx.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TftData, TftSection, TftLigne } from "@/types/compta-ui"

interface LigneAggregate {
  compte:  string
  debit:   number
  credit:  number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function chargerSoldes(exerciceId: string, dateMax: string): Promise<LigneAggregate[]> {
  const { data: ops } = await supabaseAdmin
    .from("operations")
    .select("id")
    .eq("exercice_id", exerciceId)
    .eq("statut", "valide")
    .lte("date_operation", dateMax)
  const opIds = ((ops ?? []) as Array<{ id: string }>).map(o => o.id)

  let ecrIds: string[] = []
  if (opIds.length > 0) {
    const { data: ecrs } = await supabaseAdmin
      .from("ecritures_comptables").select("id")
      .in("operation_id", opIds).eq("statut", "valide")
    ecrIds = ((ecrs ?? []) as Array<{ id: string }>).map(e => e.id)
  }
  const { data: ecrsAuto } = await supabaseAdmin
    .from("ecritures_comptables").select("id")
    .eq("exercice_id", exerciceId).eq("statut", "valide").eq("auto_generated", true)
    .lte("date_ecriture", dateMax)
  ecrIds = [...ecrIds, ...((ecrsAuto ?? []) as Array<{ id: string }>).map(e => e.id)]
  if (ecrIds.length === 0) return []

  const acc = new Map<string, { debit: number; credit: number }>()
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data: lignes } = await supabaseAdmin
      .from("lignes_ecritures")
      .select("compte_syscohada_code, debit, credit")
      .in("ecriture_id", ecrIds)
      .range(from, from + PAGE - 1)
    const batch = (lignes ?? []) as Array<{ compte_syscohada_code: string; debit: number | string; credit: number | string }>
    for (const l of batch) {
      const code = (l.compte_syscohada_code ?? "").trim()
      if (!code) continue
      const cur = acc.get(code) ?? { debit: 0, credit: 0 }
      cur.debit  += Number(l.debit)
      cur.credit += Number(l.credit)
      acc.set(code, cur)
    }
    if (batch.length < PAGE) break
    from += PAGE
  }
  return [...acc.entries()].map(([compte, v]) => ({ compte, debit: v.debit, credit: v.credit }))
}

function soldeNet(soldes: LigneAggregate[], prefix: string, mode: "debit" | "credit"): number {
  let total = 0
  for (const s of soldes) {
    if (!s.compte.startsWith(prefix)) continue
    total += mode === "debit" ? (s.debit - s.credit) : (s.credit - s.debit)
  }
  return Math.round(total)
}

/** Trésorerie = somme classes 52, 53, 57 (actif) − classe 56 (découverts). */
function tresorerie(soldes: LigneAggregate[]): number {
  return soldeNet(soldes, "52", "debit")
       + soldeNet(soldes, "53", "debit")
       + soldeNet(soldes, "57", "debit")
       - soldeNet(soldes, "56", "credit")
}

/** Construit une cascade TFT à partir des soldes N et N-1. */
function buildCascade(soldesN: LigneAggregate[], soldesNm1: LigneAggregate[]): TftSection[] {
  // Helpers pour produire une ligne (delta = N − Nm1) avec signe explicite
  const delta = (prefix: string, mode: "debit" | "credit"): { n: number; nm1: number } => ({
    n:   soldeNet(soldesN,   prefix, mode),
    nm1: soldeNet(soldesNm1, prefix, mode),
  })

  // Variations utiles
  // (les variations sont calculées comme (solde N − solde Nm1))
  const dStocks    = soldeNet(soldesN, "3",   "debit") - soldeNet(soldesNm1, "3",   "debit")
  const dClients   = soldeNet(soldesN, "411", "debit") - soldeNet(soldesNm1, "411", "debit")
  const dFournis   = soldeNet(soldesN, "401", "credit") - soldeNet(soldesNm1, "401", "credit")
  const dAutresCr  = soldeNet(soldesN, "42",  "debit") - soldeNet(soldesNm1, "42",  "debit")
                   + soldeNet(soldesN, "44",  "debit") - soldeNet(soldesNm1, "44",  "debit")
  const dAutresDe  = soldeNet(soldesN, "43",  "credit") - soldeNet(soldesNm1, "43",  "credit")

  // Résultat net (compte 13, agrégé via classe 1 — utilise les comptes 130/139)
  const resultatN   = soldeNet(soldesN,   "13", "credit")
  const resultatNm1 = soldeNet(soldesNm1, "13", "credit")

  // Dotations + reprises (cf. SIG)
  const dotN   = soldeNet(soldesN,   "68", "debit")
  const dotNm1 = soldeNet(soldesNm1, "68", "debit")
  const repN   = soldeNet(soldesN,   "78", "credit")
  const repNm1 = soldeNet(soldesNm1, "78", "credit")

  // A — Opérationnel
  const sectionA: TftSection = {
    code:   "OPERATIONNEL",
    libelle:"Flux de trésorerie provenant des activités opérationnelles",
    lignes: [
      makeLigne("Résultat net de l'exercice",                +1, resultatN,                          resultatNm1),
      makeLigne("(+) Dotations aux amortissements et provisions (68x)", +1, dotN,                    dotNm1),
      makeLigne("(−) Reprises sur amortissements et provisions (78x)",  -1, repN,                    repNm1),
      makeLigne("(−) Variation des stocks (3x)",             -1, dStocks,                            0),
      makeLigne("(−) Variation des créances clients (411)",  -1, dClients,                           0),
      makeLigne("(+) Variation des dettes fournisseurs (401)",+1, dFournis,                          0),
      makeLigne("(−) Variation autres créances (42, 44)",    -1, dAutresCr,                          0),
      makeLigne("(+) Variation autres dettes (43)",          +1, dAutresDe,                          0),
    ],
    total_n: 0, total_n_minus_1: 0,
  }
  sectionA.total_n         = sumSigned(sectionA.lignes, "n")
  sectionA.total_n_minus_1 = sumSigned(sectionA.lignes, "nm1")

  // B — Investissement
  // Approche V1 simplifiée : variation nette par classe 2x (hors 28x amort)
  // Si variation positive → acquisition (sortie de trésorerie) ; sinon cession.
  const dImmoIncorp     = soldeNet(soldesN, "21", "debit") - soldeNet(soldesNm1, "21", "debit")
  const dImmoTerrain    = soldeNet(soldesN, "22", "debit") - soldeNet(soldesNm1, "22", "debit")
  const dImmoBatiment   = soldeNet(soldesN, "23", "debit") - soldeNet(soldesNm1, "23", "debit")
  const dImmoMateriel   = soldeNet(soldesN, "24", "debit") - soldeNet(soldesNm1, "24", "debit")
  const dImmoAutres     = soldeNet(soldesN, "25", "debit") - soldeNet(soldesNm1, "25", "debit")
  const dImmoFinanciere = soldeNet(soldesN, "26", "debit") - soldeNet(soldesNm1, "26", "debit")
                        + soldeNet(soldesN, "27", "debit") - soldeNet(soldesNm1, "27", "debit")
  const dImmoTotale     = dImmoIncorp + dImmoTerrain + dImmoBatiment + dImmoMateriel + dImmoAutres + dImmoFinanciere

  const sectionB: TftSection = {
    code: "INVESTISSEMENT",
    libelle:"Flux de trésorerie provenant des investissements",
    lignes: [
      makeLigne("(−) Acquisitions / (+) cessions immobilisations incorporelles (21)", -1, dImmoIncorp,     0),
      makeLigne("(−) Acquisitions / (+) cessions terrains (22)",                       -1, dImmoTerrain,    0),
      makeLigne("(−) Acquisitions / (+) cessions bâtiments (23)",                      -1, dImmoBatiment,   0),
      makeLigne("(−) Acquisitions / (+) cessions matériel (24)",                       -1, dImmoMateriel,   0),
      makeLigne("(−) Variation autres immobilisations corporelles (25)",               -1, dImmoAutres,     0),
      makeLigne("(−) Variation immobilisations financières (26, 27)",                  -1, dImmoFinanciere, 0),
    ],
    total_n: -dImmoTotale, total_n_minus_1: 0,
  }

  // C — Financement
  const dCapital    = soldeNet(soldesN, "10",  "credit") - soldeNet(soldesNm1, "10",  "credit")
  const dEmprunts16 = soldeNet(soldesN, "16",  "credit") - soldeNet(soldesNm1, "16",  "credit")
  const dEmprunts17 = soldeNet(soldesN, "17",  "credit") - soldeNet(soldesNm1, "17",  "credit")
  // Distribution dividendes : approximé par diminution du report à nouveau (11) en cours d'exercice
  //                          (V1 — Phase 4.4 ajoutera un suivi explicite)
  const dReport     = soldeNet(soldesN, "11",  "credit") - soldeNet(soldesNm1, "11",  "credit")
  const dividendes  = dReport < 0 ? -dReport : 0

  const sectionC: TftSection = {
    code: "FINANCEMENT",
    libelle:"Flux de trésorerie provenant du financement",
    lignes: [
      makeLigne("(+) Augmentation de capital (10x)",                  +1, dCapital,    0),
      makeLigne("(+) Souscription d'emprunts (16x)",                  +1, dEmprunts16, 0),
      makeLigne("(+) Variation autres dettes financières (17x)",      +1, dEmprunts17, 0),
      makeLigne("(−) Dividendes versés (estimation via 11x)",         -1, dividendes,  0),
    ],
    total_n: 0, total_n_minus_1: 0,
  }
  sectionC.total_n         = sumSigned(sectionC.lignes, "n")
  sectionC.total_n_minus_1 = sumSigned(sectionC.lignes, "nm1")

  return [sectionA, sectionB, sectionC]
}

function makeLigne(libelle: string, signe: 1 | -1, montant_n: number, montant_n_minus_1: number): TftLigne {
  return { libelle, signe, montant_n: Math.round(montant_n), montant_n_minus_1: Math.round(montant_n_minus_1) }
}

function sumSigned(lignes: TftLigne[], col: "n" | "nm1"): number {
  let total = 0
  for (const l of lignes) {
    total += l.signe * (col === "n" ? l.montant_n : l.montant_n_minus_1)
  }
  return total
}


// ─── Fonction principale ────────────────────────────────────────────────────
export async function calculerTft(exerciceId: string): Promise<TftData> {
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("id, annee, libelle, date_debut, date_fin")
    .eq("id", exerciceId)
    .maybeSingle()
  if (exErr) throw exErr
  if (!ex) throw new Error("Exercice introuvable")

  const soldesN   = await chargerSoldes(exerciceId, ex.date_fin)
  // Charger soldes Nm1 (à la date de fin de l'exercice précédent, sinon vide)
  let soldesNm1: LigneAggregate[] = []
  let tresoDebutNm1 = 0
  {
    const { data: exPrev } = await supabaseAdmin
      .from("exercices")
      .select("id, date_debut, date_fin")
      .eq("annee", ex.annee - 1)
      .maybeSingle()
    if (exPrev) {
      soldesNm1   = await chargerSoldes(exPrev.id, exPrev.date_fin)
      // Trésorerie à l'ouverture de N-1
      const soldesNm2 = await loadSoldesNm2(ex.annee)
      tresoDebutNm1 = tresorerie(soldesNm2)
    }
  }

  const sections    = buildCascade(soldesN, soldesNm1)
  const variation_n = sections[0].total_n + sections[1].total_n + sections[2].total_n
  const variation_n_minus_1 = sections[0].total_n_minus_1 + sections[1].total_n_minus_1 + sections[2].total_n_minus_1

  const treso_debut_n = tresorerie(soldesNm1)   // soldes au "début N" ≈ soldes fin N-1
  const treso_fin_n   = tresorerie(soldesN)
  const treso_fin_n_minus_1 = treso_debut_n      // par définition

  const ecart_reconciliation = treso_debut_n + variation_n - treso_fin_n

  return {
    exercice_id:      ex.id,
    exercice_libelle: ex.libelle,
    date_arrete:      ex.date_fin,
    sections,
    variation_n,
    variation_n_minus_1,
    treso_debut_n,
    treso_fin_n,
    treso_debut_n_minus_1: tresoDebutNm1,
    treso_fin_n_minus_1,
    ecart_reconciliation,
  }
}

/** Soldes à la date de début de N (équivalent à la fin de N-1). */
async function loadSoldesNm2(anneeN: number): Promise<LigneAggregate[]> {
  const { data: exNm2 } = await supabaseAdmin
    .from("exercices")
    .select("id, date_fin")
    .eq("annee", anneeN - 2)
    .maybeSingle()
  if (!exNm2) return []
  return chargerSoldes((exNm2 as { id: string }).id, (exNm2 as { date_fin: string }).date_fin)
}
