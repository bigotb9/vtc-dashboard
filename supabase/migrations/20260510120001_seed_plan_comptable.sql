-- ============================================================
-- SEED : Plan comptable VTC SYSCOHADA (révisé / AUDCIF 2017)
-- Phase 1 — Fondations
--
-- Source : sections 3.1 → 3.6 du document instructions_cowork_compta.
-- Ne pas modifier les codes : cohérence stricte avec SYSCOHADA.
-- Idempotent : ON CONFLICT (code) DO NOTHING.
-- ============================================================

-- ── Classe 1 — Comptes de ressources durables ────────────────────────────────
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('101',  'Capital social',                                       1, 'capitaux_propres',     NULL,  10),
  ('106',  'Réserves',                                              1, 'capitaux_propres',     NULL,  20),
  ('11',   'Report à nouveau',                                      1, 'capitaux_propres',     NULL,  30),
  ('13',   'Résultat net de l''exercice',                           1, 'capitaux_propres',     NULL,  40),
  ('16',   'Emprunts et dettes assimilées',                         1, 'dettes_financieres',   NULL,  50),
  ('162',  'Emprunts auprès des établissements de crédit',          1, 'dettes_financieres',   '16',  51),
  ('167',  'Avances reçues et comptes courants des associés',       1, 'dettes_financieres',   '16',  52)
ON CONFLICT (code) DO NOTHING;


-- ── Classe 2 — Comptes d'actif immobilisé ────────────────────────────────────
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('244',   'Matériel et mobilier de bureau',                       2, 'immobilisation',     NULL,    10),
  ('2444',  'Matériel informatique',                                 2, 'immobilisation',     '244',   11),
  ('2451',  'Matériel de transport — Véhicules de tourisme',         2, 'immobilisation',     NULL,    20),
  ('2454',  'Matériel de transport — Engins agréés (VTC)',           2, 'immobilisation',     NULL,    30),
  ('2451A', 'Amortissements véhicules de tourisme',                  2, 'amortissement',      NULL,    40),
  ('281',   'Amortissements des immobilisations corporelles',        2, 'amortissement',      NULL,    50),
  ('275',   'Dépôts et cautionnements versés',                       2, 'immobilisation_fin', NULL,    60)
ON CONFLICT (code) DO NOTHING;


