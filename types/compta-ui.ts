/**
 * Types UI partagés du module Comptabilité (Phase 3).
 * Reflète le shape JSON renvoyé par `/api/compta/operations` et
 * `/api/compta/operations/stats`.
 */

import type { TypeOperation, StatutOperation, SourceOperation, TypeCaisse } from "./compta"

export type { TypeOperation, StatutOperation, SourceOperation, TypeCaisse }

// ─── Sub-types relationnels renvoyés par le SELECT enrichi ───────────────────

export interface CompteRef {
  id:       string
  libelle:  string
  code:     string | null
}

export interface CaisseRef {
  id:       string
  libelle:  string
  type:     TypeCaisse
  code:     string | null
}

export interface CategorieRef {
  id:       string
  libelle:  string
  type:     string                  // recette|depense|...
}

export interface EcritureRef {
  numero:        string
  journal_code:  string
}

export interface VehiculeRef {
  id:               number
  immatriculation:  string | null
}

export interface ChauffeurRef {
  id:    number
  nom:   string | null
}


// ─── Operation enrichie (réponse de GET /api/compta/operations) ──────────────

export interface OperationView {
  id:                  string
  date_operation:      string
  type:                TypeOperation
  montant:             number
  libelle:             string
  reference_externe:   string | null

  compte_id:           string | null
  caisse_id:           string | null
  categorie_id:        string

  vehicule_id:         number | null
  chauffeur_id:        number | null
  client_id:           number | null

  source:              SourceOperation
  source_ref:          string | null
  statut:              StatutOperation
  valide_le:           string | null
  valide_par:          string | null
  ecriture_id:         string | null
  exercice_id:         string

  created_at:          string | null
  created_by:          string | null
  updated_at:          string | null
  updated_by:          string | null
  notes:               string | null

  // Relations enrichies (peuvent être null si l'id source est null)
  compte:    CompteRef    | null
  caisse:    CaisseRef    | null
  categorie: CategorieRef | null
  ecriture:  EcritureRef  | null
  vehicule:  VehiculeRef  | null
  chauffeur: ChauffeurRef | null
  /** Phase 4.x Vague 2 correctif §2.2 — tiers lié (null si rien). */
  tiers_id?: string | null
  tiers?:    { id: string; nom: string; type: TiersType; compte_syscohada_code: string; actif: boolean } | null
  /** Phase 4.x Vague 3 — nombre de justificatifs actifs (rendu liste). */
  justificatifs_count?: number
}


// ─── Filtres UI (Écran 1) ────────────────────────────────────────────────────

export interface OperationsFilters {
  type?:         TypeOperation
  source?:       SourceOperation
  statuts?:      StatutOperation[]      // multi
  categorie_id?: string
  caisse_id?:    string
  compte_id?:    string
  vehicule_id?:  number
  chauffeur_id?: number
  client_id?:    number
  /** Phase 4.x Vague 2 correctif §2.2 — filtre multi-tiers. */
  tiers_ids?:    string[]
  /** Phase 4.x Vague 3 — filtre Health "sortie vers tiers sans justificatif". */
  missing_proof?: boolean
  date_from?:    string
  date_to?:      string
  search?:       string

  sort_by?:      "date_operation" | "montant" | "libelle" | "created_at"
  sort_order?:   "asc" | "desc"
  page?:         number
  page_size?:    number
}


// ─── Réponse paginée ─────────────────────────────────────────────────────────

export interface OperationsPaginated {
  data:       OperationView[]
  total:      number
  page:       number
  page_size:  number
}


// ─── Stats (KPIs) — réponse de GET /api/compta/operations/stats ──────────────

export interface OperationsStats {
  total:            number
  entrees_count:    number
  entrees_montant:  number
  sorties_count:    number
  sorties_montant:  number
  solde_net:        number
  evolutions: {
    operations_vs_mois_prec: number | null
    entrees_vs_mois_prec:    number | null
    sorties_vs_mois_prec:    number | null
    solde_vs_mois_prec:      number | null
  }
  periode_precedente: { date_from: string; date_to: string } | null
}


// ─── Écran 2 : détail enrichi d'une opération ────────────────────────────────

export interface ExerciceRef { id: string; libelle: string }

export interface OperationDetail {
  id:                  string
  date_operation:      string
  type:                TypeOperation
  montant:             number
  libelle:             string
  reference_externe:   string | null

  compte:              CompteRef    | null
  caisse:              CaisseRef    | null
  categorie:           CategorieRef | null
  exercice:            ExerciceRef  | null
  vehicule:            VehiculeRef  | null
  chauffeur:           ChauffeurRef | null
  client:              { id: number; nom: string | null } | null
  /** Phase 4.x Vague 2 — tiers lié (null si rien rattaché). */
  tiers:               TiersRef     | null

  source:              SourceOperation
  source_label:        string
  source_ref:          string | null
  statut:              StatutOperation

  ecriture_id:         string | null
  notes:               string | null

  created_at:          string | null
  created_by:          string | null
  created_by_name:     string | null
  valide_le:           string | null
  valide_par:          string | null
  valide_par_name:     string | null
  updated_at:          string | null
}

export interface LigneEcritureView {
  id:                       string
  ordre:                    number
  compte_syscohada_code:    string
  compte_syscohada_libelle: string | null
  libelle_ligne:            string | null
  debit:                    number
  credit:                   number
}

