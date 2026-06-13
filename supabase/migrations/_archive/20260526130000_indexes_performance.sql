-- ============================================================
-- LOT Y - Index de performance sur colonnes fortement requetees
-- 26/05/2026
-- ============================================================
-- Finding 3.6 audit : ces colonnes sont utilisees dans des WHERE/ORDER BY/JOIN
-- frequents par le dashboard, le module Clients, l'agent IA et les routes
-- d'agregation. Sans index, scan sequentiel sur toutes les lignes.
--
-- Mesure attendue : page /comptabilite passe de plusieurs secondes a < 1s
-- sur 1000+ recettes_wave (gain principal sur le tri par "Horodatage" DESC).
--
-- IF NOT EXISTS : la migration est idempotente, rejouable sans erreur si
-- un index a deja ete cree manuellement.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_recettes_wave_horodatage
  ON public.recettes_wave ("Horodatage");

CREATE INDEX IF NOT EXISTS idx_depenses_vehicules_date_depense
  ON public.depenses_vehicules (date_depense);

CREATE INDEX IF NOT EXISTS idx_versement_attribution_jour_exploitation
  ON public.versement_attribution (jour_exploitation);

CREATE INDEX IF NOT EXISTS idx_versements_clients_mois
  ON public.versements_clients (mois);

CREATE INDEX IF NOT EXISTS idx_commandes_yango_created_at
  ON public.commandes_yango (created_at);

COMMIT;
