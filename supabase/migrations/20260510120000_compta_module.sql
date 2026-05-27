-- ============================================================
-- MIGRATION : Module Comptes & Caisses Fleet Boyah
-- Phase 1 — Fondations
--
-- Périmètre : 13 nouvelles tables + RLS (directeur seul) + trigger
-- d'équilibre partie double + bucket Supabase Storage.
--
-- Standard : SYSCOHADA révisé (AUDCIF 2017).
-- Cohérence : aucune table existante n'est modifiée.
-- ============================================================


-- ============================================================
-- 0. HELPERS
-- ============================================================

-- Helper utilisé par toutes les policies du module compta.
-- Remplaçable (CREATE OR REPLACE) si déjà défini ailleurs.
CREATE OR REPLACE FUNCTION public.is_directeur()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id   = auth.uid()
       AND role = 'directeur'
  );
$$;


-- ============================================================
-- 1. PARAMÈTRES MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametres_module_compta (
  id                          INT          PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode_actif                  TEXT         NOT NULL DEFAULT 'simple'
                                           CHECK (mode_actif IN ('simple', 'avance')),
  premier_login_effectue      BOOLEAN      NOT NULL DEFAULT false,
  workflow_validation_actif   BOOLEAN      NOT NULL DEFAULT false,
  exercice_courant_id         UUID,
  date_demarrage_module       DATE         NOT NULL DEFAULT '2026-02-09',
  updated_at                  TIMESTAMPTZ  DEFAULT NOW(),
  updated_by                  UUID         REFERENCES auth.users(id)
);

