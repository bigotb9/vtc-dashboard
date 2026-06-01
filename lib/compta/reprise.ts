/**
 * Helper de reprise des donnees existantes vers operations.
 *
 * Extrait du bootstrap (Day 6) pour reutilisation par :
 *   - `app/api/compta/bootstrap/route.ts`           (reprise complete one-shot)
 *   - `app/api/compta/reprise/recettes-wave/route.ts`  (incremental)
 *   - `app/api/compta/reprise/depenses/route.ts`       (incremental)
 *   - `app/api/compta/reprise/versements-clients/route.ts`
 *   - `app/api/compta/reprise/all/route.ts`            (agregation)
 *
 * Idempotence garantie par dedup manuelle (SELECT existants + filter + INSERT
 * simple). L'index UNIQUE operations(source, source_ref) est PARTIEL :
 *   WHERE source <> 'transfert_interne' AND source_ref IS NOT NULL
 * Supabase JS ne supporte pas `onConflict` sur un index partiel - l'upsert
 * echouait avec "no unique or exclusion constraint matching". Voir patch
 * sync legacy -> operations du 18/05/2026.
 *
 * Conventions schema (post-migrations Emmanuel) :
 *   - operations.vehicule_id, chauffeur_id, client_id  -> integer
 *   - operations.source_ref                            -> text
 *   - versement_attribution.id                         -> uuid
 *   - versement_attribution.id_vehicule                -> integer (PAS d'id_chauffeur)
 *   - depenses_vehicules.id_depense                    -> uuid (PK)
 *   - versements_clients.id                            -> integer (PK)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { getExerciceForDate } from "./soldes"
import { getModeActif, genererEcritureFromOperation, EcritureError } from "./ecritures"

// --- Constantes ---------------------------------------------------------------

/**
 * Mapping type_depense (depenses_vehicules) -> libelle de categorie cible.
 *
 * ATTENTION : les VALEURS de ce mapping sont des libelles de categories tels
 * qu'inserees par le bootstrap. Toute divergence (accent, espace, tiret cadratin)
 * cassera le lookup `categorieMap.get(libelleCategorie)` dans chargerFixtureIds.
 *
 * Les libelles ci-dessous reproduisent strictement le bootstrap :
 *   - "Décaissement carburant"           (e accent aigu)
 *   - "Entretien — vidange / petites rép." (TIRET CADRATIN U+2014 + e accent)
 *   - "Entretien — réparations majeures"   (TIRET CADRATIN U+2014 + e accent)
 *   - "Achat pièces détachées"           (e accent grave + e accent aigu)
 *   - "Assurance véhicule"               (e accent aigu)
 *   - "Autre dépense (à classer)"        (e accent aigu + a accent grave)
 */
export const MAPPING_TYPE_DEPENSE: Record<string, string> = {
  "Carburant":         "Décaissement carburant",
  "carburant":         "Décaissement carburant",
  "Entretien":         "Entretien — vidange / petites rép.",
  "entretien":         "Entretien — vidange / petites rép.",
  "Réparation":        "Entretien — réparations majeures",
  "Reparation":        "Entretien — réparations majeures",
  "reparation":        "Entretien — réparations majeures",
  "Pièces":            "Achat pièces détachées",
  "Pieces":            "Achat pièces détachées",
  "Assurance":         "Assurance véhicule",
  "Visite technique":  "Visite technique",
  "Stationnement":     "Carte stationnement / patente",
  "Patente":           "Carte stationnement / patente",
  "Autre":             "Autre dépense (à classer)",
  // Pièces détachées (extensions)
    "Pneus":                                  "Achat pièces détachées",
    "pneus":                                  "Achat pièces détachées",
    "Batterie":                               "Achat pièces détachées",
    "Bougies":                                "Achat pièces détachées",
    "Plaquette de frein":                     "Achat pièces détachées",
    "Frein":                                  "Achat pièces détachées",
    "Rotule":                                 "Achat pièces détachées",
    "2 silent bloc":                          "Achat pièces détachées",
    "silent bloc":                            "Achat pièces détachées",
    "Embout":                                 "Achat pièces détachées",
    "Biellette":                              "Achat pièces détachées",
    "Robots":                                 "Achat pièces détachées",
    "Radiateur":                              "Achat pièces détachées",
    "Ampoule de phare":                       "Achat pièces détachées",
    "Ventilateur":                            "Achat pièces détachées",
    "Climatiseur":                            "Achat pièces détachées",
    "Kit d'embrayage":                        "Achat pièces détachées",

    // Entretien (extensions)
    "Vidange":                                "Entretien — vidange / petites rép.",
    "vidange":                                "Entretien — vidange / petites rép.",
    "Entretient":                             "Entretien — vidange / petites rép.", // faute fréquente
    "entretien Climatiseur":                  "Entretien — vidange / petites rép.",

    // Réparations majeures (extensions)
    "Reparation Accident":                    "Entretien — réparations majeures",

    // Stationnement / Contraventions
    "Contraventions carte de stationnement":  "Carte stationnement / patente",

    // Nouvelles catégories
    "Anthropic":                              "Abonnements logiciels et SaaS",
    "Abonnement anthropic":                   "Abonnements logiciels et SaaS",
    "Restaurant":                             "Frais de mission et restauration",
}

