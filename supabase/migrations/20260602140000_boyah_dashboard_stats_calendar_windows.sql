-- ============================================================
-- FENETRES TEMPORELLES : GLISSANT -> CALENDAIRE
-- 02/06/2026
-- ============================================================
-- Probleme constate au dashboard : "CETTE SEMAINE" (revenue.week) etait
-- calcule en 7 JOURS GLISSANTS (b.d >= today - 7) alors que "CE MOIS"
-- (revenue.month) etait deja calendaire (mois en cours). Resultat absurde
-- au 2 juin : semaine glissante (2 547 700 F, inclut fin mai) > mois
-- calendaire (461 400 F, = 2 jours de juin). Une "semaine" ne peut pas
-- depasser le "mois" qui la contient.
--
-- Correction : week / prevWeek deviennent CALENDAIRES (semaine ISO, debut
-- LUNDI via date_trunc('week', ...)). month etait deja calendaire ; on le
-- reecrit sous la meme forme (b.d >= month_start) pour homogeneite.
--
--   week      = semaine calendaire EN COURS : lundi -> aujourd'hui inclus
--               (b.d >= week_start)
--   prevWeek  = semaine calendaire PRECEDENTE complete : lundi -> dimanche
--               (b.d >= week_start - 7 AND b.d < week_start)
--   month     = mois calendaire EN COURS : 1er -> aujourd'hui inclus
--               (b.d >= month_start)
--
-- Convention CONFIRMEE : date_trunc('week', ts) en Postgres renvoie le LUNDI
-- (semaine ISO 8601). Fuseau Abidjan = UTC+0 (deja gere par timezone('UTC',...)).
--
-- trendWeekPct : formule INCHANGEE, mais recalculee mecaniquement sur les
-- nouvelles bornes (week vs prevWeek calendaires).
--
-- NE CHANGENT PAS : today, total, prevweek->week trend formula, les top
-- (drivers/vehicles), les charts 30j (daily/hourly/completion), payments.
-- Seules les 3 fenetres rev_week / rev_prevweek / rev_month changent, plus
-- l'ajout de week_start dans la CTE p.
--
-- CREATE OR REPLACE : idempotent, lecture seule, reversible (re-appliquer la
-- migration 20260602120000 restaure les fenetres glissantes).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.boyah_dashboard_stats(p_commission numeric DEFAULT 0.025)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH base AS MATERIALIZED (
  SELECT
    (timezone('UTC', created_at))::date                  AS d,
    extract(hour FROM timezone('UTC', created_at))::int  AS hr,
    NULLIF(raw->>'price', '')::numeric                   AS price,
    coalesce(raw->'driver_profile'->>'id', 'unknown')    AS driver_id,
    coalesce(raw->'driver_profile'->>'name', 'Inconnu')  AS driver_name,
    coalesce(raw->'car'->>'id', raw->'car'->>'callsign',
             raw->'car'->>'brand_model', 'Inconnu')      AS car_key,
    raw->'car'->>'callsign'                              AS car_callsign,
    raw->'car'->>'brand_model'                          AS car_model,
    raw->>'payment_method'                              AS payment_method,
    (status = 'complete')                                                   AS is_complete,
    (status = 'cancelled' OR status = 'failed' OR status LIKE 'cancel%')    AS is_cancelled
  FROM public.commandes_yango
),
p AS (
  SELECT
    (timezone('UTC', now()))::date                       AS today,
    date_trunc('week',  timezone('UTC', now()))::date    AS week_start,
    date_trunc('month', timezone('UTC', now()))::date    AS month_start
),
-- squelette 30 jours (today-29 .. today) pour avoir les jours a zero
days AS (
  SELECT gs::date AS d
  FROM p,
  LATERAL generate_series((p.today - 29)::timestamp, p.today::timestamp, interval '1 day') AS gs
),
daily_agg AS (
  SELECT
    b.d,
    count(*) FILTER (WHERE b.is_complete)                       AS courses,
    coalesce(sum(b.price) FILTER (WHERE b.is_complete), 0)      AS revenus,
    count(*)                                                    AS total_all
  FROM base b, p
  WHERE b.d >= p.today - 29
  GROUP BY b.d
),
daily AS (
  SELECT
    dd.d,
    coalesce(da.revenus, 0)   AS revenus,
    coalesce(da.courses, 0)   AS courses,
    coalesce(da.total_all, 0) AS total_all
  FROM days dd
  LEFT JOIN daily_agg da ON da.d = dd.d
),
hourly AS (
  SELECT b.hr, round(sum(b.price))::bigint AS value
  FROM base b, p
  WHERE b.is_complete AND b.d = p.today
  GROUP BY b.hr
  HAVING round(sum(b.price)) > 0
),
drivers AS (
  SELECT
    max(b.driver_name)  AS name,
    count(*)            AS courses,
    sum(b.price)        AS revenue
  FROM base b
  WHERE b.is_complete
  GROUP BY b.driver_id
  ORDER BY sum(b.price) DESC NULLS LAST
  LIMIT 10
),
vehicles AS (
  SELECT
    max(b.car_callsign) AS callsign,
    max(b.car_model)    AS model,
    count(*)            AS courses,
    sum(b.price)        AS revenue
  FROM base b
  WHERE b.is_complete
  GROUP BY b.car_key
  ORDER BY sum(b.price) DESC NULLS LAST
  LIMIT 6
),
payments AS (
  SELECT coalesce(b.payment_method, 'Autre') AS name, count(*) AS value
  FROM base b
  WHERE b.is_complete
  GROUP BY coalesce(b.payment_method, 'Autre')
),
agg AS (
  SELECT
    count(*)                                                                 AS orders,
    count(*) FILTER (WHERE b.is_complete)                                    AS completed,
    count(*) FILTER (WHERE b.is_cancelled)                                   AS cancelled,
    count(*) FILTER (WHERE NOT b.is_complete AND NOT b.is_cancelled)         AS inflight,
    coalesce(sum(b.price) FILTER (WHERE b.is_complete), 0)                   AS rev_total,
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.d = p.today), 0) AS rev_today,
    -- CALENDAIRE : semaine ISO en cours (lundi -> aujourd'hui inclus)
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.d >= p.week_start), 0)                        AS rev_week,
    -- CALENDAIRE : semaine ISO precedente complete (lundi -> dimanche)
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.d >= p.week_start - 7 AND b.d < p.week_start), 0) AS rev_prevweek,
    -- CALENDAIRE : mois en cours (1er -> aujourd'hui inclus)
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.d >= p.month_start), 0)                       AS rev_month,
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.payment_method = 'cash'), 0)                 AS especes,
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.payment_method IS DISTINCT FROM 'cash'), 0)  AS san_especes,
    min(b.d) AS period_from,
    max(b.d) AS period_to
  FROM base b, p
)
SELECT jsonb_build_object(
  'ok', true,
  'period', jsonb_build_object(
    'from', (SELECT to_char(period_from, 'YYYY-MM-DD') FROM agg),
    'to',   (SELECT to_char(period_to,   'YYYY-MM-DD') FROM agg)
  ),
  'totals', (SELECT jsonb_build_object(
    'orders',         orders,
    'completed',      completed,
    'cancelled',      cancelled,
    'inFlight',       inflight,
    'completionRate', CASE WHEN (completed + cancelled) > 0
                        THEN round(completed::numeric / (completed + cancelled) * 100)::int ELSE 0 END,
    'avgOrderValue',  CASE WHEN completed > 0
                        THEN round(rev_total / completed)::bigint ELSE 0 END,
    'commissionRate', p_commission
  ) FROM agg),
  'revenue', (SELECT jsonb_build_object(
    'today',        round(rev_today)::bigint,
    'week',         round(rev_week)::bigint,
    'month',        round(rev_month)::bigint,
    'total',        round(rev_total)::bigint,
    'prevWeek',     round(rev_prevweek)::bigint,
    'trendWeekPct', CASE WHEN rev_prevweek > 0
                      THEN round((rev_week - rev_prevweek) / rev_prevweek * 100)::int ELSE NULL END,
    'especes',      round(especes)::bigint,
    'sanEspeces',   round(san_especes)::bigint
  ) FROM agg),
  'commission', (SELECT jsonb_build_object(
    'today', round(rev_today    * p_commission)::bigint,
    'week',  round(rev_week     * p_commission)::bigint,
    'month', round(rev_month    * p_commission)::bigint,
    'total', round(rev_total    * p_commission)::bigint
  ) FROM agg),
  'charts', jsonb_build_object(
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'date',    to_char(d, 'YYYY-MM-DD'),
        'label',   (extract(day FROM d))::int::text || '/' || (extract(month FROM d))::int::text,
        'revenus', round(revenus)::bigint,
        'comm',    round(revenus * p_commission)::bigint,
        'courses', courses
      ) ORDER BY d), '[]'::jsonb) FROM daily),
    'hourly', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'label', hr::text || 'h',
        'value', value
      ) ORDER BY hr), '[]'::jsonb) FROM hourly),
    'payments', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'name',  name,
        'value', value
      ) ORDER BY value DESC), '[]'::jsonb) FROM payments),
    'completion', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'label', (extract(day FROM d))::int::text || '/' || (extract(month FROM d))::int::text,
        'taux',  CASE WHEN total_all > 0 THEN round(courses::numeric / total_all * 100)::int ELSE 0 END
      ) ORDER BY d), '[]'::jsonb) FROM daily)
  ),
  'topDrivers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name',       name,
      'courses',    courses,
      'revenue',    round(revenue)::bigint,
      'commission', round(revenue * p_commission)::bigint
    ) ORDER BY revenue DESC NULLS LAST), '[]'::jsonb) FROM drivers),
  'topVehicles', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', CASE
                WHEN callsign IS NOT NULL AND model IS NOT NULL THEN callsign || ' · ' || model
                WHEN callsign IS NOT NULL THEN callsign
                WHEN model    IS NOT NULL THEN model
                ELSE 'Inconnu'
              END,
      'courses', courses,
      'revenue', round(revenue)::bigint
    ) ORDER BY revenue DESC NULLS LAST), '[]'::jsonb) FROM vehicles)
);
$$;

-- La route appelle avec la cle anon ; commandes_yango n'a pas de RLS.
GRANT EXECUTE ON FUNCTION public.boyah_dashboard_stats(numeric) TO anon, authenticated, service_role;

COMMIT;
