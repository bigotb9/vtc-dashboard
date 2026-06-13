-- ============================================================
-- ÉCRAN 7 — Paramètres comptabilité : société + workflow + journal
-- ============================================================
-- Référence : doc Phase 3 Écran 7 §6.3 + §5.
--
-- Ajoute les colonnes manquantes à parametres_module_compta pour stocker :
--   - les infos société (Boyah Group SARL, RCCM, etc.)
--   - le toggle numérotation automatique des écritures
--   - le journal SYSCOHADA utilisé par défaut quand la catégorie n'en fixe pas
--
-- À appliquer via Supabase SQL Editor.

ALTER TABLE public.parametres_module_compta
  ADD COLUMN IF NOT EXISTS numerotation_auto    BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS journal_par_defaut   TEXT
    REFERENCES public.journaux(code)
    DEFAULT 'OD',
  ADD COLUMN IF NOT EXISTS raison_sociale       TEXT,
  ADD COLUMN IF NOT EXISTS numero_rccm          TEXT
    CHECK (numero_rccm IS NULL OR char_length(numero_rccm) <= 50),
  ADD COLUMN IF NOT EXISTS numero_contribuable  TEXT
    CHECK (numero_contribuable IS NULL OR char_length(numero_contribuable) <= 50),
  ADD COLUMN IF NOT EXISTS adresse_fiscale      TEXT
    CHECK (adresse_fiscale IS NULL OR char_length(adresse_fiscale) <= 500),
  ADD COLUMN IF NOT EXISTS telephone            TEXT
    CHECK (telephone IS NULL OR char_length(telephone) <= 30),
  ADD COLUMN IF NOT EXISTS email_comptable      TEXT
    CHECK (email_comptable IS NULL OR email_comptable ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

COMMENT ON COLUMN public.parametres_module_compta.numerotation_auto IS
  'Numérotation automatique des écritures (préfixe par journal_code).';
COMMENT ON COLUMN public.parametres_module_compta.journal_par_defaut IS
  'Journal utilisé pour les opérations dont la catégorie ne fixe pas de journal.';
COMMENT ON COLUMN public.parametres_module_compta.raison_sociale IS
  'Raison sociale (Écran 7 — affiché sur les exports comptables).';
