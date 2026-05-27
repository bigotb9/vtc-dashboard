-- ============================================================
-- PHASE 4.2 — Hash de traçabilité + archivage États financiers
-- ============================================================
-- Référence : doc Phase 4.2 §6.4.
--
-- Une ligne par EXPORT PDF (Bilan ou Compte de résultat).
-- Ne jamais overwrite : chaque re-génération crée une nouvelle archive
-- pour audit trail. La route /api/compta/verify/[uuid] est publique
-- (lecture seule du hash + montant net + raison sociale pour permettre
-- à un tiers de vérifier l'authenticité d'un PDF papier).
-- ============================================================


-- ── 1. Table etats_financiers_archives ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.etats_financiers_archives (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id       UUID         NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  type_etat         TEXT         NOT NULL CHECK (type_etat IN ('bilan', 'compte_resultat')),
  hash_sha256       TEXT         NOT NULL CHECK (char_length(hash_sha256) = 64),
  donnees_json      JSONB        NOT NULL,
  pdf_storage_path  TEXT,
  uuid_externe      UUID         NOT NULL DEFAULT gen_random_uuid(),
  genere_par        UUID         REFERENCES auth.users(id),
  genere_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ef_archives_exercice ON public.etats_financiers_archives(exercice_id, type_etat);
CREATE INDEX IF NOT EXISTS idx_ef_archives_genere_at ON public.etats_financiers_archives(genere_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ef_archives_uuid ON public.etats_financiers_archives(uuid_externe);


-- ── 2. RLS — directeur seul pour SELECT complet (mais verify est public) ────
ALTER TABLE public.etats_financiers_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS directeur_full_access ON public.etats_financiers_archives;
CREATE POLICY directeur_full_access
  ON public.etats_financiers_archives FOR ALL
  USING (public.is_directeur()) WITH CHECK (public.is_directeur());


-- ── 3. Fonction publique de vérification (RPC, sans RLS) ────────────────────
-- L'utilisateur (DGI, banque) appelle :
--   SELECT * FROM public.verify_etat_financier('<uuid>');
-- Retour minimal : hash + date génération + nom société + résultat net.
-- Aucune donnée sensible exposée.
CREATE OR REPLACE FUNCTION public.verify_etat_financier(p_uuid UUID)
RETURNS TABLE (
  type_etat       TEXT,
  hash_sha256     TEXT,
  exercice_libelle TEXT,
  date_arrete     DATE,
  raison_sociale  TEXT,
  resultat_net    BIGINT,
  genere_at       TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.type_etat,
    a.hash_sha256,
    e.libelle                              AS exercice_libelle,
    e.date_fin                             AS date_arrete,
    COALESCE(sp.raison_sociale, pmc.raison_sociale, 'Boyah Group SARL') AS raison_sociale,
    e.resultat_net,
    a.genere_at
  FROM public.etats_financiers_archives a
  JOIN public.exercices e ON e.id = a.exercice_id
  LEFT JOIN public.societe_parametres sp ON TRUE
  LEFT JOIN public.parametres_module_compta pmc ON pmc.id = 1
  WHERE a.uuid_externe = p_uuid
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_etat_financier FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_etat_financier TO anon, authenticated, service_role;
