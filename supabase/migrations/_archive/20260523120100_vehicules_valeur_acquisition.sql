-- ============================================================
-- MODULE CLIENTS - Enrichissement 23/05/2026
-- §2 : Capital gere par Client (G1)
-- ============================================================
-- Periimetre :
--   - ALTER TABLE vehicules ADD COLUMN valeur_acquisition_client (additive, nullable)
--   - Sert au calcul du KPI "Capital gere" sur le dashboard /clients
--   - NULL par defaut : Emmanuel saisira la valeur vehicule par vehicule
--     plus tard. Le KPI affichera '-' pour les vehicules sans valeur.
-- ============================================================

ALTER TABLE public.vehicules
  ADD COLUMN IF NOT EXISTS valeur_acquisition_client NUMERIC(15, 2);

COMMENT ON COLUMN public.vehicules.valeur_acquisition_client IS
  'Valeur d''acquisition du vehicule par le Client (FCFA). Utilisee pour le '
  'KPI Capital gere agrege sur la page /clients. NULL = donnee non saisie. '
  'Ajoute le 23/05/2026 (G1 module Clients enrichi).';
