-- ============================================================
-- L5 patch (audit 01/06/2026) — Refonte sync_operation_to_legacy()
-- ============================================================
-- Correctif du trigger sync_operation_to_legacy() (snapshot prod :
-- 00000000000000_legacy_baseline.sql l.1824, ex-20260517000000).
--
-- DÉCISIONS MÉTIER (Emmanuel, 01/06/2026) :
--
-- 1. RETRAIT de la branche 'versement_client'. Un reversement client n'est
--    PAS une dépense opérationnelle : il vit uniquement dans versements_clients
--    (catégorie compta classe 41). Il ne doit plus apparaître ni dans
--    /depenses (depenses_vehicules) ni dans recettes_wave.
--    => Le trigger ne traite plus que source='manuel'.
--    NB : les jumeaux 'Reversement client' DÉJÀ présents dans
--    depenses_vehicules ne sont PAS supprimés par ce trigger. La transition
--    cleanup ne fire que pour OLD.source='manuel' ; un op versement_client
--    mis à jour ne touche donc pas son ancien jumeau. Le purge de l'historique
--    (~10M F) fera l'objet d'un nettoyage séparé (avec vérif versements_clients).
--
-- 2. GARDE-FOU anti-repollution sur les sorties source='manuel' : on ne
--    miroite vers depenses_vehicules QUE si la catégorie de l'op est de
--    type='depense'. Toute autre sortie (investissement / remboursement /
--    apport / transfert / dotation / categorie_id NULL) n'est PAS miroitée,
--    et un éventuel jumeau est supprimé (cas reclassement).
--
-- 3. Filtre statut='valide' CONSERVÉ (présent dans la version prod).
--
-- 4. Bonus cohérence : sur UPDATE, nettoyage du jumeau de l'autre table en
--    cas de flip type (sortie -> entree et entree -> sortie).
--
-- 5. Dépenses véhicule (propre ET client) inchangées : elles sont
--    source='depense_vehicule', donc ignorées par ce trigger.
--
-- Pas de DROP/CREATE TRIGGER (le trigger pointe la fonction par son nom).
-- Pas de reprise initiale. Pas de changement de permissions.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_operation_to_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id   BIGINT;
  v_existing_uuid UUID;
  v_cat_type      TEXT;   -- L5 : type de la catégorie de l'op (categories_operations.type)
BEGIN
  -- (L5 01/06/2026) Seule la source 'manuel' est désormais synchronisée vers
  -- les tables legacy. La branche 'versement_client' a été RETIRÉE : un
  -- reversement client n'est pas une dépense opérationnelle, il vit uniquement
  -- dans versements_clients (catégorie compta classe 41) et ne doit plus
  -- apparaître ni dans /depenses ni dans recettes_wave.
  -- NB : les jumeaux 'Reversement client' déjà présents dans depenses_vehicules
  -- ne sont PAS supprimés par ce trigger (nettoyage séparé à venir).

  -- ── CAS DELETE ─────────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.source = 'manuel' THEN
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

  -- ── statut <> 'valide' → nettoyer le jumeau legacy (FILTRE CONSERVÉ) ─────
  IF NEW.statut <> 'valide' THEN
    IF NEW.source = 'manuel' THEN
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

  -- ── Source hors périmètre → ignorer (+ nettoyage si transition manuel → autre)
  IF NEW.source <> 'manuel' THEN
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

  -- ── INSERT / UPDATE : source='manuel' ET statut='valide' ────────────────

  IF NEW.type = 'entree' THEN
    -- Bonus cohérence : flip sortie -> entree → supprimer le jumeau dépense
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.depenses_vehicules WHERE id_depense = OLD.id;
    END IF;

    -- Sync vers recettes_wave (UPSERT par "Identifiant de transaction")
    SELECT id INTO v_existing_id
      FROM public.recettes_wave
     WHERE "Identifiant de transaction" = 'op_' || NEW.id::text
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
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
    -- Bonus cohérence : flip entree -> sortie → supprimer le jumeau recette
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.recettes_wave
       WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
    END IF;

    -- ── L5 GARDE-FOU anti-repollution ──────────────────────────────────
    -- Ne miroiter vers depenses_vehicules QUE les vraies charges, c.-à-d.
    -- catégorie de type='depense'. Les autres sorties manuelles
    -- (investissement / remboursement / apport / transfert / NULL...)
    -- ne doivent PAS alimenter la table opérationnelle des dépenses.
    SELECT type INTO v_cat_type
      FROM public.categories_operations
     WHERE id = NEW.categorie_id;

    IF v_cat_type IS DISTINCT FROM 'depense' THEN
      -- Pas une dépense → s'assurer qu'aucun jumeau ne subsiste (reclassement)
      DELETE FROM public.depenses_vehicules WHERE id_depense = NEW.id;
      RETURN NEW;
    END IF;

    -- Catégorie 'depense' confirmée → UPSERT (par id_depense = operation.id)
    SELECT id_depense INTO v_existing_uuid
      FROM public.depenses_vehicules
     WHERE id_depense = NEW.id
     LIMIT 1;

    IF v_existing_uuid IS NOT NULL THEN
      UPDATE public.depenses_vehicules SET
        date_depense  = NEW.date_operation,
        montant       = NEW.montant,
        type_depense  = 'Manuel',
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
  'Synchronise operations (source=manuel, statut=valide) vers recettes_wave / depenses_vehicules. Sortie miroitée uniquement si categorie.type=depense (L5 anti-repollution 01/06/2026). Branche versement_client RETIREE. Trigger AFTER INSERT/UPDATE/DELETE.';


