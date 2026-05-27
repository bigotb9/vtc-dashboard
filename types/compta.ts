/**
 * Types partagés du module Comptes & Caisses.
 *
 * Reflète strictement la migration 20260510120000_compta_module.sql.
 * Référence métier : doc instructions_cowork_compta — Phase 1 (Fondations).
 *
 * Conventions :
 * - UUID            → string
 * - DATE            → string  (YYYY-MM-DD)
 * - TIMESTAMPTZ     → string  (ISO 8601)
 * - NUMERIC(18,2)   → number  (FCFA, jamais de float libre)
 * - JSONB           → Record<string, unknown>
 *
 * Pour chaque table on expose :
 *   - <Nom>Row    : la forme retournée par SELECT (toutes colonnes)
 *   - <Nom>Insert : la forme acceptée par INSERT (colonnes à défaut optionnelles)
 *   - <Nom>Update : Partial<Insert>
 */

// ─── Unions de littéraux (CHECK constraints) ─────────────────────────────────

export type ModeCompta = "simple" | "avance"

export type StatutOperation = "brouillon" | "valide" | "annule"
export type StatutEcriture  = "brouillon" | "valide" | "annule"

export type TypeOperation = "entree" | "sortie"

export type SourceOperation =
  | "manuel"
  | "recette_wave"
  | "depense_vehicule"
  | "versement_client"
  | "import_csv"
  | "transfert_interne"
  | "dotation_amort"

export type TypeCategorie =
  | "recette"
  | "depense"
  | "apport"
  | "reversement"
  | "avance"
  | "investissement"
  | "remboursement"
  | "dotation"
  | "transfert"
  | "autre"

export type SensComptable = "debit" | "credit"

export type TypeJournal = "banque" | "caisse" | "achats" | "ventes" | "paie" | "od"
export type CodeJournal = "BQ" | "CA" | "AC" | "VE" | "PA" | "OD"

export type TypeCaisse = "cash" | "mobile_money"

export type DeviseCompta = "XOF"   // v1 : XOF uniquement

export type ClasseSyscohada = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type TypeCompteSyscohada =
  | "capitaux_propres"
  | "dettes_financieres"
  | "immobilisation"
  | "amortissement"
  | "immobilisation_fin"
  | "tiers_actif"
  | "tiers_passif"
  | "tiers"
  | "tresorerie"
  | "charge_exploitation"
  | "charge_personnel"
  | "charge_financiere"
  | "dotation"
  | "produit_exploitation"
  | "produit_financier"
  | "reprise"

export type TypeCloture = "mensuelle" | "annuelle"


// ─── 1. parametres_module_compta ─────────────────────────────────────────────

export interface ParametresModuleComptaRow {
  id:                          1
  mode_actif:                  ModeCompta
  premier_login_effectue:      boolean
  workflow_validation_actif:   boolean
  exercice_courant_id:         string | null
  date_demarrage_module:       string
  updated_at:                  string | null
  updated_by:                  string | null
}
export type ParametresModuleComptaUpdate = Partial<Omit<ParametresModuleComptaRow, "id">>


// ─── 2. exercices ────────────────────────────────────────────────────────────

export interface ExerciceRow {
  id:           string
  libelle:      string
  date_debut:   string
  date_fin:     string
  cloture:      boolean
  cloture_le:   string | null
  cloture_par:  string | null
  created_at:   string | null
}
export interface ExerciceInsert {
  id?:           string
  libelle:       string
  date_debut:    string
  date_fin:      string
  cloture?:      boolean
  cloture_le?:   string | null
  cloture_par?:  string | null
  created_at?:   string | null
}
export type ExerciceUpdate = Partial<ExerciceInsert>


// ─── 3. journaux ─────────────────────────────────────────────────────────────

export interface JournalRow {
  id:        string
  code:      CodeJournal | string   // string en cas d'extension future
  libelle:   string
  type:      TypeJournal
  actif:     boolean
  ordre:     number
}
export type JournalInsert = Omit<JournalRow, "id" | "actif" | "ordre"> & {
  id?: string
  actif?: boolean
  ordre?: number
}
export type JournalUpdate = Partial<JournalInsert>


// ─── 4. comptes_syscohada ────────────────────────────────────────────────────

