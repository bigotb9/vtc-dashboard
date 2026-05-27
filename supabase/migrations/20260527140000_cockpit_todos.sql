-- ============================================================
-- COCKPIT BOYAH - Table todos partagée équipe
-- 27/05/2026 - Étape 1/3 refonte /ai-insights-boyah-group
-- ============================================================
-- To-do simple texte + checkbox, partagée entre tous les utilisateurs
-- authentifiés (lecture/écriture libre). RLS activée pour bloquer les
-- anonymes mais aucun filtre par owner (volontaire : c'est un to-do
-- d'équipe, pas par utilisateur).
-- ============================================================

BEGIN;

CREATE TABLE public.cockpit_todos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texte      TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at    TIMESTAMPTZ,
  done_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_cockpit_todos_done ON public.cockpit_todos(done, created_at DESC);

-- RLS : tous les utilisateurs authentifiés peuvent lire et écrire
ALTER TABLE public.cockpit_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cockpit_todos_read_authenticated
  ON public.cockpit_todos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY cockpit_todos_insert_authenticated
  ON public.cockpit_todos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY cockpit_todos_update_authenticated
  ON public.cockpit_todos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY cockpit_todos_delete_authenticated
  ON public.cockpit_todos
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE public.cockpit_todos IS
  'Liste partagée équipe pour la page Cockpit Boyah - to-do simple texte+checkbox';

COMMIT;