const CHUNK_INSERT = 500
const CHUNK_FETCH  = 1000


// --- Types publics -----------------------------------------------------------

export interface ReprisOptions {
  /** Filtre date_operation >= (format YYYY-MM-DD). Optionnel. */
  date_from?:        string
  /** Filtre date_operation <= (format YYYY-MM-DD). Optionnel. */
  date_to?:          string
  /** Force la generation d'ecritures meme en mode Simple.
   *  Par defaut : si non fourni, la fonction lit `mode_actif` et deduit. */
  generer_ecritures?: boolean
}

export interface ReprisStats {
  /** Nombre de lignes lues cote source (avec montant > 0, filtre date applique). */
  candidats:           number
  /** Nombre de lignes deja presentes en operations (skippees par la dedup manuelle SELECT existants -> filter). */
  deja_existantes:     number
  /** Nombre de nouvelles operations effectivement creees. */
  creees:              number
  /** Nombre d'ecritures comptables generees sur les operations creees. */
  ecritures_generees:  number
  /** Nombre d'echecs lors de la generation d'ecritures. */
  ecritures_echouees:  number
  /** Avertissements non bloquants (exercices clotures, mappings inconnus, etc.). */
  warnings:            string[]
  /** Duree totale d'execution en millisecondes. */
  duree_ms:            number
}

export interface FixtureIds {
  /** ID de la caisse "Wave Boyah" (5311) - defaut pour recettes Wave + versements clients. */
  caisseWaveBoyahId:               string
  /** ID de la caisse "Caisse principale siege" (5711) - defaut pour depenses. */
  caissePrincipaleId:              string
  /** ID de la categorie "Versement quotidien chauffeur" (7061). */
  categorieVersementChauffeurId:   string
  /** ID de la categorie "Reversement client sous gestion" (4119). */
  categorieReversementClientId:    string
  /** ID de la categorie fallback "Autre depense (a classer)" (6589). */
  categorieAutreDepenseId:         string
  /** Map type_depense -> categorie_id (construite a partir de MAPPING_TYPE_DEPENSE). */
  mappingDepenseToCategorie:       Map<string, string>
}


// --- Helpers internes : affectations + fixture IDs ---------------------------

type AffectationRow = {
  id_chauffeur: number
  id_vehicule:  number
  date_debut:   string
  date_fin:     string | null
}

/**
 * Pre-charge toutes les affectations chauffeur<->vehicule en RAM et retourne une
 * fonction de lookup `(vehiculeId, jour) -> chauffeurId | null`.
 *
 * Regle d'overlap : en cas de plusieurs affectations actives a la meme date pour
 * le meme vehicule, on prend la plus recente par `date_debut` (DESC) - c'est la
 * derniere affectation enregistree qui prime.
 */
export async function chargerAffectations()
: Promise<(vehiculeId: number, jour: string) => number | null> {
  const all: AffectationRow[] = []
  let from = 0
  while (all.length < 100_000) {
    const { data, error } = await supabaseAdmin
      .from("affectation_chauffeurs_vehicules")
      .select("id_chauffeur, id_vehicule, date_debut, date_fin")
      .order("id_vehicule", { ascending: true })
      .order("date_debut",  { ascending: false })
      .range(from, from + CHUNK_FETCH - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as AffectationRow[]))
    if (data.length < CHUNK_FETCH) break
    from += CHUNK_FETCH
  }

  const byVehicule = new Map<number, AffectationRow[]>()
  for (const a of all) {
    const arr = byVehicule.get(a.id_vehicule)
    if (arr) arr.push(a)
    else     byVehicule.set(a.id_vehicule, [a])
  }

  return (vehiculeId: number, jour: string): number | null => {
    const candidates = byVehicule.get(vehiculeId)
    if (!candidates) return null
    for (const c of candidates) {
      if (c.date_debut <= jour && (c.date_fin === null || c.date_fin >= jour)) {
        return c.id_chauffeur
      }
    }
    return null
  }
}

