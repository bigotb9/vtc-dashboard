-- ============================================================
-- MODULE CLIENTS - Enrichissement 23/05/2026
-- §4 : Reconciliation Clients (legacy) <-> Tiers (compta) (H3)
-- ============================================================
-- Periimetre :
--   - ALTER TABLE clients ADD COLUMN tiers_id (FK UUID vers public.tiers)
--   - Index sur tiers_id pour jointures
--   - Backfill : pour chaque client n'ayant pas de tiers_id, creer un tiers
--     correspondant (type='client', compte SYSCOHADA 411-XX avec suffix
--     genere depuis les initiales du nom) et lier les deux
--   - Future creation de Client : POST /api/clients fera la cascade
--     applicative vers /api/compta/tiers (logique dans la route API).
-- ============================================================

-- 1. Ajout de la colonne tiers_id sur clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES public.tiers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_tiers_id
  ON public.clients (tiers_id)
  WHERE tiers_id IS NOT NULL;

COMMENT ON COLUMN public.clients.tiers_id IS
  'FK vers le tiers comptable correspondant (table tiers, type=client). '
  'Maintenu en cohaerance par /api/clients POST. NULL temporaire autorise '
  'pour les clients pre-existants en attendant le backfill. '
  'Ajoute le 23/05/2026 (H3 module Clients enrichi).';

-- 2. Backfill : creer un tiers pour chaque client orphelin et lier
DO $$
DECLARE
  client_row RECORD;
  new_tiers_id UUID;
  suffix TEXT;
  attempt INT;
BEGIN
  FOR client_row IN
    SELECT id, nom, telephone, email
    FROM public.clients
    WHERE tiers_id IS NULL
  LOOP
    -- Genere un suffix unique en s'inspirant de la logique des initiales
    -- Format : 2 premieres lettres du nom en majuscule + suffixe numerique
    -- si conflit (ex "AK", "AK1", "AK2"...)
    suffix := UPPER(REGEXP_REPLACE(
      LEFT(REGEXP_REPLACE(client_row.nom, '\s+', '', 'g'), 2),
      '[^A-Z]', '', 'gi'
    ));
    IF LENGTH(suffix) < 2 THEN
      suffix := 'CL';
    END IF;

    -- Verification d'unicite : si le tiers avec ce code existe deja, append un suffix numerique
    attempt := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.tiers
      WHERE compte_syscohada_parent = '411'
        AND compte_syscohada_suffix = (CASE WHEN attempt = 0 THEN suffix ELSE suffix || attempt::TEXT END)
    ) LOOP
      attempt := attempt + 1;
      IF attempt > 99 THEN
        RAISE EXCEPTION 'Impossible de generer un suffix unique pour le client %', client_row.id;
      END IF;
    END LOOP;

    IF attempt > 0 THEN
      suffix := suffix || attempt::TEXT;
    END IF;

    -- Creation du tiers correspondant
    INSERT INTO public.tiers (
      nom,
      type,
      telephone,
      email,
      compte_syscohada_parent,
      compte_syscohada_suffix,
      actif,
      notes
    ) VALUES (
      client_row.nom,
      'client',
      client_row.telephone,
      client_row.email,
      '411',
      suffix,
      TRUE,
      'Tiers cree automatiquement par la migration de reconciliation du 23/05/2026 (clients.id = ' || client_row.id || ').'
    )
    RETURNING id INTO new_tiers_id;

    -- Mise a jour du client : lien avec son tiers
    UPDATE public.clients
    SET tiers_id = new_tiers_id
    WHERE id = client_row.id;

    RAISE NOTICE 'Client % (%) -> tiers % (411-%)', client_row.id, client_row.nom, new_tiers_id, suffix;
  END LOOP;
END;
$$;