export interface EcritureView {
  id:               string
  numero:           string
  journal_code:     string
  journal_libelle:  string
  date_ecriture:    string
  libelle:          string
  statut:           string
  cloture:          boolean
  created_at:       string | null
  valide_le:        string | null
  lignes:           LigneEcritureView[]
  total_debit:      number
  total_credit:     number
  is_equilibree:    boolean
}

export interface ExtourneRef {
  id:            string
  numero:        string
  date_ecriture: string
  created_at:    string | null
}

export interface HistoryItem {
  timestamp: string
  type:      "creation" | "validation" | "ecriture_generated" | "annulation" | "extourne_generated" | string
  title:     string
  detail:    string
  variant:   "success" | "warning" | "danger" | "default"
}

export interface OperationDetailResponse {
  operation:         OperationDetail
  ecriture:          EcritureView | null
  extourne:          ExtourneRef  | null
  /** Phase 4.x Vague 1 — si source='transfert_interne', lien vers l'op jumelle. */
  transfert_jumelle: TransfertJumelleLink | null
  historique:        HistoryItem[]
}


// ─── Code d'identification fournisseur de paiement ───────────────────────────

/** Codes connus pour les caisses (mapping logos). */
export type CaisseCode =
  | "wave"
  | "orange_money"
  | "mtn_momo"
  | "caisse_principale"
  | "petite_caisse"

/** Codes connus pour les comptes bancaires (mapping logos). */
export type CompteCode = "sgci" | "ecobank" | "nsia"


// ─── Écran 3 : Dashboard agrégé (GET /api/compta/dashboard/stats) ────────────

export interface DashboardKpis {
  ca:                    number
  ca_trend_pct:          number | null
  depenses:              number
  depenses_trend_pct:    number | null
  resultat_net:          number
  resultat_trend_pct:    number | null
  marge_pct:             number | null
  tresorerie:            number
  tresorerie_trend_pct:  number | null
}

export interface DashboardHealth {
  ok:           boolean
  nb_ecritures: number
  nb_lignes:    number
  total_debit:  number
  total_credit: number
  anomalies:    string[]
  /** Phase 4.x Vague 3 — opérations sortie+tiers sans justif actif. */
  nb_ops_missing_proof?: number
}

export interface MoisPoint {
  mois:     string   // "YYYY-MM"
  ca:       number
  depenses: number
}

export interface EntreeCaisseSlice {
  caisse_id: string
  libelle:   string
  code:      string | null
  total:     number
  pct:       number
}

export interface DepenseCategorieRow {
  categorie_id: string | null
  libelle:      string
  total:        number
}

export interface TopVehiculeRow {
  vehicule_id:     number
  immatriculation: string | null
  chauffeur_id:    number | null
  chauffeur_nom:   string | null
  nb_versements:   number
  ca_total:        number
}

export interface DerniereEcritureRow {
  ecriture_id:     string
  numero:          string
  date_ecriture:   string
  journal_code:    string
  operation_id:    string | null
  libelle:         string
  type:            "entree" | "sortie" | null
  montant:         number | null
  caisse_libelle:  string | null
  caisse_code:     string | null
}

export interface SoldeCaisseCompteRow {
  id:             string
  libelle:        string
  code:           string | null
  type_cible:     "caisse" | "compte"
  nb_mouvements:  number
  solde:          number
}

export interface DashboardStats {
  kpis:                    DashboardKpis
  health:                  DashboardHealth
  ca_vs_depenses_12_mois:  MoisPoint[]
  entrees_par_caisse:      EntreeCaisseSlice[]
  depenses_par_categorie:  DepenseCategorieRow[]
  top_vehicules:           TopVehiculeRow[]
  dernieres_ecritures:     DerniereEcritureRow[]
  soldes_caisses_comptes:  SoldeCaisseCompteRow[]
  periode:                 { date_from: string; date_to: string }
}

/** Périodes prédéfinies du Dashboard (réutilisées dans Écran 1). */
export type PeriodKey = "ce_mois" | "mois_prec" | "3_mois" | "tout"


// ─── Écran 4 : Formulaire saisie d'une opération manuelle ────────────────────

/** Caisse retournée par GET /api/compta/caisses (ou compte, marqué par target). */
export interface CaisseRefForm {
  id:                       string
  libelle:                  string
  code:                     string | null
  type_cible:               "caisse" | "compte"
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  solde_courant:            number | null
  actif:                    boolean
}

/** Catégorie retournée par GET /api/compta/categories. */
export interface CategorieForm {
  id:                       string
  libelle:                  string
  type:                     string
  sens:                     "debit" | "credit" | null
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  journal_par_defaut:       string | null
  actif:                    boolean
  mapping_complet:          boolean
}

/** Véhicule pour le select métier. */
export interface VehiculeFormRef {
  id:               number
  immatriculation:  string | null
  type_vehicule:    string | null
}

/** Chauffeur pour le select métier. */
export interface ChauffeurFormRef {
  id:    number
  nom:   string | null
  actif: boolean
}

/** Client (investisseur) pour le select métier. */
export interface ClientFormRef {
  id:    number
  nom:   string | null
}

/** Référentiel global chargé par useFormReferences. */
export interface FormReferences {
  caisses_comptes:  CaisseRefForm[]
  categories:       CategorieForm[]
  vehicules:        VehiculeFormRef[]
  chauffeurs:       ChauffeurFormRef[]
  clients:          ClientFormRef[]
}