/**
 * Charge les IDs des fixtures critiques (caisses + categories) creees par le
 * bootstrap. Leve une erreur explicite si une fixture manque (signe que le
 * bootstrap n'a pas ete execute ou que les libelles ont diverge).
 *
 * Les LIB_* ci-dessous DOIVENT correspondre exactement aux libelles inseres
 * par `app/api/compta/bootstrap/route.ts`. Toute divergence d'accent ou de
 * tiret cassera le matching.
 */
export async function chargerFixtureIds(): Promise<FixtureIds> {
  const LIB_CAISSE_WAVE          = "Wave Boyah"
  const LIB_CAISSE_PRINCIPALE    = "Caisse principale siège"
  const LIB_CAT_VERSEMENT        = "Versement quotidien chauffeur"
  const LIB_CAT_REVERSEMENT      = "Reversement client sous gestion"
  const LIB_CAT_AUTRE            = "Autre dépense (à classer)"

  const [caissesRes, categoriesRes] = await Promise.all([
    supabaseAdmin
      .from("caisses")
      .select("id, libelle")
      .in("libelle", [LIB_CAISSE_WAVE, LIB_CAISSE_PRINCIPALE]),
    supabaseAdmin
      .from("categories_operations")
      .select("id, libelle"),
  ])

  if (caissesRes.error)    throw caissesRes.error
  if (categoriesRes.error) throw categoriesRes.error

  const caisseMap    = new Map<string, string>((caissesRes.data    ?? []).map(c => [c.libelle, c.id]))
  const categorieMap = new Map<string, string>((categoriesRes.data ?? []).map(c => [c.libelle, c.id]))

  const caisseWaveBoyahId             = caisseMap.get(LIB_CAISSE_WAVE)
  const caissePrincipaleId            = caisseMap.get(LIB_CAISSE_PRINCIPALE)
  const categorieVersementChauffeurId = categorieMap.get(LIB_CAT_VERSEMENT)
  const categorieReversementClientId  = categorieMap.get(LIB_CAT_REVERSEMENT)
  const categorieAutreDepenseId       = categorieMap.get(LIB_CAT_AUTRE)

  const missing: string[] = []
  if (!caisseWaveBoyahId)             missing.push(`caisse '${LIB_CAISSE_WAVE}'`)
  if (!caissePrincipaleId)            missing.push(`caisse '${LIB_CAISSE_PRINCIPALE}'`)
  if (!categorieVersementChauffeurId) missing.push(`categorie '${LIB_CAT_VERSEMENT}'`)
  if (!categorieReversementClientId)  missing.push(`categorie '${LIB_CAT_REVERSEMENT}'`)
  if (!categorieAutreDepenseId)       missing.push(`categorie '${LIB_CAT_AUTRE}'`)
  if (missing.length > 0) {
    throw new Error(`Fixtures manquantes : ${missing.join(", ")} - bootstrap requis avant reprise`)
  }

  // Construction du mapping type_depense -> categorie_id a partir de MAPPING_TYPE_DEPENSE
  const mappingDepenseToCategorie = new Map<string, string>()
  for (const [typeDepense, libelleCategorie] of Object.entries(MAPPING_TYPE_DEPENSE)) {
    const catId = categorieMap.get(libelleCategorie)
    if (catId) mappingDepenseToCategorie.set(typeDepense, catId)
  }

  return {
    caisseWaveBoyahId:             caisseWaveBoyahId!,
    caissePrincipaleId:            caissePrincipaleId!,
    categorieVersementChauffeurId: categorieVersementChauffeurId!,
    categorieReversementClientId:  categorieReversementClientId!,
    categorieAutreDepenseId:       categorieAutreDepenseId!,
    mappingDepenseToCategorie,
  }
}


// --- Generation d'ecritures sur les operations nouvellement creees -----------

