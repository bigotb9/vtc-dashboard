-- ============================================================
-- BUG 4 CRITIQUE v2 - Cascade recettes_wave -> operations via trigger
-- 24/05/2026
-- ============================================================
-- v1 : trigger qui skip si Montant net <= 0
-- v2 : trigger qui gere les 3 cas (entree / sortie / skip) selon le signe
--      du Montant net. Categorie "Sortie Wave - a reclasser" creee dans
--      la meme migration pour stocker les payouts non encore reclassifies.
--
-- Cas A - Montant > 0  : type='entree', categorie 'Versement quotidien
--                         chauffeur' (compte 7061), montant = Montant net
-- Cas B - Montant < 0  : type='sortie', categorie 'Sortie Wave - a reclasser'
--                         (compte 471), montant = ABS(Montant net)
-- Cas C - Montant = 0  : skip silencieux (transactions techniques)
-- ============================================================


-- 1. Categorie 'Sortie Wave - a reclasser' (compte d'attente 471)
INSERT INTO public.categories_operations (
  libelle, type, compte_syscohada_code, sens, journal_par_defaut,
  description, actif, ordre
)
SELECT
  'Sortie Wave - à reclasser',
  'depense',
  '471',
  'debit',
  'OD',
  'Categorie technique : reception automatique des sorties Wave par le trigger trg_cascade_recette_wave. A reclasser manuellement via le module Compta. Ajoute le 24/05/2026 (Bug 4 v2).',
  true,
  998
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories_operations
   WHERE libelle = 'Sortie Wave - à reclasser'
);


-- 2. Fonction trigger v2
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
BEGIN
  v_id_tx := NULLIF(TRIM(COALESCE(NEW."Identifiant de transaction", '')), '');
  IF v_id_tx IS NULL THEN RETURN NEW; END IF;

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
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$FUNC$;

COMMENT ON FUNCTION public.cascade_recette_wave_to_operation IS
  'Trigger AFTER INSERT/UPDATE sur recettes_wave (v2 - 24/05/2026) : cree l''operation comptable correspondante de facon idempotente. Gere 3 cas (Montant>0 entree, Montant<0 sortie via categorie 471, Montant=0 skip). L''ecriture comptable reste a generer separement.';


-- 3. (Re)creation du trigger
DROP TRIGGER IF EXISTS trg_cascade_recette_wave ON public.recettes_wave;

CREATE TRIGGER trg_cascade_recette_wave
  AFTER INSERT OR UPDATE OF "Identifiant de transaction", "Montant net", "Horodatage" ON public.recettes_wave
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_recette_wave_to_operation();

REVOKE ALL ON FUNCTION public.cascade_recette_wave_to_operation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_recette_wave_to_operation TO authenticated, service_role;


-- 4. BACKFILL : rattrape entrees ET sorties orphelines (Montant net != 0)
DO $BACKFILL$
DECLARE
  v_orphelines_count INT;
  v_negatives_count  INT;
BEGIN
  SELECT COUNT(*) INTO v_orphelines_count
  FROM public.recettes_wave rw
  WHERE rw."Identifiant de transaction" IS NOT NULL
    AND rw."Montant net" IS NOT NULL
    AND rw."Montant net" <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.source = 'recette_wave' AND o.source_ref = rw."Identifiant de transaction"
    );

  SELECT COUNT(*) INTO v_negatives_count
  FROM public.recettes_wave rw
  WHERE rw."Identifiant de transaction" IS NOT NULL
    AND rw."Montant net" < 0
    AND NOT EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.source = 'recette_wave' AND o.source_ref = rw."Identifiant de transaction"
    );

  RAISE NOTICE 'BACKFILL recettes_wave orphelines (v2) : % a traiter (dont % negatives)',
    v_orphelines_count, v_negatives_count;

  UPDATE public.recettes_wave
  SET "Horodatage" = "Horodatage"
  WHERE "Identifiant de transaction" IS NOT NULL
    AND "Montant net" IS NOT NULL
    AND "Montant net" <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.source = 'recette_wave'
        AND o.source_ref = public.recettes_wave."Identifiant de transaction"
    );

  RAISE NOTICE 'BACKFILL termine. Pour generer les ecritures comptables, appeler ensuite POST /api/compta/operations/regenerer-ecritures avec body {"source":"recette_wave"}';
END;
$BACKFILL$;