/** Input du formulaire pour saveDraft / validate. */
export interface CreateOperationInput {
  type:             TypeOperation
  date_operation:   string
  montant:          number
  libelle:          string
  caisse_id:        string | null
  compte_id:        string | null
  categorie_id:     string
  vehicule_id:      number | null
  chauffeur_id:     number | null
  client_id:        number | null
  /** Phase 4.x Vague 2 — lien optionnel vers un tiers (rétroaction supportée). */
  tiers_id?:        string | null
  notes:            string | null
}


// ─── Écran 5 : Comptes & Caisses ─────────────────────────────────────────────

/** Item de la liste fusionnée caisses + comptes. */
export interface ComptesCaissesListItem {
  id:                       string
  libelle:                  string
  code:                     string | null
  type_cible:               "caisse" | "compte"
  /** "cash" | "mobile_money" pour les caisses, null pour les comptes. */
  type:                     string | null
  operateur:                string | null
  banque:                   string | null
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  actif:                    boolean
  solde:                    number | null
  derniere_operation:       string | null
  nb_mouvements:            number
}

/** Détail enrichi renvoyé par GET /api/compta/{caisses|comptes}/[id]. */
export interface ComptesCaissesDetail {
  id:                       string
  libelle:                  string
  code:                     string | null
  type_cible:               "caisse" | "compte"
  type:                     string | null
  operateur:                string | null
  banque:                   string | null
  numero:                   string | null
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  actif:                    boolean
  devise:                   string
  description:              string | null
  solde_initial:            number
  date_solde_initial:       string | null
  created_at:               string | null
  archive_le:               string | null

  solde:                    number
  nb_mouvements:            number
  premiere_op:              string | null
  derniere_op:              string | null
  entrees_12_mois:          number
  sorties_12_mois:          number

  evolution_solde_12_mois:  { mois: string; solde: number }[]

  dernieres_operations: {
    id:                string
    date_operation:    string
    libelle:           string
    type:              "entree" | "sortie"
    montant:           number
    journal_code:      string | null
    ecriture_id:       string | null
    vehicule_id:       number | null
    chauffeur_id:      number | null
    categorie_libelle: string | null
  }[]
}

/** Filter tab état liste. */
export type ComptesCaissesFilter = "tout" | "caisses" | "comptes" | "actifs"

/** Input formulaire create/update partagé. */
export interface CompteCaisseFormInput {
  type_cible:             "caisse" | "compte"
  libelle:                string
  code:                   string | null
  /** Caisses uniquement. */
  type:                   "cash" | "mobile_money" | null
  operateur:              string | null
  /** Comptes uniquement. */
  banque:                 string | null
  numero:                 string | null   // numero pour caisse, numero_compte pour compte
  compte_syscohada_code:  string | null
  description:            string | null
  actif:                  boolean
}


// ─── Écran 6 : Catégories d'opérations ───────────────────────────────────────

/** Catégorie dans la liste avec stats agrégées (?avec_stats=true). */
export interface CategorieListItem {
  id:                       string
  libelle:                  string
  type:                     string
  sens:                     "debit" | "credit" | null
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  compte_syscohada_classe:  number | null
  journal_par_defaut:       string | null
  journal_libelle:          string | null
  description:              string | null
  actif:                    boolean
  ordre:                    number
  created_at:               string | null
  mapping_complet:          boolean
  nb_operations:            number
  volume_total:             number
}

/** Détail enrichi d'une catégorie (GET /api/compta/categories/[id]). */
export interface CategorieDetail {
  id:                       string
  libelle:                  string
  type:                     string
  sens:                     "debit" | "credit" | null
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  compte_syscohada_classe:  number | null
  journal_par_defaut:       string | null
  journal_libelle:          string | null
  description:              string | null
  actif:                    boolean
  ordre:                    number
  created_at:               string | null
  mapping_complet:          boolean

  volume_cumule:            number
  nb_operations:            number
  montant_moyen:            number
  premiere_utilisation:     string | null
  derniere_utilisation:     string | null

  dernieres_operations: {
    id:               string
    date_operation:   string
    libelle:          string
    type:             "entree" | "sortie"
    montant:          number
    caisse_libelle:   string | null
    caisse_code:      string | null
  }[]
}

/** Filtre sens pour la liste. */
export type CategorieSensFilter = "tout" | "entrees" | "sorties"

/** Input formulaire create/update. */
export interface CategorieFormInput {
  libelle:                string
  type:                   string   // un des TypeCategorie
  sens:                   "debit" | "credit"
  compte_syscohada_code:  string | null
  journal_par_defaut:     string | null
  description:            string | null
  actif:                  boolean
}

/** Type métier renvoyé par /api/compta/categories/types-distincts. */
export interface TypeMetierItem {
  type:     string
  count:    number
  allowed:  boolean
}


// ─── Écran 7 : Paramètres comptabilité ───────────────────────────────────────

export interface SocieteInfo {
  raison_sociale:      string | null
  numero_rccm:         string | null
  numero_contribuable: string | null
  adresse_fiscale:     string | null
  telephone:           string | null
  email_comptable:     string | null
}

export interface ExerciceCourant {
  id:          string | null
  libelle:     string
  date_debut:  string
  date_fin:    string
  statut:      "ouvert" | "cloture"
}

