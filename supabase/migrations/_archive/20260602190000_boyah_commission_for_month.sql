-- ============================================================
-- COMMISSION Yango GENEREE pour un MOIS ARBITRAIRE
-- 02/06/2026
-- ============================================================
-- BLOC 3 de la marge consolidee : la commission Yango (2,5% du CA des courses
-- COMPLETEES du mois calendaire) est un revenu GENERE par Boyah Transport. Le
-- helper lib/finance/getMargeConsolidee(mois) en a besoin pour un mois
-- QUELCONQUE (mois courant ET passe -- decalage de paiement M+1 : on traite
-- couramment mai ET avril). Or boyah_dashboard_stats ne donne QUE le mois
-- courant (month) et le mois precedent (prevMonth) -> insuffisant.
--
-- Cette fonction est parametrable par mois. Elle reutilise EXACTEMENT la meme
-- regle d'agregation que rev_prevmonth de boyah_dashboard_stats
-- (migration 20260602180000) -> zero divergence avec le dashboard Yango :
--   - jour de la course = (timezone('UTC', created_at))::date  (fuseau Abidjan = UTC+0)
--   - course retenue     = status = 'complete'
--   - prix de la course  = NULLIF(raw->>'price', '')::numeric
--   - fenetre            = [p_mois, p_mois + 1 mois[  (calendaire, borne sup. exclue)
--
-- Mois COURANT : la borne sup. (p_mois + 1 mois) est dans le futur, mais aucune
-- course n'y existe encore -> resultat PARTIEL (1er -> aujourd'hui), coherent
-- avec la marge Wave/charges elle aussi partielle. Mois PASSE : resultat COMPLET.
--
-- Retourne { mois, ca_courses, commission } (on expose aussi le CA pour pouvoir
-- l'afficher / l'auditer cote helper).
--
-- p_commission par defaut 0.025 : c'est un simple FALLBACK. Le helper passe
-- TOUJOURS le taux resolu depuis l'env YANGO_COMMISSION_RATE (source unique).
--
-- CREATE OR REPLACE : idempotent, lecture seule, sans effet de bord, reversible
-- (DROP FUNCTION public.boyah_commission_for_month(date, numeric)).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.boyah_commission_for_month(
  p_mois       date,
  p_commission numeric DEFAULT 0.025
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH agg AS (
    SELECT
      coalesce(
        sum(NULLIF(raw->>'price', '')::numeric)
          FILTER (WHERE status = 'complete'),
        0
      ) AS ca_courses
    FROM public.commandes_yango
    WHERE (timezone('UTC', created_at))::date >= p_mois
      AND (timezone('UTC', created_at))::date <  (p_mois + interval '1 month')::date
  )
  SELECT jsonb_build_object(
    'mois',       to_char(p_mois, 'YYYY-MM'),
    'ca_courses', round(ca_courses)::bigint,
    'commission', round(ca_courses * p_commission)::bigint
  )
  FROM agg;
$$;

-- Le helper appelle via supabaseAdmin (service_role) ; les routes Cockpit aussi.
-- commandes_yango n'a pas de RLS.
GRANT EXECUTE ON FUNCTION public.boyah_commission_for_month(date, numeric)
  TO anon, authenticated, service_role;

COMMIT;
