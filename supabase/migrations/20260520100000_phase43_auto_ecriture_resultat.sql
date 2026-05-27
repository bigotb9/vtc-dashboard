-- ============================================================
-- PHASE 4.3 — Module 1 : Auto-écriture résultat (compte 13)
-- ============================================================
-- Référence : doc Phase 4.3 §1.
--
-- À chaque export Bilan (exercice OUVERT), on (re)crée une écriture
-- comptable d'ajustement qui porte le résultat net au compte 13 du passif.
--
-- Contrepartie : compte technique 891 « Détermination du résultat »
-- (filtré du Bilan car classe 8 — déjà exclu par calculerBilan).
--
-- Schémas d'écriture :
--   • Bénéfice :  DEBIT  891  / CREDIT 130 (Résultat net : Bénéfice)
--   • Perte    :  DEBIT  139  / CREDIT 891  (Résultat net : Perte)
--
-- À la clôture, l'écriture est figée comme toutes les autres
-- (trigger enforce_exercice_clos_lock_ecriture).
--
-- TODO Phase 5 SaaS : ALTER ADD COLUMN tenant_id sur ecritures_comptables,
--                      lignes_ecritures et propager à la fonction.
-- ============================================================


-- ── 1. Colonnes additives sur ecritures_comptables ──────────────────────────
ALTER TABLE public.ecritures_comptables
  ADD COLUMN IF NOT EXISTS auto_generated       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_generation_type TEXT;

-- Note : `exercice_id` existe déjà (Phase 1 — NOT NULL).
-- Note : la colonne `cloture` (boolean) existe déjà pour les écritures
--        manuellement figées.

CREATE INDEX IF NOT EXISTS idx_ecritures_auto
  ON public.ecritures_comptables(exercice_id, auto_generation_type)
  WHERE auto_generated = TRUE;

COMMENT ON COLUMN public.ecritures_comptables.auto_generated IS
  'PHASE 4.3 — TRUE si l''écriture est générée automatiquement (cf auto_generation_type)';
COMMENT ON COLUMN public.ecritures_comptables.auto_generation_type IS
  'PHASE 4.3 — Type de génération : ''resultat_exercice'' (compte 13), ''cloture'' (autres ajustements futurs)';


-- ── 2. Trigger enforce_exercice_clos_lock sur écritures + lignes ────────────
-- Le trigger initial (Phase 4.2) ne couvre QUE `operations`. Les écritures
-- auto_generated n'ont pas de operation_id → la protection par le trigger
-- operations ne s'applique pas. On étend explicitement.

CREATE OR REPLACE FUNCTION public.enforce_exercice_clos_lock_ecriture()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_statut TEXT;
  v_bypass TEXT;
