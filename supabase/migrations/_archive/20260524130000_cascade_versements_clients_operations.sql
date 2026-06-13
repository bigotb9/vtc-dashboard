-- ============================================================
-- CASCADE BIDIRECTIONNELLE versements_clients <-> operations
-- 24/05/2026 (v2 - fix ROW_COUNT -> GET DIAGNOSTICS)
-- ============================================================
-- Probleme : POST /api/clients/versements insere dans versements_clients
-- mais ne cree PAS l'operation comptable correspondante. Le solde caisse
-- source n'est pas debite, le Bilan est fausse. Bug remonte le 24/05 sur
-- les versements id=86 (400 000 F) et id=87 (800 000 F) -> 1 200 000 F
-- d'argent sorti non comptabilise.
--
-- Fix : cascade bidirectionnelle via 2 triggers Postgres avec garde
-- anti-recursion mutuelle.
--
-- Flux A - versement -> operation
--   Trigger AFTER INSERT sur versements_clients qui cree l'operation
--   sortie avec categorie 'Reversement client sous gestion'.
--
-- Flux B - operation -> versement
--   Trigger AFTER INSERT sur operations qui s'active quand
--   source='versement_client' et qu'aucun versement_clients ne pointe
--   deja vers cette op (cree un versement de rattrapage).
--
-- Garde anti-recursion :
--   - Flux A check : NOT EXISTS operation avec source='versement_client'
--                    AND source_ref = vc.id::text
--   - Flux B check : NOT EXISTS versement_clients avec id::text = source_ref
-- ============================================================


-- ── 1. Colonnes caisse_id / compte_id sur versements_clients ────────────
-- Permet au frontend de specifier d'ou l'argent part (Wave Boyah par defaut,
-- mais on peut payer depuis Caisse principale, banque, etc.)
ALTER TABLE public.versements_clients
  ADD COLUMN IF NOT EXISTS caisse_id UUID REFERENCES public.caisses(id),
  ADD COLUMN IF NOT EXISTS compte_id UUID REFERENCES public.comptes(id);

-- Contrainte : un seul des deux doit etre renseigne (XOR), comme operations
-- Note : on autorise NULL/NULL pendant la phase de migration des anciennes
-- lignes. Le trigger backfill remplit caisse_id avec Wave Boyah pour les
-- versements existants.
ALTER TABLE public.versements_clients
  DROP CONSTRAINT IF EXISTS versements_clients_caisse_compte_xor;
ALTER TABLE public.versements_clients
  ADD CONSTRAINT versements_clients_caisse_compte_xor
  CHECK (
    (caisse_id IS NULL AND compte_id IS NULL)
    OR (caisse_id IS NOT NULL AND compte_id IS NULL)
    OR (caisse_id IS NULL AND compte_id IS NOT NULL)
  );

COMMENT ON COLUMN public.versements_clients.caisse_id IS
  'Caisse source du versement (XOR avec compte_id). Default frontend = Wave Boyah. Ajoute le 24/05/2026.';
COMMENT ON COLUMN public.versements_clients.compte_id IS
  'Compte bancaire source du versement (XOR avec caisse_id). Ajoute le 24/05/2026.';


-- ── 2. Backfill caisse_id Wave Boyah pour les anciens versements ───────
-- Tous les versements existants n'ont pas de caisse_id. On les rattache
-- a la caisse Wave Boyah par defaut, coherent avec le comportement
-- historique de lib/compta/reprise.ts.
DO $BACKFILL_CAISSE$
DECLARE
  v_caisse_wave_id UUID;
  v_count          INT;
BEGIN
  SELECT id INTO v_caisse_wave_id FROM public.caisses
   WHERE libelle = 'Wave Boyah' LIMIT 1;

  IF v_caisse_wave_id IS NOT NULL THEN
    UPDATE public.versements_clients
       SET caisse_id = v_caisse_wave_id
     WHERE caisse_id IS NULL AND compte_id IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'BACKFILL caisse_id Wave Boyah : % versements rattaches', v_count;
  ELSE
    RAISE NOTICE 'BACKFILL caisse_id : caisse Wave Boyah introuvable, skip';
  END IF;
