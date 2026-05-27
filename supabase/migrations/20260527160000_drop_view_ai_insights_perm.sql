-- ============================================================
-- COCKPIT BOYAH - Suppression permissions AI Insights legacy
-- 27/05/2026 - Étape 3/3 refonte /ai-insights-boyah-group
-- ============================================================
-- Le système AI Insights legacy a été supprimé (page /ai-insights-boyah-group,
-- page legacy /ai-insights, routes /api/ai-insights/*). Les permissions
-- 'view_ai_insights' et 'generate_ai_insights' ne sont plus référencées
-- nulle part dans le code TypeScript.
--
-- Cette migration nettoie les lignes orphelines dans role_permissions.
--
-- ATTENTION : la TABLE ai_insights et la VUE vue_ai_insights_today sont
-- CONSERVÉES intentionnellement (archive historique des rapports IA).
-- Elles ne sont plus consommées par aucune page mais peuvent encore
-- contenir des données utiles à des fins d'audit ou de reprise future.
--
-- Idempotence : DELETE WHERE action IN (...) — ne plante pas si rejoué.
-- ============================================================

BEGIN;

DELETE FROM public.role_permissions
WHERE action IN ('view_ai_insights', 'generate_ai_insights');

COMMIT;