async function genererEcrituresSurNouvelles(opIds: string[])
: Promise<{ generees: number; echouees: number; erreurs: string[] }> {
  // Lot J (26/05/2026 audit) : batches de 10 avec Promise.allSettled au lieu
  // d'un for séquentiel. Depuis le Lot G, `genererEcritureFromOperation` est
  // un wrapper RPC sur le helper SQL `generer_ecriture_pour_operation` qui
  // est race-safe via pg_advisory_xact_lock par (journal, exercice). Les
  // appels concurrents sont donc surs pour la numerotation.
  //
  // Batch size = 10 : compromis entre throughput (5-10x plus rapide qu'en
  // sequentiel sur 1000 ops) et risque de saturation de la pool Supabase
  // (par defaut 15 connexions cote PostgREST en pooler).
  const BATCH_SIZE = 10
  const erreurs: string[] = []
  let generees = 0
  let echouees = 0

  for (let i = 0; i < opIds.length; i += BATCH_SIZE) {
    const batch   = opIds.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(id => genererEcritureFromOperation(id))
    )
    for (let k = 0; k < results.length; k++) {
      const r = results[k]
      if (r.status === "fulfilled") {
        generees++
      } else {
        echouees++
        const reason = r.reason
        const code   = reason instanceof EcritureError ? reason.code : "INTERNAL_ERROR"
        if (erreurs.length < 20) {
          erreurs.push(`Op ${batch[k]} [${code}] : ${(reason as Error)?.message ?? String(reason)}`)
        }
      }
    }
  }
  return { generees, echouees, erreurs }
}


// --- Helper : INSERT operations avec deduplication manuelle -----------------
// Remplace l'ancien pattern upsert(onConflict:'source,source_ref') qui ne
// fonctionnait pas avec l'index UNIQUE PARTIEL (cf. note d'en-tete de fichier).
//
// Pour chaque chunk :
//   1. SELECT les source_ref deja presents en BD pour le source donne
//   2. Filtrer le chunk pour exclure les doublons
//   3. INSERT simple sur le reste
//
// Garantit l'idempotence sans dependre de l'index unique partiel.
async function insertOpsAvecDedupManuel(
  rowsToInsert: Array<Record<string, unknown>>,
  source: string,
): Promise<{ ids: string[]; tentatives: number; warnings: string[] }> {
  const ids: string[] = []
  const warnings: string[] = []
  let tentatives = 0

  for (let i = 0; i < rowsToInsert.length; i += CHUNK_INSERT) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_INSERT)
    tentatives += chunk.length

    // 1. SELECT source_ref deja existants pour ce source
    const refsBatch = chunk
      .map(r => r.source_ref)
      .filter((s): s is string => typeof s === "string" && s.length > 0)

    let refsExistants = new Set<string>()
    if (refsBatch.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("operations")
        .select("source_ref")
        .eq("source", source)
        .in("source_ref", refsBatch)
      if (error) {
        warnings.push(`Chunk ${source} ${i}-${i + chunk.length} SELECT existants : ${error.message}`)
        continue
      }
      refsExistants = new Set(
        ((data ?? []) as Array<{ source_ref: string | null }>)
          .map(e => e.source_ref)
          .filter((s): s is string => typeof s === "string"),
      )
    }

    // 2. Filtrer le chunk pour exclure les existants
    const chunkNouveau = chunk.filter(r => {
      const ref = r.source_ref
      if (typeof ref !== "string" || ref.length === 0) return false   // skip lignes sans ref
      return !refsExistants.has(ref)
    })

    // 3. INSERT simple sans onConflict
    if (chunkNouveau.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("operations")
        .insert(chunkNouveau)
        .select("id")
      if (error) {
        warnings.push(`Chunk ${source} ${i}-${i + chunk.length} INSERT : ${error.message}`)
        continue
      }
      for (const r of data ?? []) ids.push((r as { id: string }).id)
    }
  }
  return { ids, tentatives, warnings }
}


// --- Reprise recettes Wave (Option X : 1 op = 1 ligne recettes_wave) --------
//
// Refactor 18/05/2026 : on ne passe plus par `versement_attribution`.
// Chaque ligne `recettes_wave` produit exactement 1 operation comptable.
//
// Mapping :
//   source_ref        = recettes_wave."Identifiant de transaction"  (TEXT, deja unique)
//   date_operation    = recettes_wave."Horodatage"::date
//   montant           = recettes_wave."Montant net"
//   libelle           = 'Recette Wave - ' || "Nom de contrepartie"
//   vehicule_id       = NULL  (l'analytique passe desormais par des outils dedies)
//   chauffeur_id      = NULL
//   caisse            = Wave Boyah (5311)
//   categorie         = "Versement quotidien chauffeur" (proxy V1)

type RecetteWaveRow = {
  "Identifiant de transaction": string | null
  "Horodatage":                 string | null
  "Montant net":                number | string | null
  "Nom de contrepartie":        string | null
}

