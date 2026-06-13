-- ============================================================
-- LOT G - Helper SQL ecriture auto + extension triggers Wave / Versements
-- 26/05/2026
-- ============================================================
-- Probleme audit (finding 7.3) : les triggers `trg_cascade_recette_wave`
-- et `trg_cascade_versement_to_operation` creent des operations validees
-- mais SANS ecriture comptable. Il fallait declencher manuellement
-- /api/compta/operations/regenerer-ecritures pour que Bilan / Compte
-- de Resultat soient corrects.
--
-- Solution : helper PL/pgSQL `generer_ecriture_pour_operation(UUID)` qui
-- replique la logique TS `lib/compta/ecritures.ts::genererEcritureFromOperation`,
-- appele par les 2 triggers cascade apres l'INSERT de l'operation.
--
-- Contraintes respectees :
--   - Numerotation race-safe via pg_advisory_xact_lock par (journal, exercice)
--   - Idempotence : early-return si op.ecriture_id deja rempli
--   - Fail-safe global : bloc EXCEPTION attrape tout, retourne NULL,
--     l'operation reste valide (rollback implicite des INSERT partiels
--     via sub-transaction PL/pgSQL)
--   - Anti-recursion triggers : RETURNING id INTO v_op_id apres ON CONFLICT
--     DO NOTHING — v_op_id est NULL en cas de conflit, donc on n'appelle
--     pas le helper deux fois pour le meme source_ref
-- ============================================================

BEGIN;