export interface ParametresStats {
  nb_operations: number
  nb_ecritures:  number
  nb_lignes:     number
}

export interface ParametresPayload {
  mode_actif:                "simple" | "avance"
  premier_login_effectue:    boolean
  workflow_validation_actif: boolean
  numerotation_auto:         boolean
  journal_par_defaut:        string
  date_demarrage_module:     string | null
  updated_at:                string | null
  updated_by:                string | null
  exercice_courant:          ExerciceCourant
  societe:                   SocieteInfo
  stats:                     ParametresStats
}

/** Résultat normalisé du health check GET /api/compta/health. */
export interface HealthCheckResult {
  ok:           boolean
  nb_ecritures: number
  nb_lignes:    number
  total_debit:  number
  total_credit: number
  anomalies:    string[]
}


// ─── Écran 8 : Audit comptable (Health UI) ───────────────────────────────────

export type HealthCheckStatus  = "ok" | "warn" | "err"
export type HealthSectionStatus = "ok" | "warn" | "err" | "info"

export interface HealthCheckLine {
  label:  string
  status: HealthCheckStatus
  value:  string | number
}

/** Anomalie générique. Les champs en plus dépendent du type. */
export interface HealthAnomaly {
  type:     string
  id:       string
  libelle:  string
  raison?:  string
  fixable?: boolean
  fix_endpoint?: string
  fix_path?:     string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]:  any
}

export interface HealthSectionPayload {
  status:           HealthSectionStatus
  checks:           HealthCheckLine[]
  anomalies:        HealthAnomaly[]
  anomalies_total:  number
}

export interface HealthStatsSection {
  status: "info"
  stats:  {
    ca_total:       number
    depenses_total: number
    resultat_net:   number
    tresorerie:     number
    ops_brouillon:  number
    ops_valides:    number
    ops_annulees:   number
    extournes:      number
  }
}

export interface HealthDetailed {
  ok:         boolean
  score:      number
  checked_at: string
  global: {
    total_debit:   number
    total_credit:  number
    ecart:         number
    nb_ecritures:  number
    nb_lignes:     number
    nb_anomalies:  number
  }
  sections: {
    equilibre:               HealthSectionPayload
    coherence_ops_ecritures: HealthSectionPayload
    mappings_syscohada:      HealthSectionPayload
    coherence_journaux:      HealthSectionPayload
    stats_globales:          HealthStatsSection
  }
}

export type HealthSectionKey =
  | "equilibre"
  | "coherence_ops_ecritures"
  | "mappings_syscohada"
  | "coherence_journaux"
  | "stats_globales"


// ─── Écran 10 : Plan comptable SYSCOHADA ─────────────────────────────────────

export interface PlanCompteRow {
  code:           string
  libelle:        string
  classe:         number
  parent:         string | null
  ordre:          number
  type_compte:    string | null
  actif:          boolean
  nb_caisses:     number
  nb_comptes:     number
  nb_categories:  number
  total_usage:    number
}

export interface PlanComptableStats {
  total_comptes:     number
  nb_utilises:       number
  nb_disponibles:    number
  classes_presentes: number[]
}

export interface PlanComptablePayload {
  stats:   PlanComptableStats
  comptes: PlanCompteRow[]
}

export interface PlanCompteDetail {
  code:        string
  libelle:     string
  classe:      number
  parent:      string | null
  ordre:       number
  type_compte: string | null
  actif:       boolean
  usage: {
    caisses: {
      id:        string
      libelle:   string
      code:      string | null
      type:      string | null
      operateur: string | null
      actif:     boolean
      solde:     number
    }[]
    comptes: {
      id:      string
      libelle: string
      code:    string | null
      banque:  string | null
      actif:   boolean
      solde:   number
    }[]
    categories: {
      id:            string
      libelle:       string
      type:          string | null
      sens:          "debit" | "credit" | null
      actif:         boolean
      nb_operations: number
      volume_total:  number
    }[]
  }
}

/** Filtre URL pour la liste plan comptable : "all" ou classe 1..9. */
export type PlanComptableClasseFilter = "all" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"


// ─── Phase 4 : Exports PDF ───────────────────────────────────────────────────

export type ExportType =
  | "grand-livre"
  | "balance"
  | "journaux"
  | "releves-caisses"
  | "rapport-mensuel"

export interface ExportsMetadata {
  periode: { date_from: string; date_to: string }
  stats: {
    nb_operations:     number
    nb_ecritures:      number
    nb_comptes:        number
    nb_caisses:        number
    journaux_utilises: string[]
  }
  journaux_disponibles: { code: string; libelle: string }[]
  estimations:          Record<ExportType, number>
}

export type ExportsPeriodKey = "mois_courant" | "mois_prec" | "trimestre" | "annee" | "personnalise"


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.x VAGUE 1 — Transferts internes Boyah ↔ Boyah
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Élément de la liste des destinations possibles (caisses + comptes Boyah).
 * Le shortCode est calculé côté hook (WAV, MTN, SGCI, CP, …) pour la pastille.
 */
export interface TransfertDestinationItem {
  id:               string
  kind:             "caisse" | "compte"
  libelle:          string
  code:             string | null              // code snake_case (wave_boyah, sgci, …)
  shortCode:        string                     // 2-4 lettres pour la pastille
  syscohada_code:   string | null
  solde_courant:    number | null              // null si non disponible
  actif:            boolean
}

