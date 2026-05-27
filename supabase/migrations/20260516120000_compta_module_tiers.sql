-- ============================================================
-- PHASE 4.x VAGUE 2 — Module Tiers (Fournisseurs / Salariés / Autres)
-- ============================================================
-- Référence : doc Phase 4.x Vague 2 §2.
--
-- Périmètre :
--   - Table `tiers` (4 types : client, fournisseur, salarie, autre)
--   - Colonne SYSCOHADA générée (parent + suffix → "401-GA", "411-LV")
--   - Suffix auto-généré à partir des initiales du nom, retry sur collision
--   - Fonction RPC atomique `create_tiers` (SECURITY DEFINER)
--   - Fonction utilitaire `generate_tiers_suffix` (initiales)
--   - ALTER operations ADD COLUMN tiers_id (FK optionnelle)
--   - RLS directeur uniquement (cohérent module compta)
-- ============================================================


-- ── 1. Table tiers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tiers (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité
  nom                       TEXT         NOT NULL CHECK (char_length(TRIM(nom)) >= 2),
  type                      TEXT         NOT NULL CHECK (type IN ('client', 'fournisseur', 'salarie', 'autre')),

  -- Contact
  telephone                 TEXT         CHECK (telephone IS NULL OR char_length(telephone) <= 30),
  email                     TEXT         CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  adresse                   TEXT         CHECK (adresse IS NULL OR char_length(adresse) <= 500),

  -- Données entreprise (optionnelles)
  raison_sociale            TEXT         CHECK (raison_sociale IS NULL OR char_length(raison_sociale) <= 200),
  numero_rccm               TEXT         CHECK (numero_rccm IS NULL OR char_length(numero_rccm) <= 60),
  numero_contribuable       TEXT         CHECK (numero_contribuable IS NULL OR char_length(numero_contribuable) <= 60),

  -- Comptabilité : parent (401, 411, 421, 467, 447) + suffixe (GA, LV, …)
  compte_syscohada_parent   TEXT         NOT NULL CHECK (char_length(compte_syscohada_parent) >= 2),
  compte_syscohada_suffix   TEXT         CHECK (compte_syscohada_suffix IS NULL OR char_length(compte_syscohada_suffix) <= 8),
  -- Colonne générée : concaténation parent-suffix (ex "401-GA"). STORED pour
  -- pouvoir indexer + contraindre l'unicité.
  compte_syscohada_code     TEXT         GENERATED ALWAYS AS (
                              CASE
                                WHEN compte_syscohada_suffix IS NULL OR compte_syscohada_suffix = ''
                                  THEN compte_syscohada_parent
                                ELSE compte_syscohada_parent || '-' || compte_syscohada_suffix
                              END
                            ) STORED,

  -- État
  actif                     BOOLEAN      NOT NULL DEFAULT true,
  notes                     TEXT         CHECK (notes IS NULL OR char_length(notes) <= 4000),

  -- Audit
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by                UUID         REFERENCES auth.users(id),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by                UUID         REFERENCES auth.users(id)
);


-- ── 2. Unicité du code SYSCOHADA — uniquement sur les tiers actifs ───────────
-- Deux tiers actifs ne peuvent pas avoir le même `compte_syscohada_code`.
-- Un tiers désactivé libère son code (réactivation possible si pas de collision).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiers_syscohada_actif
  ON public.tiers (compte_syscohada_code)
  WHERE actif = true;


-- ── 3. Indexes (perf liste + recherche) ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tiers_type              ON public.tiers(type);
CREATE INDEX IF NOT EXISTS idx_tiers_actif             ON public.tiers(actif);
CREATE INDEX IF NOT EXISTS idx_tiers_syscohada         ON public.tiers(compte_syscohada_code);
CREATE INDEX IF NOT EXISTS idx_tiers_nom_lower         ON public.tiers(lower(nom));
CREATE INDEX IF NOT EXISTS idx_tiers_telephone         ON public.tiers(telephone)        WHERE telephone        IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiers_rccm              ON public.tiers(numero_rccm)      WHERE numero_rccm      IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiers_contribuable      ON public.tiers(numero_contribuable) WHERE numero_contribuable IS NOT NULL;
-- Recherche full-text français sur le nom (utilisé par GET /tiers?q=…)
CREATE INDEX IF NOT EXISTS idx_tiers_nom_gin
  ON public.tiers USING GIN (to_tsvector('french', coalesce(nom, '')));