END;
$BACKFILL_CAISSE$;


-- ── 3. Flux A - Trigger versements_clients -> operations ───────────────
CREATE OR REPLACE FUNCTION public.cascade_versement_client_to_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC_A$
DECLARE
  v_categorie_id UUID;
  v_exercice_id  UUID;
  v_caisse_id    UUID;
  v_compte_id    UUID;
  v_libelle      TEXT;
BEGIN
  -- Skip si donnees incompletes
  IF NEW.id_client IS NULL OR NEW.montant IS NULL OR NEW.montant <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.date_versement IS NULL THEN RETURN NEW; END IF;

  -- Anti-recursion : skip si l'operation existe deja
  IF EXISTS (
    SELECT 1 FROM public.operations
     WHERE source = 'versement_client'
       AND source_ref = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  -- Determination caisse / compte source
  v_caisse_id := NEW.caisse_id;
  v_compte_id := NEW.compte_id;
  -- Si aucun renseigne, fallback Wave Boyah
  IF v_caisse_id IS NULL AND v_compte_id IS NULL THEN
    SELECT id INTO v_caisse_id FROM public.caisses
     WHERE libelle = 'Wave Boyah' LIMIT 1;
    IF v_caisse_id IS NULL THEN RETURN NEW; END IF;
  END IF;

  -- Categorie Reversement client (compte 4119)
  SELECT id INTO v_categorie_id FROM public.categories_operations
   WHERE libelle = 'Reversement client sous gestion' LIMIT 1;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  -- Exercice ouvert
  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= NEW.date_versement
     AND date_fin   >= NEW.date_versement
     AND statut     = 'ouvert'
   LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

  -- Libelle parsable par le Flux B (format conventionnel)
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
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$FUNC_A$;

COMMENT ON FUNCTION public.cascade_versement_client_to_operation IS
  'Flux A (24/05/2026) : AFTER INSERT versements_clients -> operation sortie avec categorie 4119, anti-recursion via NOT EXISTS sur (source, source_ref).';

DROP TRIGGER IF EXISTS trg_cascade_versement_to_operation ON public.versements_clients;
CREATE TRIGGER trg_cascade_versement_to_operation
  AFTER INSERT ON public.versements_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_versement_client_to_operation();

REVOKE ALL ON FUNCTION public.cascade_versement_client_to_operation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_versement_client_to_operation TO authenticated, service_role;


-- ── 4. Flux B - Trigger operations -> versements_clients ───────────────
-- S'active quand on insere une operation source='versement_client' qui n'a
-- pas de versement correspondant (cas d'insertion manuelle directe en BD).
-- Anti-recursion : skip si le versement existe deja (cas declenche par
-- le Flux A : l'op vient d'etre creee par le Flux A donc le versement
-- existe deja, son id::text = source_ref).
CREATE OR REPLACE FUNCTION public.cascade_operation_to_versement_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC_B$
DECLARE
  v_mois        TEXT;
  v_id_int      INTEGER;
BEGIN
  -- Skip si pas une operation de type versement client
  IF NEW.source IS DISTINCT FROM 'versement_client' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type IS DISTINCT FROM 'sortie' THEN RETURN NEW; END IF;
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN RETURN NEW; END IF;

  -- Anti-recursion : si source_ref pointe vers un versement existant, skip
  -- (cas typique : Flux A vient de creer cette op apres avoir cree le versement)
  IF NEW.source_ref IS NOT NULL THEN
    BEGIN
      v_id_int := NEW.source_ref::INTEGER;
      IF EXISTS (SELECT 1 FROM public.versements_clients WHERE id = v_id_int) THEN
        RETURN NEW;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- source_ref non parsable en integer : c'est une insertion manuelle
      -- avec une ref textuelle, on continue avec le rattrapage
      NULL;
    END;
  END IF;

  -- Extraction du mois depuis le libelle (format conventionnel
  -- 'Reversement client (mois YYYY-MM)') ou fallback sur date_operation
  v_mois := SUBSTRING(NEW.libelle FROM 'mois (\d{4}-\d{2})');
  IF v_mois IS NULL OR LENGTH(v_mois) <> 7 THEN
    v_mois := to_char(NEW.date_operation, 'YYYY-MM');
  END IF;

  -- Skip si un versement existe deja pour ce client + mois (autre garde)
  IF EXISTS (
    SELECT 1 FROM public.versements_clients
     WHERE id_client = NEW.client_id::INTEGER
       AND mois = v_mois
  ) THEN
    RETURN NEW;
  END IF;

  -- Creation du versement de rattrapage
  INSERT INTO public.versements_clients (
    id_client, mois, montant, date_versement, notes,
    caisse_id, compte_id
  ) VALUES (
    NEW.client_id::INTEGER,
    v_mois,
    NEW.montant,
    NEW.date_operation,
    'Rattrapage auto - cree depuis operation #' || NEW.id::text,
    NEW.caisse_id,
    NEW.compte_id
  )
  ON CONFLICT (id_client, mois) DO NOTHING;

  RETURN NEW;
END;
$FUNC_B$;

COMMENT ON FUNCTION public.cascade_operation_to_versement_client IS
  'Flux B (24/05/2026) : AFTER INSERT operations(source=versement_client) -> versement_clients, anti-recursion via NOT EXISTS sur id integer ET sur (id_client, mois).';

DROP TRIGGER IF EXISTS trg_cascade_operation_to_versement ON public.operations;
CREATE TRIGGER trg_cascade_operation_to_versement
  AFTER INSERT ON public.operations
  FOR EACH ROW
  WHEN (NEW.source = 'versement_client')
  EXECUTE FUNCTION public.cascade_operation_to_versement_client();

REVOKE ALL ON FUNCTION public.cascade_operation_to_versement_client FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_operation_to_versement_client TO authenticated, service_role;


-- ── 5. BACKFILL : rattrape les versements orphelins existants ──────────
-- Les versements id=86, id=87 et autres qui n'ont pas d'operation associee.
-- INSERT direct dans operations (le trigger Flux B sera bloque par la
-- garde anti-recursion puisque le versement existe deja).
DO $BACKFILL_OPS$
DECLARE
  v_orphelins_count INT;
  v_inserted_count  INT;
BEGIN
  SELECT COUNT(*) INTO v_orphelins_count
  FROM public.versements_clients vc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.operations o
    WHERE o.source = 'versement_client'
      AND o.source_ref = vc.id::text
  );

  RAISE NOTICE 'BACKFILL versements orphelins : % a rattraper', v_orphelins_count;

  INSERT INTO public.operations (
    caisse_id, compte_id, date_operation, type, montant, libelle,
    reference_externe, categorie_id, client_id,
    source, source_ref, statut, valide_le, valide_par, exercice_id
  )
  SELECT
    vc.caisse_id,
    vc.compte_id,
    vc.date_versement,
    'sortie',
    vc.montant,
    'Reversement client (mois ' || COALESCE(vc.mois, to_char(vc.date_versement, 'YYYY-MM')) || ')',
    vc.id::text,
    (SELECT id FROM public.categories_operations WHERE libelle = 'Reversement client sous gestion' LIMIT 1),
    vc.id_client,
    'versement_client',
    vc.id::text,
    'valide',
    NOW(),
    NULL,
    (SELECT id FROM public.exercices
      WHERE date_debut <= vc.date_versement
        AND date_fin   >= vc.date_versement
        AND statut     = 'ouvert'
      LIMIT 1)
  FROM public.versements_clients vc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.operations o
    WHERE o.source = 'versement_client'
      AND o.source_ref = vc.id::text
  )
  AND vc.caisse_id IS NOT NULL  -- evite d'inserer si la caisse est NULL apres backfill
  AND vc.montant IS NOT NULL AND vc.montant > 0
  AND EXISTS (SELECT 1 FROM public.exercices
              WHERE date_debut <= vc.date_versement
                AND date_fin   >= vc.date_versement
                AND statut     = 'ouvert')
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RAISE NOTICE 'BACKFILL operations inserees : %', v_inserted_count;
  RAISE NOTICE 'BACKFILL termine. Pour generer les ecritures comptables : POST /api/compta/operations/regenerer-ecritures body {"source":"versement_client"}';
END;
$BACKFILL_OPS$;