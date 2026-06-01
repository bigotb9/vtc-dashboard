-- ============================================================
-- PERMISSIONS - Ajout permission view_finances_cockpit
-- 01/06/2026 - Branchement helper marge consolidée sur le Cockpit
-- ============================================================
-- Cette migration est ADDITIVE UNIQUEMENT (aucun DELETE, aucun UPDATE).
--
-- Nouvelle permission GRANULAIRE de LECTURE des données financières
-- sensibles du Cockpit (marge consolidée du mois, arriéré clients,
-- rentabilité par véhicule client / véhicules déficitaires).
--
-- Distincte volontairement de :
--   - view_cockpit       : accès au Cockpit (KPIs non sensibles), large
--                          (backfillée depuis view_dashboard -> souvent true)
--   - view_comptabilite  : accès au module Comptabilité, large aussi
--   - manage_comptabilite : ÉCRITURE en compta (contresens pour un
--                          affichage lecture seule)
--
-- Par défaut FALSE pour TOUS les rôles non-directeur. Le Directeur
-- bypasse automatiquement côté code (cf. lib/requirePermission.ts:40 et
-- lib/compta/auth.ts), il n'a donc pas besoin de ligne ici.
--
-- Le Directeur pourra activer cette permission par rôle via
-- /parametres (onglet Permissions) au cas par cas.
--
-- Énumération des rôles : on s'appuie sur les rôles déjà présents dans
-- role_permissions (lignes 'view_dashboard'), comme la migration
-- 20260527170000 pour les permissions compta sensibles.
--
-- Idempotence : ON CONFLICT (role, action) DO NOTHING -> rejouable sans
-- erreur ni écrasement d'une valeur déjà positionnée manuellement.
-- ============================================================

BEGIN;

INSERT INTO public.role_permissions (role, action, allowed)
SELECT DISTINCT role, 'view_finances_cockpit', false
FROM public.role_permissions
WHERE action = 'view_dashboard'
ON CONFLICT (role, action) DO NOTHING;

COMMIT;
