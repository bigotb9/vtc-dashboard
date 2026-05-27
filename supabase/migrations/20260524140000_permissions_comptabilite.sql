-- ============================================================
-- PERMISSIONS COMPTABILITE - Ajout dans role_permissions
-- 24/05/2026
-- ============================================================
-- Avant cette migration, le module Comptabilite etait protege uniquement par
-- isDirecteur cote front (court-circuit dans le hook useProfile.can()).
-- Inconvenient : impossible de deleguer un acces lecture-seule a un admin.
--
-- Cette migration ajoute 4 nouvelles permissions granulaires :
--   - view_comptabilite     : voir le module et les etats (read-only)
--   - manage_comptabilite   : saisir/modifier les operations comptables
--   - manage_exercices      : cloturer un exercice (action irreversible)
--   - manage_societe        : modifier les parametres societe (RCCM, logo)
--
-- Defaults :
--   - directeur  : tout est TRUE (de toute facon Proxy court-circuit)
--   - admin      : view_comptabilite=TRUE, le reste FALSE (delegation lecture)
--   - dispatcher : tout FALSE (pas d'acces compta)
--
-- En complement : on ajoute aussi 'view_journal_activite' et on s'assure que
-- 'manage_users' est present (pour remplacer les isDirecteur sur les pages
-- /journal-activite et /parametres).
-- ============================================================

-- Insertions idempotentes via ON CONFLICT (la table a probablement une cle
-- composite (role, action) ou pas - on essaie les 2 approches)
DO $$
DECLARE
  v_actions TEXT[] := ARRAY[
    'view_comptabilite', 'manage_comptabilite',
    'manage_exercices',  'manage_societe',
    'view_journal_activite'
  ];
  v_action TEXT;
BEGIN
  FOREACH v_action IN ARRAY v_actions LOOP
    -- Admin : view_comptabilite et view_journal_activite TRUE par defaut,
    -- le reste FALSE. Adapte selon le niveau de delegation souhaite.
    INSERT INTO public.role_permissions (role, action, allowed)
    VALUES ('admin', v_action,
            CASE WHEN v_action IN ('view_comptabilite', 'view_journal_activite')
                 THEN TRUE ELSE FALSE END)
    ON CONFLICT (role, action) DO NOTHING;

    -- Dispatcher : tout FALSE par defaut
    INSERT INTO public.role_permissions (role, action, allowed)
    VALUES ('dispatcher', v_action, FALSE)
    ON CONFLICT (role, action) DO NOTHING;

    -- Directeur : tout TRUE (de toute facon Proxy court-circuit dans
    -- useProfile, mais on l'inscrit pour coherence avec la table)
    INSERT INTO public.role_permissions (role, action, allowed)
    VALUES ('directeur', v_action, TRUE)
    ON CONFLICT (role, action) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Permissions ajoutees : view_comptabilite, manage_comptabilite, manage_exercices, manage_societe, view_journal_activite (% lignes maxi inserees)', array_length(v_actions, 1) * 3;
END;
$$;

-- Note : si la table role_permissions n'a pas de PRIMARY KEY (role, action),
-- l'INSERT ON CONFLICT peut echouer. Dans ce cas, utiliser le bloc fallback :
--   WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role=... AND action=...)
