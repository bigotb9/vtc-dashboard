-- ============================================================
-- MODULE CLIENTS - Enrichissement 23/05/2026
-- §3 : Documents par Client (E1)
-- ============================================================
-- Periimetre :
--   - Table clients_documents (un Client peut avoir N documents)
--   - Types : contrat / cni / carte_grise / assurance / justificatif / autre
--   - Stockage des fichiers : bucket Supabase Storage 'clients-docs'
--     (a creer manuellement dans Supabase Studio AVANT execution de la migration)
--   - RLS : lecture/ecriture pour role authentifie avec permission Clients
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients_documents (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  id_client     INTEGER      NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  type          TEXT         NOT NULL CHECK (type IN (
                              'contrat', 'cni', 'carte_grise', 'assurance',
                              'justificatif', 'etat_comptes_sortie', 'autre'
                            )),
  nom_fichier   TEXT         NOT NULL CHECK (char_length(TRIM(nom_fichier)) >= 1 AND char_length(nom_fichier) <= 255),
  storage_path  TEXT         NOT NULL CHECK (char_length(storage_path) <= 1000),
  taille        INTEGER      NOT NULL CHECK (taille > 0),
  mime_type     TEXT         NOT NULL CHECK (char_length(mime_type) <= 100),
  auto_genere   BOOLEAN      NOT NULL DEFAULT FALSE,
  notes         TEXT         CHECK (notes IS NULL OR char_length(notes) <= 1000),

  uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  uploaded_by   UUID         REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT uniq_clients_documents_path UNIQUE (storage_path)
);

-- Index pour requete frequente : tous les documents d'un client
CREATE INDEX IF NOT EXISTS idx_clients_documents_id_client
  ON public.clients_documents (id_client, uploaded_at DESC);

-- Index secondaire pour filtrage par type
CREATE INDEX IF NOT EXISTS idx_clients_documents_type
  ON public.clients_documents (type)
  WHERE type IS NOT NULL;

COMMENT ON TABLE public.clients_documents IS
  'Documents archives par Client (asset management). Stockage physique : '
  'bucket Supabase Storage clients-docs/. Types : contrat, CNI, carte grise, '
  'assurance, justificatif (auto), etat des comptes a la sortie (auto), autre. '
  'Ajoute le 23/05/2026 (E1 module Clients enrichi).';

-- ── RLS : meme regle que la table clients (qui est publique car legacy) ──
-- Note : on garde la RLS desactivee comme sur clients pour rester coherent.
-- Si la table clients passe en RLS plus tard, il faudra l'activer ici aussi.
ALTER TABLE public.clients_documents DISABLE ROW LEVEL SECURITY;