export async function repriseRecettesWave(
  userId:  string,
  options: ReprisOptions = {},
): Promise<ReprisStats> {
  const t0 = Date.now()
  const warnings: string[] = []
  const exerciceCache = new Map<string, string>()

  let candidats          = 0
  let creees             = 0
  let tentatives         = 0
  let ecritures_generees = 0
  let ecritures_echouees = 0

  // 0. Fixtures
  let fix: FixtureIds
  try {
    fix = await chargerFixtureIds()
  } catch (e) {
    warnings.push(`Chargement fixtures impossible : ${(e as Error).message}`)
    return { candidats: 0, deja_existantes: 0, creees: 0, ecritures_generees: 0, ecritures_echouees: 0, warnings, duree_ms: Date.now() - t0 }
  }

  // 1. Lecture recettes_wave (paginee + filtres date_from/date_to sur Horodatage)
  //
  // FIX v3 #1 (18/05/2026) : utiliser select("*") plutot que d'enumerer les colonnes
  // avec guillemets echappes. Supabase JS ne fait pas de SQL quoting dans .select()
  // - les .select("\"Col\"") etaient interpretes litteralement et retournaient
  // undefined, ce qui skippait toutes les recettes avec le warning trompeur
  // "Ligne recettes_wave sans 'Identifiant de transaction', skippee".
  // Perf negligeable vu le volume par batch (~quelques dizaines de lignes).
  const rows: RecetteWaveRow[] = []
  let pageFrom = 0
  while (rows.length < 100_000) {
    let q = supabaseAdmin
      .from("recettes_wave")
      .select("*")
      .order("Horodatage", { ascending: true })
      .range(pageFrom, pageFrom + CHUNK_FETCH - 1)
    // Les filtres date_from/date_to s'appliquent sur la PARTIE DATE de Horodatage.
    // Horodatage est stocke en timestamp string - on borne sur le prefixe ISO.
    if (options.date_from) q = q.gte("Horodatage", options.date_from)
    if (options.date_to)   q = q.lte("Horodatage", options.date_to + "T23:59:59.999")

    const { data, error } = await q
    if (error) {
      warnings.push(`Lecture recettes_wave echouee : ${error.message}`)
      return { candidats, deja_existantes: 0, creees, ecritures_generees, ecritures_echouees, warnings, duree_ms: Date.now() - t0 }
    }
    if (!data || data.length === 0) break
    rows.push(...(data as RecetteWaveRow[]))
    if (data.length < CHUNK_FETCH) break
    pageFrom += CHUNK_FETCH
  }
  candidats = rows.length

  if (rows.length === 0) {
    return { candidats, deja_existantes: 0, creees: 0, ecritures_generees: 0, ecritures_echouees: 0, warnings, duree_ms: Date.now() - t0 }
  }

  // 2. Construction des operations
  const nowIso = new Date().toISOString()
  const rowsToInsert: Record<string, unknown>[] = []

  for (const r of rows) {
    const idTx     = (r["Identifiant de transaction"] ?? "").trim()
    const hod      = r["Horodatage"]
    const montant  = r["Montant net"]
    const contrep  = (r["Nom de contrepartie"] ?? "").trim()

    if (!idTx)                            { warnings.push("Ligne recettes_wave sans \"Identifiant de transaction\", skippee"); continue }
    if (!hod)                             { warnings.push(`Recette ${idTx} sans Horodatage, skippee`); continue }
    const montantNum = Number(montant)
    if (!Number.isFinite(montantNum) || montantNum <= 0) {
      warnings.push(`Recette ${idTx} avec montant invalide (${montant}), skippee`); continue
    }

    // Extraction de la date (YYYY-MM-DD) depuis Horodatage
    const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(String(hod).trim())
    if (!dateMatch) {
      warnings.push(`Recette ${idTx} avec Horodatage non parsable (${hod}), skippee`); continue
    }
    const dateOp = dateMatch[1]

    // Resolution exercice
    let exerciceId = exerciceCache.get(dateOp)
    if (!exerciceId) {
      try {
        const ex = await getExerciceForDate(dateOp)
        if (ex.cloture) {
          warnings.push(`Recette ${idTx} sur exercice cloture (${dateOp}), skippee`)
          continue
        }
        exerciceId = ex.id
        exerciceCache.set(dateOp, exerciceId)
      } catch {
        warnings.push(`Recette ${idTx} hors periode exercice ouvert (${dateOp}), skippee`)
        continue
      }
    }

    const libelleBase = `Recette Wave - ${contrep || "contrepartie inconnue"}`
    const libelle     = libelleBase.length > 255 ? libelleBase.slice(0, 255) : libelleBase

    rowsToInsert.push({
      caisse_id:         fix.caisseWaveBoyahId,
      compte_id:         null,
      date_operation:    dateOp,
      type:              "entree",
      montant:           montantNum,
      libelle,
      reference_externe: idTx,
      categorie_id:      fix.categorieVersementChauffeurId,
      vehicule_id:       null,             // Option X : plus de jointure analytique ici
      chauffeur_id:      null,
      client_id:         null,
      source:            "recette_wave",
      source_ref:        idTx,             // TEXT - unique par construction Wave
      statut:            "valide",
      valide_le:         nowIso,
      valide_par:        userId,
      exercice_id:       exerciceId,
      created_by:        userId,
      updated_by:        userId,
    })
  }

  // 3. INSERT avec dedup manuelle (pas d'upsert : index UNIQUE partiel)
  const inserted = await insertOpsAvecDedupManuel(rowsToInsert, "recette_wave")
  const nouveauxIds = inserted.ids
  tentatives += inserted.tentatives
  for (const w of inserted.warnings) warnings.push(w)
  creees = nouveauxIds.length

  // 4. Generation d'ecritures pour les nouvelles operations si mode/option l'exige
  const modeActif      = await getModeActif()
  const doGenerer      = options.generer_ecritures !== undefined
    ? options.generer_ecritures
    : modeActif === "avance"
  if (doGenerer && nouveauxIds.length > 0) {
    const r = await genererEcrituresSurNouvelles(nouveauxIds)
    ecritures_generees = r.generees
    ecritures_echouees = r.echouees
    for (const err of r.erreurs) warnings.push(err)
  }

  return {
    candidats,
    deja_existantes: Math.max(0, tentatives - creees),
    creees,
    ecritures_generees,
    ecritures_echouees,
    warnings,
    duree_ms: Date.now() - t0,
  }
}