BEGIN
  -- Bypass volontaire pour ajuster_resultat_exercice(p_force_recalcul := TRUE)
  -- ou pour la fonction de clôture elle-même (recovery admin).
  BEGIN
    v_bypass := current_setting('compta.auto_recalcul_allowed', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT statut INTO v_statut
    FROM public.exercices
   WHERE id = COALESCE(NEW.exercice_id, OLD.exercice_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications d''écritures interdites (exercice_id=%)',
      COALESCE(NEW.exercice_id, OLD.exercice_id)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_ecritures_exercice_clos_lock ON public.ecritures_comptables;
CREATE TRIGGER tr_ecritures_exercice_clos_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exercice_clos_lock_ecriture();


CREATE OR REPLACE FUNCTION public.enforce_exercice_clos_lock_ligne()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_statut TEXT;
  v_bypass TEXT;
BEGIN
  BEGIN
    v_bypass := current_setting('compta.auto_recalcul_allowed', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT e.statut INTO v_statut
    FROM public.ecritures_comptables ec
    JOIN public.exercices e ON e.id = ec.exercice_id
   WHERE ec.id = COALESCE(NEW.ecriture_id, OLD.ecriture_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications de lignes interdites'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_lignes_ecritures_clos_lock ON public.lignes_ecritures;
CREATE TRIGGER tr_lignes_ecritures_clos_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.lignes_ecritures
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exercice_clos_lock_ligne();


-- ── 3. Étendre CHECK sur comptes_syscohada.type pour 'technique' ────────────
DO $do$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT con.conname INTO v_conname
    FROM pg_constraint con
    JOIN pg_class cls ON con.conrelid = cls.oid
   WHERE cls.relname = 'comptes_syscohada'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.comptes_syscohada DROP CONSTRAINT %I', v_conname);
  END IF;
END $do$;

ALTER TABLE public.comptes_syscohada
  ADD CONSTRAINT comptes_syscohada_type_check CHECK (type IN (
    'capitaux_propres', 'dettes_financieres',
    'immobilisation',   'amortissement', 'immobilisation_fin',
    'tiers_actif',      'tiers_passif',  'tiers',
    'tresorerie',
    'charge_exploitation', 'charge_personnel',
    'charge_financiere',   'dotation',
    'produit_exploitation','produit_financier','reprise',
    'technique'   -- ✦ PHASE 4.3 : comptes de regroupement / résultat non bilanciels
  ));


-- ── 4. Comptes 130 / 139 / 89 / 891 ─────────────────────────────────────────
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('130', 'Résultat net de l''exercice : Bénéfice', 1, 'capitaux_propres', '13',  41),
  ('139', 'Résultat net de l''exercice : Perte',    1, 'capitaux_propres', '13',  42),
  ('89',  'Comptes de regroupement',                  8, 'technique',         NULL, 1),
  ('891', 'Détermination du résultat',                8, 'technique',         '89', 2)
ON CONFLICT (code) DO NOTHING;


-- ── 5. Mapping Bilan pour 130 / 139 (longest prefix match) ──────────────────
INSERT INTO public.bilan_mapping (classe_compte, poste_bilan, section, cote, ordre) VALUES
  ('130', 'CP_RESULTAT', 'CAP_PROPRES', 'passif', 53),
  ('139', 'CP_RESULTAT', 'CAP_PROPRES', 'passif', 54)
ON CONFLICT (classe_compte) DO NOTHING;


-- ── 6. Fonction ajuster_resultat_exercice ───────────────────────────────────
-- Recalcule le résultat net puis (re)crée l'écriture auto-générée correspondante.
-- Renvoie un résumé pour log applicatif.
CREATE OR REPLACE FUNCTION public.ajuster_resultat_exercice(
  p_exercice_id    UUID,
  p_force_recalcul BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  ecriture_id    UUID,
  resultat_net   BIGINT,
  type_montant   TEXT,        -- 'benefice' | 'perte' | 'nul'
  numero         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut          TEXT;
  v_date_fin        DATE;
  v_resultat_net    BIGINT;
  v_resultat_abs    BIGINT;
  v_ecriture_id     UUID;
  v_numero          TEXT;
  v_type_montant    TEXT;
  v_total_produits  BIGINT;
  v_total_charges   BIGINT;
  v_total_hao_pr    BIGINT;
  v_total_hao_ch    BIGINT;
  v_total_impots    BIGINT;
BEGIN
  -- 1. Charger statut + date_fin
  SELECT statut, date_fin INTO v_statut, v_date_fin
    FROM public.exercices
   WHERE id = p_exercice_id;

  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Exercice introuvable : %', p_exercice_id;
  END IF;

  IF v_statut = 'clos' AND NOT p_force_recalcul THEN
    RAISE EXCEPTION 'Exercice clos : recalcul interdit (passer p_force_recalcul := TRUE)';
  END IF;

  -- 2. Activer le bypass de trigger si force_recalcul (exercice clos)
  IF p_force_recalcul THEN
    PERFORM set_config('compta.auto_recalcul_allowed', 'true', true);
  END IF;

  -- 3. Calcul résultat net via lignes_ecritures des opérations validées
  --    Formule : Σ produits (7x sauf 84) − Σ charges (6x sauf 83/87/89)
  --            + Σ HAO produits (84) − Σ HAO charges (83) − Σ impôts (87 + 89)
  SELECT
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '7%'
        AND compte_syscohada_code NOT LIKE '84%'
      THEN credit - debit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '6%'
        AND compte_syscohada_code NOT LIKE '83%'
        AND compte_syscohada_code NOT LIKE '87%'
        AND compte_syscohada_code NOT LIKE '89%'
      THEN debit - credit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '84%'
      THEN credit - debit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '83%'
      THEN debit - credit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '87%'
        OR compte_syscohada_code LIKE '89%'
      THEN debit - credit ELSE 0 END), 0)
  INTO v_total_produits, v_total_charges, v_total_hao_pr, v_total_hao_ch, v_total_impots
  FROM public.lignes_ecritures le
  JOIN public.ecritures_comptables ec ON ec.id = le.ecriture_id
  WHERE ec.exercice_id = p_exercice_id
    AND ec.statut = 'valide'
    AND ec.auto_generated = FALSE;   -- ✦ exclure l'éventuelle ancienne auto-écriture

  v_resultat_net := v_total_produits - v_total_charges + v_total_hao_pr - v_total_hao_ch - v_total_impots;

  IF v_resultat_net = 0 THEN
    v_type_montant := 'nul';
  ELSIF v_resultat_net > 0 THEN
    v_type_montant := 'benefice';
  ELSE
    v_type_montant := 'perte';
  END IF;

  -- 4. Supprimer ancienne auto-écriture (cascade sur lignes_ecritures)
  DELETE FROM public.ecritures_comptables
    WHERE exercice_id = p_exercice_id
      AND auto_generated = TRUE
      AND auto_generation_type = 'resultat_exercice';

  -- 5. Si résultat = 0, on s'arrête là — pas d'écriture à créer
  IF v_resultat_net = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0::BIGINT, 'nul'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  v_resultat_abs := ABS(v_resultat_net);

  -- 6. Créer la nouvelle écriture (journal OD, date = date_fin exercice)
  v_numero := 'AUTO-RES-' || to_char(v_date_fin, 'YYYY') || '-' || substring(p_exercice_id::text, 1, 8);

  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle,
    exercice_id, statut, source_manuelle,
    auto_generated, auto_generation_type
  ) VALUES (
    v_numero, v_date_fin, 'OD', 'Ajustement automatique résultat exercice — ' || v_type_montant,
    p_exercice_id, 'valide', FALSE,
    TRUE, 'resultat_exercice'
  )
  RETURNING id INTO v_ecriture_id;

  -- 7. Lignes — partie double
  IF v_type_montant = 'benefice' THEN
    -- DEBIT 891 / CREDIT 130
    INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
    VALUES
      (v_ecriture_id, 1, '891', 'Détermination du résultat (bénéfice)', v_resultat_abs, 0),
      (v_ecriture_id, 2, '130', 'Résultat net de l''exercice : Bénéfice', 0, v_resultat_abs);
  ELSE
    -- v_type_montant = 'perte' : DEBIT 139 / CREDIT 891
    INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
    VALUES
      (v_ecriture_id, 1, '139', 'Résultat net de l''exercice : Perte',  v_resultat_abs, 0),
      (v_ecriture_id, 2, '891', 'Détermination du résultat (perte)',   0, v_resultat_abs);
  END IF;

  -- 8. Désactiver le bypass (LOCAL : auto-revert en fin de transaction)
  IF p_force_recalcul THEN
    PERFORM set_config('compta.auto_recalcul_allowed', 'false', true);
  END IF;

  RETURN QUERY SELECT v_ecriture_id, v_resultat_net, v_type_montant, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.ajuster_resultat_exercice(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajuster_resultat_exercice(UUID, BOOLEAN) TO authenticated, service_role;

COMMENT ON FUNCTION public.ajuster_resultat_exercice(UUID, BOOLEAN) IS
  'PHASE 4.3 — (Re)crée l''écriture automatique d''ajustement du résultat (compte 13). À appeler AVANT chaque export Bilan si exercice ouvert, et une dernière fois à la clôture.';


-- ── 7. Mise à jour exercices.resultat_net après recalcul (helper RPC) ───────
-- Petite RPC associée qui appelle ajuster_resultat_exercice + met à jour
-- exercices.resultat_net pour cohérence avec la vue UI exercices.
CREATE OR REPLACE FUNCTION public.recalculer_resultat_exercice(p_exercice_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_net BIGINT;
BEGIN
  SELECT resultat_net INTO v_result_net
    FROM public.ajuster_resultat_exercice(p_exercice_id, FALSE);

  UPDATE public.exercices
     SET resultat_net = v_result_net
   WHERE id = p_exercice_id;

  RETURN v_result_net;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculer_resultat_exercice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculer_resultat_exercice(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.recalculer_resultat_exercice(UUID) IS
  'PHASE 4.3 — Wrapper appelable côté API : recalcule l''auto-écriture + met à jour exercices.resultat_net.';