export interface CompteSyscohadaRow {
  code:         string
  libelle:      string
  classe:       ClasseSyscohada
  type:         TypeCompteSyscohada
  parent_code:  string | null
  ordre:        number
  actif:        boolean
  created_at:   string | null
}
export interface CompteSyscohadaInsert {
  code:         string
  libelle:      string
  classe:       ClasseSyscohada
  type:         TypeCompteSyscohada
  parent_code?: string | null
  ordre?:       number
  actif?:       boolean
  created_at?:  string | null
}
export type CompteSyscohadaUpdate = Partial<Omit<CompteSyscohadaInsert, "code">>


// ─── 5. comptes (bancaires) ──────────────────────────────────────────────────

export interface CompteRow {
  id:                       string
  libelle:                  string
  banque:                   string | null
  numero_compte:            string | null
  devise:                   DeviseCompta
  solde_initial:            number
  date_solde_initial:       string
  compte_syscohada_code:    string | null
  actif:                    boolean
  created_at:               string | null
  created_by:               string | null
  archive_le:               string | null
  archive_par:              string | null
}
export interface CompteInsert {
  id?:                      string
  libelle:                  string
  banque?:                  string | null
  numero_compte?:           string | null
  devise?:                  DeviseCompta
  solde_initial?:           number
  date_solde_initial?:      string
  compte_syscohada_code?:   string | null
  actif?:                   boolean
  created_at?:              string | null
  created_by?:              string | null
  archive_le?:              string | null
  archive_par?:             string | null
}
export type CompteUpdate = Partial<CompteInsert>


// ─── 6. caisses ──────────────────────────────────────────────────────────────

export interface CaisseRow {
  id:                       string
  libelle:                  string
  type:                     TypeCaisse
  operateur:                string | null
  numero:                   string | null
  solde_initial:            number
  date_solde_initial:       string
  plafond:                  number | null
  compte_syscohada_code:    string | null
  responsable_id:           string | null
  actif:                    boolean
  created_at:               string | null
  created_by:               string | null
  archive_le:               string | null
  archive_par:              string | null
}
export interface CaisseInsert {
  id?:                      string
  libelle:                  string
  type:                     TypeCaisse
  operateur?:               string | null
  numero?:                  string | null
  solde_initial?:           number
  date_solde_initial?:      string
  plafond?:                 number | null
  compte_syscohada_code?:   string | null
  responsable_id?:          string | null
  actif?:                   boolean
  created_at?:              string | null
  created_by?:              string | null
  archive_le?:              string | null
  archive_par?:             string | null
}
export type CaisseUpdate = Partial<CaisseInsert>


// ─── 7. categories_operations ────────────────────────────────────────────────

export interface CategorieOperationRow {
  id:                      string
  libelle:                 string
  type:                    TypeCategorie
  compte_syscohada_code:   string | null
  sens:                    SensComptable | null
  journal_par_defaut:      string | null
  actif:                   boolean
  ordre:                   number
  created_at:              string | null
}
export interface CategorieOperationInsert {
  id?:                     string
  libelle:                 string
  type:                    TypeCategorie
  compte_syscohada_code?:  string | null
  sens?:                   SensComptable | null
  journal_par_defaut?:     string | null
  actif?:                  boolean
  ordre?:                  number
  created_at?:             string | null
}
export type CategorieOperationUpdate = Partial<CategorieOperationInsert>


// ─── 8. operations ───────────────────────────────────────────────────────────

export interface OperationRow {
  id:                  string
  // Localisation argent : XOR
  compte_id:           string | null
  caisse_id:           string | null
  // Métier
  date_operation:      string
  type:                TypeOperation
  montant:             number
  libelle:             string
  reference_externe:   string | null
  // Catégorisation
  categorie_id:        string | null
  // Liens flotte (UUID, pas de FK)
  vehicule_id:         string | null
  chauffeur_id:        string | null
  client_id:           string | null
  // Source pour reprise auto
  source:              SourceOperation
  source_ref:          string | null
  // Workflow
  statut:              StatutOperation
  valide_le:           string | null
  valide_par:          string | null
  // Lien comptable (mode Avancé)
  ecriture_id:         string | null
  exercice_id:         string
  // Audit
  created_at:          string | null
  created_by:          string | null
  updated_at:          string | null
  updated_by:          string | null
  notes:               string | null
}