INSERT INTO public.parametres_module_compta (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. EXERCICES COMPTABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercices (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle      TEXT         NOT NULL,
  date_debut   DATE         NOT NULL,
  date_fin     DATE         NOT NULL,
  cloture      BOOLEAN      NOT NULL DEFAULT false,
  cloture_le   TIMESTAMPTZ,
  cloture_par  UUID         REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  CHECK (date_fin > date_debut)
);

INSERT INTO public.exercices (libelle, date_debut, date_fin) VALUES
  ('Exercice 2025', '2025-01-01', '2025-12-31'),
  ('Exercice 2026', '2026-01-01', '2026-12-31')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. JOURNAUX COMPTABLES (mode Avancé)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journaux (
  id        UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  code      TEXT      UNIQUE NOT NULL,
  libelle   TEXT      NOT NULL,
  type      TEXT      NOT NULL CHECK (type IN ('banque', 'caisse', 'achats', 'ventes', 'paie', 'od')),
  actif     BOOLEAN   NOT NULL DEFAULT true,
  ordre     SMALLINT  DEFAULT 0
);

INSERT INTO public.journaux (code, libelle, type, ordre) VALUES
  ('BQ', 'Journal de banque',                'banque',  10),
  ('CA', 'Journal de caisse',                'caisse',  20),
  ('AC', 'Journal des achats',               'achats',  30),
  ('VE', 'Journal des ventes',               'ventes',  40),
  ('PA', 'Journal de paie',                  'paie',    50),
  ('OD', 'Journal des opérations diverses',  'od',      60)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 4. PLAN COMPTABLE SYSCOHADA
-- (le seed des codes est dans le fichier seed_plan_comptable.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comptes_syscohada (
  code         TEXT         PRIMARY KEY,
  libelle      TEXT         NOT NULL,
  classe       SMALLINT     NOT NULL CHECK (classe BETWEEN 1 AND 9),
  type         TEXT         NOT NULL CHECK (type IN (
                              'capitaux_propres', 'dettes_financieres',
                              'immobilisation',   'amortissement',  'immobilisation_fin',
                              'tiers_actif',      'tiers_passif',   'tiers',
                              'tresorerie',
                              'charge_exploitation', 'charge_personnel',
                              'charge_financiere',   'dotation',
                              'produit_exploitation','produit_financier','reprise'
                            )),
  parent_code  TEXT         REFERENCES public.comptes_syscohada(code),
  ordre        SMALLINT     DEFAULT 0,
  actif        BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- 5. COMPTES BANCAIRES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comptes (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle                  TEXT          NOT NULL,
  banque                   TEXT,
  numero_compte            TEXT,
  devise                   TEXT          NOT NULL DEFAULT 'XOF',
  solde_initial            NUMERIC(18,2) NOT NULL DEFAULT 0,
  date_solde_initial       DATE          NOT NULL DEFAULT '2026-02-09',
  compte_syscohada_code    TEXT          REFERENCES public.comptes_syscohada(code),
  actif                    BOOLEAN       NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  created_by               UUID          REFERENCES auth.users(id),
  archive_le               TIMESTAMPTZ,
  archive_par              UUID          REFERENCES auth.users(id)
);


-- ============================================================
-- 6. CAISSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.caisses (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle                  TEXT          NOT NULL,
  type                     TEXT          NOT NULL CHECK (type IN ('cash', 'mobile_money')),
  operateur                TEXT,                       -- Wave, Orange Money, MTN, Moov si type=mobile_money
  numero                   TEXT,                       -- numéro mobile money si applicable
  solde_initial            NUMERIC(18,2) NOT NULL DEFAULT 0,
  date_solde_initial       DATE          NOT NULL DEFAULT '2026-02-09',
  plafond                  NUMERIC(18,2),
  compte_syscohada_code    TEXT          REFERENCES public.comptes_syscohada(code),
  responsable_id           UUID          REFERENCES auth.users(id),
  actif                    BOOLEAN       NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  created_by               UUID          REFERENCES auth.users(id),
  archive_le               TIMESTAMPTZ,
  archive_par              UUID          REFERENCES auth.users(id)
);


-- ============================================================
-- 7. CATÉGORIES D'OPÉRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories_operations (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle                  TEXT         NOT NULL,
  type                     TEXT         NOT NULL CHECK (type IN (
                                          'recette', 'depense', 'apport',
                                          'reversement', 'avance', 'investissement',
                                          'remboursement', 'dotation', 'transfert', 'autre'
                                        )),
  -- Mapping SYSCOHADA pour mode Avancé
  compte_syscohada_code    TEXT         REFERENCES public.comptes_syscohada(code),
  sens                     TEXT         CHECK (sens IN ('debit', 'credit')),
  journal_par_defaut       TEXT         REFERENCES public.journaux(code),
  actif                    BOOLEAN      NOT NULL DEFAULT true,
  ordre                    SMALLINT     DEFAULT 0,
  created_at               TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- 8. OPÉRATIONS (cœur du module)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operations (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Localisation argent : compte XOR caisse
  compte_id                UUID          REFERENCES public.comptes(id),
  caisse_id                UUID          REFERENCES public.caisses(id),
  CHECK ((compte_id IS NOT NULL AND caisse_id IS NULL)
      OR (compte_id IS NULL     AND caisse_id IS NOT NULL)),

  -- Métier
  date_operation           DATE          NOT NULL,
  type                     TEXT          NOT NULL CHECK (type IN ('entree', 'sortie')),
  montant                  NUMERIC(18,2) NOT NULL CHECK (montant > 0),
  libelle                  TEXT          NOT NULL,
  reference_externe        TEXT,                    -- numéro de transaction Wave, ref bancaire, etc.

  -- Catégorisation
  categorie_id             UUID          REFERENCES public.categories_operations(id),

  -- Liens flotte (optionnels) — pas de FK, IDs entiers existants
  vehicule_id              UUID,
  chauffeur_id             UUID,
  client_id                UUID,

  -- Lien existant (pour reprise auto)
  source                   TEXT          NOT NULL DEFAULT 'manuel'
                                         CHECK (source IN (
                                           'manuel', 'recette_wave', 'depense_vehicule',
                                           'versement_client', 'import_csv',
                                           'transfert_interne', 'dotation_amort'
                                         )),
  source_ref               UUID,                    -- id de la ligne d'origine

  -- Workflow
  statut                   TEXT          NOT NULL DEFAULT 'valide'
                                         CHECK (statut IN ('brouillon', 'valide', 'annule')),
  valide_le                TIMESTAMPTZ,
  valide_par               UUID          REFERENCES auth.users(id),

  -- Lien comptable (mode Avancé) — FK ajoutée plus bas après création de ecritures_comptables
  ecriture_id              UUID,
  exercice_id              UUID          NOT NULL REFERENCES public.exercices(id),

  -- Audit
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  created_by               UUID          REFERENCES auth.users(id),
  updated_at               TIMESTAMPTZ   DEFAULT NOW(),
  updated_by               UUID          REFERENCES auth.users(id),
  notes                    TEXT
);

CREATE INDEX IF NOT EXISTS idx_operations_date       ON public.operations(date_operation);
CREATE INDEX IF NOT EXISTS idx_operations_compte     ON public.operations(compte_id);
CREATE INDEX IF NOT EXISTS idx_operations_caisse     ON public.operations(caisse_id);
CREATE INDEX IF NOT EXISTS idx_operations_categorie  ON public.operations(categorie_id);
CREATE INDEX IF NOT EXISTS idx_operations_source     ON public.operations(source, source_ref);
CREATE INDEX IF NOT EXISTS idx_operations_exercice   ON public.operations(exercice_id);
CREATE INDEX IF NOT EXISTS idx_operations_statut     ON public.operations(statut);

-- Empêche les doublons de reprise auto (idempotent : même source + source_ref => 1 seule ligne)
CREATE UNIQUE INDEX IF NOT EXISTS idx_operations_source_unique
  ON public.operations(source, source_ref)
  WHERE source_ref IS NOT NULL;


-- ============================================================
-- 9. TRANSFERTS INTERNES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transferts_internes (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date_transfert           DATE          NOT NULL,
  montant                  NUMERIC(18,2) NOT NULL CHECK (montant > 0),
  libelle                  TEXT          NOT NULL,

  -- Source (compte XOR caisse)
  source_compte_id         UUID          REFERENCES public.comptes(id),
  source_caisse_id         UUID          REFERENCES public.caisses(id),
  CHECK ((source_compte_id IS NOT NULL) <> (source_caisse_id IS NOT NULL)),

  -- Destination (compte XOR caisse)
  dest_compte_id           UUID          REFERENCES public.comptes(id),
  dest_caisse_id           UUID          REFERENCES public.caisses(id),
  CHECK ((dest_compte_id IS NOT NULL) <> (dest_caisse_id IS NOT NULL)),

  -- Liens vers les deux opérations créées (sortie + entrée)
  operation_sortie_id      UUID          REFERENCES public.operations(id),
  operation_entree_id      UUID          REFERENCES public.operations(id),
  ecriture_id              UUID,                    -- FK ajoutée plus bas
  exercice_id              UUID          NOT NULL REFERENCES public.exercices(id),
  statut                   TEXT          NOT NULL DEFAULT 'valide'
                                         CHECK (statut IN ('brouillon', 'valide', 'annule')),
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  created_by               UUID          REFERENCES auth.users(id)
);


-- ============================================================
-- 10. PIÈCES JUSTIFICATIVES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pieces_justificatives (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    UUID         REFERENCES public.operations(id)         ON DELETE CASCADE,
  transfert_id    UUID         REFERENCES public.transferts_internes(id) ON DELETE CASCADE,
  CHECK ((operation_id IS NOT NULL) OR (transfert_id IS NOT NULL)),
  url             TEXT         NOT NULL,            -- chemin Supabase Storage
  nom_fichier     TEXT         NOT NULL,
  type_mime       TEXT,
  taille_octets   INT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  created_by      UUID         REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_pieces_operation ON public.pieces_justificatives(operation_id);
CREATE INDEX IF NOT EXISTS idx_pieces_transfert ON public.pieces_justificatives(transfert_id);


-- ============================================================
-- 11. ÉCRITURES COMPTABLES (mode Avancé)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ecritures_comptables (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT         NOT NULL,           -- format YYYY-JJJ-NNNNNN
  date_ecriture    DATE         NOT NULL,
  journal_code     TEXT         NOT NULL REFERENCES public.journaux(code),
  libelle          TEXT         NOT NULL,
  exercice_id      UUID         NOT NULL REFERENCES public.exercices(id),

  -- Source
  operation_id     UUID         REFERENCES public.operations(id),
  transfert_id     UUID         REFERENCES public.transferts_internes(id),
  source_manuelle  BOOLEAN      NOT NULL DEFAULT false,

  -- Statut
  statut           TEXT         NOT NULL DEFAULT 'valide'
                                CHECK (statut IN ('brouillon', 'valide', 'annule')),
  cloture          BOOLEAN      NOT NULL DEFAULT false,

  -- Audit
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  created_by       UUID         REFERENCES auth.users(id),
  valide_le        TIMESTAMPTZ,
  valide_par       UUID         REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecritures_numero    ON public.ecritures_comptables(numero);
CREATE INDEX        IF NOT EXISTS idx_ecritures_date      ON public.ecritures_comptables(date_ecriture);
CREATE INDEX        IF NOT EXISTS idx_ecritures_journal   ON public.ecritures_comptables(journal_code);
CREATE INDEX        IF NOT EXISTS idx_ecritures_exercice  ON public.ecritures_comptables(exercice_id);


-- Liens retour : operations.ecriture_id et transferts_internes.ecriture_id
ALTER TABLE public.operations
  ADD CONSTRAINT fk_operation_ecriture
  FOREIGN KEY (ecriture_id) REFERENCES public.ecritures_comptables(id);

ALTER TABLE public.transferts_internes
  ADD CONSTRAINT fk_transfert_ecriture
  FOREIGN KEY (ecriture_id) REFERENCES public.ecritures_comptables(id);


-- ============================================================
-- 12. LIGNES D'ÉCRITURES (partie double)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lignes_ecritures (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ecriture_id              UUID          NOT NULL REFERENCES public.ecritures_comptables(id) ON DELETE CASCADE,
  ordre                    SMALLINT      NOT NULL,
  compte_syscohada_code    TEXT          NOT NULL REFERENCES public.comptes_syscohada(code),
  libelle                  TEXT,
  debit                    NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit                   NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)),

  -- Lettrage tiers (411, 401, 462...)
  lettrage                 TEXT,                    -- ex 'A', 'B'... NULL = non lettré
  lettrage_le              TIMESTAMPTZ,

  -- Liens auxiliaires
  vehicule_id              UUID,
  chauffeur_id             UUID,
  client_id                UUID,
  apporteur_code           TEXT,                    -- Famille A1, A2, B1...

  -- Audit
  created_at               TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lignes_ecriture  ON public.lignes_ecritures(ecriture_id);
CREATE INDEX IF NOT EXISTS idx_lignes_compte    ON public.lignes_ecritures(compte_syscohada_code);
CREATE INDEX IF NOT EXISTS idx_lignes_lettrage  ON public.lignes_ecritures(compte_syscohada_code, lettrage)
                                                WHERE lettrage IS NOT NULL;


-- ============================================================
-- 13. CLÔTURES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clotures (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id   UUID         NOT NULL REFERENCES public.exercices(id),
  type          TEXT         NOT NULL CHECK (type IN ('mensuelle', 'annuelle')),
  periode       TEXT         NOT NULL,              -- 'YYYY-MM' ou 'YYYY'
  cloture_le    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  cloture_par   UUID         NOT NULL REFERENCES auth.users(id),
  totaux        JSONB        NOT NULL,              -- snapshot des totaux à la clôture
  notes         TEXT,
  UNIQUE(exercice_id, type, periode)
);


-- ============================================================
-- 14. TRIGGER D'ÉQUILIBRE (partie double)
-- Vérifie : sum(debit) = sum(credit) à la validation d'une écriture
-- ============================================================
CREATE OR REPLACE FUNCTION public.verifier_equilibre_ecriture()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS tr_ecritures_equilibre ON public.ecritures_comptables;
CREATE TRIGGER tr_ecritures_equilibre
  BEFORE INSERT OR UPDATE OF statut ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.verifier_equilibre_ecriture();


-- ============================================================
-- 15. ROW LEVEL SECURITY
-- v1 : directeur uniquement (cohérent avec le périmètre v1 du module)
-- ============================================================
ALTER TABLE public.parametres_module_compta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journaux                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes_syscohada        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories_operations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferts_internes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieces_justificatives    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecritures_comptables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_ecritures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clotures                 ENABLE ROW LEVEL SECURITY;

-- Drop policies préexistantes éventuelles puis recréation
DROP POLICY IF EXISTS directeur_full_access ON public.parametres_module_compta;
DROP POLICY IF EXISTS directeur_full_access ON public.exercices;
DROP POLICY IF EXISTS directeur_full_access ON public.journaux;
DROP POLICY IF EXISTS directeur_full_access ON public.comptes_syscohada;
DROP POLICY IF EXISTS directeur_full_access ON public.comptes;
DROP POLICY IF EXISTS directeur_full_access ON public.caisses;
DROP POLICY IF EXISTS directeur_full_access ON public.categories_operations;
DROP POLICY IF EXISTS directeur_full_access ON public.operations;
DROP POLICY IF EXISTS directeur_full_access ON public.transferts_internes;
DROP POLICY IF EXISTS directeur_full_access ON public.pieces_justificatives;
DROP POLICY IF EXISTS directeur_full_access ON public.ecritures_comptables;
DROP POLICY IF EXISTS directeur_full_access ON public.lignes_ecritures;
DROP POLICY IF EXISTS directeur_full_access ON public.clotures;

CREATE POLICY directeur_full_access ON public.parametres_module_compta FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.exercices                FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.journaux                 FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.comptes_syscohada        FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.comptes                  FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.caisses                  FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.categories_operations    FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.operations               FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.transferts_internes      FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.pieces_justificatives    FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.ecritures_comptables     FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.lignes_ecritures         FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());
CREATE POLICY directeur_full_access ON public.clotures                 FOR ALL USING (public.is_directeur()) WITH CHECK (public.is_directeur());


-- ============================================================
-- 16. SUPABASE STORAGE — bucket pieces-comptables
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pieces-comptables',
  'pieces-comptables',
  false,
  10 * 1024 * 1024,                                   -- 10 Mo
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public             = EXCLUDED.public;

-- Policies sur storage.objects (directeur seul)
DROP POLICY IF EXISTS pieces_comptables_select ON storage.objects;
DROP POLICY IF EXISTS pieces_comptables_insert ON storage.objects;
DROP POLICY IF EXISTS pieces_comptables_update ON storage.objects;
DROP POLICY IF EXISTS pieces_comptables_delete ON storage.objects;

CREATE POLICY pieces_comptables_select
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pieces-comptables' AND public.is_directeur());

CREATE POLICY pieces_comptables_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pieces-comptables' AND public.is_directeur());

CREATE POLICY pieces_comptables_update
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pieces-comptables' AND public.is_directeur())
  WITH CHECK (bucket_id = 'pieces-comptables' AND public.is_directeur());

CREATE POLICY pieces_comptables_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pieces-comptables' AND public.is_directeur());


-- ============================================================
-- 17. EXERCICE COURANT par défaut
-- ============================================================
UPDATE public.parametres_module_compta
   SET exercice_courant_id = (
         SELECT id FROM public.exercices
          WHERE date_debut <= CURRENT_DATE AND date_fin >= CURRENT_DATE
          ORDER BY date_debut DESC
          LIMIT 1
       )
 WHERE id = 1
   AND exercice_courant_id IS NULL;
