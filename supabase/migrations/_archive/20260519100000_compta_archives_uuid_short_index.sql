-- ============================================================
-- PATCH Phase 4.2 — QR code + URL raccourcie pour PDF officiels
-- ============================================================
-- Référence : doc Phase 4.2 PATCH §1.
--
-- Objectif :
--   Ajouter un index fonctionnel sur les 12 premiers caractères
--   de uuid_externe pour permettre la résolution rapide du
--   short_uuid (URL raccourcie /verify/[12 chars]).
--
--   + RPC publique `verify_etat_financier_by_short(p_short text)`
--     qui résout le préfixe 12 chars → UUID complet, avec
--     détection de collision (renvoie *_count pour audit).
--
--   Probabilité collision sur 12 chars hex (≈ 48 bits) :
--     ~negligible avant ~10⁷ documents (anniversaire ~16M).
--     Pour Boyah Group avec ≤100 exports/an, sécurité absolue.
-- ============================================================


-- ── 1. Index fonctionnel sur le préfixe 12 chars ─────────────────────────────
-- Note : pas d'index UNIQUE volontairement (collision possible mais traitée
-- en applicatif via verify_etat_financier_by_short qui retourne `match_count`).
CREATE INDEX IF NOT EXISTS idx_ef_archives_uuid_short
  ON public.etats_financiers_archives ((substring(uuid_externe::text, 1, 12)));


-- ── 2. RPC publique de vérification par short UUID ───────────────────────────
-- Appelée par /app/verify/[short_uuid]/page.tsx (Server Component public).
-- Retourne :
--   - match_count : nombre de docs matchant ce préfixe (0, 1 ou 2+)
--   - les champs du document SI match unique, sinon NULL
CREATE OR REPLACE FUNCTION public.verify_etat_financier_by_short(p_short TEXT)
RETURNS TABLE (
  match_count       INTEGER,
  type_etat         TEXT,
  hash_sha256       TEXT,
  exercice_libelle  TEXT,
  date_arrete       DATE,
  raison_sociale    TEXT,
  resultat_net      BIGINT,
  genere_at         TIMESTAMPTZ,
  uuid_externe      UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Normalisation : lowercase, trim, on garde uniquement [0-9a-f-]
  p_short := lower(regexp_replace(coalesce(p_short, ''), '[^0-9a-f-]', '', 'g'));

  -- Refus si trop court (sécurité : pas de lookup sur < 8 chars pour éviter
  -- les énumérations massives).
  IF char_length(p_short) < 8 THEN
    RETURN QUERY SELECT 0, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.etats_financiers_archives a
  WHERE substring(a.uuid_externe::text, 1, char_length(p_short)) = p_short;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  IF v_count > 1 THEN
    RETURN QUERY SELECT v_count, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  -- Match unique : on renvoie les détails
  RETURN QUERY
    SELECT
      1                                                                      AS match_count,
      a.type_etat,
      a.hash_sha256,
      e.libelle                                                              AS exercice_libelle,
      e.date_fin                                                             AS date_arrete,
      COALESCE(sp.raison_sociale, pmc.raison_sociale, 'Boyah Group SARL')    AS raison_sociale,
      e.resultat_net,
      a.genere_at,
      a.uuid_externe
    FROM public.etats_financiers_archives a
    JOIN public.exercices e ON e.id = a.exercice_id
    LEFT JOIN public.societe_parametres sp ON TRUE
    LEFT JOIN public.parametres_module_compta pmc ON pmc.id = 1
    WHERE substring(a.uuid_externe::text, 1, char_length(p_short)) = p_short
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_etat_financier_by_short FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_etat_financier_by_short TO anon, authenticated, service_role;


-- ── 3. Commentaires ──────────────────────────────────────────────────────────
COMMENT ON INDEX public.idx_ef_archives_uuid_short
  IS 'PATCH 4.2 — Index sur les 12 premiers chars uuid_externe pour résolution short URL';

COMMENT ON FUNCTION public.verify_etat_financier_by_short(TEXT)
  IS 'PATCH 4.2 — Résout un short_uuid (≥8 chars hex) → infos document. Retourne match_count pour gestion collision.';