// --- Reprise depenses vehicules ----------------------------------------------

type DepenseVehiculeRow = {
  id_depense:    string                  // UUID
  id_vehicule:   number | null           // integer
  date_depense:  string
  montant:       number
  type_depense:  string | null
  description?:  string | null
}

export async function repriseDepensesVehicules(
  userId:  string,
  options: ReprisOptions = {},
): Promise<ReprisStats> {
  const t0 = Date.now()
  const warnings: string[] = []
  const exerciceCache = new Map<string, string>()
  const typesDepenseInconnus = new Set<string>()

  let candidats          = 0
  let creees             = 0
  let tentatives         = 0
  let ecritures_generees = 0
  let ecritures_echouees = 0

  // 0. Fixtures
  let fix: FixtureIds
  try {
    fix = await chargerFixtureIds()
  } catch (e) {
    warnings.push(`Chargement fixtures impossible : ${(e as Error).message}`)
    return { candidats: 0, deja_existantes: 0, creees: 0, ecritures_generees: 0, ecritures_echouees: 0, warnings, duree_ms: Date.now() - t0 }
  }

  // 1. Lecture depenses_vehicules (paginee + filtres)
  const rows: DepenseVehiculeRow[] = []
  let pageFrom = 0
  while (rows.length < 100_000) {
    let q = supabaseAdmin
      .from("depenses_vehicules")
      .select("id_depense, id_vehicule, date_depense, montant, type_depense, description")
      .order("date_depense", { ascending: true })
      .range(pageFrom, pageFrom + CHUNK_FETCH - 1)
    if (options.date_from) q = q.gte("date_depense", options.date_from)
    if (options.date_to)   q = q.lte("date_depense", options.date_to)

    const { data, error } = await q
    if (error) {
      warnings.push(`Lecture depenses_vehicules echouee : ${error.message}`)
      return { candidats, deja_existantes: 0, creees, ecritures_generees, ecritures_echouees, warnings, duree_ms: Date.now() - t0 }
    }
    if (!data || data.length === 0) break
    rows.push(...(data as DepenseVehiculeRow[]))
    if (data.length < CHUNK_FETCH) break
    pageFrom += CHUNK_FETCH
  }
  candidats = rows.length

  if (rows.length === 0) {
    return { candidats, deja_existantes: 0, creees: 0, ecritures_generees: 0, ecritures_echouees: 0, warnings, duree_ms: Date.now() - t0 }
  }

  // FIX v3 #3 (18/05/2026) : Exclure les "Reversement client" du scan.
  // Les lignes depenses_vehicules de type "Reversement client" existent pour
  // raisons historiques, mais leur op comptable est deja creee par la
  // reprise versements_clients (source='versement_client'). Sans cette
  // exclusion, on cree des doublons depense_vehicule + versement_client
  // pour la meme realite metier.
  // L'API /api/depenses/create refuse deja ce type (fix L4 v2), mais la
  // reprise scanne toute la table - il faut filtrer ici aussi.
  //
  // FIX L5 (01/06/2026) : Exclure AUSSI type_depense='Manuel'. Ces lignes sont
  // par construction des MIROIRS descendus d'une operation source='manuel' via
  // le trigger sync_operation_to_legacy (lien id_depense = operation.id). Elles
  // ont DEJA leur operation. Les retraiter creerait une op source='depense_vehicule'
  // en DOUBLON : le dedup par source_ref ne la voit pas (l'op existante a
  // source='manuel', un source different), donc rien ne l'empeche.
  const rowsFiltered = rows.filter(r => {
    const t = String(r.type_depense ?? "").toLowerCase()
    if (t.includes("reversement")) {
      warnings.push(`Ligne depenses_vehicules ${r.id_depense} type "Reversement client" skippee (doublon avec versement_client)`)
      return false
    }
    if (t === "manuel") {
      warnings.push(`Ligne depenses_vehicules ${r.id_depense} type "Manuel" skippee (miroir d'une op source='manuel' deja existante)`)
      return false
    }
    return true
  })

  // 2. Construction (sur le tableau filtre, pas le brut)
  const nowIso = new Date().toISOString()
  const rowsToInsert: Record<string, unknown>[] = []

  for (const vd of rowsFiltered) {
    if (!vd.montant || Number(vd.montant) <= 0) continue

    const dateOp = vd.date_depense
    let exerciceId = exerciceCache.get(dateOp)
    if (!exerciceId) {
      try {
        const ex = await getExerciceForDate(dateOp)
        if (ex.cloture) {
          warnings.push(`Depense ${vd.id_depense} sur exercice cloture (${dateOp}), skippee`)
          continue
        }
        exerciceId = ex.id
        exerciceCache.set(dateOp, exerciceId)
      } catch {
        warnings.push(`Depense ${vd.id_depense} hors periode exercice ouvert (${dateOp}), skippee`)
        continue
      }
    }

    const typeDep = (vd.type_depense ?? "").trim()
    let categorieId = fix.mappingDepenseToCategorie.get(typeDep)
    if (!categorieId) {
      categorieId = fix.categorieAutreDepenseId
      if (typeDep) typesDepenseInconnus.add(typeDep)
    }

    const libelleBase = vd.description?.trim()
      ? `Depense ${typeDep || "vehicule"} - ${vd.description.trim()}`
      : `Depense ${typeDep || "vehicule"}`
    const libelle = libelleBase.length > 255 ? libelleBase.slice(0, 255) : libelleBase

    rowsToInsert.push({
      caisse_id:         fix.caissePrincipaleId,
      compte_id:         null,
      date_operation:    dateOp,
      type:              "sortie",
      montant:           Number(vd.montant),
      libelle,
      reference_externe: null,
      categorie_id:      categorieId,
      vehicule_id:       vd.id_vehicule,
      chauffeur_id:      null,
      client_id:         null,
      source:            "depense_vehicule",
      source_ref:        vd.id_depense,
      statut:            "valide",
      valide_le:         nowIso,
      valide_par:        userId,
      exercice_id:       exerciceId,
      created_by:        userId,
      updated_by:        userId,
    })
  }

  // 3. INSERT avec dedup manuelle (pas d'upsert : index UNIQUE partiel)
  const inserted = await insertOpsAvecDedupManuel(rowsToInsert, "depense_vehicule")
  const nouveauxIds = inserted.ids
  tentatives += inserted.tentatives
  for (const w of inserted.warnings) warnings.push(w)
  creees = nouveauxIds.length

  // 4. Avertir des types non mappes
  for (const t of typesDepenseInconnus) {
    warnings.push(`type_depense '${t}' non mappe, operations imputees a 'Autre depense (a classer)'`)
  }

  // 5. Generation ecritures
  const modeActif = await getModeActif()
  const doGenerer = options.generer_ecritures !== undefined
    ? options.generer_ecritures
    : modeActif === "avance"
  if (doGenerer && nouveauxIds.length > 0) {
    const r = await genererEcrituresSurNouvelles(nouveauxIds)
    ecritures_generees = r.generees
    ecritures_echouees = r.echouees
    for (const err of r.erreurs) warnings.push(err)
  }

  return {
    candidats,
    deja_existantes: Math.max(0, tentatives - creees),
    creees,
    ecritures_generees,
    ecritures_echouees,
    warnings,
    duree_ms: Date.now() - t0,
  }
}


