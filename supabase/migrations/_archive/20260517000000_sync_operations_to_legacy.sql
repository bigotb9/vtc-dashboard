-- ============================================================
-- PHASE 4.x VAGUE 3.6 — Sync bidirectionnelle operations ↔ legacy tables
-- ============================================================
-- Référence : décision SaaS du 2026-05-15.
--
-- Objectif : Quand une opération avec source='manuel' est créée/modifiée/
-- supprimée via le module compta, on synchronise automatiquement la table
-- métier correspondante (recettes_wave ou depenses_vehicules) pour que
-- les pages /recettes et /depenses restent cohérentes.
--
-- Sens 1 (legacy → operations) : déjà câblé via routes reprise.
-- Sens 2 (operations → legacy) : c'est ce que fait cette migration.
--
-- Scope : source='manuel' uniquement.
-- Les autres sources (recette_wave, depense_vehicule, versement_client,
-- transfert_interne) ont déjà leur table source-of-truth.
-- ============================================================


-- ── 1. Fonction de sync : operations → legacy ────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_operation_to_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id BIGINT;
  v_existing_uuid UUID;
BEGIN
  -- ───────────────────────────────────────────────────────────────────────
  -- CAS DELETE : supprimer la ligne legacy correspondante (si manuelle)
  -- ───────────────────────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.source = 'manuel' THEN
      IF OLD.type = 'entree' THEN
        -- Supprimer dans recettes_wave où id_recette = OLD.id (cast)
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
      ELSIF OLD.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = OLD.id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ───────────────────────────────────────────────────────────────────────
  -- CAS INSERT / UPDATE : on ne synchronise que source='manuel' validé
  -- ───────────────────────────────────────────────────────────────────────
  IF NEW.source <> 'manuel' THEN
    -- Si on passe d'une source manuel à autre chose (rare), nettoyer
    IF TG_OP = 'UPDATE' AND OLD.source = 'manuel' THEN
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

  -- ───────────────────────────────────────────────────────────────────────
  -- CAS INSERT / UPDATE avec source='manuel'
  -- ───────────────────────────────────────────────────────────────────────

  IF NEW.type = 'entree' THEN
    -- Sync vers recettes_wave (UPSERT par "Identifiant de transaction")
    SELECT id INTO v_existing_id
      FROM public.recettes_wave
     WHERE "Identifiant de transaction" = 'op_' || NEW.id::text
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- UPDATE
      UPDATE public.recettes_wave SET
        "Horodatage"          = NEW.date_operation::timestamp,
        "Type de transaction" = 'Manuel',
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
      -- INSERT
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
        'Manuel',
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
    -- Sync vers depenses_vehicules (UPSERT par id_depense = operation.id)
    SELECT id_depense INTO v_existing_uuid
      FROM public.depenses_vehicules
     WHERE id_depense = NEW.id
     LIMIT 1;

    IF v_existing_uuid IS NOT NULL THEN
      -- UPDATE
      UPDATE public.depenses_vehicules SET
        date_depense  = NEW.date_operation,
        montant       = NEW.montant,
        type_depense  = 'Manuel',
        description   = COALESCE(NEW.libelle, ''),
        id_vehicule   = NEW.vehicule_id
       WHERE id_depense = NEW.id;
    ELSE
      -- INSERT
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
        'Manuel',
        COALESCE(NEW.libelle, ''),
        NEW.vehicule_id,
        false,
        NOW()
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_operation_to_legacy IS
  'Synchronise operations (source=manuel) vers recettes_wave / depenses_vehicules. Trigger AFTER INSERT/UPDATE/DELETE (Phase 4.x Vague 3.6).';


-- ── 2. Trigger sur operations ────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_operation_to_legacy ON public.operations;

CREATE TRIGGER trg_sync_operation_to_legacy
  AFTER INSERT OR UPDATE OR DELETE ON public.operations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_operation_to_legacy();


-- ── 3. Reprise initiale (synchronise les ops manuelles existantes) ───────
-- À exécuter une fois pour rattraper l'historique. Réutilise la même
-- logique que le trigger.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id, o.type, o.date_operation, o.montant, o.libelle, o.vehicule_id, o.source
      FROM public.operations o
     WHERE o.source = 'manuel'
       AND o.statut = 'valide'
  LOOP
    -- Reproduire la logique INSERT du trigger
    IF r.type = 'entree' THEN
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
        'op_' || r.id::text,
        r.date_operation::timestamp,
        'Manuel',
        r.montant,
        r.montant,
        0,
        'XOF',
        COALESCE(r.libelle, ''),
        COALESCE(r.libelle, ''),
        r.date_operation,
        r.date_operation,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    ELSIF r.type = 'sortie' THEN
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
        r.id,
        r.date_operation,
        r.montant,
        'Manuel',
        COALESCE(r.libelle, ''),
        r.vehicule_id,
        false,
        NOW()
      )
      ON CONFLICT (id_depense) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;


-- ── 4. Permissions ───────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sync_operation_to_legacy FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_operation_to_legacy TO authenticated, service_role;


-- ── 5. Smoke test (à exécuter manuellement après application) ────────────
-- 5.1) Vérifier que le trigger existe
-- SELECT tgname, tgenabled
--   FROM pg_trigger
--  WHERE tgrelid = 'public.operations'::regclass
--    AND tgname = 'trg_sync_operation_to_legacy';
--
-- 5.2) Vérifier la reprise initiale : combien d'ops manuelles miroirées ?
-- SELECT COUNT(*) FROM public.recettes_wave WHERE "Type de transaction" = 'Manuel';
-- SELECT COUNT(*) FROM public.depenses_vehicules WHERE type_depense = 'Manuel';
--
-- 5.3) Test INSERT : créer une op manuelle et vérifier la création legacy
-- INSERT INTO public.operations (
--   type, date_operation, montant, libelle, source, statut,
--   caisse_id, categorie_id, created_by, updated_by
-- ) VALUES (
--   'sortie', CURRENT_DATE, 12345, 'TEST SYNC trigger',
--   'manuel', 'valide',
--   (SELECT id FROM caisses LIMIT 1),
--   (SELECT id FROM categories_operations WHERE type='depense' LIMIT 1),
--   auth.uid(), auth.uid()
-- );
-- -- Vérifier
-- SELECT * FROM public.depenses_vehicules WHERE description = 'TEST SYNC trigger';
--
-- 5.4) Test DELETE : supprimer l'op test et vérifier la suppression legacy
-- DELETE FROM public.operations WHERE libelle = 'TEST SYNC trigger';
-- SELECT * FROM public.depenses_vehicules WHERE description = 'TEST SYNC trigger';
-- -- Attendu : 0 ligne
