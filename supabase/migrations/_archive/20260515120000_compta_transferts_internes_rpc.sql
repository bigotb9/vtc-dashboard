-- ============================================================
-- PHASE 4.x VAGUE 1 — Transferts internes Boyah ↔ Boyah
-- ============================================================
-- Référence : doc Phase 4.x Vague 1 §2 + §4.
--
-- La table `transferts_internes` existe déjà depuis la migration Phase 1
-- (20260510120000_compta_module.sql, lignes 253-278) avec les colonnes :
--   source_caisse_id / source_compte_id  (XOR)
--   dest_caisse_id   / dest_compte_id    (XOR)
--   operation_sortie_id, operation_entree_id, ecriture_id
--   exercice_id, statut, created_at/_by, libelle (NOT NULL).
--
-- Cette migration AJOUTE :
--   - indexes manquants sur les FKs source/dest
--   - contrainte interdisant source = destination
--   - colonnes updated_at/updated_by/notes/date_transfert (si manquantes)
--   - fonction RPC `create_transfert_interne` atomique (cœur Vague 1)
--   - catégorie 'Transfert interne' dans categories_operations (idempotent)
-- ============================================================


-- ── 1. Colonnes additionnelles (compatibles avec la table existante) ─────────
-- date_transfert : déjà présente, on s'assure que la colonne existe ;
-- updated_at/updated_by/notes : si introduites plus tard, idempotent.
ALTER TABLE public.transferts_internes
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by   UUID        REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS notes        TEXT;


-- ── 2. Contrainte interdisant source = destination ───────────────────────────
-- Une caisse/compte ne peut pas se transférer à elle-même. La contrainte XOR
-- déjà présente garantit l'exclusivité côté source ET côté destination, mais
-- elle n'empêche pas la comparaison source vs dest. On l'ajoute en NOT VALID
-- pour éviter de casser sur d'éventuelles lignes existantes, puis VALIDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_transfert_source_dest_different'
       AND conrelid = 'public.transferts_internes'::regclass
  ) THEN
    ALTER TABLE public.transferts_internes
      ADD CONSTRAINT chk_transfert_source_dest_different
      CHECK (
        NOT (source_caisse_id IS NOT NULL AND source_caisse_id = dest_caisse_id)
        AND NOT (source_compte_id IS NOT NULL AND source_compte_id = dest_compte_id)
      ) NOT VALID;

    -- Valider sur les lignes existantes (échoue si une ligne illégale existe)
    BEGIN
      ALTER TABLE public.transferts_internes
        VALIDATE CONSTRAINT chk_transfert_source_dest_different;
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'Lignes existantes violant chk_transfert_source_dest_different — contrainte laissée NOT VALID. Nettoyer manuellement.';
    END;
  END IF;
END$$;


-- ── 3. Indexes (perf des recherches source/dest) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transferts_date           ON public.transferts_internes(date_transfert DESC);
CREATE INDEX IF NOT EXISTS idx_transferts_source_caisse  ON public.transferts_internes(source_caisse_id);
CREATE INDEX IF NOT EXISTS idx_transferts_source_compte  ON public.transferts_internes(source_compte_id);
CREATE INDEX IF NOT EXISTS idx_transferts_dest_caisse    ON public.transferts_internes(dest_caisse_id);
CREATE INDEX IF NOT EXISTS idx_transferts_dest_compte    ON public.transferts_internes(dest_compte_id);
CREATE INDEX IF NOT EXISTS idx_transferts_statut         ON public.transferts_internes(statut);


