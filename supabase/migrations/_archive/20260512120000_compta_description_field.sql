-- ============================================================
-- ÉCRAN 5 — Champ `description` pour caisses + comptes
-- ============================================================
-- Référence : doc Phase 3 Écran 5 §4.1 — champ Description optionnel
--             (textarea libre, max 500 caractères) pour annoter une caisse
--             ou un compte. Utilisé par le formulaire création/modification.
--
-- À appliquer via Supabase SQL Editor.

ALTER TABLE public.caisses
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(description) <= 500);

ALTER TABLE public.comptes
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(description) <= 500);

COMMENT ON COLUMN public.caisses.description IS
  'Notes libres sur la caisse (Écran 5, max 500 caractères).';
COMMENT ON COLUMN public.comptes.description IS
  'Notes libres sur le compte bancaire (Écran 5, max 500 caractères).';
