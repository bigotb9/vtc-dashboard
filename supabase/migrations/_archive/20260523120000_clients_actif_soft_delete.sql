-- ============================================================
-- MODULE CLIENTS - Enrichissement 23/05/2026
-- §1 : Soft-delete via colonne actif (QW3)
-- ============================================================
-- Periimetre :
--   - ALTER TABLE clients ADD COLUMN actif (additive, defaut TRUE)
--   - Index sur actif pour acceleration filtre liste
--   - Backfill : tous les clients existants passent actif = TRUE
-- ============================================================

-- Ajout de la colonne actif (NOT NULL avec defaut TRUE garantit le backfill auto)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE;

-- Index pour acceleration du filtre "Clients actifs uniquement"
CREATE INDEX IF NOT EXISTS idx_clients_actif
  ON public.clients (actif)
  WHERE actif = TRUE;

-- Commentaire descriptif sur la colonne
COMMENT ON COLUMN public.clients.actif IS
  'Soft-delete : TRUE = client visible dans la liste par defaut. '
  'FALSE = client archive, accessible uniquement via la checkbox Inactifs. '
  'Ajoute le 23/05/2026 (QW3 module Clients enrichi).';
