-- ================================================================
-- AGENT IA BOYA – Tables Supabase
-- Exécuter dans Supabase SQL Editor
-- ================================================================

-- Mémoire longue durée de l'agent
CREATE TABLE IF NOT EXISTS agent_memory (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  categorie   text NOT NULL,                          -- entreprise | marche | chauffeur | decision | alerte | preference
  cle         text NOT NULL UNIQUE,                   -- clé unique pour upsert
  valeur      text NOT NULL,
  importance  int  DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Historique des conversations Telegram
CREATE TABLE IF NOT EXISTS agent_conversations (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id  text,
  telegram_user_id  text,
  role              text NOT NULL CHECK (role IN ('user', 'assistant')),
  content           text NOT NULL,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_conv_chat ON agent_conversations (telegram_chat_id, created_at DESC);

-- Analyses archivées (rapports, alertes, veille marché)
CREATE TABLE IF NOT EXISTS agent_analyses (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text NOT NULL,   -- daily_report | alerts | market_research | on_demand
  titre      text,
  contenu    text NOT NULL,
  donnees    jsonb,
  created_at timestamptz DEFAULT now()
);

-- Trigger pour updated_at sur agent_memory
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_agent_memory_updated_at ON agent_memory;
CREATE TRIGGER set_agent_memory_updated_at
  BEFORE UPDATE ON agent_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Désactiver RLS (accès depuis les API routes serveur)
ALTER TABLE agent_memory        DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analyses      DISABLE ROW LEVEL SECURITY;

-- Mémoire initiale de l'entreprise
INSERT INTO agent_memory (categorie, cle, valeur, importance) VALUES
  ('entreprise', 'nom',          'Boyah Group',                                           10),
  ('entreprise', 'secteur',      'VTC – Voitures de Transport avec Chauffeur',            10),
  ('entreprise', 'localisation', 'Côte d''Ivoire, Abidjan',                              10),
  ('entreprise', 'plateforme',   'Yango (Boyah Transport) + flotte propre (main fleet)',  9),
  ('marche',     'concurrents',  'Yango dominant, InDriver, Bolt en croissance en CI',    8),
  ('marche',     'contexte',     'Marché VTC Abidjan très compétitif, tarifs pression',   7)
ON CONFLICT (cle) DO NOTHING;