// Insert : on impose la contrainte XOR via un type discriminé
type OperationInsertCompte = {
  compte_id:  string
  caisse_id?: never
}
type OperationInsertCaisse = {
  compte_id?: never
  caisse_id:  string
}
type OperationInsertBase = {
  id?:                  string
  date_operation:       string
  type:                 TypeOperation
  montant:              number
  libelle:              string
  reference_externe?:   string | null
  categorie_id?:        string | null
  vehicule_id?:         string | null
  chauffeur_id?:        string | null
  client_id?:           string | null
  source?:              SourceOperation
  source_ref?:          string | null
  statut?:              StatutOperation
  valide_le?:           string | null
  valide_par?:          string | null
  ecriture_id?:         string | null
  exercice_id:          string
  created_at?:          string | null
  created_by?:          string | null
  updated_at?:          string | null
  updated_by?:          string | null
  notes?:               string | null
}
export type OperationInsert =
  | (OperationInsertBase & OperationInsertCompte)
  | (OperationInsertBase & OperationInsertCaisse)

export type OperationUpdate = Partial<OperationInsertBase & {
  compte_id: string | null
  caisse_id: string | null
}>


// ─── 9. transferts_internes ──────────────────────────────────────────────────

export interface TransfertInterneRow {
  id:                   string
  date_transfert:       string
  montant:              number
  libelle:              string
  // Source XOR
  source_compte_id:     string | null
  source_caisse_id:     string | null
  // Destination XOR
  dest_compte_id:       string | null
  dest_caisse_id:       string | null
  // Liens créés
  operation_sortie_id:  string | null
  operation_entree_id:  string | null
  ecriture_id:          string | null
  exercice_id:          string
  statut:               StatutOperation
  created_at:           string | null
  created_by:           string | null
}

type TransfertInterneInsertBase = {
  id?:                  string
  date_transfert:       string
  montant:              number
  libelle:              string
  operation_sortie_id?: string | null
  operation_entree_id?: string | null
  ecriture_id?:         string | null
  exercice_id:          string
  statut?:              StatutOperation
  created_at?:          string | null
  created_by?:          string | null
}
type TransfertSourceCompte = { source_compte_id: string; source_caisse_id?: never }
type TransfertSourceCaisse = { source_compte_id?: never; source_caisse_id: string }
type TransfertDestCompte   = { dest_compte_id: string;   dest_caisse_id?: never }
type TransfertDestCaisse   = { dest_compte_id?: never;   dest_caisse_id: string }

export type TransfertInterneInsert =
  & TransfertInterneInsertBase
  & (TransfertSourceCompte | TransfertSourceCaisse)
  & (TransfertDestCompte   | TransfertDestCaisse)

export type TransfertInterneUpdate = Partial<TransfertInterneInsertBase & {
  source_compte_id: string | null
  source_caisse_id: string | null
  dest_compte_id:   string | null
  dest_caisse_id:   string | null
}>


// ─── 10. pieces_justificatives ───────────────────────────────────────────────

export interface PieceJustificativeRow {
  id:             string
  operation_id:   string | null
  transfert_id:   string | null
  url:            string
  nom_fichier:    string
  type_mime:      string | null
  taille_octets:  number | null
  created_at:     string | null
  created_by:     string | null
}
type PieceInsertBase = {
  id?:            string
  url:            string
  nom_fichier:    string
  type_mime?:     string | null
  taille_octets?: number | null
  created_at?:    string | null
  created_by?:    string | null
}
export type PieceJustificativeInsert =
  | (PieceInsertBase & { operation_id: string; transfert_id?: never })
  | (PieceInsertBase & { operation_id?: never; transfert_id: string })


// ─── 11. ecritures_comptables ────────────────────────────────────────────────