/** Payload envoyé à POST /api/compta/transferts */
export interface TransfertPayload {
  date_transfert:    string                    // YYYY-MM-DD
  montant:           number                    // > 0
  libelle?:          string | null
  notes?:            string | null
  source_caisse_id?: string | null
  source_compte_id?: string | null
  dest_caisse_id?:   string | null
  dest_compte_id?:   string | null
}

/** Ligne preview SYSCOHADA (avant insertion BD) */
export interface TransfertPreviewLigne {
  compte_code:   string
  libelle:       string
  debit:         number
  credit:        number
}

/** Réponse POST /api/compta/transferts/preview */
export interface TransfertPreview {
  numero_ecriture_futur: string                // "2026-OD-000479"
  date_ecriture:         string
  libelle:               string
  lignes:                TransfertPreviewLigne[]
  total_debit:           number
  total_credit:          number
  equilibre:             boolean
  source: { id: string; kind: "caisse" | "compte"; libelle: string; code: string }
  dest:   { id: string; kind: "caisse" | "compte"; libelle: string; code: string }
}

/** Résultat retourné par la RPC create_transfert_interne (parsé) */
export interface TransfertCreateResult {
  transfert_id:        string
  operation_sortie_id: string
  operation_entree_id: string
  ecriture_id:         string
  numero_ecriture:     string
}

/** Ligne de la liste GET /api/compta/transferts */
export interface TransfertListItem {
  id:                  string
  date_transfert:      string
  montant:             number
  libelle:             string
  statut:              "valide" | "annule" | "brouillon"
  source: { kind: "caisse" | "compte"; id: string; libelle: string; code: string | null }
  dest:   { kind: "caisse" | "compte"; id: string; libelle: string; code: string | null }
  operation_sortie_id: string | null
  operation_entree_id: string | null
  ecriture_id:         string | null
  created_at:          string
}

/** Détail d'un transfert pour GET /api/compta/transferts/[id] */
export interface TransfertDetail extends TransfertListItem {
  notes:             string | null
  ecriture: {
    id:          string
    numero:      string
    journal_code:string
    libelle:     string
    statut:      string
    lignes: TransfertPreviewLigne[]
  } | null
}

/** Étape courante du wizard (modal). */
export type TransfertWizardStep = "destination" | "preview"

