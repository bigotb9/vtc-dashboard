/**
 * Calcul du Bilan SYSCOHADA révisé (Phase 4.2 Module 3a §4).
 *
 * Lit `lignes_ecritures` JOIN ecritures_comptables JOIN operations,
 * filtré sur statut='valide' et exercice_id donné. Agrège par classe
 * SYSCOHADA puis par poste Bilan via la table `bilan_mapping`.
 *
 * Pour chaque ligne du Bilan : soldes Brut, Amort, Net N, Net N-1.
 *
 * Convention V1 (simplifiée) :
 *   - Brut = somme des débits côté Actif, crédits côté Passif
 *   - Amort = somme des classes 28 (amortissements) — déduite du Brut Actif
 *   - Net = Brut − Amort (Actif) ; pour Passif, Net = solde créditeur
 *   - N-1 : même calcul sur exercice précédent (recherché par annee = N - 1)
 *
 * NB : pour le détail SYSCOHADA strict, la Phase 4.3 raffinera avec les
 * notes annexes et flux de trésorerie.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { BilanData, BilanLigne, BilanSection } from "@/types/compta-ui"

const SECTION_ORDER: Record<string, number> = {
  ACTIF_IMMO: 1, ACTIF_CIRC: 2, TRESO_ACTIF: 3,
  CAP_PROPRES: 50, DETTES_FIN: 51, PASSIF_CIRC: 52, TRESO_PASSIF: 53,
}
const SECTION_LIBELLES: Record<string, string> = {
  ACTIF_IMMO:   "Actif immobilisé",
  ACTIF_CIRC:   "Actif circulant",
  TRESO_ACTIF:  "Trésorerie-Actif",
  CAP_PROPRES:  "Capitaux propres et ressources assimilées",
  DETTES_FIN:   "Dettes financières et ressources assimilées",
  PASSIF_CIRC:  "Passif circulant",
  TRESO_PASSIF: "Trésorerie-Passif",
}
const POSTE_LIBELLES: Record<string, string> = {
  AI_INCORP:           "Immobilisations incorporelles",
  AI_CORP_TERRAIN:     "Terrains",
  AI_CORP_BATIMENT:    "Bâtiments",
  AI_CORP_MATERIEL:    "Matériel et mobilier",
  AI_CORP_AUTRES:      "Autres immobilisations corporelles",
  AI_FINANCIER:        "Immobilisations financières",
  AC_STOCKS:           "Stocks et en-cours",
  AC_CLIENTS:          "Clients",
  AC_AUTRES:           "Autres créances",
  TA_BANQUE:           "Banques",
  TA_CAISSE:           "Caisses",
  CP_CAPITAL:          "Capital social",
  CP_RESERVES:         "Réserves",
  CP_REPORT_NOUVEAU:   "Report à nouveau",
  CP_RESULTAT:         "Résultat de l'exercice",
  DF_EMPRUNTS:         "Emprunts",
  DF_AUTRES:           "Autres dettes financières",
  PC_FOURNISSEURS:     "Fournisseurs",
  TP_DECOUVERTS:       "Banques découverts",
}

interface MappingRow {
  classe_compte: string
  poste_bilan:   string
  section:       string
  cote:          "actif" | "passif"
  ordre:         number
}

interface SoldeCompte {
  code:  string    // compte SYSCOHADA (ex "411", "40123")
  debit:  number
  credit: number
}

/** Charge tous les soldes d'un exercice (lignes_ecritures groupées par compte). */
async function loadSoldesExercice(exerciceId: string, dateMax: string): Promise<SoldeCompte[]> {
  // 1a. Écritures issues d'operations de l'exercice
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

  // 1b. ✦ PHASE 4.3 — Écritures auto-générées (sans operation_id) rattachées
  //     directement à l'exercice. Inclut l'auto-écriture résultat compte 13.
  const { data: ecrsAuto } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id")
    .eq("exercice_id", exerciceId)
    .eq("statut", "valide")
    .eq("auto_generated", true)
    .lte("date_ecriture", dateMax)
  const ecrAutoIds = ((ecrsAuto ?? []) as Array<{ id: string }>).map(e => e.id)
  ecrIds = [...ecrIds, ...ecrAutoIds]
  if (ecrIds.length === 0) return []

  // 2. Agréger par compte_syscohada_code (pagination)
  const acc = new Map<string, { debit: number; credit: number }>()
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
      const cur = acc.get(code) ?? { debit: 0, credit: 0 }
      cur.debit  += Number(l.debit)
      cur.credit += Number(l.credit)
      acc.set(code, cur)
    }
    if (batch.length < PAGE) break
    from += PAGE
  }

  return [...acc.entries()].map(([code, v]) => ({ code, debit: v.debit, credit: v.credit }))
}

/** Trouve le mapping le plus spécifique (préfixe le plus long) pour un code. */
function findMapping(code: string, mappings: MappingRow[]): MappingRow | null {
  let best: MappingRow | null = null
  let bestLen = 0
  for (const m of mappings) {
    if (code.startsWith(m.classe_compte) && m.classe_compte.length > bestLen) {
      best = m
      bestLen = m.classe_compte.length
    }
  }
  return best
}

interface AggBilan { brut: number; amort: number }

