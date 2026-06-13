-- ============================================================
-- PERMISSIONS - Ajout permissions granulaires (clients × 4, cockpit, comptabilité × 4)
-- 27/05/2026 - Suite refonte UI Cockpit + matrice permissions
-- ============================================================
-- Cette migration est ADDITIVE UNIQUEMENT (aucun DELETE).
--
-- Elle backfille les nouvelles permissions à partir des permissions
-- existantes (manage_clients, view_dashboard) pour préserver les
-- droits actuels des Admins / Dispatchers et éviter tout gap d'accès
-- au moment du déploiement.
--
-- L'ancienne permission 'manage_clients' reste en BD comme ligne
-- orpheline inoffensive : le code TS ne la lit plus (type Permission
-- ne l'inclut plus). Un cleanup séparé sera fait dans une migration
-- ultérieure, une fois la prod stabilisée.
--
-- Mappings :
--   manage_clients      → view_clients / create_client / edit_client / delete_client
--   view_dashboard      → view_cockpit
--   view_dashboard      → view_comptabilite
--   (par défaut FALSE)  → manage_comptabilite / manage_exercices / manage_societe
--
-- Idempotence : toutes les inserts utilisent ON CONFLICT (role, action)
-- DO NOTHING. La migration peut être rejouée sans erreur ni écrasement
-- des valeurs existantes (un Admin déjà restreint manuellement ne
-- verra pas ses droits modifiés par un re-run).
--
-- Le Directeur n'est pas concerné (bypass automatique côté code,
-- cf. lib/requirePermission.ts:40).
-- ============================================================

BEGIN;

-- ─── 1. Backfill 4 granulaires clients depuis manage_clients ────────────
INSERT INTO public.role_permissions (role, action, allowed)
SELECT role, 'view_clients', allowed FROM public.role_permissions WHERE action = 'manage_clients'
ON CONFLICT (role, action) DO NOTHING;

INSERT INTO public.role_permissions (role, action, allowed)
SELECT role, 'create_client', allowed FROM public.role_permissions WHERE action = 'manage_clients'
ON CONFLICT (role, action) DO NOTHING;

INSERT INTO public.role_permissions (role, action, allowed)
SELECT role, 'edit_client', allowed FROM public.role_permissions WHERE action = 'manage_clients'
ON CONFLICT (role, action) DO NOTHING;

INSERT INTO public.role_permissions (role, action, allowed)
SELECT role, 'delete_client', allowed FROM public.role_permissions WHERE action = 'manage_clients'
ON CONFLICT (role, action) DO NOTHING;

-- ─── 2. Backfill view_cockpit depuis view_dashboard ─────────────────────
INSERT INTO public.role_permissions (role, action, allowed)
SELECT role, 'view_cockpit', allowed FROM public.role_permissions WHERE action = 'view_dashboard'
ON CONFLICT (role, action) DO NOTHING;

-- ─── 3. Backfill view_comptabilite depuis view_dashboard (non sensible)
INSERT INTO public.role_permissions (role, action, allowed)
SELECT role, 'view_comptabilite', allowed FROM public.role_permissions WHERE action = 'view_dashboard'
ON CONFLICT (role, action) DO NOTHING;

-- ─── 4. Permissions Compta sensibles : false par défaut ─────────────────
-- Le directeur pourra les activer manuellement via /parametres pour
-- les rôles qui en ont besoin.
INSERT INTO public.role_permissions (role, action, allowed)
SELECT DISTINCT role, 'manage_comptabilite', false FROM public.role_permissions WHERE action = 'view_dashboard'
ON CONFLICT (role, action) DO NOTHING;

INSERT INTO public.role_permissions (role, action, allowed)
SELECT DISTINCT role, 'manage_exercices', false FROM public.role_permissions WHERE action = 'view_dashboard'
ON CONFLICT (role, action) DO NOTHING;

INSERT INTO public.role_permissions (role, action, allowed)
SELECT DISTINCT role, 'manage_societe', false FROM public.role_permissions WHERE action = 'view_dashboard'
ON CONFLICT (role, action) DO NOTHING;

COMMIT;
