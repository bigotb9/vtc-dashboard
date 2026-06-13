-- ============================================================
-- FIX lenteur (>30s) /api/boyah-transport/driver-stats
-- 02/06/2026
-- ============================================================
-- Meme anti-pattern que le 504 dashboard-stats : la route chargeait les
-- ~64 800 commandes_yango (colonne raw jsonb incluse) via ~65 requetes
-- paginees, puis agregait en JS (buckets par chauffeur + filter/sort).
--
-- Cette fonction pousse l'agregation PER-CHAUFFEUR dans Postgres : un seul
-- scan materialise, extraction jsonb une fois, GROUP BY driver_id. La route
-- ne fait plus qu'un appel RPC + l'appel Yango Drivers (noms/tel/plaque) +
-- un merge.
--
-- DIFFERENCES vs boyah_dashboard_stats (volontaires) :
--   - Fenetres GLISSANTES (pas calendaires) : les libelles UI sont "7 jours"
--     / "30 jours" -> created_at >= now() - interval '7 days' / '30 days'.
--   - UNE LIGNE PAR CHAUFFEUR de toute la flotte (pas un top 10).
--
-- Logique identique a l'ancienne route driver-stats :
--   - On ne retient que les courses status='complete' pour CA / commission /
--     courses_week / courses_mois / last_activity (l'ancienne route ne
--     poussait dans 'completed' que si status='complete', et derivait tout
--     de la).
--   - total_courses = nombre de courses COMPLETE (b.completed.length).
--   - Un chauffeur qui n'a que des courses annulees apparait quand meme
--     (total a 0) -> il sera classe inactif cote route.
--   - On ne groupe que les courses ayant un driver_profile.id non vide
--     (l'ancienne route faisait `if (!did) continue`).
--
-- Chemins jsonb (cartographie B1) :
--   prix      : (raw->>'price')::numeric
--   chauffeur : raw->'driver_profile'->>'id' / ->>'name'
--   statut    : colonne status ('complete')
--   date      : colonne created_at (timestamptz, indexee). Abidjan = UTC+0.
--
-- p_commission : taux Boyah (defaut 0.025). round()::bigint sur les montants
-- FCFA (entiers, pas de decimales).
--
-- SECURITY INVOKER (defaut) + GRANT EXECUTE : la route appelle avec la cle
-- anon (commandes_yango n'a pas de RLS). CREATE OR REPLACE = idempotent,
-- lecture seule, reversible (DROP FUNCTION public.boyah_driver_stats(numeric)).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.boyah_driver_stats(p_commission numeric DEFAULT 0.025)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH base AS MATERIALIZED (
  SELECT
    NULLIF(trim(raw->'driver_profile'->>'id'), '')  AS driver_id,
    raw->'driver_profile'->>'name'                  AS driver_name,
    NULLIF(raw->>'price', '')::numeric              AS price,
    created_at,
    (status = 'complete')                           AS is_complete
  FROM public.commandes_yango
  WHERE NULLIF(trim(raw->'driver_profile'->>'id'), '') IS NOT NULL
),
agg AS (
  SELECT
    b.driver_id,
    max(b.driver_name)                                                                      AS driver_name,
    count(*) FILTER (WHERE b.is_complete)                                                   AS total_courses,
    coalesce(sum(b.price) FILTER (WHERE b.is_complete), 0)                                  AS total_revenue,
    count(*) FILTER (WHERE b.is_complete AND b.created_at >= now() - interval '7 days')     AS courses_week,
    count(*) FILTER (WHERE b.is_complete AND b.created_at >= now() - interval '30 days')    AS courses_mois,
    max(b.created_at) FILTER (WHERE b.is_complete)                                          AS last_activity
  FROM base b
  GROUP BY b.driver_id
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'driver_id',     driver_id,
  'driver_name',   coalesce(driver_name, ''),
  'total_courses', total_courses,
  'total_revenue', round(total_revenue)::bigint,
  'commission',    round(total_revenue * p_commission)::bigint,
  'courses_week',  courses_week,
  'courses_mois',  courses_mois,
  'last_activity', to_char(last_activity AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) ORDER BY total_revenue DESC NULLS LAST), '[]'::jsonb)
FROM agg;
$$;

-- La route appelle avec la cle anon ; commandes_yango n'a pas de RLS.
GRANT EXECUTE ON FUNCTION public.boyah_driver_stats(numeric) TO anon, authenticated, service_role;

COMMIT;