-- ── Smoke tests (à exécuter manuellement APRÈS application en Studio) ─────
-- T0) La fonction ne référence plus aucun reversement (attendu : 0 | 0)
-- SELECT (pg_get_functiondef('public.sync_operation_to_legacy'::regproc) ILIKE '%versement_client%')::int  AS ref_versement_client,
--        (pg_get_functiondef('public.sync_operation_to_legacy'::regproc) ILIKE '%Reversement client%')::int AS ref_label_reversement;
--
-- T1) Op manuelle catégorie 'depense' → 1 ligne depenses_vehicules
-- INSERT INTO public.operations (type,date_operation,montant,libelle,source,statut,caisse_id,categorie_id,created_by,updated_by)
-- VALUES ('sortie',CURRENT_DATE,11111,'TEST L5 depense','manuel','valide',
--         (SELECT id FROM caisses LIMIT 1),
--         (SELECT id FROM categories_operations WHERE type='depense' LIMIT 1),
--         auth.uid(),auth.uid());
-- SELECT count(*) FROM depenses_vehicules WHERE description='TEST L5 depense';  -- attendu 1
--
-- T2) Op manuelle catégorie 'investissement' → 0 ligne
-- INSERT INTO public.operations (type,date_operation,montant,libelle,source,statut,caisse_id,categorie_id,created_by,updated_by)
-- VALUES ('sortie',CURRENT_DATE,22222,'TEST L5 invest','manuel','valide',
--         (SELECT id FROM caisses LIMIT 1),
--         (SELECT id FROM categories_operations WHERE type='investissement' LIMIT 1),
--         auth.uid(),auth.uid());
-- SELECT count(*) FROM depenses_vehicules WHERE description='TEST L5 invest';   -- attendu 0
--
-- T3) Reclassement depense → investissement supprime le jumeau
-- UPDATE public.operations
--    SET categorie_id = (SELECT id FROM categories_operations WHERE type='investissement' LIMIT 1)
--  WHERE libelle='TEST L5 depense';
-- SELECT count(*) FROM depenses_vehicules WHERE description='TEST L5 depense';  -- attendu 0
--
-- T4) Op manuelle entree → recettes_wave 'Manuel' (et plus 'Versement client')
-- INSERT INTO public.operations (type,date_operation,montant,libelle,source,statut,caisse_id,categorie_id,created_by,updated_by)
-- VALUES ('entree',CURRENT_DATE,33333,'TEST L5 entree','manuel','valide',
--         (SELECT id FROM caisses LIMIT 1),
--         (SELECT id FROM categories_operations WHERE type='recette' LIMIT 1),
--         auth.uid(),auth.uid());
-- SELECT "Type de transaction" FROM recettes_wave WHERE "Nom de contrepartie"='TEST L5 entree'; -- attendu 'Manuel'
--
-- T5) Nettoyage
-- DELETE FROM public.operations WHERE libelle IN ('TEST L5 depense','TEST L5 invest','TEST L5 entree');
-- SELECT count(*) FROM depenses_vehicules WHERE description IN ('TEST L5 depense','TEST L5 invest'); -- attendu 0
-- SELECT count(*) FROM recettes_wave WHERE "Nom de contrepartie"='TEST L5 entree';                  -- attendu 0