export interface EcritureComptableRow {
  id:               string
  numero:           string
  date_ecriture:    string
  journal_code:     string
  libelle:          string
  exercice_id:      string
  operation_id:     string | null
  transfert_id:     string | null
  source_manuelle:  boolean
  statut:           StatutEcriture
  cloture:          boolean
  /** Si non null, cette écriture est l'extourne de l'écriture identifiée
   *  (FK auto-référente, ajoutée par la migration `20260511130000_compta_extourne_link.sql`).
   *  UNIQUE : une écriture d'origine ne peut être extournée qu'une seule fois. */
  extourne_de:      string | null
  created_at:       string | null
  created_by:       string | null
  valide_le:        string | null
  valide_par:       string | null
}
export interface EcritureComptableInsert {
  id?:              string
  numero:           string
  date_ecriture:    string
  journal_code:     string
  libelle:          string
  exercice_id:      string
  operation_id?:    string | null
  transfert_id?:    string | null
  source_manuelle?: boolean
  statut?:          StatutEcriture
  cloture?:         boolean
  created_at?:      string | null
  created_by?:      string | null
  valide_le?:       string | null
  valide_par?:      string | null
}
export type EcritureComptableUpdate = Partial<EcritureComptableInsert>


// ─── 12. lignes_ecritures ────────────────────────────────────────────────────

export interface LigneEcritureRow {
  id:                     string
  ecriture_id:            string
  ordre:                  number
  compte_syscohada_code:  string
  libelle:                string | null
  debit:                  number
  credit:                 number
  lettrage:               string | null
  lettrage_le:            string | null
  vehicule_id:            string | null
  chauffeur_id:           string | null
  client_id:              string | null
  apporteur_code:         string | null
  created_at:             string | null
}

// Contrainte CHECK : (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
type LigneEcritureDebit  = { debit:  number; credit?: 0 }
type LigneEcritureCredit = { debit?: 0;      credit:  number }

type LigneEcritureInsertBase = {
  id?:                    string
  ecriture_id:            string
  ordre:                  number
  compte_syscohada_code:  string
  libelle?:               string | null
  lettrage?:              string | null
  lettrage_le?:           string | null
  vehicule_id?:           string | null
  chauffeur_id?:          string | null
  client_id?:             string | null
  apporteur_code?:        string | null
  created_at?:            string | null
}
export type LigneEcritureInsert =
  | (LigneEcritureInsertBase & LigneEcritureDebit)
  | (LigneEcritureInsertBase & LigneEcritureCredit)

export type LigneEcritureUpdate = Partial<LigneEcritureInsertBase & { debit: number; credit: number }>


// ─── 13. clotures ────────────────────────────────────────────────────────────

export interface ClotureRow {
  id:           string
  exercice_id:  string
  type:         TypeCloture
  periode:      string
  cloture_le:   string
  cloture_par:  string
  totaux:       Record<string, unknown>
  notes:        string | null
}
export interface ClotureInsert {
  id?:          string
  exercice_id:  string
  type:         TypeCloture
  periode:      string
  cloture_le?:  string
  cloture_par:  string
  totaux:       Record<string, unknown>
  notes?:       string | null
}


// ─── Vues / agrégats utilitaires (à enrichir au fur et à mesure) ─────────────

/** Solde courant d'un compte ou d'une caisse — calculé côté API en Phase 2. */
export interface SoldeCompte {
  compte_id?:      string
  caisse_id?:      string
  libelle:         string
  devise:          DeviseCompta
  solde_initial:   number
  total_entrees:   number
  total_sorties:   number
  solde_courant:   number
  derniere_op:     string | null
}

/** Ligne du grand livre (mode Avancé) — utilisée par les rapports SYSCOHADA. */
export interface LigneGrandLivre {
  date_ecriture:   string
  numero_ecriture: string
  journal_code:    string
  libelle:         string
  debit:           number
  credit:          number
  solde_progressif: number
  lettrage:        string | null
}


// ─── Type fourre-tout : map nom_table → Row (utile dans les helpers) ─────────

export interface ComptaSchema {
  parametres_module_compta: ParametresModuleComptaRow
  exercices:                ExerciceRow
  journaux:                 JournalRow
  comptes_syscohada:        CompteSyscohadaRow
  comptes:                  CompteRow
  caisses:                  CaisseRow
  categories_operations:    CategorieOperationRow
  operations:               OperationRow
  transferts_internes:      TransfertInterneRow
  pieces_justificatives:    PieceJustificativeRow
  ecritures_comptables:     EcritureComptableRow
  lignes_ecritures:         LigneEcritureRow
  clotures:                 ClotureRow
}

export type ComptaTableName = keyof ComptaSchema
