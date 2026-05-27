/**
 * PHASE 4.3 — Module 2 : Calcul des notes annexes simplifiées.
 *
 * 6 notes SYSCOHADA — V1 simplifiée :
 *   - Note 1 : méthodes comptables (texte depuis societe_parametres)
 *   - Note 2 : état des immobilisations (extrait des écritures classes 2x)
 *   - Note 3 : dotations amortissements (28x cumulés + 68x dotation)
 *   - Note 4 : créances (411 / 41x) + dettes (401 / 40x)
 *   - Note 5 : variation des capitaux propres (10x, 11x, 13x)
 *   - Note 6 : engagements hors bilan (texte libre)
 *
 * Décisions d'archi (utilisateur 17/05/2026) :
 *   - Notes 2 & 3 extraites des écritures classes 2x/28x (hybride si pas
 *     de module Immobilisations dédié — Phase 4.4 future).
 *   - Notes 4 (créances/dettes) : tout en colonne "à -1 an" en V1.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type {
  NotesAnnexesData, NoteImmoRow, NoteAmortRow,
  NoteCreanceDetteRow, NoteCapitauxRow,
} from "@/types/compta-ui"

interface LigneAggregate {
  compte:  string
  debit:   number
  credit:  number
}

/** Catégories d'immobilisations attendues (2 premiers chars du compte). */
const IMMO_CATEGORIES: Array<{ code: string; libelle: string }> = [
  { code: "21", libelle: "Immobilisations incorporelles"   },
  { code: "22", libelle: "Terrains"                          },
  { code: "23", libelle: "Bâtiments et installations"        },
  { code: "24", libelle: "Matériel, mobilier et véhicules"   },
  { code: "25", libelle: "Avances sur immobilisations"       },
  { code: "26", libelle: "Titres de participation"           },
  { code: "27", libelle: "Autres immobilisations financières"},
]

const CAPITAUX_CATEGORIES: Array<{ root: string; libelle: string }> = [
  { root: "101", libelle: "Capital social"          },
  { root: "106", libelle: "Réserves"                },
  { root: "11",  libelle: "Report à nouveau"        },
  { root: "13",  libelle: "Résultat net de l'exercice" },
]

/** Charge les soldes agrégés d'un exercice (toute date jusqu'à dateMax). */
async function chargerSoldes(exerciceId: string, dateMax: string): Promise<LigneAggregate[]> {
  // 1a. Écritures issues d'opérations
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
      .from("ecritures_comptables")
      .select("id")
      .in("operation_id", opIds)
      .eq("statut", "valide")
    ecrIds = ((ecrs ?? []) as Array<{ id: string }>).map(e => e.id)
  }
  // 1b. Auto-générées (sans operation_id)
  const { data: ecrsAuto } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id")
    .eq("exercice_id", exerciceId)
    .eq("statut", "valide")
    .eq("auto_generated", true)
    .lte("date_ecriture", dateMax)
  ecrIds = [...ecrIds, ...((ecrsAuto ?? []) as Array<{ id: string }>).map(e => e.id)]
  if (ecrIds.length === 0) return []

  // 2. Agrégat par compte (pagination)
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

/** Charge les soldes d'un exercice N-1 (utilisé pour le "solde début" des notes). */
async function chargerSoldesNm1(annee: number): Promise<LigneAggregate[]> {
  const { data: ex } = await supabaseAdmin
    .from("exercices")
    .select("id, date_fin")
    .eq("annee", annee - 1)
    .maybeSingle()
  if (!ex) return []
  return chargerSoldes((ex as { id: string }).id, (ex as { date_fin: string }).date_fin)
}

function sumByPrefix(soldes: LigneAggregate[], prefix: string, mode: "debit_net" | "credit_net"): number {
  let total = 0
  for (const s of soldes) {
    if (!s.compte.startsWith(prefix)) continue
    total += mode === "debit_net" ? (s.debit - s.credit) : (s.credit - s.debit)
  }
  return Math.round(total)
}

/** Calcul des flux (acquisitions/cessions) d'une classe sur l'exercice — diff N − Nm1. */
function variationParCategorie(
  soldesN: LigneAggregate[], soldesNm1: LigneAggregate[],
  prefix: string, mode: "debit_net" | "credit_net",
): { debut: number; fin: number; variation: number } {
  const fin   = sumByPrefix(soldesN,   prefix, mode)
  const debut = sumByPrefix(soldesNm1, prefix, mode)
  return { debut, fin, variation: fin - debut }
}