// --- Reprise versements clients ----------------------------------------------

type VersementClientRow = {
  id:             number                  // integer (PK)
  id_client:      number | null
  date_versement: string
  montant:        number
  mois:           string | null
  notes:          string | null
}

export async function repriseVersementsClients(
  userId:  string,
  options: ReprisOptions = {},
): Promise<ReprisStats> {
  const t0 = Date.now()
  const warnings: string[] = []
  const exerciceCache = new Map<string, string>()

  let candidats          = 0
  let creees             = 0
  let tentatives         = 0
  let ecritures_generees = 0
  let ecritures_echouees = 0

  // 0. Fixtures
  let fix: FixtureIds
  try {
    fix = await chargerFixtureIds()
  } catch (e) {
    warnings.push(`Chargement fixtures impossible : ${(e as Error).message}`)
    return { candidats: 0, deja_existantes: 0, creees: 0, ecritures_generees: 0, ecritures_echouees: 0, warnings, duree_ms: Date.now() - t0 }
  }

  // 1. Lecture versements_clients (paginee + filtres)
  const rows: VersementClientRow[] = []
  let pageFrom = 0
  while (rows.length < 100_000) {
    let q = supabaseAdmin
      .from("versements_clients")
      .select("id, id_client, mois, montant, date_versement, notes")
      .order("date_versement", { ascending: true })
      .range(pageFrom, pageFrom + CHUNK_FETCH - 1)
    if (options.date_from) q = q.gte("date_versement", options.date_from)
    if (options.date_to)   q = q.lte("date_versement", options.date_to)

    const { data, error } = await q
    if (error) {
      warnings.push(`Lecture versements_clients echouee : ${error.message}`)
      return { candidats, deja_existantes: 0, creees, ecritures_generees, ecritures_echouees, warnings, duree_ms: Date.now() - t0 }
    }
    if (!data || data.length === 0) break
    rows.push(...(data as VersementClientRow[]))
    if (data.length < CHUNK_FETCH) break
    pageFrom += CHUNK_FETCH
  }
  candidats = rows.length

  if (rows.length === 0) {
    return { candidats, deja_existantes: 0, creees: 0, ecritures_generees: 0, ecritures_echouees: 0, warnings, duree_ms: Date.now() - t0 }
  }

  const nowIso = new Date().toISOString()
  const rowsToInsert: Record<string, unknown>[] = []

  for (const v of rows) {
    if (!v.montant || Number(v.montant) <= 0) continue

    const dateOp = v.date_versement
    let exerciceId = exerciceCache.get(dateOp)
    if (!exerciceId) {
      try {
        const ex = await getExerciceForDate(dateOp)
        if (ex.cloture) {
          warnings.push(`Versement client ${v.id} sur exercice cloture (${dateOp}), skippe`)
          continue
        }
        exerciceId = ex.id
        exerciceCache.set(dateOp, exerciceId)
      } catch {
        warnings.push(`Versement client ${v.id} hors periode exercice ouvert (${dateOp}), skippe`)
        continue
      }
    }

    const libelleBase = `Reversement client (mois ${v.mois ?? "?"})${v.notes ? " - " + v.notes : ""}`
    const libelle     = libelleBase.length > 255 ? libelleBase.slice(0, 255) : libelleBase

    rowsToInsert.push({
      caisse_id:         fix.caisseWaveBoyahId,
      compte_id:         null,
      date_operation:    dateOp,
      type:              "sortie",                  // Boyah verse au client, JAMAIS l'inverse
      montant:           Number(v.montant),
      libelle,
      reference_externe: null,
      categorie_id:      fix.categorieReversementClientId,
      vehicule_id:       null,
      chauffeur_id:      null,
      client_id:         v.id_client,
      source:            "versement_client",
      source_ref:        String(v.id),              // integer -> text
      statut:            "valide",
      valide_le:         nowIso,
      valide_par:        userId,
      exercice_id:       exerciceId,
      created_by:        userId,
      updated_by:        userId,
    })
  }

  // INSERT avec dedup manuelle (pas d'upsert : index UNIQUE partiel)
  const inserted = await insertOpsAvecDedupManuel(rowsToInsert, "versement_client")
  const nouveauxIds = inserted.ids
  tentatives += inserted.tentatives
  for (const w of inserted.warnings) warnings.push(w)
  creees = nouveauxIds.length

  const modeActif = await getModeActif()
  const doGenerer = options.generer_ecritures !== undefined
    ? options.generer_ecritures
    : modeActif === "avance"
  if (doGenerer && nouveauxIds.length > 0) {
    const r = await genererEcrituresSurNouvelles(nouveauxIds)
    ecritures_generees = r.generees
    ecritures_echouees = r.echouees
    for (const err of r.erreurs) warnings.push(err)
  }

  return {
    candidats,
    deja_existantes: Math.max(0, tentatives - creees),
    creees,
    ecritures_generees,
    ecritures_echouees,
    warnings,
    duree_ms: Date.now() - t0,
  }
}