/** Lien jumelle exposé par GET /operations/[id]/detail quand source = 'transfert_interne'. */
export interface TransfertJumelleLink {
  transfert_id:    string
  jumelle_id:      string                       // id de l'autre opération
  jumelle_type:    "entree" | "sortie"
  jumelle_libelle: string                       // libellé de la caisse/compte côté jumelle
  montant:         number
  sens:            "depuis" | "vers"            // "depuis" = on est la sortie
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.x VAGUE 2 — Module Tiers (Fournisseurs / Salariés / Autres)
// ═══════════════════════════════════════════════════════════════════════════

/** 4 types de tiers (cf. spec §2.2 — mapping SYSCOHADA). */
export type TiersType = "client" | "fournisseur" | "salarie" | "autre"

/** Mapping type → compte SYSCOHADA parent (figé côté serveur). */
export const TIERS_SYSCOHADA_PARENT: Record<TiersType, string> = {
  client:      "411",
  fournisseur: "401",
  salarie:     "421",
  autre:       "467",
}

/** Représentation d'un tiers (forme brute BD). */
export interface Tiers {
  id:                      string
  nom:                     string
  type:                    TiersType
  telephone:               string | null
  email:                   string | null
  adresse:                 string | null
  raison_sociale:          string | null
  numero_rccm:             string | null
  numero_contribuable:     string | null
  compte_syscohada_parent: string
  compte_syscohada_suffix: string | null
  compte_syscohada_code:   string         // colonne générée ("401-GA")
  actif:                   boolean
  notes:                   string | null
  created_at:              string
  updated_at:              string
}

/** Ligne de la liste GET /api/compta/tiers (avec totaux). */
export interface TiersListItem {
  id:                    string
  nom:                   string
  type:                  TiersType
  telephone:             string | null
  email:                 string | null
  numero_rccm:           string | null
  numero_contribuable:   string | null
  compte_syscohada_code: string
  actif:                 boolean
  // KPIs agrégés (sur l'année courante par défaut)
  nb_operations:         number
  total_flux_signe:      number     // entrées - sorties
  derniere_op_date:      string | null
}

/** KPIs globaux de la page liste. */
export interface TiersListKpis {
  total:        number
  clients:      number
  fournisseurs: number
  salaries:     number
  autres:       number
}

/** Filtres de l'URL pour /comptabilite/tiers. */
export interface TiersFilters {
  type?:         TiersType | "tout"
  q?:            string
  actifs_only?:  boolean
  page?:         number
  page_size?:    number
}

/** Réponse paginée GET /api/compta/tiers. */
export interface TiersListResponse {
  data:        TiersListItem[]
  kpis:        TiersListKpis
  total:       number
  page:        number
  page_size:   number
}

/** Détail enrichi GET /api/compta/tiers/[id]. */
export interface TiersDetail extends Tiers {
  kpis: {
    nb_operations:    number
    total_entrees:    number
    total_sorties:    number
    total_flux_signe: number
    derniere_op_date: string | null
    solde_courant:    number      // somme signée
  }
}

/** Ligne d'opération dans l'historique d'un tiers. */
export interface TiersOperationRow {
  id:                  string
  date_operation:      string
  type:                "entree" | "sortie"
  montant:             number
  libelle:             string
  caisse_libelle:      string | null
  compte_libelle:      string | null
  categorie_libelle:   string | null
  ecriture_id:         string | null
  statut:              string
  /** Phase 4.x Vague 3 — nombre de justificatifs actifs. */
  justificatifs_count: number
}

/** Réponse GET /api/compta/tiers/[id]/operations. */
export interface TiersOperationsResponse {
  data:      TiersOperationRow[]
  total:     number
  page:      number
  page_size: number
}

/** Payload de création POST /api/compta/tiers. */
export interface TiersPayload {
  nom:                  string
  type:                 TiersType
  telephone?:           string | null
  email?:               string | null
  adresse?:             string | null
  raison_sociale?:      string | null
  numero_rccm?:         string | null
  numero_contribuable?: string | null
  suffix_manuel?:       string | null    // null = auto
  notes?:               string | null
}

/** Payload de modification PATCH /api/compta/tiers/[id]. */
export type TiersUpdatePayload = Partial<TiersPayload> & {
  actif?: boolean
}

/** Résultat retourné par la RPC create_tiers. */
export interface TiersCreateResult {
  tiers_id:              string
  suffix_final:          string
  compte_syscohada_code: string
}

/** Réponse GET /api/compta/tiers/suggest-suffix. */
export interface SuggestSuffixResponse {
  suffix_suggere:        string
  compte_syscohada_code: string
  disponible:            boolean
  alternatives:          string[]    // ["GA1", "GA2"] si "GA" déjà pris
}

/** Référence Tiers exposée par /operations/[id]/detail. */
export interface TiersRef {
  id:                    string
  nom:                   string
  type:                  TiersType
  compte_syscohada_code: string
  actif:                 boolean
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.x VAGUE 3 — Justificatifs des opérations
// ═══════════════════════════════════════════════════════════════════════════

/** Mimes acceptés pour les justificatifs. */
export type JustificatifMimeType = "application/pdf" | "image/jpeg" | "image/png"

/** Référence d'un justificatif exposée par GET /operations/[id]/justificatifs. */
export interface JustificatifRef {
  id:                  string
  filename:            string
  mime_type:           JustificatifMimeType
  size_bytes:          number
  uploaded_at:         string
  uploaded_by_name:    string | null
  /** URL signée Supabase valide ~60s. Régénérée à chaque GET. */
  signed_url:          string
}

/** Réponse POST upload (sans signed_url — re-fetch via GET pour la dispo). */
export interface JustificatifUploadResponse {
  id:                  string
  filename:            string
  mime_type:           JustificatifMimeType
  size_bytes:          number
  uploaded_at:         string
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.2 — Paramètres société (Module 1)
// ═══════════════════════════════════════════════════════════════════════════

export type SocieteFormeJuridique = "SARL" | "SA" | "SAS" | "SASU" | "EI" | "SCI" | "SCS" | "SNC" | "GIE" | "autre"
export type SocieteRegimeFiscal   = "tva_assujetti" | "non_assujetti"

export interface SocieteParametres {
  id:                    string
  nom_commercial:        string
  raison_sociale:        string
  forme_juridique:       SocieteFormeJuridique | null
  adresse:               string | null
  telephone:             string | null
  email:                 string | null
  site_web:              string | null
  rccm:                  string | null
  numero_cc:             string | null
  capital_social:        number | null
  regime_fiscal:         SocieteRegimeFiscal | null
  nif:                   string | null
  code_naf:              string | null
  logo_storage_path:     string | null
  /** URL signée pour affichage UI (régénérée à chaque GET, TTL ~5 min). */
  logo_signed_url:       string | null
  exercice_debut_jj_mm:  string
  exercice_fin_jj_mm:    string
  /** PHASE 4.3 — Note 1 méthodes comptables (texte libre). */
  methodes_comptables:    string | null
  /** PHASE 4.3 — Note 6 engagements hors bilan (texte libre). */
  engagements_hors_bilan: string | null
  /** PHASE 4.3 — Méthode d'amortissement par défaut. */
  methode_amortissement:  "lineaire" | "degressif"
  /** PHASE 4.3 — Valorisation des stocks. */
  methode_stocks:         "fifo" | "cmp" | "lifo"
  created_at:            string
  updated_at:            string
}

export interface SocieteParametresPayload {
  nom_commercial?:        string
  raison_sociale?:        string
  forme_juridique?:       SocieteFormeJuridique | null
  adresse?:               string | null
  telephone?:             string | null
  email?:                 string | null
  site_web?:              string | null
  rccm?:                  string | null
  numero_cc?:             string | null
  capital_social?:        number | null
  regime_fiscal?:         SocieteRegimeFiscal | null
  nif?:                   string | null
  code_naf?:              string | null
  exercice_debut_jj_mm?:  string
  exercice_fin_jj_mm?:    string
  /** PHASE 4.3. */
  methodes_comptables?:    string | null
  engagements_hors_bilan?: string | null
  methode_amortissement?:  "lineaire" | "degressif"
  methode_stocks?:         "fifo" | "cmp" | "lifo"
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.2 — Exercices comptables (Module 2)
// ═══════════════════════════════════════════════════════════════════════════

export type ExerciceStatut = "ouvert" | "clos"

export interface ExerciceItem {
  id:               string
  annee:            number
  libelle:          string
  date_debut:       string
  date_fin:         string
  statut:           ExerciceStatut
  date_cloture:     string | null
  cloture_par_name: string | null
  resultat_net:     number | null
  bilan_pdf_path:   string | null
  cr_pdf_path:      string | null
  nb_operations:    number
  nb_brouillons:    number
  created_at:       string
}

export interface ExerciceCreatePayload {
  annee:      number
  date_debut?: string     // défaut "YYYY-01-01"
  date_fin?:   string     // défaut "YYYY-12-31"
}

export interface ExerciceClotureResult {
  exercice_id:     string
  resultat_net:    number
  bilan_pdf_path:  string | null
  cr_pdf_path:     string | null
  next_exercice_id: string | null
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.2 — États financiers (Module 3)
// ═══════════════════════════════════════════════════════════════════════════

export interface BilanLigne {
  poste:       string         // ex "AI_INCORP"
  libelle:     string         // ex "Immobilisations incorporelles"
  brut_n:      number
  amort_n:     number
  net_n:       number
  net_n_minus_1: number
}

export interface BilanSection {
  code:        string        // "ACTIF_IMMO", "ACTIF_CIRC", "TRESO_ACTIF", "CAP_PROPRES", "DETTES_FIN", "PASSIF_CIRC", "TRESO_PASSIF"
  libelle:     string
  lignes:      BilanLigne[]
  total_brut_n:     number
  total_amort_n:    number
  total_net_n:      number
  total_net_n_minus_1: number
}

export interface BilanData {
  exercice_id:        string
  exercice_libelle:   string
  date_arrete:        string
  actif_sections:     BilanSection[]
  passif_sections:    BilanSection[]
  total_actif_brut_n: number
  total_actif_amort_n:number
  total_actif_net_n:  number
  total_actif_net_n_minus_1: number
  total_passif_net_n: number
  total_passif_net_n_minus_1: number
  /** N - N : équilibre attendu = 0. */
  ecart_n:            number
  ecart_n_minus_1:    number
}

export type SIGCode =
  | "MARGE_COMMERCIALE"
  | "PRODUCTION_EXERCICE"
  | "VALEUR_AJOUTEE"
  | "EBE"
  | "RESULTAT_EXPLOITATION"
  | "RESULTAT_FINANCIER"
  | "RAO"
  | "HAO"
  | "RESULTAT_NET"

export interface SIGRow {
  code:       SIGCode
  libelle:    string
  detail:     { libelle: string; signe: 1 | -1; montant_n: number; montant_n_minus_1: number }[]
  total_n:    number
  total_n_minus_1: number
}

export interface CompteResultatData {
  exercice_id:      string
  exercice_libelle: string
  date_debut:       string
  date_fin:         string
  sigs:             SIGRow[]
  resultat_net:     number
  resultat_net_n_minus_1: number
}

export interface EtatsFinanciersArchiveRef {
  id:           string
  exercice_id:  string
  type_etat:    "bilan" | "compte_resultat" | "notes_annexes" | "tft" | "dossier_complet"
  hash_sha256:  string
  pdf_path:     string | null
  genere_at:    string
  genere_par_name: string | null
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.3 — Notes annexes simplifiées (Module 2)
// ═══════════════════════════════════════════════════════════════════════════

/** Note 2 — État des immobilisations (1 ligne par catégorie). */
export interface NoteImmoRow {
  categorie_code:    string           // ex "21", "22", "24"
  categorie_libelle: string           // ex "Immobilisations incorporelles"
  solde_debut:       number           // brut au début de l'exercice
  acquisitions:      number           // débits 2x sur l'exercice
  cessions:          number           // crédits 2x sur l'exercice
  solde_fin:         number           // = debut + acquisitions − cessions
  amort_cumule:      number           // solde 28x au fin
  vnc:               number           // valeur nette comptable = solde_fin − amort_cumule
}

/** Note 3 — Dotations aux amortissements (1 ligne par catégorie). */
export interface NoteAmortRow {
  categorie_code:    string
  categorie_libelle: string
  valeur_origine:    number
  amort_debut:       number           // cumul début exercice
  dotation_exercice: number           // dotation N (68x)
  amort_fin:         number           // cumul fin = debut + dotation
  vnc:               number           // valeur nette = origine − amort_fin
}

/** Note 4 — Créances/Dettes (V1 simplifiée : tout à -1 an). */
export interface NoteCreanceDetteRow {
  libelle:           string
  compte_root:       string           // ex "411", "401"
  montant_total:     number           // valeur absolue
  /** V1 : on met tout dans `moins_un_an`. Phase 4.4 future : ventiler. */
  moins_un_an:       number
  un_a_cinq_ans:     number
  plus_cinq_ans:     number
}

/** Note 5 — Variation des capitaux propres. */
export interface NoteCapitauxRow {
  libelle:           string           // "Capital social", "Réserves", ...
  compte_root:       string           // "101", "106", "11", "13"
  solde_debut:       number
  variation:         number           // (+) ou (−) sur l'exercice
  solde_fin:         number
}

export interface NotesAnnexesData {
  exercice_id:       string
  exercice_libelle:  string
  date_arrete:       string
  /** Note 1 — méthodes comptables (texte libre depuis societe_parametres). */
  methodes_comptables:    string
  /** Note 6 — engagements hors bilan (texte libre). */
  engagements_hors_bilan: string
  /** Note 2 — immobilisations (vide si aucune). */
  immobilisations:        NoteImmoRow[]
  /** Note 3 — dotations amortissements (vide si aucune). */
  amortissements:         NoteAmortRow[]
  /** Note 4 — créances. */
  creances:               NoteCreanceDetteRow[]
  /** Note 4 (suite) — dettes. */
  dettes:                 NoteCreanceDetteRow[]
  /** Note 5 — variation capitaux propres. */
  capitaux_propres:       NoteCapitauxRow[]
  /** Récap : méthodes amort + stocks. */
  methode_amortissement:  "lineaire" | "degressif"
  methode_stocks:         "fifo" | "cmp" | "lifo"
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.3 — Tableau Flux de Trésorerie SYSCOHADA (Module 3)
// ═══════════════════════════════════════════════════════════════════════════

export interface TftLigne {
  libelle:           string
  /** +1 = ajouté, −1 = retranché dans la cascade. */
  signe:             1 | -1
  montant_n:         number
  montant_n_minus_1: number
}

export interface TftSection {
  code:              "OPERATIONNEL" | "INVESTISSEMENT" | "FINANCEMENT"
  libelle:           string
  lignes:            TftLigne[]
  total_n:           number
  total_n_minus_1:   number
}

export interface TftData {
  exercice_id:        string
  exercice_libelle:   string
  date_arrete:        string
  sections:           TftSection[]
  variation_n:        number          // A + B + C
  variation_n_minus_1: number
  treso_debut_n:      number
  treso_fin_n:        number
  treso_debut_n_minus_1: number
  treso_fin_n_minus_1:   number
  /** Réconciliation : | treso_debut + variation − treso_fin | doit être < 1 F. */
  ecart_reconciliation: number
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4.x VAGUE 3.5 — Refonte /depenses + /recettes (vues unifiées)
// ═══════════════════════════════════════════════════════════════════════════

/** Onglet de la PeriodBar. */
export type FlowPeriodKey =
  | "today"
  | "this_week"
  | "this_month"
  | "previous_month"
  | "three_months"
  | "year"
  | "custom"

/** Plage de dates effective (ISO YYYY-MM-DD). */
export interface FlowDateRange {
  from: string
  to:   string
}

/** Sens (dépenses / recettes). */
export type FlowKind = "depenses" | "recettes"

/** Source d'opération (enum aligné avec operations.source de la BD). */
export type FlowSource =
  | "manuel"
  | "recette_wave"
  | "depense_vehicule"
  | "versement_client"
  | "transfert_interne"
  | "dotation_amort"
  | "import_csv"

/** Filtres URL → query params (CSV pour les multi). */
export interface FlowFilters {
  from?:           string
  to?:             string
  period?:         FlowPeriodKey
  cat_ids?:        string[]
  caisse_ids?:     string[]
  vehicule_ids?:   number[]
  chauffeur_ids?:  number[]
  tiers_ids?:      string[]
  sources?:        FlowSource[]
  montant_min?:    number | null
  montant_max?:    number | null
  search?:         string
  page?:           number
  page_size?:      number
  sort_by?:        "date_op" | "montant"
  sort_order?:     "asc" | "desc"
}

/** Ligne d'opération dans la liste /depenses ou /recettes. */
export interface FlowOperationItem {
  id:             string
  date_op:        string                              // YYYY-MM-DD
  type:           "entree" | "sortie"
  montant:        number
  libelle:        string
  source:         FlowSource
  caisse:         { id: string; libelle: string; code_syscohada: string | null; kind: "caisse" | "compte" } | null
  categorie:      { id: string; libelle: string; type: string; compte_syscohada_code: string | null } | null
  tiers:          { id: string; nom: string; compte_syscohada_code: string } | null
  vehicule:       { id: number; immatriculation: string | null } | null
  chauffeur:      { id: number; nom: string | null } | null
  client:         { id: number; nom: string | null } | null
}

/** Réponse GET /api/compta/depenses (ou recettes). */
export interface FlowListResponse {
  data:          FlowOperationItem[]
  total:         number
  page:          number
  page_size:     number
  total_period:  number          // somme sur TOUTE la période (sans pagination)
  count_period: number           // nb d'ops sur la période
}

/** Top entry (catégorie / tiers / chauffeur). */
export interface FlowTopEntry {
  id:      string | number
  libelle: string
  total:   number
  count:   number
}

/** Slice du donut (répartition catégorie ou source). */
export interface FlowSlice {
  id:           string             // categorie_id OU source enum value
  libelle:      string
  total:        number
  pct:          number              // 0–100
  color_hint:   string | null       // hex
}

/** Réponse GET /api/compta/depenses/stats (ou recettes/stats). */
export interface FlowStatsResponse {
  total_period:               number
  total_previous_period:      number
  trend_pct:                  number | null         // null si prev=0
  count_period:               number
  count_days:                 number
  avg_per_day:                number
  top_categories:             FlowTopEntry[]        // top 3
  top_tiers:                  FlowTopEntry[]        // top 3 (depenses)
  top_chauffeurs:             FlowTopEntry[]        // top 3 (recettes)
  evolution_monthly:          { month: string; total: number }[]   // 6 derniers mois ISO YYYY-MM
  repartition_categories:     FlowSlice[]           // top 4 + "Autres"
  repartition_sources:        FlowSlice[]           // pour recettes
}
