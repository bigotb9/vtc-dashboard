-- ============================================================
-- Baseline schema public — generee le 2026-05-26T17:59:04.465Z
-- Source : scripts/generate-baseline.mjs
-- ============================================================
--
-- Ce fichier reconstruit l'integralite du schema public a partir
-- d'un dump du catalogue Postgres au moment de l'execution.
--
-- Sections :
--   1. Extensions
--   2. Types custom (enums, composites)
--   3. Sequences independantes
--   4. Tables (sans FK)
--   5. Indexes
--   6. UNIQUE constraints
--   7. Foreign Keys
--   8. Fonctions PL/pgSQL
--   9. Vues (ordre topologique)
--  10. Triggers
--  11. RLS policies
--  12. Comments
-- ============================================================

BEGIN;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ── 1. EXTENSIONS ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- ── 2. TYPES CUSTOM ────────────────────────────────────────

-- ── 3. SEQUENCES INDEPENDANTES ─────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public."affectation_chauffeurs_vehicules_id_affectation_seq";
CREATE SEQUENCE IF NOT EXISTS public."chauffeurs_id_chauffeur_seq";
CREATE SEQUENCE IF NOT EXISTS public."recettes_wave_id_seq";
CREATE SEQUENCE IF NOT EXISTS public."vehicules_id_vehicule_seq";
CREATE SEQUENCE IF NOT EXISTS public."versements_chauffeurs_id_seq";

