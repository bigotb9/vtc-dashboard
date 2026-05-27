-- ============================================================
-- ÉCRAN 6 — Champ `description` pour categories_operations
-- ============================================================
-- Référence : doc Phase 3 Écran 6 §4.2 — champ Description optionnel
--             (textarea libre, max 500 caractères) pour annoter une
--             catégorie. Utilisé par le formulaire création/modification.
--
-- À appliquer via Supabase SQL Editor.

ALTER TABLE public.categories_operations
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(description) <= 500);

COMMENT ON COLUMN public.categories_operations.description IS
  'Notes libres sur la catégorie (Écran 6, max 500 caractères).';

-- Index sur (libelle) pour les checks d'unicité applicative + recherche.
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_operations_libelle_unique
  ON public.categories_operations (libelle);
