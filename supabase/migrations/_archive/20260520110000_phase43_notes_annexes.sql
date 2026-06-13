-- ============================================================
-- PHASE 4.3 — Module 2 : Notes annexes simplifiées
-- ============================================================
-- Référence : doc Phase 4.3 §2.
--
-- Notes 1 et 6 = textes libres saisis dans /comptabilite/parametres-societe.
-- Notes 2, 3, 4, 5 = calculées à la volée depuis ecritures_comptables.
--
-- TODO Phase 5 SaaS : tenant_id sur societe_parametres déjà couvert par
-- le singleton index. Pas de tenant_id ajouté ici.
-- ============================================================


-- ── 1. Extension de societe_parametres ──────────────────────────────────────
ALTER TABLE public.societe_parametres
  ADD COLUMN IF NOT EXISTS methodes_comptables     TEXT,
  ADD COLUMN IF NOT EXISTS engagements_hors_bilan  TEXT,
  ADD COLUMN IF NOT EXISTS methode_amortissement   TEXT NOT NULL DEFAULT 'lineaire',
  ADD COLUMN IF NOT EXISTS methode_stocks          TEXT NOT NULL DEFAULT 'fifo';

-- CHECK ajoutés en DO block (idempotent) : on ne peut pas ALTER ... ADD CHECK IF NOT EXISTS
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'societe_parametres_methode_amortissement_check'
  ) THEN
    ALTER TABLE public.societe_parametres
      ADD CONSTRAINT societe_parametres_methode_amortissement_check
      CHECK (methode_amortissement IN ('lineaire', 'degressif'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'societe_parametres_methode_stocks_check'
  ) THEN
    ALTER TABLE public.societe_parametres
      ADD CONSTRAINT societe_parametres_methode_stocks_check
      CHECK (methode_stocks IN ('fifo', 'cmp', 'lifo'));
  END IF;
END $do$;


COMMENT ON COLUMN public.societe_parametres.methodes_comptables IS
  'PHASE 4.3 — Note 1 : texte libre listant les méthodes comptables appliquées (référentiel, devise, amortissement, etc.)';
COMMENT ON COLUMN public.societe_parametres.engagements_hors_bilan IS
  'PHASE 4.3 — Note 6 : texte libre listant les engagements hors bilan (cautions, avals, crédit-bail, litiges)';
COMMENT ON COLUMN public.societe_parametres.methode_amortissement IS
  'PHASE 4.3 — Méthode d''amortissement par défaut (linéaire ou dégressif)';
COMMENT ON COLUMN public.societe_parametres.methode_stocks IS
  'PHASE 4.3 — Méthode de valorisation stocks (FIFO, CMP, LIFO)';


-- ── 2. Texte par défaut pour le singleton (méthodes comptables standard) ────
-- ── 1bis. Étendre CHECK type_etat sur etats_financiers_archives ─────────────
-- (initial : 'bilan' | 'compte_resultat' — on ajoute notes_annexes / tft / dossier_complet)
DO $do$
DECLARE v_conname TEXT;
BEGIN
  SELECT con.conname INTO v_conname
    FROM pg_constraint con
    JOIN pg_class cls ON con.conrelid = cls.oid
   WHERE cls.relname = 'etats_financiers_archives'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%type_etat%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.etats_financiers_archives DROP CONSTRAINT %I', v_conname);
  END IF;
END $do$;

ALTER TABLE public.etats_financiers_archives
  ADD CONSTRAINT etats_financiers_archives_type_etat_check
  CHECK (type_etat IN ('bilan', 'compte_resultat', 'notes_annexes', 'tft', 'dossier_complet'));


UPDATE public.societe_parametres
   SET methodes_comptables = COALESCE(methodes_comptables,
'• Référentiel comptable : SYSCOHADA révisé (Acte uniforme OHADA, révision 2017)
• Devise : Franc CFA (XOF)
• Méthode d''amortissement par défaut : linéaire
• Méthode de valorisation des stocks : FIFO (Premier Entré, Premier Sorti)
• Régime de TVA : selon paramètres société
• Reconnaissance du chiffre d''affaires : à l''émission de la facture (mode engagement)
• Évaluation des créances et dettes : valeur nominale
• Provisions : constituées dès la connaissance d''un risque probable')
 WHERE methodes_comptables IS NULL;