// ─── Calcul principal ───────────────────────────────────────────────────────
export async function calculerNotesAnnexes(exerciceId: string): Promise<NotesAnnexesData> {
  // 1. Exercice + paramètres société
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("id, annee, libelle, date_fin")
    .eq("id", exerciceId)
    .maybeSingle()
  if (exErr) throw exErr
  if (!ex) throw new Error("Exercice introuvable")

  const { data: sp } = await supabaseAdmin
    .from("societe_parametres")
    .select("methodes_comptables, engagements_hors_bilan, methode_amortissement, methode_stocks")
    .limit(1)
    .maybeSingle()

  // 2. Soldes N + N−1
  const soldesN   = await chargerSoldes(exerciceId, ex.date_fin)
  const soldesNm1 = await chargerSoldesNm1(ex.annee)

  // 3. Note 2 — Immobilisations (par catégorie)
  const immobilisations: NoteImmoRow[] = []
  for (const cat of IMMO_CATEGORIES) {
    const v = variationParCategorie(soldesN, soldesNm1, cat.code, "debit_net")
    const amortCat = sumByPrefix(soldesN, "28" + cat.code.slice(1), "credit_net")
    if (v.fin === 0 && v.debut === 0 && amortCat === 0) continue
    // Acquisitions ≈ débits classe 2x sur N (approximation via variation positive)
    const acquisitions = v.variation > 0 ? v.variation : 0
    const cessions     = v.variation < 0 ? -v.variation : 0
    immobilisations.push({
      categorie_code:    cat.code,
      categorie_libelle: cat.libelle,
      solde_debut:       v.debut,
      acquisitions,
      cessions,
      solde_fin:         v.fin,
      amort_cumule:      amortCat,
      vnc:               v.fin - amortCat,
    })
  }

  // 4. Note 3 — Dotations amortissements (par catégorie 28x)
  const amortissements: NoteAmortRow[] = []
  for (const cat of IMMO_CATEGORIES) {
    const amortCode = "28" + cat.code.slice(1)        // ex "281" pour 21
    const valeur    = sumByPrefix(soldesN,   cat.code,  "debit_net")
    const cumulFin  = sumByPrefix(soldesN,   amortCode, "credit_net")
    const cumulDeb  = sumByPrefix(soldesNm1, amortCode, "credit_net")
    if (valeur === 0 && cumulFin === 0 && cumulDeb === 0) continue
    const dotation = cumulFin - cumulDeb
    amortissements.push({
      categorie_code:    cat.code,
      categorie_libelle: cat.libelle,
      valeur_origine:    valeur,
      amort_debut:       cumulDeb,
      dotation_exercice: dotation,
      amort_fin:         cumulFin,
      vnc:               valeur - cumulFin,
    })
  }

  // 5. Note 4 — Créances + Dettes (V1 : tout à -1 an)
  function buildCD(label: string, root: string, mode: "debit_net" | "credit_net"): NoteCreanceDetteRow {
    const montant = sumByPrefix(soldesN, root, mode)
    return {
      libelle:       label,
      compte_root:   root,
      montant_total: Math.abs(montant),
      moins_un_an:   Math.abs(montant),
      un_a_cinq_ans: 0,
      plus_cinq_ans: 0,
    }
  }
  const creances: NoteCreanceDetteRow[] = [
    buildCD("Clients (411)",                       "411", "debit_net"),
    buildCD("Personnel — Avances et acomptes (42)", "42",  "debit_net"),
    buildCD("État et collectivités (44)",           "44",  "debit_net"),
    buildCD("Autres créances (46/47/48)",           "46",  "debit_net"),
  ].filter(r => r.montant_total > 0)
  const dettes: NoteCreanceDetteRow[] = [
    buildCD("Fournisseurs (401)",                  "401", "credit_net"),
    buildCD("Dettes fiscales (44)",                 "44",  "credit_net"),
    buildCD("Dettes sociales (43)",                 "43",  "credit_net"),
    buildCD("Emprunts auprès des établissements (162)", "162", "credit_net"),
    buildCD("Autres emprunts (16/17/18)",           "16",  "credit_net"),
  ].filter(r => r.montant_total > 0)

  // 6. Note 5 — Variation capitaux propres
  const capitaux_propres: NoteCapitauxRow[] = []
  for (const cat of CAPITAUX_CATEGORIES) {
    const v = variationParCategorie(soldesN, soldesNm1, cat.root, "credit_net")
    if (v.fin === 0 && v.debut === 0) continue
    capitaux_propres.push({
      libelle:     cat.libelle,
      compte_root: cat.root,
      solde_debut: v.debut,
      variation:   v.variation,
      solde_fin:   v.fin,
    })
  }

  return {
    exercice_id:        ex.id,
    exercice_libelle:   ex.libelle,
    date_arrete:        ex.date_fin,
    methodes_comptables:
      (sp?.methodes_comptables as string | undefined) ??
      "Référentiel : SYSCOHADA révisé. Devise : Franc CFA (XOF). Amortissement linéaire par défaut. Stocks valorisés en FIFO.",
    engagements_hors_bilan:
      (sp?.engagements_hors_bilan as string | undefined) ??
      "Aucun engagement hors bilan déclaré pour l'exercice.",
    immobilisations,
    amortissements,
    creances,
    dettes,
    capitaux_propres,
    methode_amortissement: ((sp?.methode_amortissement as string | undefined) ?? "lineaire") as "lineaire" | "degressif",
    methode_stocks:        ((sp?.methode_stocks        as string | undefined) ?? "fifo")     as "fifo" | "cmp" | "lifo",
  }
}