/** Agrège les soldes par poste Bilan. */
function aggregateByPoste(
  soldes: SoldeCompte[], mappings: MappingRow[],
): Map<string, { section: string; cote: "actif"|"passif"; ordre: number; brut: number; amort: number }> {
  const out = new Map<string, { section: string; cote: "actif"|"passif"; ordre: number; brut: number; amort: number }>()
  for (const s of soldes) {
    // Cas spécial : classe 28 (amortissements) → réduit le brut de la classe 2 correspondante
    if (s.code.startsWith("28")) {
      // L'amort se reporte sur la classe 2 correspondante (28X → 2X)
      const targetClass = "2" + s.code.slice(2, 3)
      const target = findMapping(targetClass, mappings) ?? findMapping("2", mappings)
      if (target) {
        const cur = out.get(target.poste_bilan) ?? { section: target.section, cote: target.cote, ordre: target.ordre, brut: 0, amort: 0 }
        cur.amort += (s.credit - s.debit)  // amortissement = solde créditeur
        out.set(target.poste_bilan, cur)
      }
      continue
    }

    const m = findMapping(s.code, mappings)
    if (!m) continue
    // Compte non amorti : on ne considère pas les classes de résultat (6/7) ici
    if (s.code.startsWith("6") || s.code.startsWith("7") || s.code.startsWith("8")) continue

    const cur = out.get(m.poste_bilan) ?? { section: m.section, cote: m.cote, ordre: m.ordre, brut: 0, amort: 0 }
    const net = m.cote === "actif"
      ? s.debit - s.credit
      : s.credit - s.debit
    cur.brut += net
    out.set(m.poste_bilan, cur)
  }
  return out
}

export async function calculerBilan(exerciceId: string): Promise<BilanData> {
  // 1. Charger l'exercice
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("id, annee, libelle, date_debut, date_fin")
    .eq("id", exerciceId)
    .maybeSingle()
  if (exErr) throw exErr
  if (!ex) throw new Error("Exercice introuvable")

  // 2. Charger mapping
  const { data: mp, error: mErr } = await supabaseAdmin
    .from("bilan_mapping")
    .select("classe_compte, poste_bilan, section, cote, ordre")
  if (mErr) throw mErr
  const mappings = (mp ?? []) as MappingRow[]

  // 3. Soldes N
  const soldesN = await loadSoldesExercice(exerciceId, ex.date_fin)
  const aggN = aggregateByPoste(soldesN, mappings)

  // 4. Soldes N-1 (si exercice précédent existe)
  let aggNm1: Map<string, AggBilan> = new Map()
  {
    const { data: exPrev } = await supabaseAdmin
      .from("exercices")
      .select("id, date_fin")
      .eq("annee", ex.annee - 1)
      .maybeSingle()
    if (exPrev) {
      const soldesNm1 = await loadSoldesExercice(exPrev.id, exPrev.date_fin)
      const tmp = aggregateByPoste(soldesNm1, mappings)
      aggNm1 = new Map([...tmp.entries()].map(([k, v]) => [k, { brut: v.brut, amort: v.amort }]))
    }
  }

  // 5. Construire sections
  const sectionsMap = new Map<string, BilanSection>()
  for (const [poste, vN] of aggN.entries()) {
    const sectCode = vN.section
    const cote = vN.cote
    const vPrev = aggNm1.get(poste) ?? { brut: 0, amort: 0 }
    const ligne: BilanLigne = {
      poste,
      libelle:       POSTE_LIBELLES[poste] ?? poste,
      brut_n:        vN.brut + vN.amort,    // brut = net + amort
      amort_n:       vN.amort,
      net_n:         vN.brut,
      net_n_minus_1: vPrev.brut,
    }
    const existing = sectionsMap.get(sectCode) ?? {
      code:    sectCode,
      libelle: SECTION_LIBELLES[sectCode] ?? sectCode,
      lignes:  [] as BilanLigne[],
      total_brut_n: 0, total_amort_n: 0, total_net_n: 0, total_net_n_minus_1: 0,
      _cote: cote,
    } as BilanSection & { _cote?: "actif"|"passif" }
    existing.lignes.push(ligne)
    existing.total_brut_n  += ligne.brut_n
    existing.total_amort_n += ligne.amort_n
    existing.total_net_n   += ligne.net_n
    existing.total_net_n_minus_1 += ligne.net_n_minus_1
    sectionsMap.set(sectCode, existing)
  }
  // Tri stable
  const all = [...sectionsMap.entries()].map(([k, v]) => ({ ...v, sectCode: k }))
  all.sort((a, b) => (SECTION_ORDER[a.code] ?? 99) - (SECTION_ORDER[b.code] ?? 99))
  for (const sec of all) sec.lignes.sort((a, b) => (POSTE_LIBELLES[a.poste] ?? a.poste).localeCompare(POSTE_LIBELLES[b.poste] ?? b.poste, "fr"))

  const isActif = (c: string) => c === "ACTIF_IMMO" || c === "ACTIF_CIRC" || c === "TRESO_ACTIF"
  const actifSections  = all.filter(s => isActif(s.code))
  const passifSections = all.filter(s => !isActif(s.code))

  // Totaux Actif / Passif
  const totals = (sec: BilanSection[]) => sec.reduce(
    (acc, s) => ({
      brut:  acc.brut  + s.total_brut_n,
      amort: acc.amort + s.total_amort_n,
      net:   acc.net   + s.total_net_n,
      netNm1:acc.netNm1+ s.total_net_n_minus_1,
    }),
    { brut: 0, amort: 0, net: 0, netNm1: 0 },
  )
  const ta = totals(actifSections)
  const tp = totals(passifSections)

  return {
    exercice_id:        ex.id,
    exercice_libelle:   ex.libelle,
    date_arrete:        ex.date_fin,
    actif_sections:     actifSections,
    passif_sections:    passifSections,
    total_actif_brut_n: ta.brut,
    total_actif_amort_n:ta.amort,
    total_actif_net_n:  ta.net,
    total_actif_net_n_minus_1: ta.netNm1,
    total_passif_net_n: tp.net,
    total_passif_net_n_minus_1: tp.netNm1,
    ecart_n:            ta.net - tp.net,
    ecart_n_minus_1:    ta.netNm1 - tp.netNm1,
  }
}