-- ── 3bis. Contrainte UNIQUE operations.(source, source_ref) → index PARTIEL ──
--
-- BUG CRITIQUE corrigé post-livraison Vague 1 :
--   La contrainte/index UNIQUE original sur operations(source, source_ref)
--   (introduit en Phase 1 — migration 20260510120000) était conçu pour les
--   reprises automatiques où une `source_ref` correspond à UNE seule opération
--   (idempotence : recette_wave, depense_vehicule, versement_client, …).
--
--   Or les transferts internes (Vague 1) insèrent volontairement DEUX
--   opérations jumelles partageant le même couple
--   (source='transfert_interne', source_ref=<transfert_id>) — une sortie + une
--   entrée. Ce design est correct (la source_ref partagée permet de retrouver
--   les 2 jumelles par une seule clé), mais incompatible avec la contrainte
--   originale : la RPC plantait au 2e INSERT et rollbackait tout.
--
--   Conséquence : AUCUN transfert n'aurait pu réussir dans l'état initial.
--   Sans ce patch, un déploiement frais (notamment Vercel cold) reproduirait
--   le bug.
--
-- Fix : remplacer la contrainte/index par un index unique PARTIEL qui exclut
--   les opérations issues de transferts internes. L'idempotence est ainsi
--   préservée pour tous les autres types de source.
--
DO $$
BEGIN
  -- Drop la contrainte CHECK si présente (cas Phase 1 où c'était une contrainte
  -- nommée — possible selon l'environnement BD).
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname  = 'operations_source_source_ref_unique'
       AND conrelid = 'public.operations'::regclass
  ) THEN
    ALTER TABLE public.operations
      DROP CONSTRAINT operations_source_source_ref_unique;
  END IF;

  -- Drop l'index s'il subsiste (cas Phase 1 où c'était un index pur via
  -- CREATE UNIQUE INDEX idx_operations_source_unique).
  IF EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'operations_source_source_ref_unique'
       AND tablename = 'operations'
  ) THEN
    DROP INDEX IF EXISTS public.operations_source_source_ref_unique;
  END IF;

  -- Au cas où l'index original suivait l'autre convention de nommage
  -- (cf. Phase 1 ligne 245 : `idx_operations_source_unique`).
  IF EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'idx_operations_source_unique'
       AND tablename = 'operations'
  ) THEN
    DROP INDEX IF EXISTS public.idx_operations_source_unique;
  END IF;
END$$;

-- Recréer en index unique PARTIEL : idempotence préservée pour tout SAUF
-- les transferts internes (où 2 ops partagent le même transfert_id).
CREATE UNIQUE INDEX IF NOT EXISTS operations_source_source_ref_unique
  ON public.operations (source, source_ref)
  WHERE source <> 'transfert_interne'
    AND source_ref IS NOT NULL;

COMMENT ON INDEX public.operations_source_source_ref_unique IS
  'Idempotence des reprises automatiques (recette_wave / depense_vehicule / versement_client / import_csv / dotation_amort / manuel). Exclut transfert_interne — 2 opérations jumelles partagent volontairement la même source_ref (= transfert_id).';


-- ── 4. Catégorie 'Transfert interne' (idempotent) ────────────────────────────
INSERT INTO public.categories_operations (
  libelle, type, compte_syscohada_code, sens, journal_par_defaut,
  description, actif, ordre
)
SELECT
  'Transfert interne',
  'transfert',
  NULL,        -- volontairement NULL : le compte est celui de la caisse/compte
  NULL,        -- volontairement NULL : sens varie selon entrée/sortie
  'OD',
  'Catégorie système : utilisée pour les transferts internes entre caisses/comptes Boyah. Ne pas modifier.',
  true,
  999
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories_operations
   WHERE libelle = 'Transfert interne' AND type = 'transfert'
);


