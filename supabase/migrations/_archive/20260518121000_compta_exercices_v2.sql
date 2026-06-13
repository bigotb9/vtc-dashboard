-- ============================================================
-- PHASE 4.2 — Module 2 : Exercices comptables enrichis
-- ============================================================
-- Référence : doc Phase 4.2 §3.
--
-- La table `exercices` existe déjà depuis Phase 1 (id, libelle,
-- date_debut, date_fin, cloture bool, cloture_le, cloture_par).
-- Cette migration AJOUTE :
--   - colonnes : annee, statut (text enum), date_cloture, resultat_net,
--     bilan_pdf_path, cr_pdf_path
--   - UNIQUE INDEX sur (annee)
--   - Backfill : annee + statut depuis les colonnes existantes
--   - operations.exercice_id existe déjà → on n'y touche pas
--   - Trigger set_exercice_id_on_operation (auto-rempli à partir de date_op)
--   - Trigger enforce_exercice_clos_lock (empêche INSERT/UPDATE/DELETE
--     des opérations d'un exercice clos)
-- ============================================================


-- ── 1. Colonnes additives ────────────────────────────────────────────────────
ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS annee           INTEGER,
  ADD COLUMN IF NOT EXISTS statut          TEXT
    CHECK (statut IN ('ouvert', 'clos'))
    DEFAULT 'ouvert',
  ADD COLUMN IF NOT EXISTS date_cloture    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resultat_net    BIGINT,
  ADD COLUMN IF NOT EXISTS bilan_pdf_path  TEXT,
  ADD COLUMN IF NOT EXISTS cr_pdf_path     TEXT;


-- ── 2. Backfill : déduire annee depuis date_debut + statut depuis cloture ───
UPDATE public.exercices
   SET annee = EXTRACT(YEAR FROM date_debut)::INTEGER
 WHERE annee IS NULL;

UPDATE public.exercices
   SET statut = CASE WHEN cloture THEN 'clos' ELSE 'ouvert' END
 WHERE statut IS NULL OR (cloture = true AND statut <> 'clos');

UPDATE public.exercices
   SET date_cloture = cloture_le
 WHERE date_cloture IS NULL AND cloture_le IS NOT NULL;

ALTER TABLE public.exercices
  ALTER COLUMN annee  SET NOT NULL,
  ALTER COLUMN statut SET NOT NULL;


-- ── 3. Unicité de l'année ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'uk_exercices_annee' AND tablename = 'exercices'
  ) THEN
    CREATE UNIQUE INDEX uk_exercices_annee ON public.exercices(annee);
  END IF;
END$$;


-- ── 4. Trigger : auto-remplir operations.exercice_id depuis date_operation ──
-- Note : la colonne exercice_id existe déjà (Phase 1) et est NOT NULL.
-- Ce trigger l'auto-remplit si NULL ou si la date change.
CREATE OR REPLACE FUNCTION public.set_exercice_id_on_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS tr_operations_set_exercice ON public.operations;
CREATE TRIGGER tr_operations_set_exercice
  BEFORE INSERT OR UPDATE OF date_operation ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.set_exercice_id_on_operation();


-- ── 5. Trigger : verrouiller modifs sur exercice clos ───────────────────────
CREATE OR REPLACE FUNCTION public.enforce_exercice_clos_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS tr_operations_exercice_clos_lock ON public.operations;
CREATE TRIGGER tr_operations_exercice_clos_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exercice_clos_lock();
