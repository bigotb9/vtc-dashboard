-- ============================================================
-- PHASE 4.x VAGUE 3 — Justificatifs des opérations
-- ============================================================
-- Référence : doc Phase 4.x Vague 3 §3.
--
-- Périmètre :
--   - Table `justificatifs` (1 ou plusieurs fichiers par opération)
--   - Trigger `enforce_justificatif_required` (bloque INSERT/UPDATE
--     statut='valide' d'une sortie vers tiers sans justificatif)
--   - RLS table : directeur uniquement (cohérent module compta)
--   - RLS storage bucket 'justificatifs' (SELECT + INSERT + DELETE
--     directeur)
--   - Soft delete : `deleted_at` + `deleted_by`, conserve l'audit trail
--
-- ⚠ Le bucket Supabase Storage `justificatifs` doit être créé
-- MANUELLEMENT avant l'application de cette migration (depuis le
-- dashboard Supabase ou via une migration séparée). Cf. spec §7.4 +
-- bloc INSERT INTO storage.buckets en bas de fichier (idempotent).
--
-- ⚠ La table `pieces_justificatives` (Phase 1) reste en place — elle
-- n'a jamais été utilisée par l'UI. À supprimer en Phase 5 si confirmé.
-- ============================================================


-- ── 1. Table justificatifs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.justificatifs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  operation_id    UUID         NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,

  -- Storage
  storage_path    TEXT         NOT NULL CHECK (char_length(storage_path) >= 4),
  storage_bucket  TEXT         NOT NULL DEFAULT 'justificatifs',

  -- Metadata fichier
  filename        TEXT         NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  mime_type       TEXT         NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes      BIGINT       NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5 * 1024 * 1024),

  -- Audit upload
  uploaded_by     UUID         REFERENCES auth.users(id),
  uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Soft delete (audit trail)
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID         REFERENCES auth.users(id)
);

COMMENT ON TABLE  public.justificatifs IS
  'Justificatifs (factures, reçus, photos) attachés aux opérations. Phase 4.x Vague 3.';
COMMENT ON COLUMN public.justificatifs.storage_path IS
  'Chemin dans le bucket Supabase Storage. Format : {operation_id}/{justificatif_id}-{filename_sluggué}.{ext}';
COMMENT ON COLUMN public.justificatifs.deleted_at IS
  'Soft delete — la ligne est conservée pour audit trail SYSCOHADA.';

-- ── 2. Indexes ───────────────────────────────────────────────────────────────
-- Index partiel sur les justificatifs actifs (utilisé par le trigger et l'API GET)
CREATE INDEX IF NOT EXISTS idx_justificatifs_operation_active
  ON public.justificatifs(operation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_justificatifs_uploaded_by
  ON public.justificatifs(uploaded_by)
  WHERE deleted_at IS NULL;

-- Index sur tous les justificatifs (incl. supprimés) pour les requêtes audit
CREATE INDEX IF NOT EXISTS idx_justificatifs_operation_all
  ON public.justificatifs(operation_id);


-- ── 3. Trigger d'enforcement métier ──────────────────────────────────────────
-- Bloque l'INSERT/UPDATE d'une opération en statut='valide' quand
-- type='sortie' ET tiers_id IS NOT NULL si aucun justificatif actif.
-- Sécurité de défense en profondeur (la validation primaire reste API).
CREATE OR REPLACE FUNCTION public.enforce_justificatif_required()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cas 1 : INSERT direct en statut='valide' (rare)
  -- Cas 2 : UPDATE statut='brouillon' → 'valide' (workflow brouillon → valide)
  IF NEW.type = 'sortie'
     AND NEW.tiers_id IS NOT NULL
     AND NEW.statut = 'valide'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.statut, 'brouillon') <> 'valide')
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.justificatifs
       WHERE operation_id = NEW.id
         AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Justificatif obligatoire pour sortie vers tiers (operation_id=%)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_operations_justificatif_required ON public.operations;
CREATE TRIGGER tr_operations_justificatif_required
  BEFORE INSERT OR UPDATE OF statut, type, tiers_id ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_justificatif_required();


-- ── 4. RLS table (directeur seul, cohérent module compta) ────────────────────
ALTER TABLE public.justificatifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS directeur_full_access ON public.justificatifs;
CREATE POLICY directeur_full_access
  ON public.justificatifs FOR ALL
  USING (public.is_directeur())
  WITH CHECK (public.is_directeur());


-- ── 5. Bucket Storage 'justificatifs' (idempotent) ───────────────────────────
-- Bucket privé, max 5 Mo par fichier, mimes restreints à PDF + JPG + PNG.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'justificatifs',
  'justificatifs',
  false,
  5 * 1024 * 1024,                                  -- 5 Mo par fichier
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public             = EXCLUDED.public;


-- ── 6. RLS storage.objects pour le bucket 'justificatifs' ────────────────────
DROP POLICY IF EXISTS justificatifs_select  ON storage.objects;
DROP POLICY IF EXISTS justificatifs_insert  ON storage.objects;
DROP POLICY IF EXISTS justificatifs_update  ON storage.objects;
DROP POLICY IF EXISTS justificatifs_delete  ON storage.objects;

CREATE POLICY justificatifs_select
  ON storage.objects FOR SELECT
  USING (bucket_id = 'justificatifs' AND public.is_directeur());

CREATE POLICY justificatifs_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'justificatifs' AND public.is_directeur());

CREATE POLICY justificatifs_update
  ON storage.objects FOR UPDATE
  USING       (bucket_id = 'justificatifs' AND public.is_directeur())
  WITH CHECK  (bucket_id = 'justificatifs' AND public.is_directeur());

CREATE POLICY justificatifs_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'justificatifs' AND public.is_directeur());
