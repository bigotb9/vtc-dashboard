-- ============================================================
-- CASCADE VERSEMENTS CLIENTS v3 — support paiements en tranches
-- 10/06/2026
-- ============================================================
-- Probleme : versements_clients = 1 ligne par (client, mois) avec
-- UNIQUE(id_client, mois). Le POST /api/clients/versements fait un upsert
-- qui REMPLACE le montant. Le trigger trg_cascade_versement_to_operation
-- etait AFTER INSERT seulement :
--   - 1ere tranche  -> INSERT  -> operation + ecriture creees (OK)
--   - 2e tranche    -> UPDATE  -> RIEN (operation figee a l'ancien montant)
-- Cas reel : Fin'elle (client 3) mois 2026-04, versement id=89 passe de
-- 300 000 a 600 000 ; l'operation cascade est restee a 300 000 et une
-- operation manuelle de contournement a du etre creee (reparee le 10/06).
--
-- Fix (C1) : etendre le trigger a AFTER INSERT OR UPDATE OF montant,
-- aligne sur le pattern de trg_cascade_recette_wave (INSERT OR UPDATE).
--
-- Comportement sur UPDATE de montant :
--   - montant inchange                  -> no-op (IS NOT DISTINCT FROM)
--   - op cascade existante + exercice ouvert
--       -> op.montant = NEW.montant (hausse OU baisse, cumul du mois)
--       -> ecriture regeneree (detacher -> DELETE -> helper Lot G)
--   - nouveau montant NULL ou <= 0      -> WARNING, op non touchee
--     (operations a une contrainte CHECK montant > 0 ; la remise a zero
--      d'un versement doit passer par le DELETE du versement, hors scope)
--   - exercice clos                     -> WARNING, op et ecriture non
--     touchees (ne jamais corrompre un exercice verrouille)
--   - pas d'op cascade existante (theorique) -> creation comme sur INSERT
--
-- Gardes preservees :
--   - anti-recursion INSERT : NOT EXISTS operations(source, source_ref)
--   - Flux B (operation -> versement) inchange : AFTER INSERT seulement,
--     l'UPDATE d'operations ne reboucle pas
--   - trg_sync_operation_to_legacy ignore source='versement_client'
--
-- Idempotent : CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cascade_versement_client_to_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC$
DECLARE
  v_caisse_id      UUID;
  v_compte_id      UUID;
  v_categorie_id   UUID;
  v_exercice_id    UUID;
  v_libelle        TEXT;
  v_op_id          UUID;
  v_old_ecr        UUID;
  v_exo_statut     TEXT;
  v_new_ecr        UUID;
BEGIN
  IF NEW.date_versement IS NULL THEN RETURN NEW; END IF;

  -- ── Branche UPDATE : ajuster l'operation cascade existante ─────────────
  IF TG_OP = 'UPDATE' THEN
    -- Montant inchange (upsert qui reecrit la meme valeur) -> no-op
    IF NEW.montant IS NOT DISTINCT FROM OLD.montant THEN
      RETURN NEW;
    END IF;

    SELECT o.id, o.ecriture_id INTO v_op_id, v_old_ecr
      FROM public.operations o
     WHERE o.source = 'versement_client'
       AND o.source_ref = NEW.id::text
     LIMIT 1;

    IF v_op_id IS NOT NULL THEN
      -- Nouveau montant invalide -> on ne touche pas l'op (CHECK montant>0)
      IF NEW.montant IS NULL OR NEW.montant <= 0 THEN
        RAISE WARNING '[cascade_versement v3] versement % : montant % invalide, operation % NON ajustee',
          NEW.id, NEW.montant, v_op_id;
        RETURN NEW;
      END IF;

      -- Exercice clos -> ne pas corrompre, avertir
      SELECT e.statut INTO v_exo_statut
        FROM public.operations o
        JOIN public.exercices e ON e.id = o.exercice_id
       WHERE o.id = v_op_id;
      IF v_exo_statut IS DISTINCT FROM 'ouvert' THEN
        RAISE WARNING '[cascade_versement v3] versement % : exercice de l''operation % non ouvert (%), montant NON ajuste',
          NEW.id, v_op_id, v_exo_statut;
        RETURN NEW;
      END IF;

      -- Ajustement du montant (hausse comme baisse : cumul du mois)
      UPDATE public.operations
         SET montant = NEW.montant, updated_at = NOW()
       WHERE id = v_op_id;

      -- Regeneration de l'ecriture : le helper Lot G est idempotent sur
      -- ecriture_id, il faut donc detacher puis supprimer l'ancienne
      -- (les lignes suivent par FK ON DELETE CASCADE).
      IF v_old_ecr IS NOT NULL THEN
        UPDATE public.operations SET ecriture_id = NULL WHERE id = v_op_id;
        DELETE FROM public.ecritures_comptables WHERE id = v_old_ecr;
      END IF;
      BEGIN
        v_new_ecr := public.generer_ecriture_pour_operation(v_op_id);
        IF v_new_ecr IS NULL THEN
          RAISE WARNING '[cascade_versement v3] regeneration ecriture op % : helper a retourne NULL (op valide sans ecriture, relancer regenerer-ecritures)',
            v_op_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[cascade_versement v3] regeneration ecriture op % : % (SQLSTATE=%)',
          v_op_id, SQLERRM, SQLSTATE;
      END;

      RETURN NEW;
    END IF;
    -- Pas d'operation cascade existante (cas theorique : versement cree
    -- avant la mise en place de la cascade) -> flux creation ci-dessous.
  END IF;

  -- ── Flux creation (INSERT, ou UPDATE sans op existante) — v2 inchange ──
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN RETURN NEW; END IF;

  -- Anti-recursion (preservee)
  IF EXISTS (
    SELECT 1 FROM public.operations
     WHERE source = 'versement_client'
       AND source_ref = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  v_caisse_id := NEW.caisse_id;
  v_compte_id := NEW.compte_id;
  IF v_caisse_id IS NULL AND v_compte_id IS NULL THEN
    SELECT id INTO v_caisse_id FROM public.caisses
     WHERE libelle = 'Wave Boyah' LIMIT 1;
    IF v_caisse_id IS NULL THEN RETURN NEW; END IF;
  END IF;

  SELECT id INTO v_categorie_id FROM public.categories_operations
   WHERE libelle = 'Reversement client sous gestion' LIMIT 1;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= NEW.date_versement
     AND date_fin   >= NEW.date_versement
     AND statut     = 'ouvert'
   LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

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
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_op_id;

  -- Generation auto de l'ecriture (Lot G, inchange)
  IF v_op_id IS NOT NULL THEN
    BEGIN
      PERFORM public.generer_ecriture_pour_operation(v_op_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cascade_versement v3] ecriture op=%: % (SQLSTATE=%)',
        v_op_id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$FUNC$;

COMMENT ON FUNCTION public.cascade_versement_client_to_operation IS
  'Flux A (v3 - 10/06/2026) : AFTER INSERT OR UPDATE OF montant sur versements_clients. INSERT -> cree operation sortie cat 4119 + ecriture. UPDATE montant -> ajuste l''operation cascade au nouveau montant (cumul des tranches du mois) et regenere son ecriture ; WARNING sans modification si exercice clos ou montant invalide. Anti-recursion preservee via NOT EXISTS (source, source_ref).';

REVOKE ALL ON FUNCTION public.cascade_versement_client_to_operation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_versement_client_to_operation TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_cascade_versement_to_operation ON public.versements_clients;
CREATE TRIGGER trg_cascade_versement_to_operation
  AFTER INSERT OR UPDATE OF montant ON public.versements_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_versement_client_to_operation();

COMMIT;

-- Verification rapide post-application (a executer apres le COMMIT) :
--   SELECT tgname, pg_get_triggerdef(oid)
--     FROM pg_trigger
--    WHERE tgrelid = 'public.versements_clients'::regclass
--      AND tgname = 'trg_cascade_versement_to_operation';
-- Attendu : AFTER INSERT OR UPDATE OF montant ... EXECUTE FUNCTION ...
