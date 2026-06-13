-- ============================================================
-- MIGRATION : Lier une écriture d'extourne à son écriture d'origine
-- Correctif post-smoke-test Écran 2 (Phase 3) — annulation buggée Day 5.
--
-- Avant ce correctif, l'idempotence + le lien extourne↔origine se faisaient
-- via `libelle LIKE 'Extourne — %'`, ce qui est fragile et empêche les
-- requêtes simples côté `/detail` et `/health`.
--
-- Après : colonne dédiée `extourne_de` (UUID FK auto-référente) + UNIQUE
-- pour empêcher tout doublon d'extourne sur une même écriture.
-- ============================================================

-- 1. Ajout de la colonne (nullable : valeur uniquement pour les extournes)
ALTER TABLE public.ecritures_comptables
  ADD COLUMN IF NOT EXISTS extourne_de UUID NULL;

-- 2. FK auto-référente (suppression de l'origine → la colonne devient NULL,
--    l'extourne reste mais perd sa traçabilité)
ALTER TABLE public.ecritures_comptables
  DROP CONSTRAINT IF EXISTS ecritures_comptables_extourne_de_fkey;
ALTER TABLE public.ecritures_comptables
  ADD CONSTRAINT ecritures_comptables_extourne_de_fkey
  FOREIGN KEY (extourne_de)
  REFERENCES public.ecritures_comptables(id)
  ON DELETE SET NULL;

-- 3. Index partiel (la grande majorité des écritures ont extourne_de = NULL)
CREATE INDEX IF NOT EXISTS idx_ecritures_extourne_de
  ON public.ecritures_comptables(extourne_de)
  WHERE extourne_de IS NOT NULL;

-- 4. UNIQUE — une écriture d'origine ne peut être extournée qu'UNE seule fois.
--    Les NULL ne sont pas comptés comme doublons par Postgres → conforme.
ALTER TABLE public.ecritures_comptables
  DROP CONSTRAINT IF EXISTS ecritures_comptables_extourne_de_unique;
ALTER TABLE public.ecritures_comptables
  ADD CONSTRAINT ecritures_comptables_extourne_de_unique
  UNIQUE (extourne_de);

-- 5. Vérifications (à exécuter manuellement après application)
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name   = 'ecritures_comptables'
--     AND column_name  = 'extourne_de';
--
-- SELECT conname, contype, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.ecritures_comptables'::regclass
--     AND conname LIKE 'ecritures_comptables_extourne_de%';
--
-- -- Les 476 écritures existantes doivent toutes avoir extourne_de = NULL
-- SELECT COUNT(*) FROM public.ecritures_comptables WHERE extourne_de IS NOT NULL;
