-- ============================================================
-- PHASE 4.2 — Module 3a : Bilan mapping (SYSCOHADA révisé)
-- ============================================================
-- Référence : doc Phase 4.2 §4.4.
--
-- Table de configuration : pour chaque classe / sous-classe SYSCOHADA,
-- on indique le poste du Bilan (Actif/Passif) où le solde doit
-- s'agréger. Le seed reflète le plan SYSCOHADA Système normal.
-- ============================================================


CREATE TABLE IF NOT EXISTS public.bilan_mapping (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_compte       TEXT         NOT NULL,           -- ex '2', '21', '411', '5'
  poste_bilan         TEXT         NOT NULL,           -- ex 'AI_INCORP', 'AC_CLIENTS'
  section             TEXT         NOT NULL CHECK (section IN
                                    ('ACTIF_IMMO','ACTIF_CIRC','TRESO_ACTIF',
                                     'CAP_PROPRES','DETTES_FIN','PASSIF_CIRC','TRESO_PASSIF')),
  cote                TEXT         NOT NULL CHECK (cote IN ('actif','passif')),
  ordre               INTEGER      NOT NULL DEFAULT 0,
  override_manuel     BOOLEAN      NOT NULL DEFAULT FALSE,  -- si TRUE, ne pas écraser au re-seed
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (classe_compte)
);

ALTER TABLE public.bilan_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS directeur_full_access ON public.bilan_mapping;
CREATE POLICY directeur_full_access
  ON public.bilan_mapping FOR ALL
  USING (public.is_directeur()) WITH CHECK (public.is_directeur());


-- ── Seed mapping SYSCOHADA (Système normal, simplifié V1) ──────────────────
-- Section / Poste / Cote / Ordre

-- ACTIF IMMOBILISÉ (classe 2)
INSERT INTO public.bilan_mapping (classe_compte, poste_bilan, section, cote, ordre) VALUES
  ('20', 'AI_INCORP',          'ACTIF_IMMO', 'actif', 1),
  ('21', 'AI_INCORP',          'ACTIF_IMMO', 'actif', 2),
  ('22', 'AI_CORP_TERRAIN',    'ACTIF_IMMO', 'actif', 3),
  ('23', 'AI_CORP_BATIMENT',   'ACTIF_IMMO', 'actif', 4),
  ('24', 'AI_CORP_MATERIEL',   'ACTIF_IMMO', 'actif', 5),
  ('25', 'AI_CORP_AUTRES',     'ACTIF_IMMO', 'actif', 6),
  ('26', 'AI_FINANCIER',       'ACTIF_IMMO', 'actif', 7),
  ('27', 'AI_FINANCIER',       'ACTIF_IMMO', 'actif', 8),
  -- ACTIF CIRCULANT (classes 3, 4 débiteurs)
  ('3',  'AC_STOCKS',          'ACTIF_CIRC', 'actif', 10),
  ('40', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 11),   -- 40 = fournisseurs créditeurs (anomalie côté actif → traité ailleurs)
  ('41', 'AC_CLIENTS',         'ACTIF_CIRC', 'actif', 12),
  ('42', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 13),   -- personnel
  ('43', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 14),
  ('44', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 15),
  ('45', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 16),
  ('46', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 17),
  ('47', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 18),
  ('48', 'AC_AUTRES',          'ACTIF_CIRC', 'actif', 19),
  -- TRÉSORERIE-ACTIF (classe 5)
  ('52', 'TA_BANQUE',          'TRESO_ACTIF','actif', 20),
  ('53', 'TA_BANQUE',          'TRESO_ACTIF','actif', 21),
  ('57', 'TA_CAISSE',          'TRESO_ACTIF','actif', 22),
  -- CAPITAUX PROPRES (classe 1)
  ('10', 'CP_CAPITAL',         'CAP_PROPRES','passif', 50),
  ('11', 'CP_RESERVES',        'CAP_PROPRES','passif', 51),
  ('12', 'CP_REPORT_NOUVEAU',  'CAP_PROPRES','passif', 52),
  ('13', 'CP_RESULTAT',        'CAP_PROPRES','passif', 53),
  -- DETTES FINANCIÈRES (16, 17, 18)
  ('16', 'DF_EMPRUNTS',        'DETTES_FIN', 'passif', 60),
  ('17', 'DF_EMPRUNTS',        'DETTES_FIN', 'passif', 61),
  ('18', 'DF_AUTRES',          'DETTES_FIN', 'passif', 62),
  -- PASSIF CIRCULANT (40s créditeurs)
  ('401','PC_FOURNISSEURS',    'PASSIF_CIRC','passif', 70),
  -- TRÉSORERIE-PASSIF (5 créditeurs, découverts)
  ('56', 'TP_DECOUVERTS',      'TRESO_PASSIF','passif', 80)
ON CONFLICT (classe_compte) DO NOTHING;