-- ── 4. ALTER operations : colonne tiers_id (FK optionnelle) ──────────────────
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES public.tiers(id);

CREATE INDEX IF NOT EXISTS idx_operations_tiers
  ON public.operations(tiers_id)
  WHERE tiers_id IS NOT NULL;


-- ── 5. RLS — directeur uniquement (cohérent module compta) ───────────────────
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS directeur_full_access ON public.tiers;
CREATE POLICY directeur_full_access
  ON public.tiers FOR ALL
  USING (public.is_directeur())
  WITH CHECK (public.is_directeur());


-- ── 6. Fonction utilitaire : nettoyage accents (unaccent-lite) ───────────────
-- L'extension `unaccent` peut ne pas être disponible sur tous les déploiements.
-- Cette fonction couvre les caractères français + ivoiriens courants.
CREATE OR REPLACE FUNCTION public.compta_unaccent_lite(p_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT translate(
    UPPER(p_text),
    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸÆŒ',
    'AAAAAACEEEEIIIINOOOOOUUUUYYAEOE'
  );
$$;


-- ── 7. Fonction : génération du suffixe initial à partir d'un nom ────────────
-- Logique :
--   - Enlever les civilités (MME, MR, M., MLLE, DR, PROF) au début
--   - Si 1 seul mot → 2 premières lettres ("Atta" → "AT")
--   - Si ≥ 2 mots   → initiale du 1er + initiale du 2e ("Garage Atta" → "GA")
-- Retourne toujours un suffixe en UPPER (2 lettres). Pas de gestion collision
-- ici — c'est `create_tiers` qui s'en charge en boucle.
CREATE OR REPLACE FUNCTION public.generate_tiers_suffix(p_nom TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean    TEXT;
  v_words    TEXT[];
  v_suffix   TEXT;
BEGIN
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN
    RETURN 'XX';
  END IF;

  -- 1. Nettoyer (UPPER + accents + civilités)
  v_clean := public.compta_unaccent_lite(TRIM(p_nom));
  v_clean := regexp_replace(v_clean, '^(MME|MR|M\.|MLLE|DR|PROF)\s+', '', 'i');
  v_clean := TRIM(v_clean);

  -- 2. Découper en mots significatifs (alphanumériques uniquement)
  v_words := regexp_split_to_array(v_clean, '[^A-Z0-9]+');
  v_words := array(SELECT w FROM unnest(v_words) AS w WHERE w <> '' AND char_length(w) > 0);

  IF array_length(v_words, 1) IS NULL THEN
    RETURN 'XX';
  ELSIF array_length(v_words, 1) = 1 THEN
    -- 1 seul mot → 2 premières lettres
    v_suffix := SUBSTRING(v_words[1] FROM 1 FOR 2);
    IF char_length(v_suffix) < 2 THEN
      v_suffix := RPAD(v_suffix, 2, 'X');
    END IF;
  ELSE
    -- ≥ 2 mots → initiale 1er + initiale 2e
    v_suffix := SUBSTRING(v_words[1] FROM 1 FOR 1) || SUBSTRING(v_words[2] FROM 1 FOR 1);
  END IF;

  RETURN v_suffix;
END;
$$;


-- ── 8. Fonction RPC atomique : create_tiers avec retry sur collision ─────────
-- Insère un tiers en gérant l'unicité du compte SYSCOHADA. Si le suffixe
-- de base entre en collision avec un tiers actif existant, ajoute un compteur
-- (GA → GA1 → GA2 …) jusqu'à 100 tentatives.
--
-- Retourne JSON : { tiers_id, suffix_final, compte_syscohada_code }
CREATE OR REPLACE FUNCTION public.create_tiers(
  p_nom                   TEXT,
  p_type                  TEXT,
  p_telephone             TEXT DEFAULT NULL,
  p_email                 TEXT DEFAULT NULL,
  p_adresse               TEXT DEFAULT NULL,
  p_raison_sociale        TEXT DEFAULT NULL,
  p_numero_rccm           TEXT DEFAULT NULL,
  p_numero_contribuable   TEXT DEFAULT NULL,
  p_suffix_manuel         TEXT DEFAULT NULL,
  p_notes                 TEXT DEFAULT NULL,
  p_user_id               UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tiers_id      UUID;
  v_parent_code   TEXT;
  v_suffix_base   TEXT;
  v_suffix_try    TEXT;
  v_attempt       INT := 0;
BEGIN
  -- Validations
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN
    RAISE EXCEPTION 'Nom obligatoire';
  END IF;
  IF p_type NOT IN ('client', 'fournisseur', 'salarie', 'autre') THEN
    RAISE EXCEPTION 'Type de tiers invalide : %', p_type;
  END IF;

  -- Mapping type → compte parent SYSCOHADA (cf. §2.2 de la spec)
  v_parent_code := CASE p_type
    WHEN 'client'      THEN '411'
    WHEN 'fournisseur' THEN '401'
    WHEN 'salarie'     THEN '421'
    WHEN 'autre'       THEN '467'
  END;

  -- Suffixe de base : manuel (si non vide) sinon auto-généré
  IF p_suffix_manuel IS NOT NULL AND TRIM(p_suffix_manuel) <> '' THEN
    v_suffix_base := UPPER(TRIM(p_suffix_manuel));
  ELSE
    v_suffix_base := public.generate_tiers_suffix(p_nom);
  END IF;

  -- Boucle de retry sur collision (max 100 tentatives)
  WHILE v_attempt < 100 LOOP
    v_suffix_try := CASE WHEN v_attempt = 0
                         THEN v_suffix_base
                         ELSE v_suffix_base || v_attempt::TEXT
                    END;
    BEGIN
      INSERT INTO public.tiers (
        nom, type, telephone, email, adresse,
        raison_sociale, numero_rccm, numero_contribuable,
        compte_syscohada_parent, compte_syscohada_suffix,
        notes, created_by, updated_by
      ) VALUES (
        TRIM(p_nom), p_type, NULLIF(TRIM(p_telephone), ''), NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_adresse), ''),
        NULLIF(TRIM(p_raison_sociale), ''), NULLIF(TRIM(p_numero_rccm), ''), NULLIF(TRIM(p_numero_contribuable), ''),
        v_parent_code, v_suffix_try,
        NULLIF(TRIM(p_notes), ''), p_user_id, p_user_id
      ) RETURNING id INTO v_tiers_id;
      EXIT;  -- succès, sortir de la boucle
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      v_tiers_id := NULL;
    END;
  END LOOP;

  IF v_tiers_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de générer un suffixe unique après 100 tentatives pour le nom "%"', p_nom;
  END IF;

  RETURN json_build_object(
    'tiers_id',              v_tiers_id,
    'suffix_final',          v_suffix_try,
    'compte_syscohada_code', v_parent_code || '-' || v_suffix_try
  );
END;
$$;

COMMENT ON FUNCTION public.create_tiers IS
  'Création atomique d''un tiers avec génération automatique du suffixe SYSCOHADA et retry sur collision (Phase 4.x Vague 2). Retourne JSON {tiers_id, suffix_final, compte_syscohada_code}.';


-- ── 9. Permissions RPC ───────────────────────────────────────────────────────
REVOKE ALL  ON FUNCTION public.create_tiers           FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.generate_tiers_suffix  FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.compta_unaccent_lite   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tiers           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_tiers_suffix  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compta_unaccent_lite   TO authenticated, service_role;