-- ── 5. Fonction RPC atomique create_transfert_interne ────────────────────────
-- Cœur de la Vague 1 : exécute toute la chaîne (transfert + 2 opérations +
-- écriture + 2 lignes) dans une transaction unique. Si une étape échoue,
-- PostgreSQL rollbacke tout. Pas de demi-transfert possible.
--
-- Signature côté Node :
--   supabaseAdmin.rpc('create_transfert_interne', {
--     p_date, p_montant, p_libelle,
--     p_source_caisse_id, p_source_compte_id,
--     p_dest_caisse_id,   p_dest_compte_id,
--     p_user_id, p_notes
--   })
-- Retourne JSON : { transfert_id, operation_sortie_id, operation_entree_id,
--                   ecriture_id, numero_ecriture }
CREATE OR REPLACE FUNCTION public.create_transfert_interne(
  p_date              DATE,
  p_montant           NUMERIC,
  p_libelle           TEXT,
  p_source_caisse_id  UUID,
  p_source_compte_id  UUID,
  p_dest_caisse_id    UUID,
  p_dest_compte_id    UUID,
  p_user_id           UUID,
  p_notes             TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfert_id     UUID;
  v_op_sortie_id     UUID;
  v_op_entree_id     UUID;
  v_ecriture_id      UUID;
  v_code_source      TEXT;
  v_code_dest        TEXT;
  v_libelle_source   TEXT;
  v_libelle_dest     TEXT;
  v_libelle_final    TEXT;
  v_categorie_id     UUID;
  v_exercice_id      UUID;
  v_seq              BIGINT;
  v_annee            INT;
  v_numero           TEXT;
BEGIN
  -- ─ Validations XOR source / dest ─────────────────────────────────────────
  IF (p_source_caisse_id IS NULL AND p_source_compte_id IS NULL)
     OR (p_source_caisse_id IS NOT NULL AND p_source_compte_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source invalide : un et un seul de source_caisse_id / source_compte_id doit être fourni';
  END IF;
  IF (p_dest_caisse_id IS NULL AND p_dest_compte_id IS NULL)
     OR (p_dest_caisse_id IS NOT NULL AND p_dest_compte_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Destination invalide : un et un seul de dest_caisse_id / dest_compte_id doit être fourni';
  END IF;
  IF p_source_caisse_id IS NOT NULL AND p_source_caisse_id = p_dest_caisse_id THEN
    RAISE EXCEPTION 'Source et destination ne peuvent pas être la même caisse';
  END IF;
  IF p_source_compte_id IS NOT NULL AND p_source_compte_id = p_dest_compte_id THEN
    RAISE EXCEPTION 'Source et destination ne peuvent pas être le même compte';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être strictement positif';
  END IF;

  -- ─ Récupérer codes SYSCOHADA et libellés source/dest ─────────────────────
  IF p_source_caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code, libelle
      INTO v_code_source, v_libelle_source
      FROM public.caisses
     WHERE id = p_source_caisse_id;
  ELSE
    SELECT compte_syscohada_code, libelle
      INTO v_code_source, v_libelle_source
      FROM public.comptes
     WHERE id = p_source_compte_id;
  END IF;
  IF v_code_source IS NULL THEN
    RAISE EXCEPTION 'Source sans mapping SYSCOHADA (compte_syscohada_code NULL)';
  END IF;

  IF p_dest_caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code, libelle
      INTO v_code_dest, v_libelle_dest
      FROM public.caisses
     WHERE id = p_dest_caisse_id;
  ELSE
    SELECT compte_syscohada_code, libelle
      INTO v_code_dest, v_libelle_dest
      FROM public.comptes
     WHERE id = p_dest_compte_id;
  END IF;
  IF v_code_dest IS NULL THEN
    RAISE EXCEPTION 'Destination sans mapping SYSCOHADA (compte_syscohada_code NULL)';
  END IF;

  -- ─ Libellé final (auto-généré si non fourni) ─────────────────────────────
  v_libelle_final := COALESCE(
    NULLIF(TRIM(p_libelle), ''),
    'Transfert interne : ' || v_libelle_source || ' → ' || v_libelle_dest
  );

  -- ─ Exercice qui couvre la date ───────────────────────────────────────────
  SELECT id INTO v_exercice_id
    FROM public.exercices
   WHERE date_debut <= p_date AND date_fin >= p_date
     AND cloture = false
   ORDER BY date_debut DESC
   LIMIT 1;
  IF v_exercice_id IS NULL THEN
    RAISE EXCEPTION 'Aucun exercice ouvert ne couvre la date %', p_date;
  END IF;

  -- ─ Catégorie 'Transfert interne' (créée par la migration § 4) ───────────
  SELECT id INTO v_categorie_id
    FROM public.categories_operations
   WHERE libelle = 'Transfert interne' AND type = 'transfert'
   LIMIT 1;
  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie système Transfert interne introuvable';
  END IF;

  -- ─ Numéro d'écriture : YYYY-OD-NNNNNN sur l'exercice courant ────────────
  SELECT EXTRACT(YEAR FROM date_debut)::INT INTO v_annee
    FROM public.exercices WHERE id = v_exercice_id;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
    FROM public.ecritures_comptables
   WHERE journal_code = 'OD' AND exercice_id = v_exercice_id;
  v_numero := v_annee || '-OD-' || LPAD(v_seq::TEXT, 6, '0');

  -- ─ 1. INSERT transfert (sans liens ops/ecr — patchés en fin) ────────────
  INSERT INTO public.transferts_internes (
    date_transfert, montant, libelle,
    source_caisse_id, source_compte_id,
    dest_caisse_id,   dest_compte_id,
    exercice_id, statut, created_by, updated_by, notes
  ) VALUES (
    p_date, p_montant, v_libelle_final,
    p_source_caisse_id, p_source_compte_id,
    p_dest_caisse_id,   p_dest_compte_id,
    v_exercice_id, 'valide', p_user_id, p_user_id, p_notes
  ) RETURNING id INTO v_transfert_id;

  -- ─ 2. INSERT opération SORTIE (source) ───────────────────────────────────
  INSERT INTO public.operations (
    date_operation, type, montant, libelle,
    caisse_id, compte_id,
    categorie_id, source, source_ref,
    statut, exercice_id, created_by, updated_by
  ) VALUES (
    p_date, 'sortie', p_montant, v_libelle_final,
    p_source_caisse_id, p_source_compte_id,
    v_categorie_id, 'transfert_interne', v_transfert_id,
    'valide', v_exercice_id, p_user_id, p_user_id
  ) RETURNING id INTO v_op_sortie_id;

  -- ─ 3. INSERT opération ENTREE (destination) ──────────────────────────────
  INSERT INTO public.operations (
    date_operation, type, montant, libelle,
    caisse_id, compte_id,
    categorie_id, source, source_ref,
    statut, exercice_id, created_by, updated_by
  ) VALUES (
    p_date, 'entree', p_montant, v_libelle_final,
    p_dest_caisse_id, p_dest_compte_id,
    v_categorie_id, 'transfert_interne', v_transfert_id,
    'valide', v_exercice_id, p_user_id, p_user_id
  ) RETURNING id INTO v_op_entree_id;

  -- ─ 4. INSERT écriture comptable (statut=brouillon temporaire) ───────────
  --    operation_id pointe vers la SORTIE (convention)
  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle, exercice_id,
    operation_id, transfert_id, source_manuelle, statut
  ) VALUES (
    v_numero, p_date, 'OD', v_libelle_final, v_exercice_id,
    v_op_sortie_id, v_transfert_id, false, 'brouillon'
  ) RETURNING id INTO v_ecriture_id;

  -- ─ 5. INSERT lignes (débit destination / crédit source) ─────────────────
  INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
  VALUES
    (v_ecriture_id, 1, v_code_dest,   v_libelle_dest,   p_montant, 0),
    (v_ecriture_id, 2, v_code_source, v_libelle_source, 0,         p_montant);

  -- ─ 6. Validation de l'écriture (déclenche trigger équilibre BD) ─────────
  UPDATE public.ecritures_comptables
     SET statut    = 'valide',
         valide_le = NOW(),
         valide_par = p_user_id
   WHERE id = v_ecriture_id;

  -- ─ 7. Patcher les liens retour ───────────────────────────────────────────
  UPDATE public.transferts_internes
     SET operation_sortie_id = v_op_sortie_id,
         operation_entree_id = v_op_entree_id,
         ecriture_id          = v_ecriture_id,
         updated_at           = NOW(),
         updated_by           = p_user_id
   WHERE id = v_transfert_id;

  UPDATE public.operations
     SET ecriture_id = v_ecriture_id,
         updated_at  = NOW(),
         updated_by  = p_user_id
   WHERE id IN (v_op_sortie_id, v_op_entree_id);

  -- ─ Retour JSON ───────────────────────────────────────────────────────────
  RETURN json_build_object(
    'transfert_id',         v_transfert_id,
    'operation_sortie_id',  v_op_sortie_id,
    'operation_entree_id',  v_op_entree_id,
    'ecriture_id',          v_ecriture_id,
    'numero_ecriture',      v_numero
  );
END;
$$;

COMMENT ON FUNCTION public.create_transfert_interne IS
  'Crée un transfert interne atomique (Phase 4.x Vague 1) : insert 1 transfert + 2 opérations + 1 écriture + 2 lignes en une seule transaction. Rollback automatique si la moindre étape échoue.';


-- ── 6. Permissions RPC (directeur via RLS, function accessible authenticated) ─
REVOKE ALL ON FUNCTION public.create_transfert_interne FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_transfert_interne TO authenticated, service_role;
