-- ============================================================
-- PHASE 4.2 — Module 1 : Paramètres société + bucket logos
-- ============================================================
-- Référence : doc Phase 4.2 §2.
--
-- Table singleton `societe_parametres` (1 ligne max). Champs identité
-- légale (RCCM, N°CC, capital, NIF, code NAF), contact, exercice par
-- défaut (jj-mm), et `logo_storage_path` (path dans bucket 'logos').
--
-- Coexistence avec `parametres_module_compta` (Phase 3 Écran 7) :
-- ce dernier garde sa fonction de "mode actif" / "workflow validation"
-- + champs hérités (raison_sociale, numero_rccm, etc.). À fusionner en
-- Phase 4.3 si retour positif. Pour V1, la source de vérité pour les
-- PDF passe désormais par `societe_parametres`.
-- ============================================================


-- ── 1. Table societe_parametres ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.societe_parametres (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité commerciale
  nom_commercial          TEXT         NOT NULL CHECK (char_length(TRIM(nom_commercial)) >= 2),
  raison_sociale          TEXT         NOT NULL CHECK (char_length(TRIM(raison_sociale)) >= 2),
  forme_juridique         TEXT         CHECK (forme_juridique IS NULL OR forme_juridique IN
                                              ('SARL','SA','SAS','SASU','EI','SCI','SCS','SNC','GIE','autre')),

  -- Contact
  adresse                 TEXT         CHECK (adresse IS NULL OR char_length(adresse) <= 500),
  telephone               TEXT         CHECK (telephone IS NULL OR char_length(telephone) <= 30),
  email                   TEXT         CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  site_web                TEXT         CHECK (site_web IS NULL OR char_length(site_web) <= 200),

  -- Informations légales (obligatoires pour PDF officiels)
  rccm                    TEXT         CHECK (rccm IS NULL OR char_length(rccm) <= 60),
  numero_cc               TEXT         CHECK (numero_cc IS NULL OR char_length(numero_cc) <= 60),
  capital_social          BIGINT       CHECK (capital_social IS NULL OR capital_social >= 0),
  regime_fiscal           TEXT         CHECK (regime_fiscal IS NULL OR regime_fiscal IN ('tva_assujetti', 'non_assujetti')),
  nif                     TEXT         CHECK (nif IS NULL OR char_length(nif) <= 60),
  code_naf                TEXT         CHECK (code_naf IS NULL OR char_length(code_naf) <= 30),

  -- Logo
  logo_storage_path       TEXT         CHECK (logo_storage_path IS NULL OR char_length(logo_storage_path) <= 400),

  -- Exercice par défaut (JJ-MM, ex "01-01" → "12-31")
  exercice_debut_jj_mm    TEXT         NOT NULL DEFAULT '01-01' CHECK (exercice_debut_jj_mm ~ '^\d{2}-\d{2}$'),
  exercice_fin_jj_mm      TEXT         NOT NULL DEFAULT '12-31' CHECK (exercice_fin_jj_mm   ~ '^\d{2}-\d{2}$'),

  -- Audit
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by              UUID         REFERENCES auth.users(id)
);

COMMENT ON TABLE public.societe_parametres IS
  'Phase 4.2 — Paramètres société pour PDF officiels (logo + identité légale + exercice par défaut). Singleton.';

-- Singleton enforcement : une seule ligne autorisée (jusqu''à passage SaaS
-- multi-tenant où on ajoutera tenant_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_societe_parametres_singleton
  ON public.societe_parametres ((TRUE));


-- ── 2. RLS — directeur seul ──────────────────────────────────────────────────
ALTER TABLE public.societe_parametres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS directeur_full_access ON public.societe_parametres;
CREATE POLICY directeur_full_access
  ON public.societe_parametres FOR ALL
  USING (public.is_directeur())
  WITH CHECK (public.is_directeur());


-- ── 3. Bucket Storage 'logos' (idempotent) ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  false,
  2 * 1024 * 1024,                                  -- 2 Mo par fichier
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public             = EXCLUDED.public;


-- ── 4. RLS storage.objects pour le bucket 'logos' ────────────────────────────
DROP POLICY IF EXISTS logos_select  ON storage.objects;
DROP POLICY IF EXISTS logos_insert  ON storage.objects;
DROP POLICY IF EXISTS logos_update  ON storage.objects;
DROP POLICY IF EXISTS logos_delete  ON storage.objects;

CREATE POLICY logos_select
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos' AND public.is_directeur());

CREATE POLICY logos_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND public.is_directeur());

CREATE POLICY logos_update
  ON storage.objects FOR UPDATE
  USING       (bucket_id = 'logos' AND public.is_directeur())
  WITH CHECK  (bucket_id = 'logos' AND public.is_directeur());

CREATE POLICY logos_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND public.is_directeur());