-- ── 4. TABLES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."activity_logs" (
  "id" bigint DEFAULT nextval('activity_logs_id_seq'::regclass) NOT NULL,
  "user_id" uuid,
  "user_name" text,
  "user_role" text,
  "action" text NOT NULL,
  "entity" text,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."affectation_chauffeurs_vehicules" (
  "id_affectation" integer DEFAULT nextval('affectation_chauffeurs_vehicules_id_affectation_seq'::regclass) NOT NULL,
  "id_chauffeur" integer,
  "id_vehicule" integer,
  "date_debut" date,
  "date_fin" date,
  "created_at" timestamp without time zone,
  CONSTRAINT "affectation_chauffeurs_vehicules_pkey" PRIMARY KEY (id_affectation)
);
CREATE TABLE IF NOT EXISTS public."agent_analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "titre" text,
  "contenu" text NOT NULL,
  "donnees" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agent_analyses_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."agent_conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "telegram_chat_id" text,
  "telegram_user_id" text,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agent_conversations_pkey" PRIMARY KEY (id),
  CONSTRAINT "agent_conversations_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);
CREATE TABLE IF NOT EXISTS public."agent_memory" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "categorie" text NOT NULL,
  "cle" text NOT NULL,
  "valeur" text NOT NULL,
  "importance" integer DEFAULT 5,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agent_memory_pkey" PRIMARY KEY (id),
  CONSTRAINT "agent_memory_importance_check" CHECK (((importance >= 1) AND (importance <= 10)))
);
CREATE TABLE IF NOT EXISTS public."ai_insights" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "triggered_by" text DEFAULT 'auto'::text NOT NULL,
  "analysis" jsonb,
  "retard_vehicules" jsonb DEFAULT '[]'::jsonb,
  "is_after_noon" boolean DEFAULT false,
  "total_vehicules" integer DEFAULT 0,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."alertes_envoyees" (
  "id" bigint DEFAULT nextval('alertes_envoyees_id_seq'::regclass) NOT NULL,
  "type_alerte" text NOT NULL,
  "gravite" text NOT NULL,
  "cible" text,
  "message_envoye" text,
  "data_snapshot" jsonb,
  "telegram_message_id" bigint,
  "statut" text DEFAULT 'envoyee'::text,
  "date_envoi" timestamp with time zone DEFAULT now(),
  "date_expiration" timestamp with time zone,
  "date_traitement" timestamp with time zone,
  "traitement_action" text,
  CONSTRAINT "alertes_envoyees_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."bilan_mapping" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "classe_compte" text NOT NULL,
  "poste_bilan" text NOT NULL,
  "section" text NOT NULL,
  "cote" text NOT NULL,
  "ordre" integer DEFAULT 0 NOT NULL,
  "override_manuel" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bilan_mapping_pkey" PRIMARY KEY (id),
  CONSTRAINT "bilan_mapping_cote_check" CHECK ((cote = ANY (ARRAY['actif'::text, 'passif'::text]))),
  CONSTRAINT "bilan_mapping_section_check" CHECK ((section = ANY (ARRAY['ACTIF_IMMO'::text, 'ACTIF_CIRC'::text, 'TRESO_ACTIF'::text, 'CAP_PROPRES'::text, 'DETTES_FIN'::text, 'PASSIF_CIRC'::text, 'TRESO_PASSIF'::text])))
);
CREATE TABLE IF NOT EXISTS public."boyahbot_memory" (
  "id" bigint DEFAULT nextval('boyahbot_memory_id_seq'::regclass) NOT NULL,
  "session_id" text NOT NULL,
  "message" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "boyahbot_memory_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."caisses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "libelle" text NOT NULL,
  "type" text NOT NULL,
  "operateur" text,
  "numero" text,
  "solde_initial" numeric(18,2) DEFAULT 0 NOT NULL,
  "date_solde_initial" date DEFAULT '2026-02-09'::date NOT NULL,
  "plafond" numeric(18,2),
  "compte_syscohada_code" text,
  "responsable_id" uuid,
  "actif" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  "archive_le" timestamp with time zone,
  "archive_par" uuid,
  "code" text,
  "description" text,
  CONSTRAINT "caisses_pkey" PRIMARY KEY (id),
  CONSTRAINT "caisses_type_check" CHECK ((type = ANY (ARRAY['cash'::text, 'mobile_money'::text])))
);
CREATE TABLE IF NOT EXISTS public."calendrier" (
  "date" date NOT NULL,
  "annee" integer,
  "mois" integer,
  "jour" integer,
  "semaine" integer,
  "jour_semaine" integer,
  "nom_mois" text,
  "nom_jour" text,
  "trimestre" integer,
  CONSTRAINT "calendrier_pkey" PRIMARY KEY (date)
);
CREATE TABLE IF NOT EXISTS public."categories_operations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "libelle" text NOT NULL,
  "type" text NOT NULL,
  "compte_syscohada_code" text,
  "sens" text,
  "journal_par_defaut" text,
  "actif" boolean DEFAULT true NOT NULL,
  "ordre" smallint DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "description" text,
  CONSTRAINT "categories_operations_pkey" PRIMARY KEY (id),
  CONSTRAINT "categories_operations_sens_check" CHECK ((sens = ANY (ARRAY['debit'::text, 'credit'::text]))),
  CONSTRAINT "categories_operations_type_check" CHECK ((type = ANY (ARRAY['recette'::text, 'depense'::text, 'apport'::text, 'reversement'::text, 'avance'::text, 'investissement'::text, 'remboursement'::text, 'dotation'::text, 'transfert'::text, 'autre'::text])))
);
CREATE TABLE IF NOT EXISTS public."chauffeurs" (
  "id_chauffeur" integer DEFAULT nextval('chauffeurs_id_chauffeur_seq'::regclass) NOT NULL,
  "nom" text,
  "numero_wave" text,
  "actif" boolean,
  "commentaire" text,
  "photo" text,
  "photo_permis_recto" text,
  "photo_permis_verso" text,
  "numero_permis" text,
  "numero_cni" text,
  "situation_matrimoniale" text,
  "nombre_enfants" integer,
  "domicile" text,
  "numero_garant" text,
  "numero_wave_2" text,
  "numero_wave_3" text,
  CONSTRAINT "chauffeurs_pkey" PRIMARY KEY (id_chauffeur)
);
CREATE TABLE IF NOT EXISTS public."chauffeurs_yango_snapshot" (
  "id" integer DEFAULT nextval('chauffeurs_yango_snapshot_id_seq'::regclass) NOT NULL,
  "yango_driver_id" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "phone" text,
  "work_status" text,
  "premiere_vue_at" timestamp with time zone DEFAULT now(),
  "derniere_vue_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "chauffeurs_yango_snapshot_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."clients" (
  "id" integer DEFAULT nextval('clients_id_seq'::regclass) NOT NULL,
  "nom" text NOT NULL,
  "telephone" text,
  "email" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "actif" boolean DEFAULT true NOT NULL,
  "tiers_id" uuid,
  CONSTRAINT "clients_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."clients_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_client" integer NOT NULL,
  "type" text NOT NULL,
  "nom_fichier" text NOT NULL,
  "storage_path" text NOT NULL,
  "taille" integer NOT NULL,
  "mime_type" text NOT NULL,
  "auto_genere" boolean DEFAULT false NOT NULL,
  "notes" text,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "uploaded_by" uuid,
  CONSTRAINT "clients_documents_pkey" PRIMARY KEY (id),
  CONSTRAINT "clients_documents_mime_type_check" CHECK ((char_length(mime_type) <= 100)),
  CONSTRAINT "clients_documents_nom_fichier_check" CHECK (((char_length(TRIM(BOTH FROM nom_fichier)) >= 1) AND (char_length(nom_fichier) <= 255))),
  CONSTRAINT "clients_documents_notes_check" CHECK (((notes IS NULL) OR (char_length(notes) <= 1000))),
  CONSTRAINT "clients_documents_storage_path_check" CHECK ((char_length(storage_path) <= 1000)),
  CONSTRAINT "clients_documents_taille_check" CHECK ((taille > 0)),
  CONSTRAINT "clients_documents_type_check" CHECK ((type = ANY (ARRAY['contrat'::text, 'cni'::text, 'carte_grise'::text, 'assurance'::text, 'justificatif'::text, 'etat_comptes_sortie'::text, 'autre'::text])))
);
CREATE TABLE IF NOT EXISTS public."clotures" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "exercice_id" uuid NOT NULL,
  "type" text NOT NULL,
  "periode" text NOT NULL,
  "cloture_le" timestamp with time zone DEFAULT now() NOT NULL,
  "cloture_par" uuid NOT NULL,
  "totaux" jsonb NOT NULL,
  "notes" text,
  CONSTRAINT "clotures_pkey" PRIMARY KEY (id),
  CONSTRAINT "clotures_type_check" CHECK ((type = ANY (ARRAY['mensuelle'::text, 'annuelle'::text])))
);
CREATE TABLE IF NOT EXISTS public."commandes_yango" (
  "id" text NOT NULL,
  "short_id" bigint,
  "status" text,
  "created_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "raw" jsonb,
  CONSTRAINT "commandes_yango_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."comptes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "libelle" text NOT NULL,
  "banque" text,
  "numero_compte" text,
  "devise" text DEFAULT 'XOF'::text NOT NULL,
  "solde_initial" numeric(18,2) DEFAULT 0 NOT NULL,
  "date_solde_initial" date DEFAULT '2026-02-09'::date NOT NULL,
  "compte_syscohada_code" text,
  "actif" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  "archive_le" timestamp with time zone,
  "archive_par" uuid,
  "code" text,
  "description" text,
  CONSTRAINT "comptes_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."comptes_syscohada" (
  "code" text NOT NULL,
  "libelle" text NOT NULL,
  "classe" smallint NOT NULL,
  "type" text NOT NULL,
  "parent_code" text,
  "ordre" smallint DEFAULT 0,
  "actif" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "comptes_syscohada_pkey" PRIMARY KEY (code),
  CONSTRAINT "comptes_syscohada_classe_check" CHECK (((classe >= 1) AND (classe <= 9))),
  CONSTRAINT "comptes_syscohada_type_check" CHECK ((type = ANY (ARRAY['capitaux_propres'::text, 'dettes_financieres'::text, 'immobilisation'::text, 'amortissement'::text, 'immobilisation_fin'::text, 'tiers_actif'::text, 'tiers_passif'::text, 'tiers'::text, 'tresorerie'::text, 'charge_exploitation'::text, 'charge_personnel'::text, 'charge_financiere'::text, 'dotation'::text, 'produit_exploitation'::text, 'produit_financier'::text, 'reprise'::text, 'technique'::text])))
);
CREATE TABLE IF NOT EXISTS public."depenses_vehicules" (
  "id_depense" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date_depense" date,
  "montant" numeric,
  "type_depense" text,
  "description" text,
  "id_vehicule" integer,
  "immobilisation" boolean,
  "date_debut_immobilisation" date,
  "date_fin_immobilisation" date,
  "created_at" timestamp without time zone,
  CONSTRAINT "depenses_vehicules_pkey" PRIMARY KEY (id_depense)
);
CREATE TABLE IF NOT EXISTS public."ecritures_comptables" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "numero" text NOT NULL,
  "date_ecriture" date NOT NULL,
  "journal_code" text NOT NULL,
  "libelle" text NOT NULL,
  "exercice_id" uuid NOT NULL,
  "operation_id" uuid,
  "transfert_id" uuid,
  "source_manuelle" boolean DEFAULT false NOT NULL,
  "statut" text DEFAULT 'valide'::text NOT NULL,
  "cloture" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  "valide_le" timestamp with time zone,
  "valide_par" uuid,
  "extourne_de" uuid,
  "auto_generated" boolean DEFAULT false NOT NULL,
  "auto_generation_type" text,
  CONSTRAINT "ecritures_comptables_pkey" PRIMARY KEY (id),
  CONSTRAINT "ecritures_comptables_statut_check" CHECK ((statut = ANY (ARRAY['brouillon'::text, 'valide'::text, 'annule'::text])))
);
CREATE TABLE IF NOT EXISTS public."entretiens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_vehicule" integer,
  "immatriculation" text NOT NULL,
  "date_realise" date NOT NULL,
  "date_prochain" date GENERATED ALWAYS AS ((date_realise + '21 days'::interval)) STORED,
  "huile_moteur" boolean DEFAULT false,
  "filtre_huile" boolean DEFAULT false,
  "filtre_air" boolean DEFAULT false,
  "filtre_pollen" boolean DEFAULT false,
  "liquide_refroidissement" boolean DEFAULT false,
  "huile_frein" boolean DEFAULT false,
  "pneus" boolean DEFAULT false,
  "km_vidange" integer,
  "cout" numeric DEFAULT 0,
  "technicien" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "inspection" jsonb,
  CONSTRAINT "entretiens_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."etats_financiers_archives" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "exercice_id" uuid NOT NULL,
  "type_etat" text NOT NULL,
  "hash_sha256" text NOT NULL,
  "donnees_json" jsonb NOT NULL,
  "pdf_storage_path" text,
  "uuid_externe" uuid DEFAULT gen_random_uuid() NOT NULL,
  "genere_par" uuid,
  "genere_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "etats_financiers_archives_pkey" PRIMARY KEY (id),
  CONSTRAINT "etats_financiers_archives_hash_sha256_check" CHECK ((char_length(hash_sha256) = 64)),
  CONSTRAINT "etats_financiers_archives_type_etat_check" CHECK ((type_etat = ANY (ARRAY['bilan'::text, 'compte_resultat'::text, 'notes_annexes'::text, 'tft'::text, 'dossier_complet'::text])))
);
CREATE TABLE IF NOT EXISTS public."exercices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "libelle" text NOT NULL,
  "date_debut" date NOT NULL,
  "date_fin" date NOT NULL,
  "cloture" boolean DEFAULT false NOT NULL,
  "cloture_le" timestamp with time zone,
  "cloture_par" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "annee" integer NOT NULL,
  "statut" text DEFAULT 'ouvert'::text NOT NULL,
  "date_cloture" timestamp with time zone,
  "resultat_net" bigint,
  "bilan_pdf_path" text,
  "cr_pdf_path" text,
  CONSTRAINT "exercices_pkey" PRIMARY KEY (id),
  CONSTRAINT "exercices_check" CHECK ((date_fin > date_debut)),
  CONSTRAINT "exercices_statut_check" CHECK ((statut = ANY (ARRAY['ouvert'::text, 'clos'::text])))
);
CREATE TABLE IF NOT EXISTS public."journaux" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "libelle" text NOT NULL,
  "type" text NOT NULL,
  "actif" boolean DEFAULT true NOT NULL,
  "ordre" smallint DEFAULT 0,
  CONSTRAINT "journaux_pkey" PRIMARY KEY (id),
  CONSTRAINT "journaux_type_check" CHECK ((type = ANY (ARRAY['banque'::text, 'caisse'::text, 'achats'::text, 'ventes'::text, 'paie'::text, 'od'::text])))
);
CREATE TABLE IF NOT EXISTS public."jours_feries" (
  "date" date NOT NULL,
  "libelle" text NOT NULL,
  "montant" numeric DEFAULT 15000,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "jours_feries_pkey" PRIMARY KEY (date)
);
CREATE TABLE IF NOT EXISTS public."justificatifs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" uuid NOT NULL,
  "storage_path" text NOT NULL,
  "storage_bucket" text DEFAULT 'justificatifs'::text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "uploaded_by" uuid,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  CONSTRAINT "justificatifs_pkey" PRIMARY KEY (id),
  CONSTRAINT "justificatifs_filename_check" CHECK (((char_length(filename) >= 1) AND (char_length(filename) <= 255))),
  CONSTRAINT "justificatifs_mime_type_check" CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text]))),
  CONSTRAINT "justificatifs_size_bytes_check" CHECK (((size_bytes > 0) AND (size_bytes <= ((5 * 1024) * 1024)))),
  CONSTRAINT "justificatifs_storage_path_check" CHECK ((char_length(storage_path) >= 4))
);
CREATE TABLE IF NOT EXISTS public."justifications_versement" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_vehicule" integer NOT NULL,
  "jour_exploitation" date NOT NULL,
  "type" text NOT NULL,
  "motif" text,
  "montant_attendu" numeric,
  "montant_recu" numeric,
  "auto_genere" boolean DEFAULT false,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "justifications_versement_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."lignes_ecritures" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ecriture_id" uuid NOT NULL,
  "ordre" smallint NOT NULL,
  "compte_syscohada_code" text NOT NULL,
  "libelle" text,
  "debit" numeric(18,2) DEFAULT 0 NOT NULL,
  "credit" numeric(18,2) DEFAULT 0 NOT NULL,
  "lettrage" text,
  "lettrage_le" timestamp with time zone,
  "vehicule_id" integer,
  "chauffeur_id" integer,
  "client_id" integer,
  "apporteur_code" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "lignes_ecritures_pkey" PRIMARY KEY (id),
  CONSTRAINT "lignes_ecritures_check" CHECK ((((debit > (0)::numeric) AND (credit = (0)::numeric)) OR ((debit = (0)::numeric) AND (credit > (0)::numeric)))),
  CONSTRAINT "lignes_ecritures_credit_check" CHECK ((credit >= (0)::numeric)),
  CONSTRAINT "lignes_ecritures_debit_check" CHECK ((debit >= (0)::numeric))
);
CREATE TABLE IF NOT EXISTS public."operations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "compte_id" uuid,
  "caisse_id" uuid,
  "date_operation" date NOT NULL,
  "type" text NOT NULL,
  "montant" numeric(18,2) NOT NULL,
  "libelle" text NOT NULL,
  "reference_externe" text,
  "categorie_id" uuid,
  "vehicule_id" integer,
  "chauffeur_id" integer,
  "client_id" integer,
  "source" text DEFAULT 'manuel'::text NOT NULL,
  "source_ref" text,
  "statut" text DEFAULT 'valide'::text NOT NULL,
  "valide_le" timestamp with time zone,
  "valide_par" uuid,
  "ecriture_id" uuid,
  "exercice_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now(),
  "updated_by" uuid,
  "notes" text,
  "tiers_id" uuid,
  CONSTRAINT "operations_pkey" PRIMARY KEY (id),
  CONSTRAINT "operations_check" CHECK ((((compte_id IS NOT NULL) AND (caisse_id IS NULL)) OR ((compte_id IS NULL) AND (caisse_id IS NOT NULL)))),
  CONSTRAINT "operations_montant_check" CHECK ((montant > (0)::numeric)),
  CONSTRAINT "operations_source_check" CHECK ((source = ANY (ARRAY['manuel'::text, 'recette_wave'::text, 'depense_vehicule'::text, 'versement_client'::text, 'import_csv'::text, 'transfert_interne'::text, 'dotation_amort'::text]))),
  CONSTRAINT "operations_statut_check" CHECK ((statut = ANY (ARRAY['brouillon'::text, 'valide'::text, 'annule'::text]))),
  CONSTRAINT "operations_type_check" CHECK ((type = ANY (ARRAY['entree'::text, 'sortie'::text])))
);
CREATE TABLE IF NOT EXISTS public."parametres_module_compta" (
  "id" integer DEFAULT 1 NOT NULL,
  "mode_actif" text DEFAULT 'simple'::text NOT NULL,
  "premier_login_effectue" boolean DEFAULT false NOT NULL,
  "workflow_validation_actif" boolean DEFAULT false NOT NULL,
  "exercice_courant_id" uuid,
  "date_demarrage_module" date DEFAULT '2026-02-09'::date NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  "updated_by" uuid,
  "numerotation_auto" boolean DEFAULT true NOT NULL,
  "journal_par_defaut" text DEFAULT 'OD'::text,
  "raison_sociale" text,
  "numero_rccm" text,
  "numero_contribuable" text,
  "adresse_fiscale" text,
  "telephone" text,
  "email_comptable" text,
  CONSTRAINT "parametres_module_compta_pkey" PRIMARY KEY (id),
  CONSTRAINT "parametres_module_compta_adresse_fiscale_check" CHECK (((adresse_fiscale IS NULL) OR (char_length(adresse_fiscale) <= 500))),
  CONSTRAINT "parametres_module_compta_email_comptable_check" CHECK (((email_comptable IS NULL) OR (email_comptable ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
  CONSTRAINT "parametres_module_compta_id_check" CHECK ((id = 1)),
  CONSTRAINT "parametres_module_compta_mode_actif_check" CHECK ((mode_actif = ANY (ARRAY['simple'::text, 'avance'::text]))),
  CONSTRAINT "parametres_module_compta_numero_contribuable_check" CHECK (((numero_contribuable IS NULL) OR (char_length(numero_contribuable) <= 50))),
  CONSTRAINT "parametres_module_compta_numero_rccm_check" CHECK (((numero_rccm IS NULL) OR (char_length(numero_rccm) <= 50))),
  CONSTRAINT "parametres_module_compta_telephone_check" CHECK (((telephone IS NULL) OR (char_length(telephone) <= 30)))
);
CREATE TABLE IF NOT EXISTS public."pieces_justificatives" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" uuid,
  "transfert_id" uuid,
  "url" text NOT NULL,
  "nom_fichier" text NOT NULL,
  "type_mime" text,
  "taille_octets" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  CONSTRAINT "pieces_justificatives_pkey" PRIMARY KEY (id),
  CONSTRAINT "pieces_justificatives_check" CHECK (((operation_id IS NOT NULL) OR (transfert_id IS NOT NULL)))
);
CREATE TABLE IF NOT EXISTS public."profiles" (
  "id" uuid NOT NULL,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "role" text DEFAULT 'dispatcher'::text,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."recettes_wave" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "id_recette" bigint,
  "Horodatage" timestamp without time zone,
  "Identifiant de transaction" text,
  "Type de transaction" text,
  "Montant net" numeric,
  "Montant brut" numeric,
  "Frais" numeric,
  "Solde" numeric,
  "Devise" text,
  "Nom de contrepartie" text,
  "Numéro de téléphone de contrepartie" text,
  "Nom d'utilisateur" text,
  "Numéro de téléphone d'utilisateur" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "date_paiement" date,
  "telephone_chauffeur" text,
  "date_travail" date,
  CONSTRAINT "recettes_wave_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."records_flotte" (
  "id" integer DEFAULT nextval('records_flotte_id_seq'::regclass) NOT NULL,
  "type_record" text NOT NULL,
  "valeur" numeric NOT NULL,
  "date_record" date NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "records_flotte_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."role_permissions" (
  "id" bigint DEFAULT nextval('role_permissions_id_seq'::regclass) NOT NULL,
  "role" text NOT NULL,
  "action" text NOT NULL,
  "allowed" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY (id),
  CONSTRAINT "role_permissions_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'dispatcher'::text])))
);
CREATE TABLE IF NOT EXISTS public."societe_parametres" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nom_commercial" text NOT NULL,
  "raison_sociale" text NOT NULL,
  "forme_juridique" text,
  "adresse" text,
  "telephone" text,
  "email" text,
  "site_web" text,
  "rccm" text,
  "numero_cc" text,
  "capital_social" bigint,
  "regime_fiscal" text,
  "nif" text,
  "code_naf" text,
  "logo_storage_path" text,
  "exercice_debut_jj_mm" text DEFAULT '01-01'::text NOT NULL,
  "exercice_fin_jj_mm" text DEFAULT '12-31'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "methodes_comptables" text,
  "engagements_hors_bilan" text,
  "methode_amortissement" text DEFAULT 'lineaire'::text NOT NULL,
  "methode_stocks" text DEFAULT 'fifo'::text NOT NULL,
  CONSTRAINT "societe_parametres_pkey" PRIMARY KEY (id),
  CONSTRAINT "societe_parametres_adresse_check" CHECK (((adresse IS NULL) OR (char_length(adresse) <= 500))),
  CONSTRAINT "societe_parametres_capital_social_check" CHECK (((capital_social IS NULL) OR (capital_social >= 0))),
  CONSTRAINT "societe_parametres_code_naf_check" CHECK (((code_naf IS NULL) OR (char_length(code_naf) <= 30))),
  CONSTRAINT "societe_parametres_email_check" CHECK (((email IS NULL) OR (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
  CONSTRAINT "societe_parametres_exercice_debut_jj_mm_check" CHECK ((exercice_debut_jj_mm ~ '^\d{2}-\d{2}$'::text)),
  CONSTRAINT "societe_parametres_exercice_fin_jj_mm_check" CHECK ((exercice_fin_jj_mm ~ '^\d{2}-\d{2}$'::text)),
  CONSTRAINT "societe_parametres_forme_juridique_check" CHECK (((forme_juridique IS NULL) OR (forme_juridique = ANY (ARRAY['SARL'::text, 'SA'::text, 'SAS'::text, 'SASU'::text, 'EI'::text, 'SCI'::text, 'SCS'::text, 'SNC'::text, 'GIE'::text, 'autre'::text])))),
  CONSTRAINT "societe_parametres_logo_storage_path_check" CHECK (((logo_storage_path IS NULL) OR (char_length(logo_storage_path) <= 400))),
  CONSTRAINT "societe_parametres_methode_amortissement_check" CHECK ((methode_amortissement = ANY (ARRAY['lineaire'::text, 'degressif'::text]))),
  CONSTRAINT "societe_parametres_methode_stocks_check" CHECK ((methode_stocks = ANY (ARRAY['fifo'::text, 'cmp'::text, 'lifo'::text]))),
  CONSTRAINT "societe_parametres_nif_check" CHECK (((nif IS NULL) OR (char_length(nif) <= 60))),
  CONSTRAINT "societe_parametres_nom_commercial_check" CHECK ((char_length(TRIM(BOTH FROM nom_commercial)) >= 2)),
  CONSTRAINT "societe_parametres_numero_cc_check" CHECK (((numero_cc IS NULL) OR (char_length(numero_cc) <= 60))),
  CONSTRAINT "societe_parametres_raison_sociale_check" CHECK ((char_length(TRIM(BOTH FROM raison_sociale)) >= 2)),
  CONSTRAINT "societe_parametres_rccm_check" CHECK (((rccm IS NULL) OR (char_length(rccm) <= 60))),
  CONSTRAINT "societe_parametres_regime_fiscal_check" CHECK (((regime_fiscal IS NULL) OR (regime_fiscal = ANY (ARRAY['tva_assujetti'::text, 'non_assujetti'::text])))),
  CONSTRAINT "societe_parametres_site_web_check" CHECK (((site_web IS NULL) OR (char_length(site_web) <= 200))),
  CONSTRAINT "societe_parametres_telephone_check" CHECK (((telephone IS NULL) OR (char_length(telephone) <= 30)))
);
CREATE TABLE IF NOT EXISTS public."taches_suivi" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_vehicule" integer,
  "immatriculation" text NOT NULL,
  "description" text NOT NULL,
  "fait" boolean DEFAULT false,
  "id_entretien" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "fait_at" timestamp with time zone,
  CONSTRAINT "taches_suivi_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."tiers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nom" text NOT NULL,
  "type" text NOT NULL,
  "telephone" text,
  "email" text,
  "adresse" text,
  "raison_sociale" text,
  "numero_rccm" text,
  "numero_contribuable" text,
  "compte_syscohada_parent" text NOT NULL,
  "compte_syscohada_suffix" text,
  "compte_syscohada_code" text GENERATED ALWAYS AS (
CASE
    WHEN ((compte_syscohada_suffix IS NULL) OR (compte_syscohada_suffix = ''::text)) THEN compte_syscohada_parent
    ELSE ((compte_syscohada_parent || '-'::text) || compte_syscohada_suffix)
END) STORED,
  "actif" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  CONSTRAINT "tiers_pkey" PRIMARY KEY (id),
  CONSTRAINT "tiers_adresse_check" CHECK (((adresse IS NULL) OR (char_length(adresse) <= 500))),
  CONSTRAINT "tiers_compte_syscohada_parent_check" CHECK ((char_length(compte_syscohada_parent) >= 2)),
  CONSTRAINT "tiers_compte_syscohada_suffix_check" CHECK (((compte_syscohada_suffix IS NULL) OR (char_length(compte_syscohada_suffix) <= 8))),
  CONSTRAINT "tiers_email_check" CHECK (((email IS NULL) OR (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
  CONSTRAINT "tiers_nom_check" CHECK ((char_length(TRIM(BOTH FROM nom)) >= 2)),
  CONSTRAINT "tiers_notes_check" CHECK (((notes IS NULL) OR (char_length(notes) <= 4000))),
  CONSTRAINT "tiers_numero_contribuable_check" CHECK (((numero_contribuable IS NULL) OR (char_length(numero_contribuable) <= 60))),
  CONSTRAINT "tiers_numero_rccm_check" CHECK (((numero_rccm IS NULL) OR (char_length(numero_rccm) <= 60))),
  CONSTRAINT "tiers_raison_sociale_check" CHECK (((raison_sociale IS NULL) OR (char_length(raison_sociale) <= 200))),
  CONSTRAINT "tiers_telephone_check" CHECK (((telephone IS NULL) OR (char_length(telephone) <= 30))),
  CONSTRAINT "tiers_type_check" CHECK ((type = ANY (ARRAY['client'::text, 'fournisseur'::text, 'salarie'::text, 'autre'::text])))
);
CREATE TABLE IF NOT EXISTS public."transferts_internes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date_transfert" date NOT NULL,
  "montant" numeric(18,2) NOT NULL,
  "libelle" text NOT NULL,
  "source_compte_id" uuid,
  "source_caisse_id" uuid,
  "dest_compte_id" uuid,
  "dest_caisse_id" uuid,
  "operation_sortie_id" uuid,
  "operation_entree_id" uuid,
  "ecriture_id" uuid,
  "exercice_id" uuid NOT NULL,
  "statut" text DEFAULT 'valide'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "notes" text,
  CONSTRAINT "transferts_internes_pkey" PRIMARY KEY (id),
  CONSTRAINT "chk_transfert_source_dest_different" CHECK (((NOT ((source_caisse_id IS NOT NULL) AND (source_caisse_id = dest_caisse_id))) AND (NOT ((source_compte_id IS NOT NULL) AND (source_compte_id = dest_compte_id))))),
  CONSTRAINT "transferts_internes_check" CHECK (((source_compte_id IS NOT NULL) <> (source_caisse_id IS NOT NULL))),
  CONSTRAINT "transferts_internes_check1" CHECK (((dest_compte_id IS NOT NULL) <> (dest_caisse_id IS NOT NULL))),
  CONSTRAINT "transferts_internes_montant_check" CHECK ((montant > (0)::numeric)),
  CONSTRAINT "transferts_internes_statut_check" CHECK ((statut = ANY (ARRAY['brouillon'::text, 'valide'::text, 'annule'::text])))
);
CREATE TABLE IF NOT EXISTS public."vehicules" (
  "id_vehicule" integer DEFAULT nextval('vehicules_id_vehicule_seq'::regclass) NOT NULL,
  "immatriculation" text,
  "type_vehicule" text,
  "proprietaire" text,
  "statut" text,
  "montant de la recette" numeric,
  "km_actuel" integer,
  "km_derniere_vidange" integer,
  "date_derniers_pneus" date,
  "date_assurance" date,
  "date_expiration_assurance" date,
  "date_visite_technique" date,
  "date_expiration_visite" date,
  "photo" text,
  "carte_grise_recto" text,
  "carte_grise_verso" text,
  "sous_gestion" boolean DEFAULT false,
  "montant_mensuel_client" integer DEFAULT 0,
  "id_client" integer,
  "date_carte_stationnement" date,
  "date_expiration_carte_stationnement" date,
  "date_patente" date,
  "date_expiration_patente" date,
  "montant_recette_jour" numeric DEFAULT 0,
  "valeur_acquisition_client" numeric(15,2),
  CONSTRAINT "vehicules_pkey" PRIMARY KEY (id_vehicule)
);
CREATE TABLE IF NOT EXISTS public."versement_attribution" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_recette" bigint,
  "id_vehicule" integer,
  "jour_exploitation" date NOT NULL,
  "montant_attribue" numeric NOT NULL,
  "type_attribution" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "versement_attribution_pkey" PRIMARY KEY (id),
  CONSTRAINT "versement_attribution_type_attribution_check" CHECK ((type_attribution = ANY (ARRAY['normal'::text, 'jour_meme'::text, 'split_2j'::text, 'retard'::text])))
);
CREATE TABLE IF NOT EXISTS public."versements_chauffeurs" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "date_versement" date,
  "id_chauffeur" integer,
  "id_vehicule" integer,
  "montant" numeric,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "versements_chauffeurs_pkey" PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public."versements_clients" (
  "id" integer DEFAULT nextval('versements_clients_id_seq'::regclass) NOT NULL,
  "id_client" integer NOT NULL,
  "mois" character varying(7) NOT NULL,
  "montant" numeric(12,0) NOT NULL,
  "date_versement" date DEFAULT CURRENT_DATE NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "caisse_id" uuid,
  "compte_id" uuid,
  CONSTRAINT "versements_clients_pkey" PRIMARY KEY (id),
  CONSTRAINT "versements_clients_caisse_compte_xor" CHECK ((((caisse_id IS NULL) AND (compte_id IS NULL)) OR ((caisse_id IS NOT NULL) AND (compte_id IS NULL)) OR ((caisse_id IS NULL) AND (compte_id IS NOT NULL))))
);
CREATE TABLE IF NOT EXISTS public."wave_fr" (
  "Devise" text,
  "Frais" text,
  "Horodatage" text,
  "Identifiant de transaction" text,
  "Montant brut" text,
  "Montant net" text,
  "Nom d'utilisateur" text,
  "Nom de contrepartie" text,
  "Numéro de téléphone d'utilisateur" text,
  "Numéro de téléphone de contrepartie" text,
  "Solde" text,
  "Type de transaction" text
);

-- ── 5. INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_chat ON public.agent_conversations USING btree (telegram_chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_insights_created_at_idx ON public.ai_insights USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertes_expiration ON public.alertes_envoyees USING btree (date_expiration) WHERE (statut <> 'ignoree'::text);
CREATE INDEX IF NOT EXISTS idx_alertes_type_cible ON public.alertes_envoyees USING btree (type_alerte, cible, date_envoi DESC);
CREATE INDEX IF NOT EXISTS idx_boyahbot_memory_session ON public.boyahbot_memory USING btree (session_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS categories_operations_libelle_unique ON public.categories_operations USING btree (libelle);
CREATE INDEX IF NOT EXISTS idx_yango_snapshot_driver_id ON public.chauffeurs_yango_snapshot USING btree (yango_driver_id);
CREATE INDEX IF NOT EXISTS idx_clients_actif ON public.clients USING btree (actif) WHERE (actif = true);
CREATE INDEX IF NOT EXISTS idx_clients_tiers_id ON public.clients USING btree (tiers_id) WHERE (tiers_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_clients_documents_id_client ON public.clients_documents USING btree (id_client, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_documents_type ON public.clients_documents USING btree (type) WHERE (type IS NOT NULL);
CREATE INDEX IF NOT EXISTS commandes_yango_created_at_idx ON public.commandes_yango USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS commandes_yango_ended_at_idx ON public.commandes_yango USING btree (ended_at DESC);
CREATE INDEX IF NOT EXISTS commandes_yango_status_idx ON public.commandes_yango USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ecritures_auto ON public.ecritures_comptables USING btree (exercice_id, auto_generation_type) WHERE (auto_generated = true);
CREATE INDEX IF NOT EXISTS idx_ecritures_date ON public.ecritures_comptables USING btree (date_ecriture);
CREATE INDEX IF NOT EXISTS idx_ecritures_exercice ON public.ecritures_comptables USING btree (exercice_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_extourne_de ON public.ecritures_comptables USING btree (extourne_de) WHERE (extourne_de IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ecritures_journal ON public.ecritures_comptables USING btree (journal_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecritures_numero ON public.ecritures_comptables USING btree (numero);
CREATE INDEX IF NOT EXISTS idx_entretiens_prochain ON public.entretiens USING btree (date_prochain);
CREATE INDEX IF NOT EXISTS idx_entretiens_vehicule ON public.entretiens USING btree (id_vehicule);
CREATE INDEX IF NOT EXISTS idx_ef_archives_exercice ON public.etats_financiers_archives USING btree (exercice_id, type_etat);
CREATE INDEX IF NOT EXISTS idx_ef_archives_genere_at ON public.etats_financiers_archives USING btree (genere_at DESC);
CREATE INDEX IF NOT EXISTS idx_ef_archives_uuid_short ON public.etats_financiers_archives USING btree ("substring"((uuid_externe)::text, 1, 12));
CREATE UNIQUE INDEX IF NOT EXISTS uq_ef_archives_uuid ON public.etats_financiers_archives USING btree (uuid_externe);
CREATE UNIQUE INDEX IF NOT EXISTS uk_exercices_annee ON public.exercices USING btree (annee);
CREATE INDEX IF NOT EXISTS idx_justificatifs_operation_active ON public.justificatifs USING btree (operation_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_justificatifs_operation_all ON public.justificatifs USING btree (operation_id);
CREATE INDEX IF NOT EXISTS idx_justificatifs_uploaded_by ON public.justificatifs USING btree (uploaded_by) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_lignes_compte ON public.lignes_ecritures USING btree (compte_syscohada_code);
CREATE INDEX IF NOT EXISTS idx_lignes_ecriture ON public.lignes_ecritures USING btree (ecriture_id);
CREATE INDEX IF NOT EXISTS idx_lignes_lettrage ON public.lignes_ecritures USING btree (compte_syscohada_code, lettrage) WHERE (lettrage IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_operations_caisse ON public.operations USING btree (caisse_id);
CREATE INDEX IF NOT EXISTS idx_operations_categorie ON public.operations USING btree (categorie_id);
CREATE INDEX IF NOT EXISTS idx_operations_compte ON public.operations USING btree (compte_id);
CREATE INDEX IF NOT EXISTS idx_operations_date ON public.operations USING btree (date_operation);
CREATE INDEX IF NOT EXISTS idx_operations_exercice ON public.operations USING btree (exercice_id);
CREATE INDEX IF NOT EXISTS idx_operations_source ON public.operations USING btree (source, source_ref);
CREATE INDEX IF NOT EXISTS idx_operations_statut ON public.operations USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_operations_tiers ON public.operations USING btree (tiers_id) WHERE (tiers_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS operations_source_source_ref_unique ON public.operations USING btree (source, source_ref) WHERE ((source <> 'transfert_interne'::text) AND (source_ref IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_pieces_operation ON public.pieces_justificatives USING btree (operation_id);
CREATE INDEX IF NOT EXISTS idx_pieces_transfert ON public.pieces_justificatives USING btree (transfert_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_societe_parametres_singleton ON public.societe_parametres USING btree ((true));
CREATE INDEX IF NOT EXISTS idx_taches_fait ON public.taches_suivi USING btree (fait);
CREATE INDEX IF NOT EXISTS idx_taches_vehicule ON public.taches_suivi USING btree (id_vehicule);
CREATE INDEX IF NOT EXISTS idx_tiers_actif ON public.tiers USING btree (actif);
CREATE INDEX IF NOT EXISTS idx_tiers_contribuable ON public.tiers USING btree (numero_contribuable) WHERE (numero_contribuable IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tiers_nom_gin ON public.tiers USING gin (to_tsvector('french'::regconfig, COALESCE(nom, ''::text)));
CREATE INDEX IF NOT EXISTS idx_tiers_nom_lower ON public.tiers USING btree (lower(nom));
CREATE INDEX IF NOT EXISTS idx_tiers_rccm ON public.tiers USING btree (numero_rccm) WHERE (numero_rccm IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tiers_syscohada ON public.tiers USING btree (compte_syscohada_code);
CREATE INDEX IF NOT EXISTS idx_tiers_telephone ON public.tiers USING btree (telephone) WHERE (telephone IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tiers_type ON public.tiers USING btree (type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiers_syscohada_actif ON public.tiers USING btree (compte_syscohada_code) WHERE (actif = true);
CREATE INDEX IF NOT EXISTS idx_transferts_date ON public.transferts_internes USING btree (date_transfert DESC);
CREATE INDEX IF NOT EXISTS idx_transferts_dest_caisse ON public.transferts_internes USING btree (dest_caisse_id);
CREATE INDEX IF NOT EXISTS idx_transferts_dest_compte ON public.transferts_internes USING btree (dest_compte_id);
CREATE INDEX IF NOT EXISTS idx_transferts_source_caisse ON public.transferts_internes USING btree (source_caisse_id);
CREATE INDEX IF NOT EXISTS idx_transferts_source_compte ON public.transferts_internes USING btree (source_compte_id);
CREATE INDEX IF NOT EXISTS idx_transferts_statut ON public.transferts_internes USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_va_jour ON public.versement_attribution USING btree (jour_exploitation);
CREATE INDEX IF NOT EXISTS idx_va_vehicule_jour ON public.versement_attribution USING btree (id_vehicule, jour_exploitation);

-- ── 6. UNIQUE CONSTRAINTS ──────────────────────────────────
ALTER TABLE public."agent_memory" ADD CONSTRAINT "agent_memory_cle_key" UNIQUE (cle);
ALTER TABLE public."bilan_mapping" ADD CONSTRAINT "bilan_mapping_classe_compte_key" UNIQUE (classe_compte);
ALTER TABLE public."chauffeurs_yango_snapshot" ADD CONSTRAINT "chauffeurs_yango_snapshot_yango_driver_id_key" UNIQUE (yango_driver_id);
ALTER TABLE public."clients_documents" ADD CONSTRAINT "uniq_clients_documents_path" UNIQUE (storage_path);
ALTER TABLE public."clotures" ADD CONSTRAINT "clotures_exercice_id_type_periode_key" UNIQUE (exercice_id, type, periode);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_extourne_de_unique" UNIQUE (extourne_de);
ALTER TABLE public."journaux" ADD CONSTRAINT "journaux_code_key" UNIQUE (code);
ALTER TABLE public."justifications_versement" ADD CONSTRAINT "justifications_versement_id_vehicule_jour_exploitation_key" UNIQUE (id_vehicule, jour_exploitation);
ALTER TABLE public."recettes_wave" ADD CONSTRAINT "recettes_wave_Identifiant de transaction_key" UNIQUE ("Identifiant de transaction");
ALTER TABLE public."records_flotte" ADD CONSTRAINT "records_flotte_type_record_key" UNIQUE (type_record);
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_role_action_key" UNIQUE (role, action);
ALTER TABLE public."versements_clients" ADD CONSTRAINT "versements_clients_id_client_mois_key" UNIQUE (id_client, mois);
ALTER TABLE public."wave_fr" ADD CONSTRAINT "wave_fr_tx_id_unique" UNIQUE ("Identifiant de transaction");

-- ── 7. FOREIGN KEYS ────────────────────────────────────────
ALTER TABLE public."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE public."affectation_chauffeurs_vehicules" ADD CONSTRAINT "affectation_chauffeurs_vehicules_id_chauffeur_fkey" FOREIGN KEY (id_chauffeur) REFERENCES chauffeurs(id_chauffeur);
ALTER TABLE public."affectation_chauffeurs_vehicules" ADD CONSTRAINT "affectation_chauffeurs_vehicules_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule);
ALTER TABLE public."caisses" ADD CONSTRAINT "caisses_archive_par_fkey" FOREIGN KEY (archive_par) REFERENCES auth.users(id);
ALTER TABLE public."caisses" ADD CONSTRAINT "caisses_compte_syscohada_code_fkey" FOREIGN KEY (compte_syscohada_code) REFERENCES comptes_syscohada(code);
ALTER TABLE public."caisses" ADD CONSTRAINT "caisses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."caisses" ADD CONSTRAINT "caisses_responsable_id_fkey" FOREIGN KEY (responsable_id) REFERENCES auth.users(id);
ALTER TABLE public."categories_operations" ADD CONSTRAINT "categories_operations_compte_syscohada_code_fkey" FOREIGN KEY (compte_syscohada_code) REFERENCES comptes_syscohada(code);
ALTER TABLE public."categories_operations" ADD CONSTRAINT "categories_operations_journal_par_defaut_fkey" FOREIGN KEY (journal_par_defaut) REFERENCES journaux(code);
ALTER TABLE public."clients" ADD CONSTRAINT "clients_tiers_id_fkey" FOREIGN KEY (tiers_id) REFERENCES tiers(id) ON DELETE SET NULL;
ALTER TABLE public."clients_documents" ADD CONSTRAINT "clients_documents_id_client_fkey" FOREIGN KEY (id_client) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public."clients_documents" ADD CONSTRAINT "clients_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."clotures" ADD CONSTRAINT "clotures_cloture_par_fkey" FOREIGN KEY (cloture_par) REFERENCES auth.users(id);
ALTER TABLE public."clotures" ADD CONSTRAINT "clotures_exercice_id_fkey" FOREIGN KEY (exercice_id) REFERENCES exercices(id);
ALTER TABLE public."comptes" ADD CONSTRAINT "comptes_archive_par_fkey" FOREIGN KEY (archive_par) REFERENCES auth.users(id);
ALTER TABLE public."comptes" ADD CONSTRAINT "comptes_compte_syscohada_code_fkey" FOREIGN KEY (compte_syscohada_code) REFERENCES comptes_syscohada(code);
ALTER TABLE public."comptes" ADD CONSTRAINT "comptes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."comptes_syscohada" ADD CONSTRAINT "comptes_syscohada_parent_code_fkey" FOREIGN KEY (parent_code) REFERENCES comptes_syscohada(code);
ALTER TABLE public."depenses_vehicules" ADD CONSTRAINT "depenses_vehicules_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_exercice_id_fkey" FOREIGN KEY (exercice_id) REFERENCES exercices(id);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_extourne_de_fkey" FOREIGN KEY (extourne_de) REFERENCES ecritures_comptables(id) ON DELETE SET NULL;
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_journal_code_fkey" FOREIGN KEY (journal_code) REFERENCES journaux(code);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES operations(id);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_transfert_id_fkey" FOREIGN KEY (transfert_id) REFERENCES transferts_internes(id);
ALTER TABLE public."ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_valide_par_fkey" FOREIGN KEY (valide_par) REFERENCES auth.users(id);
ALTER TABLE public."entretiens" ADD CONSTRAINT "entretiens_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."etats_financiers_archives" ADD CONSTRAINT "etats_financiers_archives_exercice_id_fkey" FOREIGN KEY (exercice_id) REFERENCES exercices(id) ON DELETE CASCADE;
ALTER TABLE public."etats_financiers_archives" ADD CONSTRAINT "etats_financiers_archives_genere_par_fkey" FOREIGN KEY (genere_par) REFERENCES auth.users(id);
ALTER TABLE public."exercices" ADD CONSTRAINT "exercices_cloture_par_fkey" FOREIGN KEY (cloture_par) REFERENCES auth.users(id);
ALTER TABLE public."justificatifs" ADD CONSTRAINT "justificatifs_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
ALTER TABLE public."justificatifs" ADD CONSTRAINT "justificatifs_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE;
ALTER TABLE public."justificatifs" ADD CONSTRAINT "justificatifs_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
ALTER TABLE public."justifications_versement" ADD CONSTRAINT "justifications_versement_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."lignes_ecritures" ADD CONSTRAINT "lignes_ecritures_compte_syscohada_code_fkey" FOREIGN KEY (compte_syscohada_code) REFERENCES comptes_syscohada(code);
ALTER TABLE public."lignes_ecritures" ADD CONSTRAINT "lignes_ecritures_ecriture_id_fkey" FOREIGN KEY (ecriture_id) REFERENCES ecritures_comptables(id) ON DELETE CASCADE;
ALTER TABLE public."operations" ADD CONSTRAINT "fk_operation_ecriture" FOREIGN KEY (ecriture_id) REFERENCES ecritures_comptables(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_caisse_id_fkey" FOREIGN KEY (caisse_id) REFERENCES caisses(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_categorie_id_fkey" FOREIGN KEY (categorie_id) REFERENCES categories_operations(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_compte_id_fkey" FOREIGN KEY (compte_id) REFERENCES comptes(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_exercice_id_fkey" FOREIGN KEY (exercice_id) REFERENCES exercices(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_tiers_id_fkey" FOREIGN KEY (tiers_id) REFERENCES tiers(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."operations" ADD CONSTRAINT "operations_valide_par_fkey" FOREIGN KEY (valide_par) REFERENCES auth.users(id);
ALTER TABLE public."parametres_module_compta" ADD CONSTRAINT "parametres_module_compta_journal_par_defaut_fkey" FOREIGN KEY (journal_par_defaut) REFERENCES journaux(code);
ALTER TABLE public."parametres_module_compta" ADD CONSTRAINT "parametres_module_compta_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."pieces_justificatives" ADD CONSTRAINT "pieces_justificatives_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."pieces_justificatives" ADD CONSTRAINT "pieces_justificatives_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE;
ALTER TABLE public."pieces_justificatives" ADD CONSTRAINT "pieces_justificatives_transfert_id_fkey" FOREIGN KEY (transfert_id) REFERENCES transferts_internes(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."societe_parametres" ADD CONSTRAINT "societe_parametres_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."taches_suivi" ADD CONSTRAINT "taches_suivi_id_entretien_fkey" FOREIGN KEY (id_entretien) REFERENCES entretiens(id) ON DELETE SET NULL;
ALTER TABLE public."taches_suivi" ADD CONSTRAINT "taches_suivi_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."tiers" ADD CONSTRAINT "tiers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."tiers" ADD CONSTRAINT "tiers_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "fk_transfert_ecriture" FOREIGN KEY (ecriture_id) REFERENCES ecritures_comptables(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_dest_caisse_id_fkey" FOREIGN KEY (dest_caisse_id) REFERENCES caisses(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_dest_compte_id_fkey" FOREIGN KEY (dest_compte_id) REFERENCES comptes(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_exercice_id_fkey" FOREIGN KEY (exercice_id) REFERENCES exercices(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_operation_entree_id_fkey" FOREIGN KEY (operation_entree_id) REFERENCES operations(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_operation_sortie_id_fkey" FOREIGN KEY (operation_sortie_id) REFERENCES operations(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_source_caisse_id_fkey" FOREIGN KEY (source_caisse_id) REFERENCES caisses(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_source_compte_id_fkey" FOREIGN KEY (source_compte_id) REFERENCES comptes(id);
ALTER TABLE public."transferts_internes" ADD CONSTRAINT "transferts_internes_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."vehicules" ADD CONSTRAINT "vehicules_id_client_fkey" FOREIGN KEY (id_client) REFERENCES clients(id);
ALTER TABLE public."versement_attribution" ADD CONSTRAINT "versement_attribution_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."versements_clients" ADD CONSTRAINT "versements_clients_caisse_id_fkey" FOREIGN KEY (caisse_id) REFERENCES caisses(id);
ALTER TABLE public."versements_clients" ADD CONSTRAINT "versements_clients_compte_id_fkey" FOREIGN KEY (compte_id) REFERENCES comptes(id);
ALTER TABLE public."versements_clients" ADD CONSTRAINT "versements_clients_id_client_fkey" FOREIGN KEY (id_client) REFERENCES clients(id) ON DELETE CASCADE;

-- ── 8. FONCTIONS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ajuster_resultat_exercice(p_exercice_id uuid, p_force_recalcul boolean DEFAULT false)
 RETURNS TABLE(ecriture_id uuid, resultat_net bigint, type_montant text, numero text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_statut          TEXT;
  v_date_fin        DATE;
  v_resultat_net    BIGINT;
  v_resultat_abs    BIGINT;
  v_ecriture_id     UUID;
  v_numero          TEXT;
  v_type_montant    TEXT;
  v_total_produits  BIGINT;
  v_total_charges   BIGINT;
  v_total_hao_pr    BIGINT;
  v_total_hao_ch    BIGINT;
  v_total_impots    BIGINT;
BEGIN
  -- 1. Charger statut + date_fin
  SELECT statut, date_fin INTO v_statut, v_date_fin
    FROM public.exercices
   WHERE id = p_exercice_id;

  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Exercice introuvable : %', p_exercice_id;
  END IF;

  IF v_statut = 'clos' AND NOT p_force_recalcul THEN
    RAISE EXCEPTION 'Exercice clos : recalcul interdit (passer p_force_recalcul := TRUE)';
  END IF;

  -- 2. Activer le bypass de trigger si force_recalcul (exercice clos)
  IF p_force_recalcul THEN
    PERFORM set_config('compta.auto_recalcul_allowed', 'true', true);
  END IF;

  -- 3. Calcul résultat net via lignes_ecritures des opérations validées
  --    Formule : Σ produits (7x sauf 84) − Σ charges (6x sauf 83/87/89)
  --            + Σ HAO produits (84) − Σ HAO charges (83) − Σ impôts (87 + 89)
  SELECT
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '7%'
        AND compte_syscohada_code NOT LIKE '84%'
      THEN credit - debit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '6%'
        AND compte_syscohada_code NOT LIKE '83%'
        AND compte_syscohada_code NOT LIKE '87%'
        AND compte_syscohada_code NOT LIKE '89%'
      THEN debit - credit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '84%'
      THEN credit - debit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '83%'
      THEN debit - credit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '87%'
        OR compte_syscohada_code LIKE '89%'
      THEN debit - credit ELSE 0 END), 0)
  INTO v_total_produits, v_total_charges, v_total_hao_pr, v_total_hao_ch, v_total_impots
  FROM public.lignes_ecritures le
  JOIN public.ecritures_comptables ec ON ec.id = le.ecriture_id
  WHERE ec.exercice_id = p_exercice_id
    AND ec.statut = 'valide'
    AND ec.auto_generated = FALSE;   -- ✦ exclure l'éventuelle ancienne auto-écriture

  v_resultat_net := v_total_produits - v_total_charges + v_total_hao_pr - v_total_hao_ch - v_total_impots;

  IF v_resultat_net = 0 THEN
    v_type_montant := 'nul';
  ELSIF v_resultat_net > 0 THEN
    v_type_montant := 'benefice';
  ELSE
    v_type_montant := 'perte';
  END IF;

  -- 4. Supprimer ancienne auto-écriture (cascade sur lignes_ecritures)
  DELETE FROM public.ecritures_comptables
    WHERE exercice_id = p_exercice_id
      AND auto_generated = TRUE
      AND auto_generation_type = 'resultat_exercice';

  -- 5. Si résultat = 0, on s'arrête là — pas d'écriture à créer
  IF v_resultat_net = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0::BIGINT, 'nul'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  v_resultat_abs := ABS(v_resultat_net);

  -- 6. Créer la nouvelle écriture (journal OD, date = date_fin exercice)
  v_numero := 'AUTO-RES-' || to_char(v_date_fin, 'YYYY') || '-' || substring(p_exercice_id::text, 1, 8);

  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle,
    exercice_id, statut, source_manuelle,
    auto_generated, auto_generation_type
  ) VALUES (
    v_numero, v_date_fin, 'OD', 'Ajustement automatique résultat exercice — ' || v_type_montant,
    p_exercice_id, 'valide', FALSE,
    TRUE, 'resultat_exercice'
  )
  RETURNING id INTO v_ecriture_id;

  -- 7. Lignes — partie double
  IF v_type_montant = 'benefice' THEN
    -- DEBIT 891 / CREDIT 130
    INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
    VALUES
      (v_ecriture_id, 1, '891', 'Détermination du résultat (bénéfice)', v_resultat_abs, 0),
      (v_ecriture_id, 2, '130', 'Résultat net de l''exercice : Bénéfice', 0, v_resultat_abs);
  ELSE
    -- v_type_montant = 'perte' : DEBIT 139 / CREDIT 891
    INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
    VALUES
      (v_ecriture_id, 1, '139', 'Résultat net de l''exercice : Perte',  v_resultat_abs, 0),
      (v_ecriture_id, 2, '891', 'Détermination du résultat (perte)',   0, v_resultat_abs);
  END IF;

  -- 8. Désactiver le bypass (LOCAL : auto-revert en fin de transaction)
  IF p_force_recalcul THEN
    PERFORM set_config('compta.auto_recalcul_allowed', 'false', true);
  END IF;

  RETURN QUERY SELECT v_ecriture_id, v_resultat_net, v_type_montant, v_numero;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cascade_operation_to_versement_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mois        TEXT;
  v_id_int      INTEGER;
BEGIN
  -- Skip si pas une operation de type versement client
  IF NEW.source IS DISTINCT FROM 'versement_client' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type IS DISTINCT FROM 'sortie' THEN RETURN NEW; END IF;
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN RETURN NEW; END IF;

  -- Anti-recursion : si source_ref pointe vers un versement existant, skip
  -- (cas typique : Flux A vient de creer cette op apres avoir cree le versement)
  IF NEW.source_ref IS NOT NULL THEN
    BEGIN
      v_id_int := NEW.source_ref::INTEGER;
      IF EXISTS (SELECT 1 FROM public.versements_clients WHERE id = v_id_int) THEN
        RETURN NEW;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- source_ref non parsable en integer : c'est une insertion manuelle
      -- avec une ref textuelle, on continue avec le rattrapage
      NULL;
    END;
  END IF;

  -- Extraction du mois depuis le libelle (format conventionnel
  -- 'Reversement client (mois YYYY-MM)') ou fallback sur date_operation
  v_mois := SUBSTRING(NEW.libelle FROM 'mois (\d{4}-\d{2})');
  IF v_mois IS NULL OR LENGTH(v_mois) <> 7 THEN
    v_mois := to_char(NEW.date_operation, 'YYYY-MM');
  END IF;

  -- Skip si un versement existe deja pour ce client + mois (autre garde)
  IF EXISTS (
    SELECT 1 FROM public.versements_clients
     WHERE id_client = NEW.client_id::INTEGER
       AND mois = v_mois
  ) THEN
    RETURN NEW;
  END IF;

  -- Creation du versement de rattrapage
  INSERT INTO public.versements_clients (
    id_client, mois, montant, date_versement, notes,
    caisse_id, compte_id
  ) VALUES (
    NEW.client_id::INTEGER,
    v_mois,
    NEW.montant,
    NEW.date_operation,
    'Rattrapage auto - cree depuis operation #' || NEW.id::text,
    NEW.caisse_id,
    NEW.compte_id
  )
  ON CONFLICT (id_client, mois) DO NOTHING;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cascade_recette_wave_to_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caisse_wave_id    UUID;
  v_categorie_id      UUID;
  v_exercice_id       UUID;
  v_date              DATE;
  v_id_tx             TEXT;
  v_montant_net       NUMERIC;
  v_montant_abs       NUMERIC;
  v_type_op           TEXT;
  v_libelle           TEXT;
  v_contrepartie      TEXT;
BEGIN
  v_id_tx := NULLIF(TRIM(COALESCE(NEW."Identifiant de transaction", '')), '');
  IF v_id_tx IS NULL THEN RETURN NEW; END IF;

  -- ANTI-RECURSION 26/05/2026 (Lot B audit) :
  -- Si l'ID commence par 'op_', c'est une ligne sync depuis operations
  -- via trg_sync_operation_to_legacy. On NE doit PAS recréer une opération
  -- (sinon boucle infinie + doublon CA).
  IF v_id_tx LIKE 'op\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  v_montant_net := NEW."Montant net";
  IF v_montant_net IS NULL OR v_montant_net = 0 THEN RETURN NEW; END IF;

  IF v_montant_net > 0 THEN
    v_type_op := 'entree';
    v_montant_abs := v_montant_net;
  ELSE
    v_type_op := 'sortie';
    v_montant_abs := ABS(v_montant_net);
  END IF;

  BEGIN
    v_date := NEW."Horodatage"::DATE;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_date IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_caisse_wave_id FROM public.caisses
   WHERE libelle = 'Wave Boyah' LIMIT 1;
  IF v_caisse_wave_id IS NULL THEN RETURN NEW; END IF;

  IF v_type_op = 'entree' THEN
    SELECT id INTO v_categorie_id FROM public.categories_operations
     WHERE libelle = 'Versement quotidien chauffeur' LIMIT 1;
  ELSE
    SELECT id INTO v_categorie_id FROM public.categories_operations
     WHERE libelle = 'Sortie Wave - à reclasser' LIMIT 1;
  END IF;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= v_date AND date_fin >= v_date AND statut = 'ouvert' LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

  v_contrepartie := NULLIF(TRIM(COALESCE(NEW."Nom de contrepartie", '')), '');
  IF v_type_op = 'entree' THEN
    v_libelle := 'Recette Wave - ' || COALESCE(v_contrepartie, 'contrepartie inconnue');
  ELSE
    v_libelle := 'Sortie Wave - ' || COALESCE(v_contrepartie, 'Payout');
  END IF;
  IF LENGTH(v_libelle) > 255 THEN
    v_libelle := SUBSTRING(v_libelle FROM 1 FOR 255);
  END IF;

  INSERT INTO public.operations (
    caisse_id, compte_id, date_operation, type, montant, libelle,
    reference_externe, categorie_id, vehicule_id, chauffeur_id, client_id,
    source, source_ref, statut, valide_le, valide_par, exercice_id,
    created_by, updated_by
  ) VALUES (
    v_caisse_wave_id, NULL, v_date, v_type_op, v_montant_abs, v_libelle,
    v_id_tx, v_categorie_id, NULL, NULL, NULL,
    'recette_wave', v_id_tx, 'valide', NOW(), NULL, v_exercice_id,
    NULL, NULL
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cascade_versement_client_to_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_categorie_id UUID;
  v_exercice_id  UUID;
  v_caisse_id    UUID;
  v_compte_id    UUID;
  v_libelle      TEXT;
BEGIN
  -- Skip si donnees incompletes
  IF NEW.id_client IS NULL OR NEW.montant IS NULL OR NEW.montant <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.date_versement IS NULL THEN RETURN NEW; END IF;

  -- Anti-recursion : skip si l'operation existe deja
  IF EXISTS (
    SELECT 1 FROM public.operations
     WHERE source = 'versement_client'
       AND source_ref = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  -- Determination caisse / compte source
  v_caisse_id := NEW.caisse_id;
  v_compte_id := NEW.compte_id;
  -- Si aucun renseigne, fallback Wave Boyah
  IF v_caisse_id IS NULL AND v_compte_id IS NULL THEN
    SELECT id INTO v_caisse_id FROM public.caisses
     WHERE libelle = 'Wave Boyah' LIMIT 1;
    IF v_caisse_id IS NULL THEN RETURN NEW; END IF;
  END IF;

  -- Categorie Reversement client (compte 4119)
  SELECT id INTO v_categorie_id FROM public.categories_operations
   WHERE libelle = 'Reversement client sous gestion' LIMIT 1;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  -- Exercice ouvert
  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= NEW.date_versement
     AND date_fin   >= NEW.date_versement
     AND statut     = 'ouvert'
   LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

  -- Libelle parsable par le Flux B (format conventionnel)
  v_libelle := 'Reversement client (mois ' || COALESCE(NEW.mois, to_char(NEW.date_versement, 'YYYY-MM')) || ')';

  INSERT INTO public.operations (
    caisse_id, compte_id, date_operation, type, montant, libelle,
    reference_externe, categorie_id, vehicule_id, chauffeur_id, client_id,
    source, source_ref, statut, valide_le, valide_par, exercice_id,
    created_by, updated_by
  ) VALUES (
    v_caisse_id, v_compte_id, NEW.date_versement, 'sortie', NEW.montant, v_libelle,
    NEW.id::text, v_categorie_id, NULL, NULL, NEW.id_client,
    'versement_client', NEW.id::text, 'valide', NOW(), NULL, v_exercice_id,
    NULL, NULL
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.check_alerte_peut_envoyer(p_type_alerte text, p_cible text, p_gravite text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  derniere_envoi TIMESTAMPTZ;
  intervalle_min INTERVAL;
BEGIN
  -- Définir l'intervalle minimal selon la gravité
  intervalle_min := CASE p_gravite
    WHEN 'critique' THEN INTERVAL '6 hours'
    WHEN 'important' THEN INTERVAL '24 hours'
    WHEN 'opportunite' THEN INTERVAL '365 days'  -- jamais (1x seulement)
    ELSE INTERVAL '24 hours'
  END;

  -- Chercher la dernière alerte non ignorée du même type/cible
  SELECT MAX(date_envoi) INTO derniere_envoi
  FROM alertes_envoyees
  WHERE type_alerte = p_type_alerte
    AND (cible = p_cible OR (cible IS NULL AND p_cible IS NULL))
    AND statut != 'ignoree';

  -- Vérifier aussi les alertes récemment ignorées (blocage 24h)
  IF EXISTS (
    SELECT 1 FROM alertes_envoyees
    WHERE type_alerte = p_type_alerte
      AND (cible = p_cible OR (cible IS NULL AND p_cible IS NULL))
      AND statut = 'ignoree'
      AND date_traitement > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN FALSE;  -- Bloqué par ignorer
  END IF;

  -- Si jamais envoyée, autoriser
  IF derniere_envoi IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Si envoyée avant l'intervalle min, autoriser
  IF NOW() - derniere_envoi > intervalle_min THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.compta_unaccent_lite(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT translate(
    UPPER(p_text),
    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸÆŒ',
    'AAAAAACEEEEIIIINOOOOOUUUUYYAEOE'
  );
$function$;
CREATE OR REPLACE FUNCTION public.create_tiers(p_nom text, p_type text, p_telephone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_adresse text DEFAULT NULL::text, p_raison_sociale text DEFAULT NULL::text, p_numero_rccm text DEFAULT NULL::text, p_numero_contribuable text DEFAULT NULL::text, p_suffix_manuel text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tiers_id      UUID;
  v_parent_code   TEXT;
  v_suffix_base   TEXT;
  v_suffix_try    TEXT;
  v_attempt       INT := 0;
BEGIN
  -- Validations
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN
    RAISE EXCEPTION 'Nom obligatoire';
  END IF;
  IF p_type NOT IN ('client', 'fournisseur', 'salarie', 'autre') THEN
    RAISE EXCEPTION 'Type de tiers invalide : %', p_type;
  END IF;

  -- Mapping type → compte parent SYSCOHADA (cf. §2.2 de la spec)
  v_parent_code := CASE p_type
    WHEN 'client'      THEN '411'
    WHEN 'fournisseur' THEN '401'
    WHEN 'salarie'     THEN '421'
    WHEN 'autre'       THEN '467'
  END;

  -- Suffixe de base : manuel (si non vide) sinon auto-généré
  IF p_suffix_manuel IS NOT NULL AND TRIM(p_suffix_manuel) <> '' THEN
    v_suffix_base := UPPER(TRIM(p_suffix_manuel));
  ELSE
    v_suffix_base := public.generate_tiers_suffix(p_nom);
  END IF;

  -- Boucle de retry sur collision (max 100 tentatives)
  WHILE v_attempt < 100 LOOP
    v_suffix_try := CASE WHEN v_attempt = 0
                         THEN v_suffix_base
                         ELSE v_suffix_base || v_attempt::TEXT
                    END;
    BEGIN
      INSERT INTO public.tiers (
        nom, type, telephone, email, adresse,
        raison_sociale, numero_rccm, numero_contribuable,
        compte_syscohada_parent, compte_syscohada_suffix,
        notes, created_by, updated_by
      ) VALUES (
        TRIM(p_nom), p_type, NULLIF(TRIM(p_telephone), ''), NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_adresse), ''),
        NULLIF(TRIM(p_raison_sociale), ''), NULLIF(TRIM(p_numero_rccm), ''), NULLIF(TRIM(p_numero_contribuable), ''),
        v_parent_code, v_suffix_try,
        NULLIF(TRIM(p_notes), ''), p_user_id, p_user_id
      ) RETURNING id INTO v_tiers_id;
      EXIT;  -- succès, sortir de la boucle
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      v_tiers_id := NULL;
    END;
  END LOOP;

  IF v_tiers_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de générer un suffixe unique après 100 tentatives pour le nom "%"', p_nom;
  END IF;

  RETURN json_build_object(
    'tiers_id',              v_tiers_id,
    'suffix_final',          v_suffix_try,
    'compte_syscohada_code', v_parent_code || '-' || v_suffix_try
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_transfert_interne(p_date date, p_montant numeric, p_libelle text, p_source_caisse_id uuid, p_source_compte_id uuid, p_dest_caisse_id uuid, p_dest_compte_id uuid, p_user_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transfert_id     UUID;
  v_op_sortie_id     UUID;
  v_op_entree_id     UUID;
  v_ecriture_id      UUID;
  v_code_source      TEXT;
  v_code_dest        TEXT;
  v_libelle_source   TEXT;
  v_libelle_dest     TEXT;
  v_libelle_final    TEXT;
  v_categorie_id     UUID;
  v_exercice_id      UUID;
  v_seq              BIGINT;
  v_annee            INT;
  v_numero           TEXT;
BEGIN
  -- ─ Validations XOR source / dest ─────────────────────────────────────────
  IF (p_source_caisse_id IS NULL AND p_source_compte_id IS NULL)
     OR (p_source_caisse_id IS NOT NULL AND p_source_compte_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source invalide : un et un seul de source_caisse_id / source_compte_id doit être fourni';
  END IF;
  IF (p_dest_caisse_id IS NULL AND p_dest_compte_id IS NULL)
     OR (p_dest_caisse_id IS NOT NULL AND p_dest_compte_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Destination invalide : un et un seul de dest_caisse_id / dest_compte_id doit être fourni';
  END IF;
  IF p_source_caisse_id IS NOT NULL AND p_source_caisse_id = p_dest_caisse_id THEN
    RAISE EXCEPTION 'Source et destination ne peuvent pas être la même caisse';
  END IF;
  IF p_source_compte_id IS NOT NULL AND p_source_compte_id = p_dest_compte_id THEN
    RAISE EXCEPTION 'Source et destination ne peuvent pas être le même compte';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être strictement positif';
  END IF;

  -- ─ Récupérer codes SYSCOHADA et libellés source/dest ─────────────────────
  IF p_source_caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code, libelle
      INTO v_code_source, v_libelle_source
      FROM public.caisses
     WHERE id = p_source_caisse_id;
  ELSE
    SELECT compte_syscohada_code, libelle
      INTO v_code_source, v_libelle_source
      FROM public.comptes
     WHERE id = p_source_compte_id;
  END IF;
  IF v_code_source IS NULL THEN
    RAISE EXCEPTION 'Source sans mapping SYSCOHADA (compte_syscohada_code NULL)';
  END IF;

  IF p_dest_caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code, libelle
      INTO v_code_dest, v_libelle_dest
      FROM public.caisses
     WHERE id = p_dest_caisse_id;
  ELSE
    SELECT compte_syscohada_code, libelle
      INTO v_code_dest, v_libelle_dest
      FROM public.comptes
     WHERE id = p_dest_compte_id;
  END IF;
  IF v_code_dest IS NULL THEN
    RAISE EXCEPTION 'Destination sans mapping SYSCOHADA (compte_syscohada_code NULL)';
  END IF;

  -- ─ Libellé final (auto-généré si non fourni) ─────────────────────────────
  v_libelle_final := COALESCE(
    NULLIF(TRIM(p_libelle), ''),
    'Transfert interne : ' || v_libelle_source || ' → ' || v_libelle_dest
  );

  -- ─ Exercice qui couvre la date ───────────────────────────────────────────
  SELECT id INTO v_exercice_id
    FROM public.exercices
   WHERE date_debut <= p_date AND date_fin >= p_date
     AND cloture = false
   ORDER BY date_debut DESC
   LIMIT 1;
  IF v_exercice_id IS NULL THEN
    RAISE EXCEPTION 'Aucun exercice ouvert ne couvre la date %', p_date;
  END IF;

  -- ─ Catégorie 'Transfert interne' (créée par la migration § 4) ───────────
  SELECT id INTO v_categorie_id
    FROM public.categories_operations
   WHERE libelle = 'Transfert interne' AND type = 'transfert'
   LIMIT 1;
  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie système Transfert interne introuvable';
  END IF;

  -- ─ Numéro d'écriture : YYYY-OD-NNNNNN sur l'exercice courant ────────────
  SELECT EXTRACT(YEAR FROM date_debut)::INT INTO v_annee
    FROM public.exercices WHERE id = v_exercice_id;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
    FROM public.ecritures_comptables
   WHERE journal_code = 'OD' AND exercice_id = v_exercice_id;
  v_numero := v_annee || '-OD-' || LPAD(v_seq::TEXT, 6, '0');

  -- ─ 1. INSERT transfert (sans liens ops/ecr — patchés en fin) ────────────
  INSERT INTO public.transferts_internes (
    date_transfert, montant, libelle,
    source_caisse_id, source_compte_id,
    dest_caisse_id,   dest_compte_id,
    exercice_id, statut, created_by, updated_by, notes
  ) VALUES (
    p_date, p_montant, v_libelle_final,
    p_source_caisse_id, p_source_compte_id,
    p_dest_caisse_id,   p_dest_compte_id,
    v_exercice_id, 'valide', p_user_id, p_user_id, p_notes
  ) RETURNING id INTO v_transfert_id;

  -- ─ 2. INSERT opération SORTIE (source) ───────────────────────────────────
  INSERT INTO public.operations (
    date_operation, type, montant, libelle,
    caisse_id, compte_id,
    categorie_id, source, source_ref,
    statut, exercice_id, created_by, updated_by
  ) VALUES (
    p_date, 'sortie', p_montant, v_libelle_final,
    p_source_caisse_id, p_source_compte_id,
    v_categorie_id, 'transfert_interne', v_transfert_id,
    'valide', v_exercice_id, p_user_id, p_user_id
  ) RETURNING id INTO v_op_sortie_id;

  -- ─ 3. INSERT opération ENTREE (destination) ──────────────────────────────
  INSERT INTO public.operations (
    date_operation, type, montant, libelle,
    caisse_id, compte_id,
    categorie_id, source, source_ref,
    statut, exercice_id, created_by, updated_by
  ) VALUES (
    p_date, 'entree', p_montant, v_libelle_final,
    p_dest_caisse_id, p_dest_compte_id,
    v_categorie_id, 'transfert_interne', v_transfert_id,
    'valide', v_exercice_id, p_user_id, p_user_id
  ) RETURNING id INTO v_op_entree_id;

  -- ─ 4. INSERT écriture comptable (statut=brouillon temporaire) ───────────
  --    operation_id pointe vers la SORTIE (convention)
  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle, exercice_id,
    operation_id, transfert_id, source_manuelle, statut
  ) VALUES (
    v_numero, p_date, 'OD', v_libelle_final, v_exercice_id,
    v_op_sortie_id, v_transfert_id, false, 'brouillon'
  ) RETURNING id INTO v_ecriture_id;

  -- ─ 5. INSERT lignes (débit destination / crédit source) ─────────────────
  INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
  VALUES
    (v_ecriture_id, 1, v_code_dest,   v_libelle_dest,   p_montant, 0),
    (v_ecriture_id, 2, v_code_source, v_libelle_source, 0,         p_montant);

  -- ─ 6. Validation de l'écriture (déclenche trigger équilibre BD) ─────────
  UPDATE public.ecritures_comptables
     SET statut    = 'valide',
         valide_le = NOW(),
         valide_par = p_user_id
   WHERE id = v_ecriture_id;

  -- ─ 7. Patcher les liens retour ───────────────────────────────────────────
  UPDATE public.transferts_internes
     SET operation_sortie_id = v_op_sortie_id,
         operation_entree_id = v_op_entree_id,
         ecriture_id          = v_ecriture_id,
         updated_at           = NOW(),
         updated_by           = p_user_id
   WHERE id = v_transfert_id;

  UPDATE public.operations
     SET ecriture_id = v_ecriture_id,
         updated_at  = NOW(),
         updated_by  = p_user_id
   WHERE id IN (v_op_sortie_id, v_op_entree_id);

  -- ─ Retour JSON ───────────────────────────────────────────────────────────
  RETURN json_build_object(
    'transfert_id',         v_transfert_id,
    'operation_sortie_id',  v_op_sortie_id,
    'operation_entree_id',  v_op_entree_id,
    'ecriture_id',          v_ecriture_id,
    'numero_ecriture',      v_numero
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_exercice_clos_lock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_statut TEXT;
BEGIN
  SELECT statut INTO v_statut
    FROM public.exercices
   WHERE id = COALESCE(NEW.exercice_id, OLD.exercice_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications interdites (exercice_id=%)',
      COALESCE(NEW.exercice_id, OLD.exercice_id)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_exercice_clos_lock_ecriture()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_statut TEXT;
  v_bypass TEXT;
BEGIN
  -- Bypass volontaire pour ajuster_resultat_exercice(p_force_recalcul := TRUE)
  -- ou pour la fonction de clôture elle-même (recovery admin).
  BEGIN
    v_bypass := current_setting('compta.auto_recalcul_allowed', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT statut INTO v_statut
    FROM public.exercices
   WHERE id = COALESCE(NEW.exercice_id, OLD.exercice_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications d''écritures interdites (exercice_id=%)',
      COALESCE(NEW.exercice_id, OLD.exercice_id)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_exercice_clos_lock_ligne()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_statut TEXT;
  v_bypass TEXT;
BEGIN
  BEGIN
    v_bypass := current_setting('compta.auto_recalcul_allowed', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT e.statut INTO v_statut
    FROM public.ecritures_comptables ec
    JOIN public.exercices e ON e.id = ec.exercice_id
   WHERE ec.id = COALESCE(NEW.ecriture_id, OLD.ecriture_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications de lignes interdites'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_justificatif_required()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Cas 1 : INSERT direct en statut='valide' (rare)
  -- Cas 2 : UPDATE statut='brouillon' → 'valide' (workflow brouillon → valide)
  IF NEW.type = 'sortie'
     AND NEW.tiers_id IS NOT NULL
     AND NEW.statut = 'valide'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.statut, 'brouillon') <> 'valide')
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.justificatifs
       WHERE operation_id = NEW.id
         AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Justificatif obligatoire pour sortie vers tiers (operation_id=%)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_tiers_suffix(p_nom text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_clean    TEXT;
  v_words    TEXT[];
  v_suffix   TEXT;
BEGIN
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN
    RETURN 'XX';
  END IF;

  -- 1. Nettoyer (UPPER + accents + civilités)
  v_clean := public.compta_unaccent_lite(TRIM(p_nom));
  v_clean := regexp_replace(v_clean, '^(MME|MR|M\.|MLLE|DR|PROF)\s+', '', 'i');
  v_clean := TRIM(v_clean);

  -- 2. Découper en mots significatifs (alphanumériques uniquement)
  v_words := regexp_split_to_array(v_clean, '[^A-Z0-9]+');
  v_words := array(SELECT w FROM unnest(v_words) AS w WHERE w <> '' AND char_length(w) > 0);

  IF array_length(v_words, 1) IS NULL THEN
    RETURN 'XX';
  ELSIF array_length(v_words, 1) = 1 THEN
    -- 1 seul mot → 2 premières lettres
    v_suffix := SUBSTRING(v_words[1] FROM 1 FOR 2);
    IF char_length(v_suffix) < 2 THEN
      v_suffix := RPAD(v_suffix, 2, 'X');
    END IF;
  ELSE
    -- ≥ 2 mots → initiale 1er + initiale 2e
    v_suffix := SUBSTRING(v_words[1] FROM 1 FOR 1) || SUBSTRING(v_words[2] FROM 1 FOR 1);
  END IF;

  RETURN v_suffix;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.is_directeur()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id   = auth.uid()
       AND role = 'directeur'
  );
$function$;
CREATE OR REPLACE FUNCTION public.recalculer_resultat_exercice(p_exercice_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result_net BIGINT;
BEGIN
  SELECT resultat_net INTO v_result_net
    FROM public.ajuster_resultat_exercice(p_exercice_id, FALSE);

  UPDATE public.exercices
     SET resultat_net = v_result_net
   WHERE id = p_exercice_id;

  RETURN v_result_net;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_exercice_id_on_operation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_ex UUID;
BEGIN
  -- Si exercice_id pas fourni OU si la date change → recalculer
  IF NEW.exercice_id IS NULL OR (TG_OP = 'UPDATE' AND OLD.date_operation IS DISTINCT FROM NEW.date_operation) THEN
    SELECT id INTO v_ex
      FROM public.exercices
     WHERE NEW.date_operation BETWEEN date_debut AND date_fin
     LIMIT 1;
    IF v_ex IS NOT NULL THEN
      NEW.exercice_id := v_ex;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_operation_to_legacy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id BIGINT;
  v_existing_uuid UUID;
  v_sync_enabled BOOLEAN;
BEGIN
  -- Sources qui sont synchronisées vers les tables legacy :
  -- - 'manuel' (Vague 3.6 initiale)
  -- - 'versement_client' (extension : pour que reversements apparaissent dans /depenses)
  
  -- ───────────────────────────────────────────────────────────────────
  -- CAS DELETE : supprimer la ligne legacy correspondante
  -- ───────────────────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.source IN ('manuel', 'versement_client') THEN
      IF OLD.type = 'entree' THEN
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
      ELSIF OLD.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = OLD.id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ───────────────────────────────────────────────────────────────────
  -- Si statut != 'valide' → nettoyer legacy
  -- ───────────────────────────────────────────────────────────────────
  IF NEW.statut <> 'valide' THEN
    IF NEW.source IN ('manuel', 'versement_client') THEN
      IF NEW.type = 'entree' THEN
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || NEW.id::text;
      ELSIF NEW.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = NEW.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ───────────────────────────────────────────────────────────────────
  -- Si la source n'est pas dans notre périmètre de sync, on ignore
  -- ───────────────────────────────────────────────────────────────────
  v_sync_enabled := NEW.source IN ('manuel', 'versement_client');
  
  IF NOT v_sync_enabled THEN
    -- Si on passe d'une source synchronisée à autre chose, nettoyer
    IF TG_OP = 'UPDATE' AND OLD.source IN ('manuel', 'versement_client') THEN
      IF OLD.type = 'entree' THEN
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
      ELSIF OLD.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ───────────────────────────────────────────────────────────────────
  -- CAS INSERT / UPDATE avec source synchronisée ET statut='valide'
  -- ───────────────────────────────────────────────────────────────────

  IF NEW.type = 'entree' THEN
    -- Sync vers recettes_wave (UPSERT par "Identifiant de transaction")
    SELECT id INTO v_existing_id
      FROM public.recettes_wave
     WHERE "Identifiant de transaction" = 'op_' || NEW.id::text
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.recettes_wave SET
        "Horodatage"          = NEW.date_operation::timestamp,
        "Type de transaction" = CASE 
                                  WHEN NEW.source = 'versement_client' THEN 'Versement client'
                                  ELSE 'Manuel'
                                END,
        "Montant net"         = NEW.montant,
        "Montant brut"        = NEW.montant,
        "Frais"               = 0,
        "Devise"              = 'XOF',
        "Nom de contrepartie" = COALESCE(NEW.libelle, ''),
        "Nom d'utilisateur"   = COALESCE(NEW.libelle, ''),
        date_paiement         = NEW.date_operation,
        date_travail          = NEW.date_operation
       WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.recettes_wave (
        "Identifiant de transaction",
        "Horodatage",
        "Type de transaction",
        "Montant net",
        "Montant brut",
        "Frais",
        "Devise",
        "Nom de contrepartie",
        "Nom d'utilisateur",
        date_paiement,
        date_travail,
        created_at
      ) VALUES (
        'op_' || NEW.id::text,
        NEW.date_operation::timestamp,
        CASE WHEN NEW.source = 'versement_client' THEN 'Versement client' ELSE 'Manuel' END,
        NEW.montant,
        NEW.montant,
        0,
        'XOF',
        COALESCE(NEW.libelle, ''),
        COALESCE(NEW.libelle, ''),
        NEW.date_operation,
        NEW.date_operation,
        NOW()
      );
    END IF;

  ELSIF NEW.type = 'sortie' THEN
    -- Sync vers depenses_vehicules
    SELECT id_depense INTO v_existing_uuid
      FROM public.depenses_vehicules
     WHERE id_depense = NEW.id
     LIMIT 1;

    IF v_existing_uuid IS NOT NULL THEN
      UPDATE public.depenses_vehicules SET
        date_depense  = NEW.date_operation,
        montant       = NEW.montant,
        type_depense  = CASE 
                          WHEN NEW.source = 'versement_client' THEN 'Reversement client'
                          ELSE 'Manuel'
                        END,
        description   = COALESCE(NEW.libelle, ''),
        id_vehicule   = NEW.vehicule_id
       WHERE id_depense = NEW.id;
    ELSE
      INSERT INTO public.depenses_vehicules (
        id_depense,
        date_depense,
        montant,
        type_depense,
        description,
        id_vehicule,
        immobilisation,
        created_at
      ) VALUES (
        NEW.id,
        NEW.date_operation,
        NEW.montant,
        CASE WHEN NEW.source = 'versement_client' THEN 'Reversement client' ELSE 'Manuel' END,
        COALESCE(NEW.libelle, ''),
        NEW.vehicule_id,
        false,
        NOW()
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
CREATE OR REPLACE FUNCTION public.verifier_equilibre_ecriture()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_debit  NUMERIC;
  total_credit NUMERIC;
BEGIN
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut <> 'valide') THEN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
      INTO   total_debit, total_credit
      FROM   public.lignes_ecritures
      WHERE  ecriture_id = NEW.id;

    IF total_debit <> total_credit THEN
      RAISE EXCEPTION 'Écriture % déséquilibrée : débit=% crédit=%',
        NEW.numero, total_debit, total_credit;
    END IF;
    IF total_debit = 0 THEN
      RAISE EXCEPTION 'Écriture % vide (aucune ligne)', NEW.numero;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.verify_etat_financier(p_uuid uuid)
 RETURNS TABLE(type_etat text, hash_sha256 text, exercice_libelle text, date_arrete date, raison_sociale text, resultat_net bigint, genere_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.type_etat,
    a.hash_sha256,
    e.libelle                              AS exercice_libelle,
    e.date_fin                             AS date_arrete,
    COALESCE(sp.raison_sociale, pmc.raison_sociale, 'Boyah Group SARL') AS raison_sociale,
    e.resultat_net,
    a.genere_at
  FROM public.etats_financiers_archives a
  JOIN public.exercices e ON e.id = a.exercice_id
  LEFT JOIN public.societe_parametres sp ON TRUE
  LEFT JOIN public.parametres_module_compta pmc ON pmc.id = 1
  WHERE a.uuid_externe = p_uuid
  LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.verify_etat_financier_by_short(p_short text)
 RETURNS TABLE(match_count integer, type_etat text, hash_sha256 text, exercice_libelle text, date_arrete date, raison_sociale text, resultat_net bigint, genere_at timestamp with time zone, uuid_externe uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Normalisation : lowercase, trim, on garde uniquement [0-9a-f-]
  p_short := lower(regexp_replace(coalesce(p_short, ''), '[^0-9a-f-]', '', 'g'));

  -- Refus si trop court (sécurité : pas de lookup sur < 8 chars pour éviter
  -- les énumérations massives).
  IF char_length(p_short) < 8 THEN
    RETURN QUERY SELECT 0, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.etats_financiers_archives a
  WHERE substring(a.uuid_externe::text, 1, char_length(p_short)) = p_short;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  IF v_count > 1 THEN
    RETURN QUERY SELECT v_count, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  -- Match unique : on renvoie les détails
  RETURN QUERY
    SELECT
      1                                                                      AS match_count,
      a.type_etat,
      a.hash_sha256,
      e.libelle                                                              AS exercice_libelle,
      e.date_fin                                                             AS date_arrete,
      COALESCE(sp.raison_sociale, pmc.raison_sociale, 'Boyah Group SARL')    AS raison_sociale,
      e.resultat_net,
      a.genere_at,
      a.uuid_externe
    FROM public.etats_financiers_archives a
    JOIN public.exercices e ON e.id = a.exercice_id
    LEFT JOIN public.societe_parametres sp ON TRUE
    LEFT JOIN public.parametres_module_compta pmc ON pmc.id = 1
    WHERE substring(a.uuid_externe::text, 1, char_length(p_short)) = p_short
    LIMIT 1;
END;
$function$;

-- ── 9. VUES ────────────────────────────────────────────────
DROP VIEW IF EXISTS public."alerte_assurance" CASCADE;
CREATE VIEW public."alerte_assurance" AS
SELECT id_vehicule,
    immatriculation,
    date_expiration_assurance,
    date_expiration_assurance - CURRENT_DATE AS jours_restants
   FROM vehicules
  WHERE date_expiration_assurance <= (CURRENT_DATE + '30 days'::interval);
DROP VIEW IF EXISTS public."alerte_pneus" CASCADE;
CREATE VIEW public."alerte_pneus" AS
SELECT id_vehicule,
    immatriculation,
    date_derniers_pneus,
    CURRENT_DATE - date_derniers_pneus AS jours_utilisation
   FROM vehicules
  WHERE (CURRENT_DATE - date_derniers_pneus) >= 90;
DROP VIEW IF EXISTS public."alerte_vidange" CASCADE;
CREATE VIEW public."alerte_vidange" AS
SELECT id_vehicule,
    immatriculation,
    km_actuel,
    km_derniere_vidange,
    km_actuel - km_derniere_vidange AS km_depuis_vidange
   FROM vehicules
  WHERE (km_actuel - km_derniere_vidange) >= 8000;
DROP VIEW IF EXISTS public."alerte_visite_technique" CASCADE;
CREATE VIEW public."alerte_visite_technique" AS
SELECT id_vehicule,
    immatriculation,
    date_expiration_visite,
    date_expiration_visite - CURRENT_DATE AS jours_restants
   FROM vehicules
  WHERE date_expiration_visite <= (CURRENT_DATE + '7 days'::interval);
DROP VIEW IF EXISTS public."chauffeurs_actifs" CASCADE;
CREATE VIEW public."chauffeurs_actifs" AS
SELECT c.id_chauffeur,
    c.nom,
    count(r.id) AS nombre_transactions,
    sum(r."Montant net") AS chiffre_affaire
   FROM chauffeurs c
     LEFT JOIN recettes_wave r ON r."Numéro de téléphone de contrepartie" = c.numero_wave
  GROUP BY c.id_chauffeur, c.nom
 HAVING count(r.id) > 0;
DROP VIEW IF EXISTS public."chauffeurs_inactifs" CASCADE;
CREATE VIEW public."chauffeurs_inactifs" AS
SELECT c.id_chauffeur,
    c.nom
   FROM chauffeurs c
     LEFT JOIN recettes_wave r ON r."Numéro de téléphone de contrepartie" = c.numero_wave
  GROUP BY c.id_chauffeur, c.nom
 HAVING count(r.id) = 0;
DROP VIEW IF EXISTS public."classement_chauffeurs" CASCADE;
CREATE VIEW public."classement_chauffeurs" AS
SELECT c.id_chauffeur,
    c.nom,
    COALESCE(sum(r."Montant net"), 0::numeric) AS ca
   FROM chauffeurs c
     LEFT JOIN recettes_wave r ON lower(split_part(r."Nom de contrepartie", ' '::text, 1)) = lower(split_part(c.nom, ' '::text, 1))
  GROUP BY c.id_chauffeur, c.nom
  ORDER BY (COALESCE(sum(r."Montant net"), 0::numeric)) DESC;
DROP VIEW IF EXISTS public."cout_reel_vehicule" CASCADE;
CREATE VIEW public."cout_reel_vehicule" AS
SELECT id_vehicule,
    sum(montant) AS cout_total
   FROM depenses_vehicules
  GROUP BY id_vehicule;
DROP VIEW IF EXISTS public."depenses_anormales" CASCADE;
CREATE VIEW public."depenses_anormales" AS
SELECT id_depense,
    date_depense,
    montant,
    type_depense,
    description,
    id_vehicule,
    immobilisation,
    date_debut_immobilisation,
    date_fin_immobilisation,
    created_at
   FROM depenses_vehicules
  WHERE montant > (( SELECT avg(depenses_vehicules_1.montant) * 2::numeric
           FROM depenses_vehicules depenses_vehicules_1));
DROP VIEW IF EXISTS public."depenses_recurrentes" CASCADE;
CREATE VIEW public."depenses_recurrentes" AS
SELECT type_depense,
    count(*) AS nombre_depenses,
    avg(montant) AS montant_moyen
   FROM depenses_vehicules
  GROUP BY type_depense
  ORDER BY (count(*)) DESC;
DROP VIEW IF EXISTS public."vue_ca_chauffeur_jour" CASCADE;
CREATE VIEW public."vue_ca_chauffeur_jour" AS
SELECT c.nom,
    date(r."Horodatage") AS date_recette,
    sum(r."Montant net") AS ca_jour
   FROM recettes_wave r
     LEFT JOIN chauffeurs c ON lower(split_part(r."Nom de contrepartie", ' '::text, 1)) = lower(split_part(c.nom, ' '::text, 1))
  GROUP BY c.nom, (date(r."Horodatage"))
  ORDER BY (date(r."Horodatage"));
DROP VIEW IF EXISTS public."vue_ca_journalier" CASCADE;
CREATE VIEW public."vue_ca_journalier" AS
SELECT date("Horodatage") AS date_recette,
    sum("Montant net") AS chiffre_affaire
   FROM recettes_wave
  GROUP BY (date("Horodatage"))
  ORDER BY (date("Horodatage"));
DROP VIEW IF EXISTS public."vue_ca_mensuel" CASCADE;
CREATE VIEW public."vue_ca_mensuel" AS
SELECT EXTRACT(year FROM "Horodatage")::integer AS annee,
    EXTRACT(month FROM "Horodatage")::integer AS mois,
    sum("Montant net") AS chiffre_affaire
   FROM recettes_wave
  GROUP BY (EXTRACT(year FROM "Horodatage")::integer), (EXTRACT(month FROM "Horodatage")::integer)
  ORDER BY (EXTRACT(year FROM "Horodatage")::integer), (EXTRACT(month FROM "Horodatage")::integer);
DROP VIEW IF EXISTS public."vue_chauffeurs_vehicules" CASCADE;
CREATE VIEW public."vue_chauffeurs_vehicules" AS
SELECT c.id_chauffeur,
    c.nom,
    c.numero_wave,
    c.commentaire,
    c.actif,
    v.id_vehicule,
    v.immatriculation
   FROM chauffeurs c
     LEFT JOIN affectation_chauffeurs_vehicules a ON a.id_chauffeur = c.id_chauffeur AND a.date_fin IS NULL
     LEFT JOIN vehicules v ON v.id_vehicule = a.id_vehicule;
DROP VIEW IF EXISTS public."vue_dashboard_depenses" CASCADE;
CREATE VIEW public."vue_dashboard_depenses" AS
SELECT d.id_depense,
    d.date_depense,
    d.montant,
    d.type_depense,
    d.description,
    v.immatriculation
   FROM depenses_vehicules d
     LEFT JOIN vehicules v ON v.id_vehicule = d.id_vehicule
  ORDER BY d.date_depense DESC;
DROP VIEW IF EXISTS public."vue_dashboard_recettes" CASCADE;
CREATE VIEW public."vue_dashboard_recettes" AS
SELECT id,
    "Horodatage" AS date_recette,
    "Montant net" AS montant,
    "Nom de contrepartie" AS chauffeur
   FROM recettes_wave
  ORDER BY "Horodatage" DESC;
DROP VIEW IF EXISTS public."vue_depenses_aujourdhui" CASCADE;
CREATE VIEW public."vue_depenses_aujourdhui" AS
SELECT sum(montant) AS total_depenses
   FROM depenses_vehicules
  WHERE date_depense = CURRENT_DATE;
DROP VIEW IF EXISTS public."vue_depenses_categories" CASCADE;
CREATE VIEW public."vue_depenses_categories" AS
SELECT type_depense,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY type_depense
  ORDER BY (sum(montant)) DESC;
DROP VIEW IF EXISTS public."vue_depenses_journalieres" CASCADE;
CREATE VIEW public."vue_depenses_journalieres" AS
SELECT date_depense,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY date_depense
  ORDER BY date_depense;
DROP VIEW IF EXISTS public."vue_depenses_mensuelles" CASCADE;
CREATE VIEW public."vue_depenses_mensuelles" AS
SELECT date_trunc('month'::text, date_depense::timestamp with time zone) AS mois,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY (date_trunc('month'::text, date_depense::timestamp with time zone))
  ORDER BY (date_trunc('month'::text, date_depense::timestamp with time zone));
DROP VIEW IF EXISTS public."vue_depenses_mois" CASCADE;
CREATE VIEW public."vue_depenses_mois" AS
SELECT sum(montant) AS total_depenses
   FROM depenses_vehicules
  WHERE date_trunc('month'::text, date_depense::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone);
DROP VIEW IF EXISTS public."vue_depenses_par_categorie" CASCADE;
CREATE VIEW public."vue_depenses_par_categorie" AS
SELECT type_depense,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY type_depense
  ORDER BY (sum(montant)) DESC;
DROP VIEW IF EXISTS public."vue_depenses_par_vehicule" CASCADE;
CREATE VIEW public."vue_depenses_par_vehicule" AS
SELECT v.id_vehicule,
    v.immatriculation,
    COALESCE(sum(d.montant), 0::numeric) AS total_depenses
   FROM vehicules v
     LEFT JOIN depenses_vehicules d ON d.id_vehicule = v.id_vehicule
  GROUP BY v.id_vehicule, v.immatriculation
  ORDER BY (COALESCE(sum(d.montant), 0::numeric)) DESC;
DROP VIEW IF EXISTS public."vue_objectif_vehicules" CASCADE;
CREATE VIEW public."vue_objectif_vehicules" AS
SELECT id_vehicule,
    immatriculation,
    "montant de la recette" AS objectif_journalier
   FROM vehicules;
DROP VIEW IF EXISTS public."vue_profit_journalier" CASCADE;
CREATE VIEW public."vue_profit_journalier" AS
SELECT ca.date_recette,
    ca.chiffre_affaire - COALESCE(dep.total_depenses, 0::numeric) AS profit
   FROM ( SELECT date(recettes_wave."Horodatage") AS date_recette,
            sum(recettes_wave."Montant net") AS chiffre_affaire
           FROM recettes_wave
          GROUP BY (date(recettes_wave."Horodatage"))) ca
     LEFT JOIN ( SELECT depenses_vehicules.date_depense,
            sum(depenses_vehicules.montant) AS total_depenses
           FROM depenses_vehicules
          GROUP BY depenses_vehicules.date_depense) dep ON ca.date_recette = dep.date_depense
  ORDER BY ca.date_recette;
DROP VIEW IF EXISTS public."vue_recettes_chauffeurs" CASCADE;
CREATE VIEW public."vue_recettes_chauffeurs" AS
SELECT r.id,
    r."Horodatage",
    r."Identifiant de transaction",
    r."Montant net",
    r.telephone_chauffeur,
    c.id_chauffeur,
    c.nom
   FROM recettes_wave r
     LEFT JOIN chauffeurs c ON r.telephone_chauffeur = c.numero_wave;
DROP VIEW IF EXISTS public."vue_recettes_vehicules" CASCADE;
CREATE VIEW public."vue_recettes_vehicules" AS
SELECT r.id,
    r."Horodatage",
    r."Montant net",
    r."Identifiant de transaction",
    r."Type de transaction",
    r."Montant brut",
    r."Frais",
    r."Solde",
    r."Devise",
    r."Nom de contrepartie",
    r."Nom d'utilisateur",
    r."Numéro de téléphone de contrepartie",
    r."Numéro de téléphone d'utilisateur",
    COALESCE(c.nom, r."Nom de contrepartie") AS chauffeur,
    v.immatriculation,
    v.id_vehicule
   FROM recettes_wave r
     LEFT JOIN chauffeurs c ON regexp_replace(r."Numéro de téléphone de contrepartie", '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(c.numero_wave, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN affectation_chauffeurs_vehicules a ON c.id_chauffeur = a.id_chauffeur AND a.date_fin IS NULL
     LEFT JOIN vehicules v ON a.id_vehicule = v.id_vehicule
  WHERE r."Montant net" IS NOT NULL;
DROP VIEW IF EXISTS public."vue_top_vehicule_depenses" CASCADE;
CREATE VIEW public."vue_top_vehicule_depenses" AS
SELECT v.immatriculation,
    sum(d.montant) AS total_depenses
   FROM depenses_vehicules d
     LEFT JOIN vehicules v ON v.id_vehicule = d.id_vehicule
  GROUP BY v.immatriculation
  ORDER BY (sum(d.montant)) DESC
 LIMIT 1;
DROP VIEW IF EXISTS public."vue_voitures_payees" CASCADE;
CREATE VIEW public."vue_voitures_payees" AS
SELECT v.id_vehicule,
    v.immatriculation,
    count(vc.id) AS versements
   FROM vehicules v
     LEFT JOIN versements_chauffeurs vc ON vc.id_vehicule = v.id_vehicule AND vc.date_versement = CURRENT_DATE
  GROUP BY v.id_vehicule, v.immatriculation;
DROP VIEW IF EXISTS public."alertes_vehicules" CASCADE;
CREATE VIEW public."alertes_vehicules" AS
SELECT 'VIDANGE'::text AS type_alerte,
    alerte_vidange.immatriculation,
    CURRENT_DATE AS date_alerte,
    alerte_vidange.km_actuel - alerte_vidange.km_derniere_vidange AS valeur
   FROM alerte_vidange
UNION ALL
 SELECT 'PNEUS'::text AS type_alerte,
    alerte_pneus.immatriculation,
    CURRENT_DATE AS date_alerte,
    CURRENT_DATE - alerte_pneus.date_derniers_pneus AS valeur
   FROM alerte_pneus
UNION ALL
 SELECT 'ASSURANCE'::text AS type_alerte,
    alerte_assurance.immatriculation,
    alerte_assurance.date_expiration_assurance AS date_alerte,
    alerte_assurance.date_expiration_assurance - CURRENT_DATE AS valeur
   FROM alerte_assurance
UNION ALL
 SELECT 'VISITE_TECHNIQUE'::text AS type_alerte,
    alerte_visite_technique.immatriculation,
    alerte_visite_technique.date_expiration_visite AS date_alerte,
    alerte_visite_technique.date_expiration_visite - CURRENT_DATE AS valeur
   FROM alerte_visite_technique;
DROP VIEW IF EXISTS public."prevision_ca_mensuel" CASCADE;
CREATE VIEW public."prevision_ca_mensuel" AS
SELECT annee,
    mois,
    chiffre_affaire,
    chiffre_affaire * 1.1 AS prevision
   FROM vue_ca_mensuel;
DROP VIEW IF EXISTS public."prevision_depenses" CASCADE;
CREATE VIEW public."prevision_depenses" AS
SELECT avg(total_depenses) AS depense_moyenne_mensuelle
   FROM vue_depenses_mensuelles;
DROP VIEW IF EXISTS public."vue_ca_vehicule_aujourdhui" CASCADE;
CREATE VIEW public."vue_ca_vehicule_aujourdhui" AS
SELECT id_vehicule,
    immatriculation,
    sum("Montant net") AS ca_today
   FROM vue_recettes_vehicules
  WHERE date("Horodatage") = CURRENT_DATE
  GROUP BY id_vehicule, immatriculation;
DROP VIEW IF EXISTS public."vue_ca_vehicule_jour" CASCADE;
CREATE VIEW public."vue_ca_vehicule_jour" AS
SELECT id_vehicule,
    immatriculation,
    date("Horodatage") AS date_recette,
    sum("Montant net") AS ca_jour
   FROM vue_recettes_vehicules
  GROUP BY id_vehicule, immatriculation, (date("Horodatage"))
  ORDER BY (date("Horodatage")) DESC;
DROP VIEW IF EXISTS public."vue_ca_vehicule_mois" CASCADE;
CREATE VIEW public."vue_ca_vehicule_mois" AS
SELECT id_vehicule,
    immatriculation,
    date_trunc('month'::text, "Horodatage") AS mois,
    sum("Montant net") AS ca_mois
   FROM vue_recettes_vehicules
  GROUP BY id_vehicule, immatriculation, (date_trunc('month'::text, "Horodatage"))
  ORDER BY (date_trunc('month'::text, "Horodatage")) DESC;
DROP VIEW IF EXISTS public."vue_ca_vehicules" CASCADE;
CREATE VIEW public."vue_ca_vehicules" AS
SELECT v.immatriculation,
    sum(r."Montant net") AS ca_total
   FROM vue_recettes_vehicules r
     LEFT JOIN vehicules v ON r.id_vehicule = v.id_vehicule
  GROUP BY v.immatriculation
  ORDER BY (sum(r."Montant net")) DESC;
DROP VIEW IF EXISTS public."vue_dashboard_vehicules" CASCADE;
CREATE VIEW public."vue_dashboard_vehicules" AS
SELECT v.id_vehicule,
    v.immatriculation,
    v.type_vehicule,
    v.proprietaire,
    v.statut,
    COALESCE(j.ca_today, 0::numeric) AS ca_aujourdhui,
    COALESCE(m.ca_mois, 0::numeric) AS ca_mensuel,
    COALESCE(c.cout_total, 0::numeric) AS cout_total,
    COALESCE(m.ca_mois, 0::numeric) - COALESCE(c.cout_total, 0::numeric) AS profit
   FROM vehicules v
     LEFT JOIN vue_ca_vehicule_aujourdhui j ON v.id_vehicule = j.id_vehicule
     LEFT JOIN vue_ca_vehicule_mois m ON v.id_vehicule = m.id_vehicule AND m.mois = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)
     LEFT JOIN cout_reel_vehicule c ON v.id_vehicule = c.id_vehicule;

-- ── 10. TRIGGERS ───────────────────────────────────────────
DROP TRIGGER IF EXISTS "set_agent_memory_updated_at" ON public."agent_memory";
CREATE TRIGGER set_agent_memory_updated_at BEFORE UPDATE ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "tr_ecritures_equilibre" ON public."ecritures_comptables";
CREATE TRIGGER tr_ecritures_equilibre BEFORE INSERT OR UPDATE OF statut ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION verifier_equilibre_ecriture();
DROP TRIGGER IF EXISTS "tr_ecritures_exercice_clos_lock" ON public."ecritures_comptables";
CREATE TRIGGER tr_ecritures_exercice_clos_lock BEFORE INSERT OR DELETE OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION enforce_exercice_clos_lock_ecriture();
DROP TRIGGER IF EXISTS "tr_lignes_ecritures_clos_lock" ON public."lignes_ecritures";
CREATE TRIGGER tr_lignes_ecritures_clos_lock BEFORE INSERT OR DELETE OR UPDATE ON public.lignes_ecritures FOR EACH ROW EXECUTE FUNCTION enforce_exercice_clos_lock_ligne();
DROP TRIGGER IF EXISTS "tr_operations_exercice_clos_lock" ON public."operations";
CREATE TRIGGER tr_operations_exercice_clos_lock BEFORE INSERT OR DELETE OR UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION enforce_exercice_clos_lock();
DROP TRIGGER IF EXISTS "tr_operations_justificatif_required" ON public."operations";
CREATE TRIGGER tr_operations_justificatif_required BEFORE INSERT OR UPDATE OF statut, type, tiers_id ON public.operations FOR EACH ROW EXECUTE FUNCTION enforce_justificatif_required();
DROP TRIGGER IF EXISTS "tr_operations_set_exercice" ON public."operations";
CREATE TRIGGER tr_operations_set_exercice BEFORE INSERT OR UPDATE OF date_operation ON public.operations FOR EACH ROW EXECUTE FUNCTION set_exercice_id_on_operation();
DROP TRIGGER IF EXISTS "trg_cascade_operation_to_versement" ON public."operations";
CREATE TRIGGER trg_cascade_operation_to_versement AFTER INSERT ON public.operations FOR EACH ROW WHEN ((new.source = 'versement_client'::text)) EXECUTE FUNCTION cascade_operation_to_versement_client();
DROP TRIGGER IF EXISTS "trg_sync_operation_to_legacy" ON public."operations";
CREATE TRIGGER trg_sync_operation_to_legacy AFTER INSERT OR DELETE OR UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION sync_operation_to_legacy();
DROP TRIGGER IF EXISTS "trg_cascade_recette_wave" ON public."recettes_wave";
CREATE TRIGGER trg_cascade_recette_wave AFTER INSERT OR UPDATE OF "Identifiant de transaction", "Montant net", "Horodatage" ON public.recettes_wave FOR EACH ROW EXECUTE FUNCTION cascade_recette_wave_to_operation();
DROP TRIGGER IF EXISTS "trg_cascade_versement_to_operation" ON public."versements_clients";
CREATE TRIGGER trg_cascade_versement_to_operation AFTER INSERT ON public.versements_clients FOR EACH ROW EXECUTE FUNCTION cascade_versement_client_to_operation();

-- ── 11. RLS POLICIES ───────────────────────────────────────
ALTER TABLE public."activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ai_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."bilan_mapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."caisses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."categories_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clotures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comptes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comptes_syscohada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ecritures_comptables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."etats_financiers_archives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."exercices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."journaux" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."justificatifs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lignes_ecritures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."parametres_module_compta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pieces_justificatives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."societe_parametres" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."transferts_internes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."versements_clients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_insert" ON public."activity_logs" AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK (true);
CREATE POLICY "logs_select" ON public."activity_logs" AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);
CREATE POLICY "Insertion publique ai_insights" ON public."ai_insights" AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (true);
CREATE POLICY "Lecture publique ai_insights" ON public."ai_insights" AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "directeur_full_access" ON public."bilan_mapping" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."caisses" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."categories_operations" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "authenticated_all_chauffeurs" ON public."chauffeurs" AS PERMISSIVE FOR ALL TO {authenticated} USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_clients" ON public."clients" AS PERMISSIVE FOR ALL TO {authenticated} USING (true) WITH CHECK (true);
CREATE POLICY "directeur_full_access" ON public."clotures" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."comptes" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."comptes_syscohada" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."ecritures_comptables" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."etats_financiers_archives" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."exercices" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."journaux" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."justificatifs" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."lignes_ecritures" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."operations" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."parametres_module_compta" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."pieces_justificatives" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "Users can update their own profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = id));
CREATE POLICY "Users can view their profile" ON public."profiles" AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = id));
CREATE POLICY "profiles_insert" ON public."profiles" AS PERMISSIVE FOR INSERT TO {service_role} WITH CHECK (true);
CREATE POLICY "profiles_select" ON public."profiles" AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);
CREATE POLICY "profiles_update" ON public."profiles" AS PERMISSIVE FOR UPDATE TO {service_role} USING (true);
CREATE POLICY "perms_all" ON public."role_permissions" AS PERMISSIVE FOR ALL TO {service_role} USING (true);
CREATE POLICY "perms_select" ON public."role_permissions" AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);
CREATE POLICY "directeur_full_access" ON public."societe_parametres" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."tiers" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "directeur_full_access" ON public."transferts_internes" AS PERMISSIVE FOR ALL TO {public} USING (is_directeur()) WITH CHECK (is_directeur());
CREATE POLICY "authenticated_all_vehicules" ON public."vehicules" AS PERMISSIVE FOR ALL TO {authenticated} USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_versements" ON public."versements_clients" AS PERMISSIVE FOR ALL TO {public} USING ((auth.role() = 'authenticated'::text));

-- ── 12. COMMENTS ───────────────────────────────────────────
COMMENT ON TABLE public."clients_documents" IS 'Documents archives par Client (asset management). Stockage physique : bucket Supabase Storage clients-docs/. Types : contrat, CNI, carte grise, assurance, justificatif (auto), etat des comptes a la sortie (auto), autre. Ajoute le 23/05/2026 (E1 module Clients enrichi).';
COMMENT ON TABLE public."justificatifs" IS 'Justificatifs (factures, reçus, photos) attachés aux opérations. Phase 4.x Vague 3.';
COMMENT ON TABLE public."societe_parametres" IS 'Phase 4.2 — Paramètres société pour PDF officiels (logo + identité légale + exercice par défaut). Singleton.';
COMMENT ON COLUMN public."clients"."actif" IS 'Soft-delete : TRUE = client visible dans la liste par defaut. FALSE = client archive, accessible uniquement via la checkbox Inactifs. Ajoute le 23/05/2026 (QW3 module Clients enrichi).';
COMMENT ON COLUMN public."clients"."tiers_id" IS 'FK vers le tiers comptable correspondant (table tiers, type=client). Maintenu en cohaerance par /api/clients POST. NULL temporaire autorise pour les clients pre-existants en attendant le backfill. Ajoute le 23/05/2026 (H3 module Clients enrichi).';
COMMENT ON COLUMN public."ecritures_comptables"."auto_generated" IS 'PHASE 4.3 — TRUE si l''écriture est générée automatiquement (cf auto_generation_type)';
COMMENT ON COLUMN public."ecritures_comptables"."auto_generation_type" IS 'PHASE 4.3 — Type de génération : ''resultat_exercice'' (compte 13), ''cloture'' (autres ajustements futurs)';
COMMENT ON COLUMN public."justificatifs"."storage_path" IS 'Chemin dans le bucket Supabase Storage. Format : {operation_id}/{justificatif_id}-{filename_sluggué}.{ext}';
COMMENT ON COLUMN public."justificatifs"."deleted_at" IS 'Soft delete — la ligne est conservée pour audit trail SYSCOHADA.';
COMMENT ON COLUMN public."parametres_module_compta"."numerotation_auto" IS 'Numérotation automatique des écritures (préfixe par journal_code).';
COMMENT ON COLUMN public."parametres_module_compta"."journal_par_defaut" IS 'Journal utilisé pour les opérations dont la catégorie ne fixe pas de journal.';
COMMENT ON COLUMN public."parametres_module_compta"."raison_sociale" IS 'Raison sociale (Écran 7 — affiché sur les exports comptables).';
COMMENT ON COLUMN public."societe_parametres"."methodes_comptables" IS 'PHASE 4.3 — Note 1 : texte libre listant les méthodes comptables appliquées (référentiel, devise, amortissement, etc.)';
COMMENT ON COLUMN public."societe_parametres"."engagements_hors_bilan" IS 'PHASE 4.3 — Note 6 : texte libre listant les engagements hors bilan (cautions, avals, crédit-bail, litiges)';
COMMENT ON COLUMN public."societe_parametres"."methode_amortissement" IS 'PHASE 4.3 — Méthode d''amortissement par défaut (linéaire ou dégressif)';
COMMENT ON COLUMN public."societe_parametres"."methode_stocks" IS 'PHASE 4.3 — Méthode de valorisation stocks (FIFO, CMP, LIFO)';
COMMENT ON COLUMN public."vehicules"."valeur_acquisition_client" IS 'Valeur d''acquisition du vehicule par le Client (FCFA). Utilisee pour le KPI Capital gere agrege sur la page /clients. NULL = donnee non saisie. Ajoute le 23/05/2026 (G1 module Clients enrichi).';
COMMENT ON COLUMN public."versements_clients"."caisse_id" IS 'Caisse source du versement (XOR avec compte_id). Default frontend = Wave Boyah. Ajoute le 24/05/2026.';
COMMENT ON COLUMN public."versements_clients"."compte_id" IS 'Compte bancaire source du versement (XOR avec caisse_id). Ajoute le 24/05/2026.';

COMMIT;