-- ── Classe 4 — Comptes de tiers ──────────────────────────────────────────────
-- Insérer les codes parents avant les enfants
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('401',  'Fournisseurs (dettes d''exploitation)',                                 4, 'tiers_passif', NULL,   10),
  ('411',  'Clients (créances d''exploitation)',                                    4, 'tiers_actif',  NULL,   20),
  ('462',  'Apporteurs de capitaux — Famille A et Famille B (loyers à reverser)',   4, 'tiers_passif', NULL,   30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('4011', 'Fournisseurs locaux — Carburant',                                       4, 'tiers_passif', '401',  11),
  ('4012', 'Fournisseurs locaux — Pièces et entretien',                             4, 'tiers_passif', '401',  12),
  ('4019', 'Fournisseurs divers',                                                   4, 'tiers_passif', '401',  13),
  ('4111', 'Clients — Chauffeurs (versements quotidiens dus)',                      4, 'tiers_actif',  '411',  21),
  ('4112', 'Clients — Yango (commissions à recevoir)',                              4, 'tiers_actif',  '411',  22),
  ('4119', 'Clients divers',                                                        4, 'tiers_actif',  '411',  23),
  ('421',  'Personnel — Avances et acomptes',                                       4, 'tiers_actif',  NULL,   40),
  ('422',  'Personnel — Rémunérations dues',                                        4, 'tiers_passif', NULL,   50),
  ('431',  'Sécurité sociale (CNPS)',                                               4, 'tiers_passif', NULL,   60),
  ('442',  'État — Impôts et taxes',                                                4, 'tiers_passif', NULL,   70),
  ('4621', 'Apporteurs Famille A — comptes individuels',                            4, 'tiers_passif', '462',  31),
  ('4622', 'Apporteurs Famille B — comptes individuels',                            4, 'tiers_passif', '462',  32),
  ('471',  'Comptes d''attente (à régulariser)',                                    4, 'tiers',        NULL,   80)
ON CONFLICT (code) DO NOTHING;


-- ── Classe 5 — Comptes de trésorerie ─────────────────────────────────────────
-- Parents d'abord
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('521', 'Banques locales (FCFA)',                              5, 'tresorerie', NULL,   10),
  ('531', 'Mobile money (Wave, OM, MTN, Moov)',                  5, 'tresorerie', NULL,   20),
  ('571', 'Caisse — espèces',                                    5, 'tresorerie', NULL,   30),
  ('581', 'Virements internes (compte de transition)',           5, 'tresorerie', NULL,   40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('5211', 'SGCI',                                               5, 'tresorerie', '521',  11),
  ('5212', 'Ecobank',                                            5, 'tresorerie', '521',  12),
  ('5213', 'NSIA Banque',                                        5, 'tresorerie', '521',  13),
  ('5311', 'Wave Boyah',                                         5, 'tresorerie', '531',  21),
  ('5312', 'Orange Money Boyah',                                 5, 'tresorerie', '531',  22),
  ('5313', 'MTN MoMo Boyah',                                     5, 'tresorerie', '531',  23),
  ('5711', 'Caisse principale siège',                            5, 'tresorerie', '571',  31),
  ('5712', 'Petite caisse opérationnelle',                       5, 'tresorerie', '571',  32)
ON CONFLICT (code) DO NOTHING;


-- ── Classe 6 — Comptes de charges ────────────────────────────────────────────
-- Parents d'abord pour les sous-comptes 624x
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('624',  'Entretien et réparations véhicules',                                     6, 'charge_exploitation', NULL,  100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('6052', 'Carburants et lubrifiants',                                              6, 'charge_exploitation', NULL,   10),
  ('6056', 'Achats stockés — Pièces de rechange',                                    6, 'charge_exploitation', NULL,   20),
  ('6081', 'Achats — Petit outillage et fournitures',                                6, 'charge_exploitation', NULL,   30),
  ('6131', 'Locations véhicules (sous-traitance Yango)',                             6, 'charge_exploitation', NULL,   40),
  ('6132', 'Locations bureaux et immobilier',                                        6, 'charge_exploitation', NULL,   50),
  ('6228', 'Honoraires (comptable, juridique, conseil)',                             6, 'charge_exploitation', NULL,   60),
  ('6241', 'Entretien — Vidanges et petites réparations',                            6, 'charge_exploitation', '624', 110),
  ('6242', 'Entretien — Réparations majeures',                                       6, 'charge_exploitation', '624', 120),
  ('625',  'Primes d''assurance véhicules',                                          6, 'charge_exploitation', NULL,  130),
  ('6262', 'Frais de télécommunication (data chauffeurs, internet)',                 6, 'charge_exploitation', NULL,  140),
  ('627',  'Services bancaires (commissions, agios)',                                6, 'charge_exploitation', NULL,  150),
  ('633',  'Frais de visites techniques et contrôles',                               6, 'charge_exploitation', NULL,  160),
  ('646',  'Droits d''enregistrement (cartes stationnement, patente)',               6, 'charge_exploitation', NULL,  170),
  ('658',  'Charges diverses d''exploitation (commissions Yango versées)',           6, 'charge_exploitation', NULL,  180),
  -- 6589 : référencé par le mapping section 3.7 ("Autre dépense (à classer)").
  -- Codifié comme sous-compte de 658, type 'charge_exploitation'.
  ('6589', 'Autre dépense (à classer)',                                              6, 'charge_exploitation', '658', 181),
  ('661',  'Rémunérations directes — Personnel (chauffeurs salariés)',               6, 'charge_personnel',    NULL,  200),
  ('664',  'Charges sociales (CNPS employeur)',                                      6, 'charge_personnel',    NULL,  210),
  ('671',  'Intérêts des emprunts',                                                  6, 'charge_financiere',   NULL,  220),
  ('681',  'Dotations aux amortissements',                                           6, 'dotation',            NULL,  230),
  ('691',  'Dotations aux provisions d''exploitation',                               6, 'dotation',            NULL,  240)
ON CONFLICT (code) DO NOTHING;


-- ── Classe 7 — Comptes de produits ───────────────────────────────────────────
-- Parent 706 d'abord
INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('706', 'Services vendus — Recettes courses VTC (Boyah Group flotte propre)',     7, 'produit_exploitation', NULL,   10)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.comptes_syscohada (code, libelle, classe, type, parent_code, ordre) VALUES
  ('7061', 'Recettes versements quotidiens chauffeurs (Wave)',                       7, 'produit_exploitation', '706',  11),
  ('7062', 'Commissions Boyah Transport (2,5 % Yango)',                              7, 'produit_exploitation', '706',  12),
  ('7063', 'Recettes véhicules sous gestion (clients propriétaires)',                7, 'produit_exploitation', '706',  13),
  ('758',  'Produits divers d''exploitation',                                        7, 'produit_exploitation', NULL,   20),
  ('771',  'Intérêts perçus (placements)',                                           7, 'produit_financier',    NULL,   30),
  ('781',  'Reprises de provisions',                                                 7, 'reprise',              NULL,   40)
ON CONFLICT (code) DO NOTHING;