-- ─── 1. HELPER generer_ecriture_pour_operation ──────────────────────────────
CREATE OR REPLACE FUNCTION public.generer_ecriture_pour_operation(p_op_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC$
DECLARE
  v_op            RECORD;
  v_cat           RECORD;
  v_compte_tresor TEXT;
  v_journal       TEXT;
  v_numero        TEXT;
  v_annee         INT;
  v_last_seq      INT;
  v_seq           INT;
  v_ecr_id        UUID;
  v_debit_tresor  NUMERIC;
  v_credit_tresor NUMERIC;
  v_debit_cat     NUMERIC;
  v_credit_cat    NUMERIC;
BEGIN
  -- ─── 1. Charger l'operation ─────────────────────────────────────────
  SELECT * INTO v_op FROM public.operations WHERE id = p_op_id;
  IF NOT FOUND THEN
    RAISE WARNING '[generer_ecriture] op % introuvable', p_op_id;
    RETURN NULL;
  END IF;

  -- Idempotence : deja liee a une ecriture
  IF v_op.ecriture_id IS NOT NULL THEN
    RETURN v_op.ecriture_id;
  END IF;

  -- L'operation doit etre validee
  IF v_op.statut IS DISTINCT FROM 'valide' THEN
    RAISE WARNING '[generer_ecriture] op % non validee (statut=%)', p_op_id, v_op.statut;
    RETURN NULL;
  END IF;

  -- ─── 2. Charger la categorie + verifier mapping SYSCOHADA ───────────
  SELECT * INTO v_cat FROM public.categories_operations WHERE id = v_op.categorie_id;
  IF NOT FOUND THEN
    RAISE WARNING '[generer_ecriture] op % categorie % introuvable', p_op_id, v_op.categorie_id;
    RETURN NULL;
  END IF;
  IF v_cat.compte_syscohada_code IS NULL OR v_cat.compte_syscohada_code = '' OR v_cat.sens IS NULL THEN
    RAISE WARNING '[generer_ecriture] op % categorie "%" sans mapping (code=%, sens=%)',
      p_op_id, v_cat.libelle, v_cat.compte_syscohada_code, v_cat.sens;
    RETURN NULL;
  END IF;

  -- ─── 3. Code SYSCOHADA du compte de tresorerie (caisse OU compte) ───
  IF v_op.caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code INTO v_compte_tresor
    FROM public.caisses WHERE id = v_op.caisse_id;
  ELSIF v_op.compte_id IS NOT NULL THEN
    SELECT compte_syscohada_code INTO v_compte_tresor
    FROM public.comptes WHERE id = v_op.compte_id;
  END IF;
  IF v_compte_tresor IS NULL OR v_compte_tresor = '' THEN
    RAISE WARNING '[generer_ecriture] op % sans compte tresorerie SYSCOHADA (caisse=%, compte=%)',
      p_op_id, v_op.caisse_id, v_op.compte_id;
    RETURN NULL;
  END IF;

  -- ─── 4. Choix du journal ────────────────────────────────────────────
  -- Priorite : journal_par_defaut de la categorie, sinon VE/BQ/CA selon type
  v_journal := COALESCE(
    NULLIF(v_cat.journal_par_defaut, ''),
    CASE
      WHEN v_op.type = 'entree'            THEN 'VE'
      WHEN v_op.compte_id IS NOT NULL      THEN 'BQ'
      ELSE                                      'CA'
    END
  );

  -- ─── 5. Numerotation YYYY-JJ-NNNNNN (race-safe via advisory lock) ───
  -- Le lock est transactionnel : libere automatiquement au COMMIT/ROLLBACK.
  -- Serialise uniquement les inserts concurrent sur le meme (journal, exercice).
  PERFORM pg_advisory_xact_lock(
    hashtext('ecriture_seq_' || v_journal || '_' || v_op.exercice_id::text)
  );

  SELECT EXTRACT(YEAR FROM date_debut)::INT INTO v_annee
  FROM public.exercices WHERE id = v_op.exercice_id;
  IF v_annee IS NULL THEN
    RAISE WARNING '[generer_ecriture] op % exercice % introuvable', p_op_id, v_op.exercice_id;
    RETURN NULL;
  END IF;

  -- MAX(seq) + 1 plutot que COUNT pour gerer les trous (extournes, DELETE, etc.)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^.*-(\d+)$', '\1'), '')::INT), 0)
    INTO v_last_seq
    FROM public.ecritures_comptables
   WHERE journal_code = v_journal
     AND exercice_id  = v_op.exercice_id
     AND numero LIKE v_annee::TEXT || '-' || v_journal || '-%';

  v_seq := v_last_seq + 1;
  v_numero := v_annee::TEXT || '-' || v_journal || '-' || LPAD(v_seq::TEXT, 6, '0');

  -- ─── 6. Preparer les 2 lignes (partie double) ───────────────────────
  -- Ligne 1 : tresorerie (caisse/compte). Entree -> debit. Sortie -> credit.
  IF v_op.type = 'entree' THEN
    v_debit_tresor  := v_op.montant;
    v_credit_tresor := 0;
  ELSE
    v_debit_tresor  := 0;
    v_credit_tresor := v_op.montant;
  END IF;

  -- Ligne 2 : categorie. Sens donne par cat.sens ('debit' ou 'credit').
  IF v_cat.sens = 'debit' THEN
    v_debit_cat  := v_op.montant;
    v_credit_cat := 0;
  ELSE
    v_debit_cat  := 0;
    v_credit_cat := v_op.montant;
  END IF;

  -- Sanity check : equilibre (le trigger d'equilibre BD le verifie aussi
  -- en UPDATE statut=valide, mais on detecte ici pour eviter l'INSERT)
  IF (v_debit_tresor + v_debit_cat) <> (v_credit_tresor + v_credit_cat) THEN
    RAISE WARNING '[generer_ecriture] op % desequilibree debit=% credit=% (cat.sens=%, op.type=%)',
      p_op_id, (v_debit_tresor + v_debit_cat), (v_credit_tresor + v_credit_cat),
      v_cat.sens, v_op.type;
    RETURN NULL;
  END IF;

  -- ─── 7. INSERT ecriture (statut=brouillon) ──────────────────────────
  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle,
    exercice_id, operation_id, source_manuelle, statut
  ) VALUES (
    v_numero, v_op.date_operation, v_journal, v_op.libelle,
    v_op.exercice_id, v_op.id, FALSE, 'brouillon'
  )
  RETURNING id INTO v_ecr_id;

  -- ─── 8. INSERT les 2 lignes ─────────────────────────────────────────
  INSERT INTO public.lignes_ecritures (
    ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit,
    vehicule_id, chauffeur_id, client_id
  ) VALUES
  (v_ecr_id, 1, v_compte_tresor,                v_op.libelle, v_debit_tresor, v_credit_tresor,
   v_op.vehicule_id, v_op.chauffeur_id, v_op.client_id),
  (v_ecr_id, 2, v_cat.compte_syscohada_code,    v_op.libelle, v_debit_cat,    v_credit_cat,
   v_op.vehicule_id, v_op.chauffeur_id, v_op.client_id);

  -- ─── 9. UPDATE statut=valide (declenche trigger equilibre BD) ───────
  UPDATE public.ecritures_comptables
     SET statut = 'valide', valide_le = NOW()
   WHERE id = v_ecr_id;

  -- ─── 10. Lier l'operation a son ecriture ────────────────────────────
  UPDATE public.operations
     SET ecriture_id = v_ecr_id
   WHERE id = v_op.id;

  RETURN v_ecr_id;

EXCEPTION WHEN OTHERS THEN
  -- Fail-safe global : log warning + rollback implicite des INSERT partiels
  -- via sub-transaction PL/pgSQL. L'operation reste validee sans ecriture.
  RAISE WARNING '[generer_ecriture] op % erreur: % (SQLSTATE=%)',
    p_op_id, SQLERRM, SQLSTATE;
  RETURN NULL;
END;
$FUNC$;

REVOKE ALL ON FUNCTION public.generer_ecriture_pour_operation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generer_ecriture_pour_operation(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.generer_ecriture_pour_operation(UUID) IS
  'Lot G (26/05/2026) : genere l''ecriture comptable double-partie pour une operation validee. Retourne l''UUID de l''ecriture creee, ou l''ecriture existante si idempotent, ou NULL en cas d''echec (warning logue). Race-safe via pg_advisory_xact_lock par (journal, exercice).';


-- ─── 2. EXTENSION du trigger cascade_recette_wave_to_operation ──────────────
CREATE OR REPLACE FUNCTION public.cascade_recette_wave_to_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC$
DECLARE
  v_caisse_wave_id    UUID;
  v_categorie_id      UUID;
  v_exercice_id       UUID;
  v_date              DATE;
  v_id_tx             TEXT;
  v_montant_net       NUMERIC;
  v_montant_abs       NUMERIC;
  v_type_op           TEXT;
  v_libelle           TEXT;
  v_contrepartie      TEXT;
  v_op_id             UUID;   -- Lot G : id de l'op creee (NULL si ON CONFLICT)
BEGIN
  v_id_tx := NULLIF(TRIM(COALESCE(NEW."Identifiant de transaction", '')), '');
  IF v_id_tx IS NULL THEN RETURN NEW; END IF;

  -- ANTI-RECURSION 26/05/2026 (Lot B audit) :
  -- Si l'ID commence par 'op_', c'est une ligne sync depuis operations
  -- via trg_sync_operation_to_legacy. On NE doit PAS recreer une operation
  -- (sinon boucle infinie + doublon CA).
  IF v_id_tx LIKE 'op\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  v_montant_net := NEW."Montant net";
  IF v_montant_net IS NULL OR v_montant_net = 0 THEN RETURN NEW; END IF;

  IF v_montant_net > 0 THEN
    v_type_op := 'entree';
    v_montant_abs := v_montant_net;
  ELSE
    v_type_op := 'sortie';
    v_montant_abs := ABS(v_montant_net);
  END IF;

  BEGIN
    v_date := NEW."Horodatage"::DATE;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_date IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_caisse_wave_id FROM public.caisses
   WHERE libelle = 'Wave Boyah' LIMIT 1;
  IF v_caisse_wave_id IS NULL THEN RETURN NEW; END IF;

  IF v_type_op = 'entree' THEN
    SELECT id INTO v_categorie_id FROM public.categories_operations
     WHERE libelle = 'Versement quotidien chauffeur' LIMIT 1;
  ELSE
    SELECT id INTO v_categorie_id FROM public.categories_operations
     WHERE libelle = 'Sortie Wave - à reclasser' LIMIT 1;
  END IF;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= v_date AND date_fin >= v_date AND statut = 'ouvert' LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

  v_contrepartie := NULLIF(TRIM(COALESCE(NEW."Nom de contrepartie", '')), '');
  IF v_type_op = 'entree' THEN
    v_libelle := 'Recette Wave - ' || COALESCE(v_contrepartie, 'contrepartie inconnue');
  ELSE
    v_libelle := 'Sortie Wave - ' || COALESCE(v_contrepartie, 'Payout');
  END IF;
  IF LENGTH(v_libelle) > 255 THEN
    v_libelle := SUBSTRING(v_libelle FROM 1 FOR 255);
  END IF;

  INSERT INTO public.operations (
    caisse_id, compte_id, date_operation, type, montant, libelle,
    reference_externe, categorie_id, vehicule_id, chauffeur_id, client_id,
    source, source_ref, statut, valide_le, valide_par, exercice_id,
    created_by, updated_by
  ) VALUES (
    v_caisse_wave_id, NULL, v_date, v_type_op, v_montant_abs, v_libelle,
    v_id_tx, v_categorie_id, NULL, NULL, NULL,
    'recette_wave', v_id_tx, 'valide', NOW(), NULL, v_exercice_id,
    NULL, NULL
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_op_id;

  -- Lot G : generation auto de l'ecriture comptable
  -- v_op_id est NULL si ON CONFLICT a matche (anti-recursion sur les UPDATE
  -- de recettes_wave). On ne genere donc que pour les nouveaux INSERT.
  IF v_op_id IS NOT NULL THEN
    BEGIN
      PERFORM public.generer_ecriture_pour_operation(v_op_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cascade_recette_wave] ecriture op=%: % (SQLSTATE=%)',
        v_op_id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$FUNC$;

COMMENT ON FUNCTION public.cascade_recette_wave_to_operation IS
  'Trigger AFTER INSERT/UPDATE sur recettes_wave (v3 - 26/05/2026, Lot G audit) : cree l''operation comptable ET son ecriture double-partie de facon idempotente. Gere 3 cas (Montant>0 entree, Montant<0 sortie via cat 471, Montant=0 skip). Anti-recursion via RETURNING id apres ON CONFLICT DO NOTHING.';


-- ─── 3. EXTENSION du trigger cascade_versement_client_to_operation ──────────
CREATE OR REPLACE FUNCTION public.cascade_versement_client_to_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC$
DECLARE
  v_caisse_id     UUID;
  v_compte_id     UUID;
  v_categorie_id  UUID;
  v_exercice_id   UUID;
  v_libelle       TEXT;
  v_op_id         UUID;   -- Lot G : id de l'op creee (NULL si ON CONFLICT)
BEGIN
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN RETURN NEW; END IF;
  IF NEW.date_versement IS NULL THEN RETURN NEW; END IF;

  -- Anti-recursion (existait deja)
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

  -- Lot G : generation auto de l'ecriture comptable
  IF v_op_id IS NOT NULL THEN
    BEGIN
      PERFORM public.generer_ecriture_pour_operation(v_op_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cascade_versement_client] ecriture op=%: % (SQLSTATE=%)',
        v_op_id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$FUNC$;

COMMENT ON FUNCTION public.cascade_versement_client_to_operation IS
  'Flux A (v2 - 26/05/2026, Lot G audit) : AFTER INSERT versements_clients -> operation sortie cat 4119 ET ecriture comptable. Anti-recursion via NOT EXISTS + RETURNING id.';


-- ─── 4. BACKFILL ecritures pour les ops orphelines source=recette_wave ──────
DO $BACKFILL_WAVE$
DECLARE
  v_orphan_count INT;
  v_processed    INT := 0;
  v_failed       INT := 0;
  v_op_id        UUID;
  v_ecr_id       UUID;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.operations
  WHERE source = 'recette_wave'
    AND ecriture_id IS NULL
    AND statut = 'valide';

  RAISE NOTICE '[BACKFILL recette_wave] % op orphelines a traiter', v_orphan_count;

  FOR v_op_id IN (
    SELECT id FROM public.operations
    WHERE source = 'recette_wave'
      AND ecriture_id IS NULL
      AND statut = 'valide'
    ORDER BY date_operation
  ) LOOP
    v_ecr_id := public.generer_ecriture_pour_operation(v_op_id);
    IF v_ecr_id IS NULL THEN
      v_failed := v_failed + 1;
    ELSE
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '[BACKFILL recette_wave] termine : % ecrits, % echecs (voir RAISE WARNING)',
    v_processed, v_failed;
END;
$BACKFILL_WAVE$;


-- ─── 5. BACKFILL ecritures pour les ops orphelines source=versement_client ──
DO $BACKFILL_VERSEMENT$
DECLARE
  v_orphan_count INT;
  v_processed    INT := 0;
  v_failed       INT := 0;
  v_op_id        UUID;
  v_ecr_id       UUID;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.operations
  WHERE source = 'versement_client'
    AND ecriture_id IS NULL
    AND statut = 'valide';

  RAISE NOTICE '[BACKFILL versement_client] % op orphelines a traiter', v_orphan_count;

  FOR v_op_id IN (
    SELECT id FROM public.operations
    WHERE source = 'versement_client'
      AND ecriture_id IS NULL
      AND statut = 'valide'
    ORDER BY date_operation
  ) LOOP
    v_ecr_id := public.generer_ecriture_pour_operation(v_op_id);
    IF v_ecr_id IS NULL THEN
      v_failed := v_failed + 1;
    ELSE
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '[BACKFILL versement_client] termine : % ecrits, % echecs',
    v_processed, v_failed;
END;
$BACKFILL_VERSEMENT$;

COMMIT;
