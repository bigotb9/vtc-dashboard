-- =============================================================================
-- BASELINE UNIQUE — schema complet de la prod Fleet (iixpsfsqyfnllggvsvfl)
-- Genere le 12/06/2026 :
--   * corps public  : `supabase db dump --linked`        (pg_dump natif, fidele)
--   * roles custom  : `supabase db dump --linked --role-only`
--   * storage       : complements manuels collectes en LECTURE SEULE via MCP
-- Source UNIQUE de migrations DB (remplace 00000000000000_legacy_baseline.sql,
-- a archiver en etape 3). Couvre TOUT : flotte, compta SYSCOHADA, app_* (ex-repo
-- mobile), agent/bot, RLS du 12/06 (helpers is_dashboard_user/_directeur,
-- 105 policies, 53 ENABLE RLS, 37 vues security_invoker), roles boyahbot_*,
-- 8 buckets storage + 28 policies.
--
-- EXCLUS (geres par la plateforme Supabase, presents sur tout projet vierge) :
--   extensions `pg_stat_statements` + `supabase_vault` ; schemas auth / storage(*)
--   / vault / realtime / graphql / supabase_migrations / extensions.
--   (*) sauf NOS buckets + policies storage, reinjectes en pied de fichier.
--   Les references auth.uid()/auth.jwt() dans policies/fonctions sont CONSERVEES
--   (l'extension auth existe en prod).
--
-- FIDELITE STRICTE : tout defaut prod est reproduit ET consigne en DETTE P2,
--   jamais corrige en silence (sinon la verif de fidelite ne distinguerait plus
--   une erreur d'un nettoyage voulu). Cf. notes "DETTE P2" ci-dessous.
--
-- ORDRE : roles custom -> corps (dump public) -> storage.
-- =============================================================================

-- =============================================================================
-- ROLES CUSTOM (hors pg_dump base — objets globaux du cluster)
-- Repris fidelement de `supabase db dump --role-only` (etat prod 12/06/2026).
-- Places AVANT le corps car le corps fait GRANT ... TO boyahbot_* et
-- CREATE POLICY ... TO boyahbot_*.
--
-- DETTE P2 (fidelite voulue — NE PAS corriger ici) :
--   - boyahbot_reader/writer ont LOGIN sans mot de passe (non dumpable) ->
--     PROVISIONING : definir un mot de passe par tenant APRES baseline.
--   - boyahbot_reader herite de anon,authenticated (membership large, probablement
--     non intentionnel) -> a examiner au durcissement P2.
-- =============================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'boyahbot_reader') then
    create role "boyahbot_reader";
  end if;
  if not exists (select 1 from pg_roles where rolname = 'boyahbot_writer') then
    create role "boyahbot_writer";
  end if;
end $$;
alter role "boyahbot_reader" with inherit nocreaterole nocreatedb login nobypassrls;
alter role "boyahbot_writer" with inherit nocreaterole nocreatedb login nobypassrls;
alter role "boyahbot_reader" set "search_path" to 'public';
grant "anon"          to "boyahbot_reader";
grant "authenticated" to "boyahbot_reader";

-- Reglages sur roles PLATEFORME (existent deja sur un projet vierge ; idempotent).
-- Inclus pour fidelite de la config prod. NE cree PAS ces roles (geres Supabase).
alter role "anon"          set "statement_timeout" to '3s';
alter role "authenticated" set "statement_timeout" to '8s';
alter role "authenticator" set "statement_timeout" to '8s';




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';









CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";












CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean DEFAULT false) RETURNS TABLE("ecriture_id" "uuid", "resultat_net" bigint, "type_montant" "text", "numero" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_statut          TEXT;
  v_date_fin        DATE;
  v_resultat_net    BIGINT;
  v_resultat_abs    BIGINT;
  v_ecriture_id     UUID;
  v_numero          TEXT;
  v_type_montant    TEXT;
  v_total_produits  BIGINT;
  v_total_charges   BIGINT;
  v_total_hao_pr    BIGINT;
  v_total_hao_ch    BIGINT;
  v_total_impots    BIGINT;
BEGIN
  -- 1. Charger statut + date_fin
  SELECT statut, date_fin INTO v_statut, v_date_fin
    FROM public.exercices
   WHERE id = p_exercice_id;

  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Exercice introuvable : %', p_exercice_id;
  END IF;

  IF v_statut = 'clos' AND NOT p_force_recalcul THEN
    RAISE EXCEPTION 'Exercice clos : recalcul interdit (passer p_force_recalcul := TRUE)';
  END IF;

  -- 2. Activer le bypass de trigger si force_recalcul (exercice clos)
  IF p_force_recalcul THEN
    PERFORM set_config('compta.auto_recalcul_allowed', 'true', true);
  END IF;

  -- 3. Calcul résultat net via lignes_ecritures des opérations validées
  --    Formule : Σ produits (7x sauf 84) − Σ charges (6x sauf 83/87/89)
  --            + Σ HAO produits (84) − Σ HAO charges (83) − Σ impôts (87 + 89)
  SELECT
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '7%'
        AND compte_syscohada_code NOT LIKE '84%'
      THEN credit - debit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '6%'
        AND compte_syscohada_code NOT LIKE '83%'
        AND compte_syscohada_code NOT LIKE '87%'
        AND compte_syscohada_code NOT LIKE '89%'
      THEN debit - credit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '84%'
      THEN credit - debit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '83%'
      THEN debit - credit ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN compte_syscohada_code LIKE '87%'
        OR compte_syscohada_code LIKE '89%'
      THEN debit - credit ELSE 0 END), 0)
  INTO v_total_produits, v_total_charges, v_total_hao_pr, v_total_hao_ch, v_total_impots
  FROM public.lignes_ecritures le
  JOIN public.ecritures_comptables ec ON ec.id = le.ecriture_id
  WHERE ec.exercice_id = p_exercice_id
    AND ec.statut = 'valide'
    AND ec.auto_generated = FALSE;   -- ✦ exclure l'éventuelle ancienne auto-écriture

  v_resultat_net := v_total_produits - v_total_charges + v_total_hao_pr - v_total_hao_ch - v_total_impots;

  IF v_resultat_net = 0 THEN
    v_type_montant := 'nul';
  ELSIF v_resultat_net > 0 THEN
    v_type_montant := 'benefice';
  ELSE
    v_type_montant := 'perte';
  END IF;

  -- 4. Supprimer ancienne auto-écriture (cascade sur lignes_ecritures)
  DELETE FROM public.ecritures_comptables
    WHERE exercice_id = p_exercice_id
      AND auto_generated = TRUE
      AND auto_generation_type = 'resultat_exercice';

  -- 5. Si résultat = 0, on s'arrête là — pas d'écriture à créer
  IF v_resultat_net = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0::BIGINT, 'nul'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  v_resultat_abs := ABS(v_resultat_net);

  -- 6. Créer la nouvelle écriture (journal OD, date = date_fin exercice)
  v_numero := 'AUTO-RES-' || to_char(v_date_fin, 'YYYY') || '-' || substring(p_exercice_id::text, 1, 8);

  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle,
    exercice_id, statut, source_manuelle,
    auto_generated, auto_generation_type
  ) VALUES (
    v_numero, v_date_fin, 'OD', 'Ajustement automatique résultat exercice — ' || v_type_montant,
    p_exercice_id, 'valide', FALSE,
    TRUE, 'resultat_exercice'
  )
  RETURNING id INTO v_ecriture_id;

  -- 7. Lignes — partie double
  IF v_type_montant = 'benefice' THEN
    -- DEBIT 891 / CREDIT 130
    INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
    VALUES
      (v_ecriture_id, 1, '891', 'Détermination du résultat (bénéfice)', v_resultat_abs, 0),
      (v_ecriture_id, 2, '130', 'Résultat net de l''exercice : Bénéfice', 0, v_resultat_abs);
  ELSE
    -- v_type_montant = 'perte' : DEBIT 139 / CREDIT 891
    INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
    VALUES
      (v_ecriture_id, 1, '139', 'Résultat net de l''exercice : Perte',  v_resultat_abs, 0),
      (v_ecriture_id, 2, '891', 'Détermination du résultat (perte)',   0, v_resultat_abs);
  END IF;

  -- 8. Désactiver le bypass (LOCAL : auto-revert en fin de transaction)
  IF p_force_recalcul THEN
    PERFORM set_config('compta.auto_recalcul_allowed', 'false', true);
  END IF;

  RETURN QUERY SELECT v_ecriture_id, v_resultat_net, v_type_montant, v_numero;
END;
$$;


ALTER FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean) IS 'PHASE 4.3 — (Re)crée l''écriture automatique d''ajustement du résultat (compte 13). À appeler AVANT chaque export Bilan si exercice ouvert, et une dernière fois à la clôture.';



CREATE OR REPLACE FUNCTION "public"."app_chauffeur_home"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_id          integer;
  v_nom         text;
  v_photo       text;
  v_model       text;
  v_plate       text;
  v_forfait     numeric;
  v_has_vehicle boolean;
  v_fin_today   boolean;
  v_msg_body    text;
  v_msg_at      timestamptz;
  v_has_msg     boolean;
begin
  v_id := nullif(auth.jwt() ->> 'id_chauffeur', '')::int;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_driver');
  end if;

  -- Identity (read-only from Fleet) — keeps the Accueil banner self-sufficient.
  select c.nom, c.photo into v_nom, v_photo
  from public.chauffeurs c
  where c.id_chauffeur = v_id;

  -- Currently assigned vehicle: active affectation = date_fin IS NULL.
  select v.type_vehicule, v.immatriculation, v.montant_recette_jour
    into v_model, v_plate, v_forfait
  from public.affectation_chauffeurs_vehicules a
  join public.vehicules v on v.id_vehicule = a.id_vehicule
  where a.id_chauffeur = v_id
    and a.date_fin is null
  order by a.date_debut desc nulls last
  limit 1;
  v_has_vehicle := found;

  -- Has the driver filled their personal finance sheet today? (Phase 4 screen.)
  select exists(
    select 1 from public.app_chauffeur_finances f
    where f.id_chauffeur = v_id and f.date = current_date
  ) into v_fin_today;

  -- Latest active, non-expired patron broadcast.
  select m.body, m.created_at into v_msg_body, v_msg_at
  from public.app_messages_patron m
  where m.is_active = true
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at desc
  limit 1;
  v_has_msg := found;

  return jsonb_build_object(
    'ok',           true,
    'id_chauffeur', v_id,
    'nom',          v_nom,
    'photo',        v_photo,
    'vehicle',      case when not v_has_vehicle then null
                         else jsonb_build_object(
                           'model',        v_model,
                           'plate',        v_plate,
                           'forfait_jour', v_forfait
                         ) end,
    'finances_filled_today', coalesce(v_fin_today, false),
    'patron_message', case when not v_has_msg then null
                           else jsonb_build_object(
                             'body',       v_msg_body,
                             'created_at', v_msg_at
                           ) end
  );
end;
$$;


ALTER FUNCTION "public"."app_chauffeur_home"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_chauffeur_login"("p_phone" "text", "p_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
declare
  v_last8 text;
  v_ch    record;
  v_auth  public.app_chauffeur_auth;
  v_now   timestamptz := now();
begin
  v_last8 := public.app_phone_last8(p_phone);
  if length(v_last8) < 8 then
    return jsonb_build_object('success', false, 'reason', 'invalid_phone');
  end if;
  if p_pin is null or p_pin !~ '^\d{4}$' then
    return jsonb_build_object('success', false, 'reason', 'invalid_pin');
  end if;

  select c.id_chauffeur, c.nom, c.photo
    into v_ch
  from public.chauffeurs c
  where coalesce(c.actif, false) = true
    and (
      public.app_phone_last8(c.numero_wave)   = v_last8 or
      public.app_phone_last8(c.numero_wave_2) = v_last8 or
      public.app_phone_last8(c.numero_wave_3) = v_last8
    )
  order by c.id_chauffeur
  limit 1;

  if v_ch.id_chauffeur is null then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  insert into public.app_chauffeur_auth (id_chauffeur, pin_hash, pin_must_change)
  values (v_ch.id_chauffeur, crypt('0000', gen_salt('bf')), true)
  on conflict (id_chauffeur) do nothing;

  -- Row lock so concurrent attempts for the same driver serialize.
  select * into v_auth
  from public.app_chauffeur_auth
  where id_chauffeur = v_ch.id_chauffeur
  for update;

  -- Already locked?
  if v_auth.locked_until is not null and v_auth.locked_until > v_now then
    return jsonb_build_object(
      'success',      false,
      'reason',       case when v_auth.lock_level >= 3 then 'support_required' else 'locked' end,
      'locked_until', v_auth.locked_until,
      'lock_level',   v_auth.lock_level
    );
  end if;

  -- Expired lock -> fresh batch of attempts, keep lock_level for escalation.
  if v_auth.locked_until is not null and v_auth.locked_until <= v_now then
    v_auth.failed_attempts := 0;
    v_auth.locked_until    := null;
  end if;

  -- Correct PIN.
  if v_auth.pin_hash = crypt(p_pin, v_auth.pin_hash) then
    update public.app_chauffeur_auth
       set failed_attempts = 0,
           lock_level      = 0,
           locked_until    = null,
           last_login_at   = v_now
     where id_chauffeur = v_ch.id_chauffeur;

    return jsonb_build_object(
      'success',           true,
      'id_chauffeur',      v_ch.id_chauffeur,
      'nom',               v_ch.nom,
      'photo',             v_ch.photo,
      'pin_must_change',   v_auth.pin_must_change,
      'biometric_enabled', v_auth.biometric_enabled
    );
  end if;

  -- Wrong PIN -> count + maybe escalate lock.
  v_auth.failed_attempts := v_auth.failed_attempts + 1;

  if v_auth.failed_attempts >= 5 then
    if v_auth.lock_level = 0 then
      update public.app_chauffeur_auth
         set failed_attempts = 0, lock_level = 1,
             locked_until = v_now + interval '15 minutes'
       where id_chauffeur = v_ch.id_chauffeur;
      return jsonb_build_object('success', false, 'reason', 'locked',
        'locked_until', v_now + interval '15 minutes', 'lock_level', 1);

    elsif v_auth.lock_level = 1 then
      update public.app_chauffeur_auth
         set failed_attempts = 0, lock_level = 2,
             locked_until = v_now + interval '1 hour'
       where id_chauffeur = v_ch.id_chauffeur;
      return jsonb_build_object('success', false, 'reason', 'locked',
        'locked_until', v_now + interval '1 hour', 'lock_level', 2);

    else
      -- Definitive lock: only the support team can reset failed_attempts /
      -- locked_until from Fleet. 100 years ~ "blocked until support".
      update public.app_chauffeur_auth
         set failed_attempts = 0, lock_level = 3,
             locked_until = v_now + interval '100 years'
       where id_chauffeur = v_ch.id_chauffeur;
      return jsonb_build_object('success', false, 'reason', 'support_required',
        'locked_until', v_now + interval '100 years', 'lock_level', 3);
    end if;
  end if;

  update public.app_chauffeur_auth
     set failed_attempts = v_auth.failed_attempts
   where id_chauffeur = v_ch.id_chauffeur;

  return jsonb_build_object(
    'success',       false,
    'reason',        'wrong_pin',
    'attempts_left', 5 - v_auth.failed_attempts
  );
end;
$_$;


ALTER FUNCTION "public"."app_chauffeur_login"("p_phone" "text", "p_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_chauffeur_set_pin"("p_id_chauffeur" integer, "p_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
begin
  if p_pin is null or p_pin !~ '^\d{4}$' then
    return jsonb_build_object('success', false, 'reason', 'invalid_pin');
  end if;
  if p_pin = '0000' then
    return jsonb_build_object('success', false, 'reason', 'pin_too_weak');
  end if;

  update public.app_chauffeur_auth
     set pin_hash        = crypt(p_pin, gen_salt('bf')),
         pin_must_change = false,
         failed_attempts = 0,
         lock_level      = 0,
         locked_until    = null
   where id_chauffeur = p_id_chauffeur;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('success', true, 'pin_must_change', false);
end;
$_$;


ALTER FUNCTION "public"."app_chauffeur_set_pin"("p_id_chauffeur" integer, "p_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_chauffeur_verify_phone"("p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_last8 text;
  v_ch    record;
  v_auth  public.app_chauffeur_auth;
begin
  v_last8 := public.app_phone_last8(p_phone);
  if length(v_last8) < 8 then
    return jsonb_build_object('found', false, 'reason', 'invalid_phone');
  end if;

  select c.id_chauffeur, c.nom, c.photo
    into v_ch
  from public.chauffeurs c
  where coalesce(c.actif, false) = true
    and (
      public.app_phone_last8(c.numero_wave)   = v_last8 or
      public.app_phone_last8(c.numero_wave_2) = v_last8 or
      public.app_phone_last8(c.numero_wave_3) = v_last8
    )
  order by c.id_chauffeur
  limit 1;

  if v_ch.id_chauffeur is null then
    return jsonb_build_object('found', false, 'reason', 'not_found');
  end if;

  -- Lazy provisioning: default PIN 0000 on first contact.
  insert into public.app_chauffeur_auth (id_chauffeur, pin_hash, pin_must_change)
  values (v_ch.id_chauffeur, crypt('0000', gen_salt('bf')), true)
  on conflict (id_chauffeur) do nothing;

  select * into v_auth
  from public.app_chauffeur_auth
  where id_chauffeur = v_ch.id_chauffeur;

  return jsonb_build_object(
    'found',             true,
    'id_chauffeur',      v_ch.id_chauffeur,
    'nom',               v_ch.nom,
    'photo',             v_ch.photo,
    'pin_must_change',   v_auth.pin_must_change,
    'biometric_enabled', v_auth.biometric_enabled,
    'is_first_login',    (v_auth.last_login_at is null),
    'locked_until',      v_auth.locked_until
  );
end;
$$;


ALTER FUNCTION "public"."app_chauffeur_verify_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_chauffeur_versements"("p_limit" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_id   integer;
  v_w1   text;
  v_w2   text;
  v_w3   text;
  v_lim  integer;
  v_rows jsonb;
begin
  v_id := nullif(auth.jwt() ->> 'id_chauffeur', '')::int;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_driver');
  end if;

  v_lim := least(greatest(coalesce(p_limit, 10), 1), 50);

  select public.app_phone_last8(c.numero_wave),
         public.app_phone_last8(c.numero_wave_2),
         public.app_phone_last8(c.numero_wave_3)
    into v_w1, v_w2, v_w3
  from public.chauffeurs c
  where c.id_chauffeur = v_id;

  -- No registered Wave number → nothing to match.
  if coalesce(v_w1,'') = '' and coalesce(v_w2,'') = '' and coalesce(v_w3,'') = '' then
    return jsonb_build_object('ok', true, 'versements', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.paid_at desc), '[]'::jsonb)
    into v_rows
  from (
    select
      rw.id                            as source_id,
      rw."Identifiant de transaction"  as transaction_id,
      rw."Horodatage"                  as paid_at,
      round(rw."Montant net")::bigint  as amount
    from public.recettes_wave rw
    where rw."Montant net" is not null
      and rw."Montant net" > 0
      and (
        (v_w1 <> '' and public.app_phone_last8(rw."Numéro de téléphone de contrepartie") = v_w1) or
        (v_w2 <> '' and public.app_phone_last8(rw."Numéro de téléphone de contrepartie") = v_w2) or
        (v_w3 <> '' and public.app_phone_last8(rw."Numéro de téléphone de contrepartie") = v_w3)
      )
    order by rw."Horodatage" desc
    limit v_lim
  ) t;

  return jsonb_build_object('ok', true, 'versements', v_rows);
end;
$$;


ALTER FUNCTION "public"."app_chauffeur_versements"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_phone_last8"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 8);
$$;


ALTER FUNCTION "public"."app_phone_last8"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."app_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."boyah_commission_for_month"("p_mois" "date", "p_commission" numeric DEFAULT 0.025) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
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


ALTER FUNCTION "public"."boyah_commission_for_month"("p_mois" "date", "p_commission" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."boyah_dashboard_stats"("p_commission" numeric DEFAULT 0.025) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
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
    date_trunc('month', timezone('UTC', now()))::date    AS month_start,
    (date_trunc('month', timezone('UTC', now())) - interval '1 month')::date AS month_prev_start
),
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
    -- CALENDAIRE : mois en cours (1er -> aujourd'hui inclus) -- PARTIEL en debut de mois
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.d >= p.month_start), 0)                       AS rev_month,
    -- CALENDAIRE : mois precedent COMPLET (1er mois-1 -> dernier jour mois-1)
    coalesce(sum(b.price) FILTER (WHERE b.is_complete AND b.d >= p.month_prev_start AND b.d < p.month_start), 0) AS rev_prevmonth,
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
    'today',         round(rev_today)::bigint,
    'week',          round(rev_week)::bigint,
    'month',         round(rev_month)::bigint,
    'total',         round(rev_total)::bigint,
    'prevWeek',      round(rev_prevweek)::bigint,
    'trendWeekPct',  CASE WHEN rev_prevweek > 0
                       THEN round((rev_week - rev_prevweek) / rev_prevweek * 100)::int ELSE NULL END,
    'prevMonth',     round(rev_prevmonth)::bigint,
    'trendMonthPct', CASE WHEN rev_prevmonth > 0
                       THEN round((rev_month - rev_prevmonth) / rev_prevmonth * 100)::int ELSE NULL END,
    'especes',       round(especes)::bigint,
    'sanEspeces',    round(san_especes)::bigint
  ) FROM agg),
  'commission', (SELECT jsonb_build_object(
    'today',     round(rev_today     * p_commission)::bigint,
    'week',      round(rev_week      * p_commission)::bigint,
    'month',     round(rev_month     * p_commission)::bigint,
    'total',     round(rev_total     * p_commission)::bigint,
    'prevMonth', round(rev_prevmonth * p_commission)::bigint
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


ALTER FUNCTION "public"."boyah_dashboard_stats"("p_commission" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."boyah_driver_stats"("p_commission" numeric DEFAULT 0.025) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
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


ALTER FUNCTION "public"."boyah_driver_stats"("p_commission" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_operation_to_versement_client"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_mois        TEXT;
  v_id_int      INTEGER;
BEGIN
  -- Skip si pas une operation de type versement client
  IF NEW.source IS DISTINCT FROM 'versement_client' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type IS DISTINCT FROM 'sortie' THEN RETURN NEW; END IF;
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN RETURN NEW; END IF;

  -- Anti-recursion : si source_ref pointe vers un versement existant, skip
  -- (cas typique : Flux A vient de creer cette op apres avoir cree le versement)
  IF NEW.source_ref IS NOT NULL THEN
    BEGIN
      v_id_int := NEW.source_ref::INTEGER;
      IF EXISTS (SELECT 1 FROM public.versements_clients WHERE id = v_id_int) THEN
        RETURN NEW;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- source_ref non parsable en integer : c'est une insertion manuelle
      -- avec une ref textuelle, on continue avec le rattrapage
      NULL;
    END;
  END IF;

  -- Extraction du mois depuis le libelle (format conventionnel
  -- 'Reversement client (mois YYYY-MM)') ou fallback sur date_operation
  v_mois := SUBSTRING(NEW.libelle FROM 'mois (\d{4}-\d{2})');
  IF v_mois IS NULL OR LENGTH(v_mois) <> 7 THEN
    v_mois := to_char(NEW.date_operation, 'YYYY-MM');
  END IF;

  -- Skip si un versement existe deja pour ce client + mois (autre garde)
  IF EXISTS (
    SELECT 1 FROM public.versements_clients
     WHERE id_client = NEW.client_id::INTEGER
       AND mois = v_mois
  ) THEN
    RETURN NEW;
  END IF;

  -- Creation du versement de rattrapage
  INSERT INTO public.versements_clients (
    id_client, mois, montant, date_versement, notes,
    caisse_id, compte_id
  ) VALUES (
    NEW.client_id::INTEGER,
    v_mois,
    NEW.montant,
    NEW.date_operation,
    'Rattrapage auto - cree depuis operation #' || NEW.id::text,
    NEW.caisse_id,
    NEW.compte_id
  )
  ON CONFLICT (id_client, mois) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_operation_to_versement_client"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cascade_operation_to_versement_client"() IS 'Flux B (24/05/2026) : AFTER INSERT operations(source=versement_client) -> versement_clients, anti-recursion via NOT EXISTS sur id integer ET sur (id_client, mois).';



CREATE OR REPLACE FUNCTION "public"."cascade_recette_wave_to_operation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caisse_wave_id    UUID;
  v_categorie_id      UUID;
  v_exercice_id       UUID;
  v_date              DATE;
  v_id_tx             TEXT;
  v_montant_net       NUMERIC;
  v_montant_abs       NUMERIC;
  v_type_op           TEXT;
  v_libelle           TEXT;
  v_contrepartie      TEXT;
  v_op_id             UUID;   -- Lot G : id de l'op creee (NULL si ON CONFLICT)
BEGIN
  v_id_tx := NULLIF(TRIM(COALESCE(NEW."Identifiant de transaction", '')), '');
  IF v_id_tx IS NULL THEN RETURN NEW; END IF;

  -- ANTI-RECURSION 26/05/2026 (Lot B audit) :
  -- Si l'ID commence par 'op_', c'est une ligne sync depuis operations
  -- via trg_sync_operation_to_legacy. On NE doit PAS recreer une operation
  -- (sinon boucle infinie + doublon CA).
  IF v_id_tx LIKE 'op\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  v_montant_net := NEW."Montant net";
  IF v_montant_net IS NULL OR v_montant_net = 0 THEN RETURN NEW; END IF;

  IF v_montant_net > 0 THEN
    v_type_op := 'entree';
    v_montant_abs := v_montant_net;
  ELSE
    v_type_op := 'sortie';
    v_montant_abs := ABS(v_montant_net);
  END IF;

  BEGIN
    v_date := NEW."Horodatage"::DATE;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_date IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_caisse_wave_id FROM public.caisses
   WHERE libelle = 'Wave Boyah' LIMIT 1;
  IF v_caisse_wave_id IS NULL THEN RETURN NEW; END IF;

  IF v_type_op = 'entree' THEN
    SELECT id INTO v_categorie_id FROM public.categories_operations
     WHERE libelle = 'Versement quotidien chauffeur' LIMIT 1;
  ELSE
    SELECT id INTO v_categorie_id FROM public.categories_operations
     WHERE libelle = 'Sortie Wave - à reclasser' LIMIT 1;
  END IF;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= v_date AND date_fin >= v_date AND statut = 'ouvert' LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

  v_contrepartie := NULLIF(TRIM(COALESCE(NEW."Nom de contrepartie", '')), '');
  IF v_type_op = 'entree' THEN
    v_libelle := 'Recette Wave - ' || COALESCE(v_contrepartie, 'contrepartie inconnue');
  ELSE
    v_libelle := 'Sortie Wave - ' || COALESCE(v_contrepartie, 'Payout');
  END IF;
  IF LENGTH(v_libelle) > 255 THEN
    v_libelle := SUBSTRING(v_libelle FROM 1 FOR 255);
  END IF;

  INSERT INTO public.operations (
    caisse_id, compte_id, date_operation, type, montant, libelle,
    reference_externe, categorie_id, vehicule_id, chauffeur_id, client_id,
    source, source_ref, statut, valide_le, valide_par, exercice_id,
    created_by, updated_by
  ) VALUES (
    v_caisse_wave_id, NULL, v_date, v_type_op, v_montant_abs, v_libelle,
    v_id_tx, v_categorie_id, NULL, NULL, NULL,
    'recette_wave', v_id_tx, 'valide', NOW(), NULL, v_exercice_id,
    NULL, NULL
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_op_id;

  -- Lot G : generation auto de l'ecriture comptable
  -- v_op_id est NULL si ON CONFLICT a matche (anti-recursion sur les UPDATE
  -- de recettes_wave). On ne genere donc que pour les nouveaux INSERT.
  IF v_op_id IS NOT NULL THEN
    BEGIN
      PERFORM public.generer_ecriture_pour_operation(v_op_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cascade_recette_wave] ecriture op=%: % (SQLSTATE=%)',
        v_op_id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_recette_wave_to_operation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cascade_recette_wave_to_operation"() IS 'Trigger AFTER INSERT/UPDATE sur recettes_wave (v3 - 26/05/2026, Lot G audit) : cree l''operation comptable ET son ecriture double-partie de facon idempotente. Gere 3 cas (Montant>0 entree, Montant<0 sortie via cat 471, Montant=0 skip). Anti-recursion via RETURNING id apres ON CONFLICT DO NOTHING.';



CREATE OR REPLACE FUNCTION "public"."cascade_versement_client_to_operation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caisse_id      UUID;
  v_compte_id      UUID;
  v_categorie_id   UUID;
  v_exercice_id    UUID;
  v_libelle        TEXT;
  v_op_id          UUID;
  v_old_ecr        UUID;
  v_exo_statut     TEXT;
  v_new_ecr        UUID;
BEGIN
  IF NEW.date_versement IS NULL THEN RETURN NEW; END IF;

  -- ── Branche UPDATE : ajuster l'operation cascade existante ─────────────
  IF TG_OP = 'UPDATE' THEN
    -- Montant inchange (upsert qui reecrit la meme valeur) -> no-op
    IF NEW.montant IS NOT DISTINCT FROM OLD.montant THEN
      RETURN NEW;
    END IF;

    SELECT o.id, o.ecriture_id INTO v_op_id, v_old_ecr
      FROM public.operations o
     WHERE o.source = 'versement_client'
       AND o.source_ref = NEW.id::text
     LIMIT 1;

    IF v_op_id IS NOT NULL THEN
      -- Nouveau montant invalide -> on ne touche pas l'op (CHECK montant>0)
      IF NEW.montant IS NULL OR NEW.montant <= 0 THEN
        RAISE WARNING '[cascade_versement v3] versement % : montant % invalide, operation % NON ajustee',
          NEW.id, NEW.montant, v_op_id;
        RETURN NEW;
      END IF;

      -- Exercice clos -> ne pas corrompre, avertir
      SELECT e.statut INTO v_exo_statut
        FROM public.operations o
        JOIN public.exercices e ON e.id = o.exercice_id
       WHERE o.id = v_op_id;
      IF v_exo_statut IS DISTINCT FROM 'ouvert' THEN
        RAISE WARNING '[cascade_versement v3] versement % : exercice de l''operation % non ouvert (%), montant NON ajuste',
          NEW.id, v_op_id, v_exo_statut;
        RETURN NEW;
      END IF;

      -- Ajustement du montant (hausse comme baisse : cumul du mois)
      UPDATE public.operations
         SET montant = NEW.montant, updated_at = NOW()
       WHERE id = v_op_id;

      -- Regeneration de l'ecriture : le helper Lot G est idempotent sur
      -- ecriture_id, il faut donc detacher puis supprimer l'ancienne
      -- (les lignes suivent par FK ON DELETE CASCADE).
      IF v_old_ecr IS NOT NULL THEN
        UPDATE public.operations SET ecriture_id = NULL WHERE id = v_op_id;
        DELETE FROM public.ecritures_comptables WHERE id = v_old_ecr;
      END IF;
      BEGIN
        v_new_ecr := public.generer_ecriture_pour_operation(v_op_id);
        IF v_new_ecr IS NULL THEN
          RAISE WARNING '[cascade_versement v3] regeneration ecriture op % : helper a retourne NULL (op valide sans ecriture, relancer regenerer-ecritures)',
            v_op_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[cascade_versement v3] regeneration ecriture op % : % (SQLSTATE=%)',
          v_op_id, SQLERRM, SQLSTATE;
      END;

      RETURN NEW;
    END IF;
    -- Pas d'operation cascade existante (cas theorique : versement cree
    -- avant la mise en place de la cascade) -> flux creation ci-dessous.
  END IF;

  -- ── Flux creation (INSERT, ou UPDATE sans op existante) — v2 inchange ──
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN RETURN NEW; END IF;

  -- Anti-recursion (preservee)
  IF EXISTS (
    SELECT 1 FROM public.operations
     WHERE source = 'versement_client'
       AND source_ref = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  v_caisse_id := NEW.caisse_id;
  v_compte_id := NEW.compte_id;
  IF v_caisse_id IS NULL AND v_compte_id IS NULL THEN
    SELECT id INTO v_caisse_id FROM public.caisses
     WHERE libelle = 'Wave Boyah' LIMIT 1;
    IF v_caisse_id IS NULL THEN RETURN NEW; END IF;
  END IF;

  SELECT id INTO v_categorie_id FROM public.categories_operations
   WHERE libelle = 'Reversement client sous gestion' LIMIT 1;
  IF v_categorie_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_exercice_id FROM public.exercices
   WHERE date_debut <= NEW.date_versement
     AND date_fin   >= NEW.date_versement
     AND statut     = 'ouvert'
   LIMIT 1;
  IF v_exercice_id IS NULL THEN RETURN NEW; END IF;

  v_libelle := 'Reversement client (mois ' || COALESCE(NEW.mois, to_char(NEW.date_versement, 'YYYY-MM')) || ')';

  INSERT INTO public.operations (
    caisse_id, compte_id, date_operation, type, montant, libelle,
    reference_externe, categorie_id, vehicule_id, chauffeur_id, client_id,
    source, source_ref, statut, valide_le, valide_par, exercice_id,
    created_by, updated_by
  ) VALUES (
    v_caisse_id, v_compte_id, NEW.date_versement, 'sortie', NEW.montant, v_libelle,
    NEW.id::text, v_categorie_id, NULL, NULL, NEW.id_client,
    'versement_client', NEW.id::text, 'valide', NOW(), NULL, v_exercice_id,
    NULL, NULL
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_op_id;

  -- Generation auto de l'ecriture (Lot G, inchange)
  IF v_op_id IS NOT NULL THEN
    BEGIN
      PERFORM public.generer_ecriture_pour_operation(v_op_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cascade_versement v3] ecriture op=%: % (SQLSTATE=%)',
        v_op_id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_versement_client_to_operation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cascade_versement_client_to_operation"() IS 'Flux A (v3 - 10/06/2026) : AFTER INSERT OR UPDATE OF montant sur versements_clients. INSERT -> cree operation sortie cat 4119 + ecriture. UPDATE montant -> ajuste l''operation cascade au nouveau montant (cumul des tranches du mois) et regenere son ecriture ; WARNING sans modification si exercice clos ou montant invalide. Anti-recursion preservee via NOT EXISTS (source, source_ref).';



CREATE OR REPLACE FUNCTION "public"."check_alerte_peut_envoyer"("p_type_alerte" "text", "p_cible" "text", "p_gravite" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  derniere_envoi TIMESTAMPTZ;
  intervalle_min INTERVAL;
BEGIN
  -- Définir l'intervalle minimal selon la gravité
  intervalle_min := CASE p_gravite
    WHEN 'critique' THEN INTERVAL '6 hours'
    WHEN 'important' THEN INTERVAL '24 hours'
    WHEN 'opportunite' THEN INTERVAL '365 days'  -- jamais (1x seulement)
    ELSE INTERVAL '24 hours'
  END;

  -- Chercher la dernière alerte non ignorée du même type/cible
  SELECT MAX(date_envoi) INTO derniere_envoi
  FROM alertes_envoyees
  WHERE type_alerte = p_type_alerte
    AND (cible = p_cible OR (cible IS NULL AND p_cible IS NULL))
    AND statut != 'ignoree';

  -- Vérifier aussi les alertes récemment ignorées (blocage 24h)
  IF EXISTS (
    SELECT 1 FROM alertes_envoyees
    WHERE type_alerte = p_type_alerte
      AND (cible = p_cible OR (cible IS NULL AND p_cible IS NULL))
      AND statut = 'ignoree'
      AND date_traitement > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN FALSE;  -- Bloqué par ignorer
  END IF;

  -- Si jamais envoyée, autoriser
  IF derniere_envoi IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Si envoyée avant l'intervalle min, autoriser
  IF NOW() - derniere_envoi > intervalle_min THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_alerte_peut_envoyer"("p_type_alerte" "text", "p_cible" "text", "p_gravite" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compta_unaccent_lite"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT translate(
    UPPER(p_text),
    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸÆŒ',
    'AAAAAACEEEEIIIINOOOOOUUUUYYAEOE'
  );
$$;


ALTER FUNCTION "public"."compta_unaccent_lite"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_adresse" "text" DEFAULT NULL::"text", "p_raison_sociale" "text" DEFAULT NULL::"text", "p_numero_rccm" "text" DEFAULT NULL::"text", "p_numero_contribuable" "text" DEFAULT NULL::"text", "p_suffix_manuel" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tiers_id      UUID;
  v_parent_code   TEXT;
  v_suffix_base   TEXT;
  v_suffix_try    TEXT;
  v_attempt       INT := 0;
BEGIN
  -- Validations
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN
    RAISE EXCEPTION 'Nom obligatoire';
  END IF;
  IF p_type NOT IN ('client', 'fournisseur', 'salarie', 'autre') THEN
    RAISE EXCEPTION 'Type de tiers invalide : %', p_type;
  END IF;

  -- Mapping type → compte parent SYSCOHADA (cf. §2.2 de la spec)
  v_parent_code := CASE p_type
    WHEN 'client'      THEN '411'
    WHEN 'fournisseur' THEN '401'
    WHEN 'salarie'     THEN '421'
    WHEN 'autre'       THEN '467'
  END;

  -- Suffixe de base : manuel (si non vide) sinon auto-généré
  IF p_suffix_manuel IS NOT NULL AND TRIM(p_suffix_manuel) <> '' THEN
    v_suffix_base := UPPER(TRIM(p_suffix_manuel));
  ELSE
    v_suffix_base := public.generate_tiers_suffix(p_nom);
  END IF;

  -- Boucle de retry sur collision (max 100 tentatives)
  WHILE v_attempt < 100 LOOP
    v_suffix_try := CASE WHEN v_attempt = 0
                         THEN v_suffix_base
                         ELSE v_suffix_base || v_attempt::TEXT
                    END;
    BEGIN
      INSERT INTO public.tiers (
        nom, type, telephone, email, adresse,
        raison_sociale, numero_rccm, numero_contribuable,
        compte_syscohada_parent, compte_syscohada_suffix,
        notes, created_by, updated_by
      ) VALUES (
        TRIM(p_nom), p_type, NULLIF(TRIM(p_telephone), ''), NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_adresse), ''),
        NULLIF(TRIM(p_raison_sociale), ''), NULLIF(TRIM(p_numero_rccm), ''), NULLIF(TRIM(p_numero_contribuable), ''),
        v_parent_code, v_suffix_try,
        NULLIF(TRIM(p_notes), ''), p_user_id, p_user_id
      ) RETURNING id INTO v_tiers_id;
      EXIT;  -- succès, sortir de la boucle
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      v_tiers_id := NULL;
    END;
  END LOOP;

  IF v_tiers_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de générer un suffixe unique après 100 tentatives pour le nom "%"', p_nom;
  END IF;

  RETURN json_build_object(
    'tiers_id',              v_tiers_id,
    'suffix_final',          v_suffix_try,
    'compte_syscohada_code', v_parent_code || '-' || v_suffix_try
  );
END;
$$;


ALTER FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text", "p_email" "text", "p_adresse" "text", "p_raison_sociale" "text", "p_numero_rccm" "text", "p_numero_contribuable" "text", "p_suffix_manuel" "text", "p_notes" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text", "p_email" "text", "p_adresse" "text", "p_raison_sociale" "text", "p_numero_rccm" "text", "p_numero_contribuable" "text", "p_suffix_manuel" "text", "p_notes" "text", "p_user_id" "uuid") IS 'Création atomique d''un tiers avec génération automatique du suffixe SYSCOHADA et retry sur collision (Phase 4.x Vague 2). Retourne JSON {tiers_id, suffix_final, compte_syscohada_code}.';



CREATE OR REPLACE FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_transfert_id     UUID;
  v_op_sortie_id     UUID;
  v_op_entree_id     UUID;
  v_ecriture_id      UUID;
  v_code_source      TEXT;
  v_code_dest        TEXT;
  v_libelle_source   TEXT;
  v_libelle_dest     TEXT;
  v_libelle_final    TEXT;
  v_categorie_id     UUID;
  v_exercice_id      UUID;
  v_seq              BIGINT;
  v_annee            INT;
  v_numero           TEXT;
BEGIN
  -- ─ Validations XOR source / dest ─────────────────────────────────────────
  IF (p_source_caisse_id IS NULL AND p_source_compte_id IS NULL)
     OR (p_source_caisse_id IS NOT NULL AND p_source_compte_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source invalide : un et un seul de source_caisse_id / source_compte_id doit être fourni';
  END IF;
  IF (p_dest_caisse_id IS NULL AND p_dest_compte_id IS NULL)
     OR (p_dest_caisse_id IS NOT NULL AND p_dest_compte_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Destination invalide : un et un seul de dest_caisse_id / dest_compte_id doit être fourni';
  END IF;
  IF p_source_caisse_id IS NOT NULL AND p_source_caisse_id = p_dest_caisse_id THEN
    RAISE EXCEPTION 'Source et destination ne peuvent pas être la même caisse';
  END IF;
  IF p_source_compte_id IS NOT NULL AND p_source_compte_id = p_dest_compte_id THEN
    RAISE EXCEPTION 'Source et destination ne peuvent pas être le même compte';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être strictement positif';
  END IF;

  -- ─ Récupérer codes SYSCOHADA et libellés source/dest ─────────────────────
  IF p_source_caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code, libelle
      INTO v_code_source, v_libelle_source
      FROM public.caisses
     WHERE id = p_source_caisse_id;
  ELSE
    SELECT compte_syscohada_code, libelle
      INTO v_code_source, v_libelle_source
      FROM public.comptes
     WHERE id = p_source_compte_id;
  END IF;
  IF v_code_source IS NULL THEN
    RAISE EXCEPTION 'Source sans mapping SYSCOHADA (compte_syscohada_code NULL)';
  END IF;

  IF p_dest_caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code, libelle
      INTO v_code_dest, v_libelle_dest
      FROM public.caisses
     WHERE id = p_dest_caisse_id;
  ELSE
    SELECT compte_syscohada_code, libelle
      INTO v_code_dest, v_libelle_dest
      FROM public.comptes
     WHERE id = p_dest_compte_id;
  END IF;
  IF v_code_dest IS NULL THEN
    RAISE EXCEPTION 'Destination sans mapping SYSCOHADA (compte_syscohada_code NULL)';
  END IF;

  -- ─ Libellé final (auto-généré si non fourni) ─────────────────────────────
  v_libelle_final := COALESCE(
    NULLIF(TRIM(p_libelle), ''),
    'Transfert interne : ' || v_libelle_source || ' → ' || v_libelle_dest
  );

  -- ─ Exercice qui couvre la date ───────────────────────────────────────────
  SELECT id INTO v_exercice_id
    FROM public.exercices
   WHERE date_debut <= p_date AND date_fin >= p_date
     AND cloture = false
   ORDER BY date_debut DESC
   LIMIT 1;
  IF v_exercice_id IS NULL THEN
    RAISE EXCEPTION 'Aucun exercice ouvert ne couvre la date %', p_date;
  END IF;

  -- ─ Catégorie 'Transfert interne' (créée par la migration § 4) ───────────
  SELECT id INTO v_categorie_id
    FROM public.categories_operations
   WHERE libelle = 'Transfert interne' AND type = 'transfert'
   LIMIT 1;
  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie système Transfert interne introuvable';
  END IF;

  -- ─ Numéro d'écriture : YYYY-OD-NNNNNN sur l'exercice courant ────────────
  SELECT EXTRACT(YEAR FROM date_debut)::INT INTO v_annee
    FROM public.exercices WHERE id = v_exercice_id;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
    FROM public.ecritures_comptables
   WHERE journal_code = 'OD' AND exercice_id = v_exercice_id;
  v_numero := v_annee || '-OD-' || LPAD(v_seq::TEXT, 6, '0');

  -- ─ 1. INSERT transfert (sans liens ops/ecr — patchés en fin) ────────────
  INSERT INTO public.transferts_internes (
    date_transfert, montant, libelle,
    source_caisse_id, source_compte_id,
    dest_caisse_id,   dest_compte_id,
    exercice_id, statut, created_by, updated_by, notes
  ) VALUES (
    p_date, p_montant, v_libelle_final,
    p_source_caisse_id, p_source_compte_id,
    p_dest_caisse_id,   p_dest_compte_id,
    v_exercice_id, 'valide', p_user_id, p_user_id, p_notes
  ) RETURNING id INTO v_transfert_id;

  -- ─ 2. INSERT opération SORTIE (source) ───────────────────────────────────
  INSERT INTO public.operations (
    date_operation, type, montant, libelle,
    caisse_id, compte_id,
    categorie_id, source, source_ref,
    statut, exercice_id, created_by, updated_by
  ) VALUES (
    p_date, 'sortie', p_montant, v_libelle_final,
    p_source_caisse_id, p_source_compte_id,
    v_categorie_id, 'transfert_interne', v_transfert_id,
    'valide', v_exercice_id, p_user_id, p_user_id
  ) RETURNING id INTO v_op_sortie_id;

  -- ─ 3. INSERT opération ENTREE (destination) ──────────────────────────────
  INSERT INTO public.operations (
    date_operation, type, montant, libelle,
    caisse_id, compte_id,
    categorie_id, source, source_ref,
    statut, exercice_id, created_by, updated_by
  ) VALUES (
    p_date, 'entree', p_montant, v_libelle_final,
    p_dest_caisse_id, p_dest_compte_id,
    v_categorie_id, 'transfert_interne', v_transfert_id,
    'valide', v_exercice_id, p_user_id, p_user_id
  ) RETURNING id INTO v_op_entree_id;

  -- ─ 4. INSERT écriture comptable (statut=brouillon temporaire) ───────────
  --    operation_id pointe vers la SORTIE (convention)
  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle, exercice_id,
    operation_id, transfert_id, source_manuelle, statut
  ) VALUES (
    v_numero, p_date, 'OD', v_libelle_final, v_exercice_id,
    v_op_sortie_id, v_transfert_id, false, 'brouillon'
  ) RETURNING id INTO v_ecriture_id;

  -- ─ 5. INSERT lignes (débit destination / crédit source) ─────────────────
  INSERT INTO public.lignes_ecritures (ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit)
  VALUES
    (v_ecriture_id, 1, v_code_dest,   v_libelle_dest,   p_montant, 0),
    (v_ecriture_id, 2, v_code_source, v_libelle_source, 0,         p_montant);

  -- ─ 6. Validation de l'écriture (déclenche trigger équilibre BD) ─────────
  UPDATE public.ecritures_comptables
     SET statut    = 'valide',
         valide_le = NOW(),
         valide_par = p_user_id
   WHERE id = v_ecriture_id;

  -- ─ 7. Patcher les liens retour ───────────────────────────────────────────
  UPDATE public.transferts_internes
     SET operation_sortie_id = v_op_sortie_id,
         operation_entree_id = v_op_entree_id,
         ecriture_id          = v_ecriture_id,
         updated_at           = NOW(),
         updated_by           = p_user_id
   WHERE id = v_transfert_id;

  UPDATE public.operations
     SET ecriture_id = v_ecriture_id,
         updated_at  = NOW(),
         updated_by  = p_user_id
   WHERE id IN (v_op_sortie_id, v_op_entree_id);

  -- ─ Retour JSON ───────────────────────────────────────────────────────────
  RETURN json_build_object(
    'transfert_id',         v_transfert_id,
    'operation_sortie_id',  v_op_sortie_id,
    'operation_entree_id',  v_op_entree_id,
    'ecriture_id',          v_ecriture_id,
    'numero_ecriture',      v_numero
  );
END;
$$;


ALTER FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text") IS 'Crée un transfert interne atomique (Phase 4.x Vague 1) : insert 1 transfert + 2 opérations + 1 écriture + 2 lignes en une seule transaction. Rollback automatique si la moindre étape échoue.';



CREATE OR REPLACE FUNCTION "public"."enforce_exercice_clos_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_statut TEXT;
BEGIN
  SELECT statut INTO v_statut
    FROM public.exercices
   WHERE id = COALESCE(NEW.exercice_id, OLD.exercice_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications interdites (exercice_id=%)',
      COALESCE(NEW.exercice_id, OLD.exercice_id)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."enforce_exercice_clos_lock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_exercice_clos_lock_ecriture"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_statut TEXT;
  v_bypass TEXT;
BEGIN
  -- Bypass volontaire pour ajuster_resultat_exercice(p_force_recalcul := TRUE)
  -- ou pour la fonction de clôture elle-même (recovery admin).
  BEGIN
    v_bypass := current_setting('compta.auto_recalcul_allowed', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT statut INTO v_statut
    FROM public.exercices
   WHERE id = COALESCE(NEW.exercice_id, OLD.exercice_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications d''écritures interdites (exercice_id=%)',
      COALESCE(NEW.exercice_id, OLD.exercice_id)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."enforce_exercice_clos_lock_ecriture"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_exercice_clos_lock_ligne"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_statut TEXT;
  v_bypass TEXT;
BEGIN
  BEGIN
    v_bypass := current_setting('compta.auto_recalcul_allowed', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT e.statut INTO v_statut
    FROM public.ecritures_comptables ec
    JOIN public.exercices e ON e.id = ec.exercice_id
   WHERE ec.id = COALESCE(NEW.ecriture_id, OLD.ecriture_id);

  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Exercice clos : modifications de lignes interdites'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."enforce_exercice_clos_lock_ligne"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_justificatif_required"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Cas 1 : INSERT direct en statut='valide' (rare)
  -- Cas 2 : UPDATE statut='brouillon' → 'valide' (workflow brouillon → valide)
  IF NEW.type = 'sortie'
     AND NEW.tiers_id IS NOT NULL
     AND NEW.statut = 'valide'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.statut, 'brouillon') <> 'valide')
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.justificatifs
       WHERE operation_id = NEW.id
         AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Justificatif obligatoire pour sortie vers tiers (operation_id=%)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_justificatif_required"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_tiers_suffix"("p_nom" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_clean    TEXT;
  v_words    TEXT[];
  v_suffix   TEXT;
BEGIN
  IF p_nom IS NULL OR TRIM(p_nom) = '' THEN
    RETURN 'XX';
  END IF;

  -- 1. Nettoyer (UPPER + accents + civilités)
  v_clean := public.compta_unaccent_lite(TRIM(p_nom));
  v_clean := regexp_replace(v_clean, '^(MME|MR|M\.|MLLE|DR|PROF)\s+', '', 'i');
  v_clean := TRIM(v_clean);

  -- 2. Découper en mots significatifs (alphanumériques uniquement)
  v_words := regexp_split_to_array(v_clean, '[^A-Z0-9]+');
  v_words := array(SELECT w FROM unnest(v_words) AS w WHERE w <> '' AND char_length(w) > 0);

  IF array_length(v_words, 1) IS NULL THEN
    RETURN 'XX';
  ELSIF array_length(v_words, 1) = 1 THEN
    -- 1 seul mot → 2 premières lettres
    v_suffix := SUBSTRING(v_words[1] FROM 1 FOR 2);
    IF char_length(v_suffix) < 2 THEN
      v_suffix := RPAD(v_suffix, 2, 'X');
    END IF;
  ELSE
    -- ≥ 2 mots → initiale 1er + initiale 2e
    v_suffix := SUBSTRING(v_words[1] FROM 1 FOR 1) || SUBSTRING(v_words[2] FROM 1 FOR 1);
  END IF;

  RETURN v_suffix;
END;
$$;


ALTER FUNCTION "public"."generate_tiers_suffix"("p_nom" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_op            RECORD;
  v_cat           RECORD;
  v_compte_tresor TEXT;
  v_journal       TEXT;
  v_numero        TEXT;
  v_annee         INT;
  v_last_seq      INT;
  v_seq           INT;
  v_ecr_id        UUID;
  v_debit_tresor  NUMERIC;
  v_credit_tresor NUMERIC;
  v_debit_cat     NUMERIC;
  v_credit_cat    NUMERIC;
BEGIN
  -- ─── 1. Charger l'operation ─────────────────────────────────────────
  SELECT * INTO v_op FROM public.operations WHERE id = p_op_id;
  IF NOT FOUND THEN
    RAISE WARNING '[generer_ecriture] op % introuvable', p_op_id;
    RETURN NULL;
  END IF;

  -- Idempotence : deja liee a une ecriture
  IF v_op.ecriture_id IS NOT NULL THEN
    RETURN v_op.ecriture_id;
  END IF;

  -- L'operation doit etre validee
  IF v_op.statut IS DISTINCT FROM 'valide' THEN
    RAISE WARNING '[generer_ecriture] op % non validee (statut=%)', p_op_id, v_op.statut;
    RETURN NULL;
  END IF;

  -- ─── 2. Charger la categorie + verifier mapping SYSCOHADA ───────────
  SELECT * INTO v_cat FROM public.categories_operations WHERE id = v_op.categorie_id;
  IF NOT FOUND THEN
    RAISE WARNING '[generer_ecriture] op % categorie % introuvable', p_op_id, v_op.categorie_id;
    RETURN NULL;
  END IF;
  IF v_cat.compte_syscohada_code IS NULL OR v_cat.compte_syscohada_code = '' OR v_cat.sens IS NULL THEN
    RAISE WARNING '[generer_ecriture] op % categorie "%" sans mapping (code=%, sens=%)',
      p_op_id, v_cat.libelle, v_cat.compte_syscohada_code, v_cat.sens;
    RETURN NULL;
  END IF;

  -- ─── 3. Code SYSCOHADA du compte de tresorerie (caisse OU compte) ───
  IF v_op.caisse_id IS NOT NULL THEN
    SELECT compte_syscohada_code INTO v_compte_tresor
    FROM public.caisses WHERE id = v_op.caisse_id;
  ELSIF v_op.compte_id IS NOT NULL THEN
    SELECT compte_syscohada_code INTO v_compte_tresor
    FROM public.comptes WHERE id = v_op.compte_id;
  END IF;
  IF v_compte_tresor IS NULL OR v_compte_tresor = '' THEN
    RAISE WARNING '[generer_ecriture] op % sans compte tresorerie SYSCOHADA (caisse=%, compte=%)',
      p_op_id, v_op.caisse_id, v_op.compte_id;
    RETURN NULL;
  END IF;

  -- ─── 4. Choix du journal ────────────────────────────────────────────
  -- Priorite : journal_par_defaut de la categorie, sinon VE/BQ/CA selon type
  v_journal := COALESCE(
    NULLIF(v_cat.journal_par_defaut, ''),
    CASE
      WHEN v_op.type = 'entree'            THEN 'VE'
      WHEN v_op.compte_id IS NOT NULL      THEN 'BQ'
      ELSE                                      'CA'
    END
  );

  -- ─── 5. Numerotation YYYY-JJ-NNNNNN (race-safe via advisory lock) ───
  -- Le lock est transactionnel : libere automatiquement au COMMIT/ROLLBACK.
  -- Serialise uniquement les inserts concurrent sur le meme (journal, exercice).
  PERFORM pg_advisory_xact_lock(
    hashtext('ecriture_seq_' || v_journal || '_' || v_op.exercice_id::text)
  );

  SELECT EXTRACT(YEAR FROM date_debut)::INT INTO v_annee
  FROM public.exercices WHERE id = v_op.exercice_id;
  IF v_annee IS NULL THEN
    RAISE WARNING '[generer_ecriture] op % exercice % introuvable', p_op_id, v_op.exercice_id;
    RETURN NULL;
  END IF;

  -- MAX(seq) + 1 plutot que COUNT pour gerer les trous (extournes, DELETE, etc.)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^.*-(\d+)$', '\1'), '')::INT), 0)
    INTO v_last_seq
    FROM public.ecritures_comptables
   WHERE journal_code = v_journal
     AND exercice_id  = v_op.exercice_id
     AND numero LIKE v_annee::TEXT || '-' || v_journal || '-%';

  v_seq := v_last_seq + 1;
  v_numero := v_annee::TEXT || '-' || v_journal || '-' || LPAD(v_seq::TEXT, 6, '0');

  -- ─── 6. Preparer les 2 lignes (partie double) ───────────────────────
  -- Ligne 1 : tresorerie (caisse/compte). Entree -> debit. Sortie -> credit.
  IF v_op.type = 'entree' THEN
    v_debit_tresor  := v_op.montant;
    v_credit_tresor := 0;
  ELSE
    v_debit_tresor  := 0;
    v_credit_tresor := v_op.montant;
  END IF;

  -- Ligne 2 : categorie. Sens donne par cat.sens ('debit' ou 'credit').
  IF v_cat.sens = 'debit' THEN
    v_debit_cat  := v_op.montant;
    v_credit_cat := 0;
  ELSE
    v_debit_cat  := 0;
    v_credit_cat := v_op.montant;
  END IF;

  -- Sanity check : equilibre (le trigger d'equilibre BD le verifie aussi
  -- en UPDATE statut=valide, mais on detecte ici pour eviter l'INSERT)
  IF (v_debit_tresor + v_debit_cat) <> (v_credit_tresor + v_credit_cat) THEN
    RAISE WARNING '[generer_ecriture] op % desequilibree debit=% credit=% (cat.sens=%, op.type=%)',
      p_op_id, (v_debit_tresor + v_debit_cat), (v_credit_tresor + v_credit_cat),
      v_cat.sens, v_op.type;
    RETURN NULL;
  END IF;

  -- ─── 7. INSERT ecriture (statut=brouillon) ──────────────────────────
  INSERT INTO public.ecritures_comptables (
    numero, date_ecriture, journal_code, libelle,
    exercice_id, operation_id, source_manuelle, statut
  ) VALUES (
    v_numero, v_op.date_operation, v_journal, v_op.libelle,
    v_op.exercice_id, v_op.id, FALSE, 'brouillon'
  )
  RETURNING id INTO v_ecr_id;

  -- ─── 8. INSERT les 2 lignes ─────────────────────────────────────────
  INSERT INTO public.lignes_ecritures (
    ecriture_id, ordre, compte_syscohada_code, libelle, debit, credit,
    vehicule_id, chauffeur_id, client_id
  ) VALUES
  (v_ecr_id, 1, v_compte_tresor,                v_op.libelle, v_debit_tresor, v_credit_tresor,
   v_op.vehicule_id, v_op.chauffeur_id, v_op.client_id),
  (v_ecr_id, 2, v_cat.compte_syscohada_code,    v_op.libelle, v_debit_cat,    v_credit_cat,
   v_op.vehicule_id, v_op.chauffeur_id, v_op.client_id);

  -- ─── 9. UPDATE statut=valide (declenche trigger equilibre BD) ───────
  UPDATE public.ecritures_comptables
     SET statut = 'valide', valide_le = NOW()
   WHERE id = v_ecr_id;

  -- ─── 10. Lier l'operation a son ecriture ────────────────────────────
  UPDATE public.operations
     SET ecriture_id = v_ecr_id
   WHERE id = v_op.id;

  RETURN v_ecr_id;

EXCEPTION WHEN OTHERS THEN
  -- Fail-safe global : log warning + rollback implicite des INSERT partiels
  -- via sub-transaction PL/pgSQL. L'operation reste validee sans ecriture.
  RAISE WARNING '[generer_ecriture] op % erreur: % (SQLSTATE=%)',
    p_op_id, SQLERRM, SQLSTATE;
  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") IS 'Lot G (26/05/2026) : genere l''ecriture comptable double-partie pour une operation validee. Retourne l''UUID de l''ecriture creee, ou l''ecriture existante si idempotent, ou NULL en cas d''echec (warning logue). Race-safe via pg_advisory_xact_lock par (journal, exercice).';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dashboard_directeur"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_uid uuid;
begin
  begin
    v_uid := auth.uid();
  exception when others then
    return false;
  end;
  if v_uid is null then
    return false;
  end if;
  return exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'directeur');
end;
$$;


ALTER FUNCTION "public"."is_dashboard_directeur"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dashboard_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_uid uuid;
begin
  begin
    v_uid := auth.uid();
  exception when others then
    return false;
  end;
  if v_uid is null then
    return false;
  end if;
  return exists (select 1 from public.profiles p where p.id = v_uid);
end;
$$;


ALTER FUNCTION "public"."is_dashboard_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_directeur"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id   = auth.uid()
       AND role = 'directeur'
  );
$$;


ALTER FUNCTION "public"."is_directeur"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result_net BIGINT;
BEGIN
  SELECT resultat_net INTO v_result_net
    FROM public.ajuster_resultat_exercice(p_exercice_id, FALSE);

  UPDATE public.exercices
     SET resultat_net = v_result_net
   WHERE id = p_exercice_id;

  RETURN v_result_net;
END;
$$;


ALTER FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") IS 'PHASE 4.3 — Wrapper appelable côté API : recalcule l''auto-écriture + met à jour exercices.resultat_net.';



CREATE OR REPLACE FUNCTION "public"."set_exercice_id_on_operation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_ex UUID;
BEGIN
  -- Si exercice_id pas fourni OU si la date change → recalculer
  IF NEW.exercice_id IS NULL OR (TG_OP = 'UPDATE' AND OLD.date_operation IS DISTINCT FROM NEW.date_operation) THEN
    SELECT id INTO v_ex
      FROM public.exercices
     WHERE NEW.date_operation BETWEEN date_debut AND date_fin
     LIMIT 1;
    IF v_ex IS NOT NULL THEN
      NEW.exercice_id := v_ex;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_exercice_id_on_operation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_operation_to_legacy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing_id   BIGINT;
  v_existing_uuid UUID;
  v_cat_type      TEXT;   -- L5 : type de la catégorie de l'op (categories_operations.type)
BEGIN
  -- (L5 01/06/2026) Seule la source 'manuel' est désormais synchronisée vers
  -- les tables legacy. La branche 'versement_client' a été RETIRÉE : un
  -- reversement client n'est pas une dépense opérationnelle, il vit uniquement
  -- dans versements_clients (catégorie compta classe 41) et ne doit plus
  -- apparaître ni dans /depenses ni dans recettes_wave.
  -- NB : les jumeaux 'Reversement client' déjà présents dans depenses_vehicules
  -- ne sont PAS supprimés par ce trigger (nettoyage séparé à venir).

  -- ── CAS DELETE ─────────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.source = 'manuel' THEN
      IF OLD.type = 'entree' THEN
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
      ELSIF OLD.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = OLD.id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ── statut <> 'valide' → nettoyer le jumeau legacy (FILTRE CONSERVÉ) ─────
  IF NEW.statut <> 'valide' THEN
    IF NEW.source = 'manuel' THEN
      IF NEW.type = 'entree' THEN
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || NEW.id::text;
      ELSIF NEW.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = NEW.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ── Source hors périmètre → ignorer (+ nettoyage si transition manuel → autre)
  IF NEW.source <> 'manuel' THEN
    IF TG_OP = 'UPDATE' AND OLD.source = 'manuel' THEN
      IF OLD.type = 'entree' THEN
        DELETE FROM public.recettes_wave
         WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
      ELSIF OLD.type = 'sortie' THEN
        DELETE FROM public.depenses_vehicules
         WHERE id_depense = OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ── INSERT / UPDATE : source='manuel' ET statut='valide' ────────────────

  IF NEW.type = 'entree' THEN
    -- Bonus cohérence : flip sortie -> entree → supprimer le jumeau dépense
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.depenses_vehicules WHERE id_depense = OLD.id;
    END IF;

    -- Sync vers recettes_wave (UPSERT par "Identifiant de transaction")
    SELECT id INTO v_existing_id
      FROM public.recettes_wave
     WHERE "Identifiant de transaction" = 'op_' || NEW.id::text
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.recettes_wave SET
        "Horodatage"          = NEW.date_operation::timestamp,
        "Type de transaction" = 'Manuel',
        "Montant net"         = NEW.montant,
        "Montant brut"        = NEW.montant,
        "Frais"               = 0,
        "Devise"              = 'XOF',
        "Nom de contrepartie" = COALESCE(NEW.libelle, ''),
        "Nom d'utilisateur"   = COALESCE(NEW.libelle, ''),
        date_paiement         = NEW.date_operation,
        date_travail          = NEW.date_operation
       WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.recettes_wave (
        "Identifiant de transaction",
        "Horodatage",
        "Type de transaction",
        "Montant net",
        "Montant brut",
        "Frais",
        "Devise",
        "Nom de contrepartie",
        "Nom d'utilisateur",
        date_paiement,
        date_travail,
        created_at
      ) VALUES (
        'op_' || NEW.id::text,
        NEW.date_operation::timestamp,
        'Manuel',
        NEW.montant,
        NEW.montant,
        0,
        'XOF',
        COALESCE(NEW.libelle, ''),
        COALESCE(NEW.libelle, ''),
        NEW.date_operation,
        NEW.date_operation,
        NOW()
      );
    END IF;

  ELSIF NEW.type = 'sortie' THEN
    -- Bonus cohérence : flip entree -> sortie → supprimer le jumeau recette
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.recettes_wave
       WHERE "Identifiant de transaction" = 'op_' || OLD.id::text;
    END IF;

    -- ── L5 GARDE-FOU anti-repollution ──────────────────────────────────
    -- Ne miroiter vers depenses_vehicules QUE les vraies charges, c.-à-d.
    -- catégorie de type='depense'. Les autres sorties manuelles
    -- (investissement / remboursement / apport / transfert / NULL...)
    -- ne doivent PAS alimenter la table opérationnelle des dépenses.
    SELECT type INTO v_cat_type
      FROM public.categories_operations
     WHERE id = NEW.categorie_id;

    IF v_cat_type IS DISTINCT FROM 'depense' THEN
      -- Pas une dépense → s'assurer qu'aucun jumeau ne subsiste (reclassement)
      DELETE FROM public.depenses_vehicules WHERE id_depense = NEW.id;
      RETURN NEW;
    END IF;

    -- Catégorie 'depense' confirmée → UPSERT (par id_depense = operation.id)
    SELECT id_depense INTO v_existing_uuid
      FROM public.depenses_vehicules
     WHERE id_depense = NEW.id
     LIMIT 1;

    IF v_existing_uuid IS NOT NULL THEN
      UPDATE public.depenses_vehicules SET
        date_depense  = NEW.date_operation,
        montant       = NEW.montant,
        type_depense  = 'Manuel',
        description   = COALESCE(NEW.libelle, ''),
        id_vehicule   = NEW.vehicule_id
       WHERE id_depense = NEW.id;
    ELSE
      INSERT INTO public.depenses_vehicules (
        id_depense,
        date_depense,
        montant,
        type_depense,
        description,
        id_vehicule,
        immobilisation,
        created_at
      ) VALUES (
        NEW.id,
        NEW.date_operation,
        NEW.montant,
        'Manuel',
        COALESCE(NEW.libelle, ''),
        NEW.vehicule_id,
        false,
        NOW()
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_operation_to_legacy"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_operation_to_legacy"() IS 'Synchronise operations (source=manuel, statut=valide) vers recettes_wave / depenses_vehicules. Sortie miroitée uniquement si categorie.type=depense (L5 anti-repollution 01/06/2026). Branche versement_client RETIREE. Trigger AFTER INSERT/UPDATE/DELETE.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verifier_equilibre_ecriture"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_debit  NUMERIC;
  total_credit NUMERIC;
BEGIN
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut <> 'valide') THEN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
      INTO   total_debit, total_credit
      FROM   public.lignes_ecritures
      WHERE  ecriture_id = NEW.id;

    IF total_debit <> total_credit THEN
      RAISE EXCEPTION 'Écriture % déséquilibrée : débit=% crédit=%',
        NEW.numero, total_debit, total_credit;
    END IF;
    IF total_debit = 0 THEN
      RAISE EXCEPTION 'Écriture % vide (aucune ligne)', NEW.numero;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."verifier_equilibre_ecriture"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_etat_financier"("p_uuid" "uuid") RETURNS TABLE("type_etat" "text", "hash_sha256" "text", "exercice_libelle" "text", "date_arrete" "date", "raison_sociale" "text", "resultat_net" bigint, "genere_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    a.type_etat,
    a.hash_sha256,
    e.libelle                              AS exercice_libelle,
    e.date_fin                             AS date_arrete,
    COALESCE(sp.raison_sociale, pmc.raison_sociale, 'Boyah Group SARL') AS raison_sociale,
    e.resultat_net,
    a.genere_at
  FROM public.etats_financiers_archives a
  JOIN public.exercices e ON e.id = a.exercice_id
  LEFT JOIN public.societe_parametres sp ON TRUE
  LEFT JOIN public.parametres_module_compta pmc ON pmc.id = 1
  WHERE a.uuid_externe = p_uuid
  LIMIT 1;
$$;


ALTER FUNCTION "public"."verify_etat_financier"("p_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") RETURNS TABLE("match_count" integer, "type_etat" "text", "hash_sha256" "text", "exercice_libelle" "text", "date_arrete" "date", "raison_sociale" "text", "resultat_net" bigint, "genere_at" timestamp with time zone, "uuid_externe" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Normalisation : lowercase, trim, on garde uniquement [0-9a-f-]
  p_short := lower(regexp_replace(coalesce(p_short, ''), '[^0-9a-f-]', '', 'g'));

  -- Refus si trop court (sécurité : pas de lookup sur < 8 chars pour éviter
  -- les énumérations massives).
  IF char_length(p_short) < 8 THEN
    RETURN QUERY SELECT 0, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.etats_financiers_archives a
  WHERE substring(a.uuid_externe::text, 1, char_length(p_short)) = p_short;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  IF v_count > 1 THEN
    RETURN QUERY SELECT v_count, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
                         NULL::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;

  -- Match unique : on renvoie les détails
  RETURN QUERY
    SELECT
      1                                                                      AS match_count,
      a.type_etat,
      a.hash_sha256,
      e.libelle                                                              AS exercice_libelle,
      e.date_fin                                                             AS date_arrete,
      COALESCE(sp.raison_sociale, pmc.raison_sociale, 'Boyah Group SARL')    AS raison_sociale,
      e.resultat_net,
      a.genere_at,
      a.uuid_externe
    FROM public.etats_financiers_archives a
    JOIN public.exercices e ON e.id = a.exercice_id
    LEFT JOIN public.societe_parametres sp ON TRUE
    LEFT JOIN public.parametres_module_compta pmc ON pmc.id = 1
    WHERE substring(a.uuid_externe::text, 1, char_length(p_short)) = p_short
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") IS 'PATCH 4.2 — Résout un short_uuid (≥8 chars hex) → infos document. Retourne match_count pour gestion collision.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "user_name" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "entity" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."activity_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."activity_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."activity_logs_id_seq" OWNED BY "public"."activity_logs"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."affectation_chauffeurs_vehicules_id_affectation_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."affectation_chauffeurs_vehicules_id_affectation_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affectation_chauffeurs_vehicules" (
    "id_affectation" integer DEFAULT "nextval"('"public"."affectation_chauffeurs_vehicules_id_affectation_seq"'::"regclass") NOT NULL,
    "id_chauffeur" integer,
    "id_vehicule" integer,
    "date_debut" "date",
    "date_fin" "date",
    "created_at" timestamp without time zone
);


ALTER TABLE "public"."affectation_chauffeurs_vehicules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "titre" "text",
    "contenu" "text" NOT NULL,
    "donnees" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_chat_id" "text",
    "telegram_user_id" "text",
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_conversations_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."agent_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "categorie" "text" NOT NULL,
    "cle" "text" NOT NULL,
    "valeur" "text" NOT NULL,
    "importance" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_memory_importance_check" CHECK ((("importance" >= 1) AND ("importance" <= 10)))
);


ALTER TABLE "public"."agent_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "triggered_by" "text" DEFAULT 'auto'::"text" NOT NULL,
    "analysis" "jsonb",
    "retard_vehicules" "jsonb" DEFAULT '[]'::"jsonb",
    "is_after_noon" boolean DEFAULT false,
    "total_vehicules" integer DEFAULT 0
);


ALTER TABLE "public"."ai_insights" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."vehicules_id_vehicule_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."vehicules_id_vehicule_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicules" (
    "id_vehicule" integer DEFAULT "nextval"('"public"."vehicules_id_vehicule_seq"'::"regclass") NOT NULL,
    "immatriculation" "text",
    "type_vehicule" "text",
    "proprietaire" "text",
    "statut" "text",
    "montant de la recette" numeric,
    "km_actuel" integer,
    "km_derniere_vidange" integer,
    "date_derniers_pneus" "date",
    "date_assurance" "date",
    "date_expiration_assurance" "date",
    "date_visite_technique" "date",
    "date_expiration_visite" "date",
    "photo" "text",
    "carte_grise_recto" "text",
    "carte_grise_verso" "text",
    "sous_gestion" boolean DEFAULT false,
    "montant_mensuel_client" integer DEFAULT 0,
    "id_client" integer,
    "date_carte_stationnement" "date",
    "date_expiration_carte_stationnement" "date",
    "date_patente" "date",
    "date_expiration_patente" "date",
    "montant_recette_jour" numeric DEFAULT 0,
    "valeur_acquisition_client" numeric(15,2)
);


ALTER TABLE "public"."vehicules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vehicules"."valeur_acquisition_client" IS 'Valeur d''acquisition du vehicule par le Client (FCFA). Utilisee pour le KPI Capital gere agrege sur la page /clients. NULL = donnee non saisie. Ajoute le 23/05/2026 (G1 module Clients enrichi).';



CREATE OR REPLACE VIEW "public"."alerte_assurance" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "date_expiration_assurance",
    ("date_expiration_assurance" - CURRENT_DATE) AS "jours_restants"
   FROM "public"."vehicules"
  WHERE ("date_expiration_assurance" <= (CURRENT_DATE + '30 days'::interval));


ALTER VIEW "public"."alerte_assurance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."alerte_pneus" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "date_derniers_pneus",
    (CURRENT_DATE - "date_derniers_pneus") AS "jours_utilisation"
   FROM "public"."vehicules"
  WHERE ((CURRENT_DATE - "date_derniers_pneus") >= 90);


ALTER VIEW "public"."alerte_pneus" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."alerte_vidange" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "km_actuel",
    "km_derniere_vidange",
    ("km_actuel" - "km_derniere_vidange") AS "km_depuis_vidange"
   FROM "public"."vehicules"
  WHERE (("km_actuel" - "km_derniere_vidange") >= 8000);


ALTER VIEW "public"."alerte_vidange" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."alerte_visite_technique" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "date_expiration_visite",
    ("date_expiration_visite" - CURRENT_DATE) AS "jours_restants"
   FROM "public"."vehicules"
  WHERE ("date_expiration_visite" <= (CURRENT_DATE + '7 days'::interval));


ALTER VIEW "public"."alerte_visite_technique" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertes_envoyees" (
    "id" bigint NOT NULL,
    "type_alerte" "text" NOT NULL,
    "gravite" "text" NOT NULL,
    "cible" "text",
    "message_envoye" "text",
    "data_snapshot" "jsonb",
    "telegram_message_id" bigint,
    "statut" "text" DEFAULT 'envoyee'::"text",
    "date_envoi" timestamp with time zone DEFAULT "now"(),
    "date_expiration" timestamp with time zone,
    "date_traitement" timestamp with time zone,
    "traitement_action" "text"
);


ALTER TABLE "public"."alertes_envoyees" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."alertes_envoyees_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."alertes_envoyees_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."alertes_envoyees_id_seq" OWNED BY "public"."alertes_envoyees"."id";



CREATE OR REPLACE VIEW "public"."alertes_vehicules" WITH ("security_invoker"='on') AS
 SELECT 'VIDANGE'::"text" AS "type_alerte",
    "alerte_vidange"."immatriculation",
    CURRENT_DATE AS "date_alerte",
    ("alerte_vidange"."km_actuel" - "alerte_vidange"."km_derniere_vidange") AS "valeur"
   FROM "public"."alerte_vidange"
UNION ALL
 SELECT 'PNEUS'::"text" AS "type_alerte",
    "alerte_pneus"."immatriculation",
    CURRENT_DATE AS "date_alerte",
    (CURRENT_DATE - "alerte_pneus"."date_derniers_pneus") AS "valeur"
   FROM "public"."alerte_pneus"
UNION ALL
 SELECT 'ASSURANCE'::"text" AS "type_alerte",
    "alerte_assurance"."immatriculation",
    "alerte_assurance"."date_expiration_assurance" AS "date_alerte",
    ("alerte_assurance"."date_expiration_assurance" - CURRENT_DATE) AS "valeur"
   FROM "public"."alerte_assurance"
UNION ALL
 SELECT 'VISITE_TECHNIQUE'::"text" AS "type_alerte",
    "alerte_visite_technique"."immatriculation",
    "alerte_visite_technique"."date_expiration_visite" AS "date_alerte",
    ("alerte_visite_technique"."date_expiration_visite" - CURRENT_DATE) AS "valeur"
   FROM "public"."alerte_visite_technique";


ALTER VIEW "public"."alertes_vehicules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_chauffeur_auth" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_chauffeur" integer NOT NULL,
    "pin_hash" "text" NOT NULL,
    "pin_must_change" boolean DEFAULT true NOT NULL,
    "biometric_enabled" boolean DEFAULT false NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "lock_level" smallint DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_chauffeur_auth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_chauffeur_finances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_chauffeur" integer NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "gain_declare" integer DEFAULT 0 NOT NULL,
    "carburant" integer DEFAULT 0 NOT NULL,
    "lavage" integer DEFAULT 0 NOT NULL,
    "recharge_yango" integer DEFAULT 0 NOT NULL,
    "autre" integer DEFAULT 0 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_chauffeur_finances_autre_check" CHECK (("autre" >= 0)),
    CONSTRAINT "app_chauffeur_finances_carburant_check" CHECK (("carburant" >= 0)),
    CONSTRAINT "app_chauffeur_finances_gain_declare_check" CHECK (("gain_declare" >= 0)),
    CONSTRAINT "app_chauffeur_finances_lavage_check" CHECK (("lavage" >= 0)),
    CONSTRAINT "app_chauffeur_finances_recharge_yango_check" CHECK (("recharge_yango" >= 0))
);


ALTER TABLE "public"."app_chauffeur_finances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_messages_patron" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "body" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_messages_patron" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_support_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_chauffeur" integer NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "last_message_at" timestamp with time zone,
    "unread_for_chauffeur" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_support_conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."app_support_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "content" "text",
    "media_url" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_support_messages_sender_check" CHECK (("sender" = ANY (ARRAY['chauffeur'::"text", 'support'::"text"]))),
    CONSTRAINT "app_support_messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'audio'::"text"])))
);


ALTER TABLE "public"."app_support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_versements_mirror" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_chauffeur" integer NOT NULL,
    "transaction_id" "text" NOT NULL,
    "paid_at" timestamp with time zone NOT NULL,
    "amount" bigint NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_versements_mirror" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bilan_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classe_compte" "text" NOT NULL,
    "poste_bilan" "text" NOT NULL,
    "section" "text" NOT NULL,
    "cote" "text" NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL,
    "override_manuel" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bilan_mapping_cote_check" CHECK (("cote" = ANY (ARRAY['actif'::"text", 'passif'::"text"]))),
    CONSTRAINT "bilan_mapping_section_check" CHECK (("section" = ANY (ARRAY['ACTIF_IMMO'::"text", 'ACTIF_CIRC'::"text", 'TRESO_ACTIF'::"text", 'CAP_PROPRES'::"text", 'DETTES_FIN'::"text", 'PASSIF_CIRC'::"text", 'TRESO_PASSIF'::"text"])))
);


ALTER TABLE "public"."bilan_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boyahbot_memory" (
    "id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "message" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."boyahbot_memory" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."boyahbot_memory_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."boyahbot_memory_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."boyahbot_memory_id_seq" OWNED BY "public"."boyahbot_memory"."id";



CREATE TABLE IF NOT EXISTS "public"."caisses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "libelle" "text" NOT NULL,
    "type" "text" NOT NULL,
    "operateur" "text",
    "numero" "text",
    "solde_initial" numeric(18,2) DEFAULT 0 NOT NULL,
    "date_solde_initial" "date" DEFAULT '2026-02-09'::"date" NOT NULL,
    "plafond" numeric(18,2),
    "compte_syscohada_code" "text",
    "responsable_id" "uuid",
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "archive_le" timestamp with time zone,
    "archive_par" "uuid",
    "code" "text",
    "description" "text",
    CONSTRAINT "caisses_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'mobile_money'::"text"])))
);


ALTER TABLE "public"."caisses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendrier" (
    "date" "date" NOT NULL,
    "annee" integer,
    "mois" integer,
    "jour" integer,
    "semaine" integer,
    "jour_semaine" integer,
    "nom_mois" "text",
    "nom_jour" "text",
    "trimestre" integer
);


ALTER TABLE "public"."calendrier" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "libelle" "text" NOT NULL,
    "type" "text" NOT NULL,
    "compte_syscohada_code" "text",
    "sens" "text",
    "journal_par_defaut" "text",
    "actif" boolean DEFAULT true NOT NULL,
    "ordre" smallint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    CONSTRAINT "categories_operations_sens_check" CHECK (("sens" = ANY (ARRAY['debit'::"text", 'credit'::"text"]))),
    CONSTRAINT "categories_operations_type_check" CHECK (("type" = ANY (ARRAY['recette'::"text", 'depense'::"text", 'apport'::"text", 'reversement'::"text", 'avance'::"text", 'investissement'::"text", 'remboursement'::"text", 'dotation'::"text", 'transfert'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."categories_operations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."chauffeurs_id_chauffeur_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."chauffeurs_id_chauffeur_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chauffeurs" (
    "id_chauffeur" integer DEFAULT "nextval"('"public"."chauffeurs_id_chauffeur_seq"'::"regclass") NOT NULL,
    "nom" "text",
    "numero_wave" "text",
    "actif" boolean,
    "commentaire" "text",
    "photo" "text",
    "photo_permis_recto" "text",
    "photo_permis_verso" "text",
    "numero_permis" "text",
    "numero_cni" "text",
    "situation_matrimoniale" "text",
    "nombre_enfants" integer,
    "domicile" "text",
    "numero_garant" "text",
    "numero_wave_2" "text",
    "numero_wave_3" "text"
);


ALTER TABLE "public"."chauffeurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recettes_wave" (
    "id" bigint NOT NULL,
    "id_recette" bigint,
    "Horodatage" timestamp without time zone,
    "Identifiant de transaction" "text",
    "Type de transaction" "text",
    "Montant net" numeric,
    "Montant brut" numeric,
    "Frais" numeric,
    "Solde" numeric,
    "Devise" "text",
    "Nom de contrepartie" "text",
    "Numéro de téléphone de contrepartie" "text",
    "Nom d'utilisateur" "text",
    "Numéro de téléphone d'utilisateur" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "date_paiement" "date",
    "telephone_chauffeur" "text",
    "date_travail" "date"
);


ALTER TABLE "public"."recettes_wave" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."chauffeurs_actifs" WITH ("security_invoker"='on') AS
 SELECT "c"."id_chauffeur",
    "c"."nom",
    "count"("r"."id") AS "nombre_transactions",
    "sum"("r"."Montant net") AS "chiffre_affaire"
   FROM ("public"."chauffeurs" "c"
     LEFT JOIN "public"."recettes_wave" "r" ON (("r"."Numéro de téléphone de contrepartie" = "c"."numero_wave")))
  GROUP BY "c"."id_chauffeur", "c"."nom"
 HAVING ("count"("r"."id") > 0);


ALTER VIEW "public"."chauffeurs_actifs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."chauffeurs_inactifs" WITH ("security_invoker"='on') AS
 SELECT "c"."id_chauffeur",
    "c"."nom"
   FROM ("public"."chauffeurs" "c"
     LEFT JOIN "public"."recettes_wave" "r" ON (("r"."Numéro de téléphone de contrepartie" = "c"."numero_wave")))
  GROUP BY "c"."id_chauffeur", "c"."nom"
 HAVING ("count"("r"."id") = 0);


ALTER VIEW "public"."chauffeurs_inactifs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chauffeurs_yango_snapshot" (
    "id" integer NOT NULL,
    "yango_driver_id" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "work_status" "text",
    "premiere_vue_at" timestamp with time zone DEFAULT "now"(),
    "derniere_vue_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chauffeurs_yango_snapshot" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."chauffeurs_yango_snapshot_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" OWNED BY "public"."chauffeurs_yango_snapshot"."id";



CREATE OR REPLACE VIEW "public"."classement_chauffeurs" WITH ("security_invoker"='on') AS
 SELECT "c"."id_chauffeur",
    "c"."nom",
    COALESCE("sum"("r"."Montant net"), (0)::numeric) AS "ca"
   FROM ("public"."chauffeurs" "c"
     LEFT JOIN "public"."recettes_wave" "r" ON (("lower"("split_part"("r"."Nom de contrepartie", ' '::"text", 1)) = "lower"("split_part"("c"."nom", ' '::"text", 1)))))
  GROUP BY "c"."id_chauffeur", "c"."nom"
  ORDER BY COALESCE("sum"("r"."Montant net"), (0)::numeric) DESC;


ALTER VIEW "public"."classement_chauffeurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" integer NOT NULL,
    "nom" "text" NOT NULL,
    "telephone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "actif" boolean DEFAULT true NOT NULL,
    "tiers_id" "uuid"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."actif" IS 'Soft-delete : TRUE = client visible dans la liste par defaut. FALSE = client archive, accessible uniquement via la checkbox Inactifs. Ajoute le 23/05/2026 (QW3 module Clients enrichi).';



COMMENT ON COLUMN "public"."clients"."tiers_id" IS 'FK vers le tiers comptable correspondant (table tiers, type=client). Maintenu en cohaerance par /api/clients POST. NULL temporaire autorise pour les clients pre-existants en attendant le backfill. Ajoute le 23/05/2026 (H3 module Clients enrichi).';



CREATE TABLE IF NOT EXISTS "public"."clients_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_client" integer NOT NULL,
    "type" "text" NOT NULL,
    "nom_fichier" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "taille" integer NOT NULL,
    "mime_type" "text" NOT NULL,
    "auto_genere" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_by" "uuid",
    CONSTRAINT "clients_documents_mime_type_check" CHECK (("char_length"("mime_type") <= 100)),
    CONSTRAINT "clients_documents_nom_fichier_check" CHECK ((("char_length"(TRIM(BOTH FROM "nom_fichier")) >= 1) AND ("char_length"("nom_fichier") <= 255))),
    CONSTRAINT "clients_documents_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 1000))),
    CONSTRAINT "clients_documents_storage_path_check" CHECK (("char_length"("storage_path") <= 1000)),
    CONSTRAINT "clients_documents_taille_check" CHECK (("taille" > 0)),
    CONSTRAINT "clients_documents_type_check" CHECK (("type" = ANY (ARRAY['contrat'::"text", 'cni'::"text", 'carte_grise'::"text", 'assurance'::"text", 'justificatif'::"text", 'etat_comptes_sortie'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."clients_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."clients_documents" IS 'Documents archives par Client (asset management). Stockage physique : bucket Supabase Storage clients-docs/. Types : contrat, CNI, carte grise, assurance, justificatif (auto), etat des comptes a la sortie (auto), autre. Ajoute le 23/05/2026 (E1 module Clients enrichi).';



CREATE SEQUENCE IF NOT EXISTS "public"."clients_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."clients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."clients_id_seq" OWNED BY "public"."clients"."id";



CREATE TABLE IF NOT EXISTS "public"."clotures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercice_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "periode" "text" NOT NULL,
    "cloture_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cloture_par" "uuid" NOT NULL,
    "totaux" "jsonb" NOT NULL,
    "notes" "text",
    CONSTRAINT "clotures_type_check" CHECK (("type" = ANY (ARRAY['mensuelle'::"text", 'annuelle'::"text"])))
);


ALTER TABLE "public"."clotures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cockpit_todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "texte" "text" NOT NULL,
    "done" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "done_at" timestamp with time zone,
    "done_by" "uuid"
);


ALTER TABLE "public"."cockpit_todos" OWNER TO "postgres";


COMMENT ON TABLE "public"."cockpit_todos" IS 'Liste partagée équipe pour la page Cockpit Boyah - to-do simple texte+checkbox';



CREATE TABLE IF NOT EXISTS "public"."commandes_yango" (
    "id" "text" NOT NULL,
    "short_id" bigint,
    "status" "text",
    "created_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "raw" "jsonb"
);


ALTER TABLE "public"."commandes_yango" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comptes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "libelle" "text" NOT NULL,
    "banque" "text",
    "numero_compte" "text",
    "devise" "text" DEFAULT 'XOF'::"text" NOT NULL,
    "solde_initial" numeric(18,2) DEFAULT 0 NOT NULL,
    "date_solde_initial" "date" DEFAULT '2026-02-09'::"date" NOT NULL,
    "compte_syscohada_code" "text",
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "archive_le" timestamp with time zone,
    "archive_par" "uuid",
    "code" "text",
    "description" "text"
);


ALTER TABLE "public"."comptes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comptes_syscohada" (
    "code" "text" NOT NULL,
    "libelle" "text" NOT NULL,
    "classe" smallint NOT NULL,
    "type" "text" NOT NULL,
    "parent_code" "text",
    "ordre" smallint DEFAULT 0,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "comptes_syscohada_classe_check" CHECK ((("classe" >= 1) AND ("classe" <= 9))),
    CONSTRAINT "comptes_syscohada_type_check" CHECK (("type" = ANY (ARRAY['capitaux_propres'::"text", 'dettes_financieres'::"text", 'immobilisation'::"text", 'amortissement'::"text", 'immobilisation_fin'::"text", 'tiers_actif'::"text", 'tiers_passif'::"text", 'tiers'::"text", 'tresorerie'::"text", 'charge_exploitation'::"text", 'charge_personnel'::"text", 'charge_financiere'::"text", 'dotation'::"text", 'produit_exploitation'::"text", 'produit_financier'::"text", 'reprise'::"text", 'technique'::"text"])))
);


ALTER TABLE "public"."comptes_syscohada" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."depenses_vehicules" (
    "id_depense" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date_depense" "date",
    "montant" numeric,
    "type_depense" "text",
    "description" "text",
    "id_vehicule" integer,
    "immobilisation" boolean,
    "date_debut_immobilisation" "date",
    "date_fin_immobilisation" "date",
    "created_at" timestamp without time zone
);


ALTER TABLE "public"."depenses_vehicules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."cout_reel_vehicule" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "sum"("montant") AS "cout_total"
   FROM "public"."depenses_vehicules"
  GROUP BY "id_vehicule";


ALTER VIEW "public"."cout_reel_vehicule" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."depenses_anormales" WITH ("security_invoker"='on') AS
 SELECT "id_depense",
    "date_depense",
    "montant",
    "type_depense",
    "description",
    "id_vehicule",
    "immobilisation",
    "date_debut_immobilisation",
    "date_fin_immobilisation",
    "created_at"
   FROM "public"."depenses_vehicules"
  WHERE ("montant" > ( SELECT ("avg"("depenses_vehicules_1"."montant") * (2)::numeric)
           FROM "public"."depenses_vehicules" "depenses_vehicules_1"));


ALTER VIEW "public"."depenses_anormales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."depenses_recurrentes" WITH ("security_invoker"='on') AS
 SELECT "type_depense",
    "count"(*) AS "nombre_depenses",
    "avg"("montant") AS "montant_moyen"
   FROM "public"."depenses_vehicules"
  GROUP BY "type_depense"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."depenses_recurrentes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecritures_comptables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" "text" NOT NULL,
    "date_ecriture" "date" NOT NULL,
    "journal_code" "text" NOT NULL,
    "libelle" "text" NOT NULL,
    "exercice_id" "uuid" NOT NULL,
    "operation_id" "uuid",
    "transfert_id" "uuid",
    "source_manuelle" boolean DEFAULT false NOT NULL,
    "statut" "text" DEFAULT 'valide'::"text" NOT NULL,
    "cloture" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "valide_le" timestamp with time zone,
    "valide_par" "uuid",
    "extourne_de" "uuid",
    "auto_generated" boolean DEFAULT false NOT NULL,
    "auto_generation_type" "text",
    CONSTRAINT "ecritures_comptables_statut_check" CHECK (("statut" = ANY (ARRAY['brouillon'::"text", 'valide'::"text", 'annule'::"text"])))
);


ALTER TABLE "public"."ecritures_comptables" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ecritures_comptables"."auto_generated" IS 'PHASE 4.3 — TRUE si l''écriture est générée automatiquement (cf auto_generation_type)';



COMMENT ON COLUMN "public"."ecritures_comptables"."auto_generation_type" IS 'PHASE 4.3 — Type de génération : ''resultat_exercice'' (compte 13), ''cloture'' (autres ajustements futurs)';



CREATE TABLE IF NOT EXISTS "public"."entretiens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_vehicule" integer,
    "immatriculation" "text" NOT NULL,
    "date_realise" "date" NOT NULL,
    "date_prochain" "date" GENERATED ALWAYS AS (("date_realise" + '21 days'::interval)) STORED,
    "huile_moteur" boolean DEFAULT false,
    "filtre_huile" boolean DEFAULT false,
    "filtre_air" boolean DEFAULT false,
    "filtre_pollen" boolean DEFAULT false,
    "liquide_refroidissement" boolean DEFAULT false,
    "huile_frein" boolean DEFAULT false,
    "pneus" boolean DEFAULT false,
    "km_vidange" integer,
    "cout" numeric DEFAULT 0,
    "technicien" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "inspection" "jsonb"
);


ALTER TABLE "public"."entretiens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."etats_financiers_archives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercice_id" "uuid" NOT NULL,
    "type_etat" "text" NOT NULL,
    "hash_sha256" "text" NOT NULL,
    "donnees_json" "jsonb" NOT NULL,
    "pdf_storage_path" "text",
    "uuid_externe" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "genere_par" "uuid",
    "genere_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "etats_financiers_archives_hash_sha256_check" CHECK (("char_length"("hash_sha256") = 64)),
    CONSTRAINT "etats_financiers_archives_type_etat_check" CHECK (("type_etat" = ANY (ARRAY['bilan'::"text", 'compte_resultat'::"text", 'notes_annexes'::"text", 'tft'::"text", 'dossier_complet'::"text"])))
);


ALTER TABLE "public"."etats_financiers_archives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "libelle" "text" NOT NULL,
    "date_debut" "date" NOT NULL,
    "date_fin" "date" NOT NULL,
    "cloture" boolean DEFAULT false NOT NULL,
    "cloture_le" timestamp with time zone,
    "cloture_par" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "annee" integer NOT NULL,
    "statut" "text" DEFAULT 'ouvert'::"text" NOT NULL,
    "date_cloture" timestamp with time zone,
    "resultat_net" bigint,
    "bilan_pdf_path" "text",
    "cr_pdf_path" "text",
    CONSTRAINT "exercices_check" CHECK (("date_fin" > "date_debut")),
    CONSTRAINT "exercices_statut_check" CHECK (("statut" = ANY (ARRAY['ouvert'::"text", 'clos'::"text"])))
);


ALTER TABLE "public"."exercices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journaux" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "libelle" "text" NOT NULL,
    "type" "text" NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "ordre" smallint DEFAULT 0,
    CONSTRAINT "journaux_type_check" CHECK (("type" = ANY (ARRAY['banque'::"text", 'caisse'::"text", 'achats'::"text", 'ventes'::"text", 'paie'::"text", 'od'::"text"])))
);


ALTER TABLE "public"."journaux" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jours_feries" (
    "date" "date" NOT NULL,
    "libelle" "text" NOT NULL,
    "montant" numeric DEFAULT 15000,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."jours_feries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."justificatifs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'justificatifs'::"text" NOT NULL,
    "filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "justificatifs_filename_check" CHECK ((("char_length"("filename") >= 1) AND ("char_length"("filename") <= 255))),
    CONSTRAINT "justificatifs_mime_type_check" CHECK (("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/jpeg'::"text", 'image/png'::"text"]))),
    CONSTRAINT "justificatifs_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= ((5 * 1024) * 1024)))),
    CONSTRAINT "justificatifs_storage_path_check" CHECK (("char_length"("storage_path") >= 4))
);


ALTER TABLE "public"."justificatifs" OWNER TO "postgres";


COMMENT ON TABLE "public"."justificatifs" IS 'Justificatifs (factures, reçus, photos) attachés aux opérations. Phase 4.x Vague 3.';



COMMENT ON COLUMN "public"."justificatifs"."storage_path" IS 'Chemin dans le bucket Supabase Storage. Format : {operation_id}/{justificatif_id}-{filename_sluggué}.{ext}';



COMMENT ON COLUMN "public"."justificatifs"."deleted_at" IS 'Soft delete — la ligne est conservée pour audit trail SYSCOHADA.';



CREATE TABLE IF NOT EXISTS "public"."justifications_versement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_vehicule" integer NOT NULL,
    "jour_exploitation" "date" NOT NULL,
    "type" "text" NOT NULL,
    "motif" "text",
    "montant_attendu" numeric,
    "montant_recu" numeric,
    "auto_genere" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."justifications_versement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lignes_ecritures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecriture_id" "uuid" NOT NULL,
    "ordre" smallint NOT NULL,
    "compte_syscohada_code" "text" NOT NULL,
    "libelle" "text",
    "debit" numeric(18,2) DEFAULT 0 NOT NULL,
    "credit" numeric(18,2) DEFAULT 0 NOT NULL,
    "lettrage" "text",
    "lettrage_le" timestamp with time zone,
    "vehicule_id" integer,
    "chauffeur_id" integer,
    "client_id" integer,
    "apporteur_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lignes_ecritures_check" CHECK (((("debit" > (0)::numeric) AND ("credit" = (0)::numeric)) OR (("debit" = (0)::numeric) AND ("credit" > (0)::numeric)))),
    CONSTRAINT "lignes_ecritures_credit_check" CHECK (("credit" >= (0)::numeric)),
    CONSTRAINT "lignes_ecritures_debit_check" CHECK (("debit" >= (0)::numeric))
);


ALTER TABLE "public"."lignes_ecritures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compte_id" "uuid",
    "caisse_id" "uuid",
    "date_operation" "date" NOT NULL,
    "type" "text" NOT NULL,
    "montant" numeric(18,2) NOT NULL,
    "libelle" "text" NOT NULL,
    "reference_externe" "text",
    "categorie_id" "uuid",
    "vehicule_id" integer,
    "chauffeur_id" integer,
    "client_id" integer,
    "source" "text" DEFAULT 'manuel'::"text" NOT NULL,
    "source_ref" "text",
    "statut" "text" DEFAULT 'valide'::"text" NOT NULL,
    "valide_le" timestamp with time zone,
    "valide_par" "uuid",
    "ecriture_id" "uuid",
    "exercice_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "notes" "text",
    "tiers_id" "uuid",
    CONSTRAINT "operations_check" CHECK (((("compte_id" IS NOT NULL) AND ("caisse_id" IS NULL)) OR (("compte_id" IS NULL) AND ("caisse_id" IS NOT NULL)))),
    CONSTRAINT "operations_montant_check" CHECK (("montant" > (0)::numeric)),
    CONSTRAINT "operations_source_check" CHECK (("source" = ANY (ARRAY['manuel'::"text", 'recette_wave'::"text", 'depense_vehicule'::"text", 'versement_client'::"text", 'import_csv'::"text", 'transfert_interne'::"text", 'dotation_amort'::"text"]))),
    CONSTRAINT "operations_statut_check" CHECK (("statut" = ANY (ARRAY['brouillon'::"text", 'valide'::"text", 'annule'::"text"]))),
    CONSTRAINT "operations_type_check" CHECK (("type" = ANY (ARRAY['entree'::"text", 'sortie'::"text"])))
);


ALTER TABLE "public"."operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parametres_module_compta" (
    "id" integer DEFAULT 1 NOT NULL,
    "mode_actif" "text" DEFAULT 'simple'::"text" NOT NULL,
    "premier_login_effectue" boolean DEFAULT false NOT NULL,
    "workflow_validation_actif" boolean DEFAULT false NOT NULL,
    "exercice_courant_id" "uuid",
    "date_demarrage_module" "date" DEFAULT '2026-02-09'::"date" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "numerotation_auto" boolean DEFAULT true NOT NULL,
    "journal_par_defaut" "text" DEFAULT 'OD'::"text",
    "raison_sociale" "text",
    "numero_rccm" "text",
    "numero_contribuable" "text",
    "adresse_fiscale" "text",
    "telephone" "text",
    "email_comptable" "text",
    CONSTRAINT "parametres_module_compta_adresse_fiscale_check" CHECK ((("adresse_fiscale" IS NULL) OR ("char_length"("adresse_fiscale") <= 500))),
    CONSTRAINT "parametres_module_compta_email_comptable_check" CHECK ((("email_comptable" IS NULL) OR ("email_comptable" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text"))),
    CONSTRAINT "parametres_module_compta_id_check" CHECK (("id" = 1)),
    CONSTRAINT "parametres_module_compta_mode_actif_check" CHECK (("mode_actif" = ANY (ARRAY['simple'::"text", 'avance'::"text"]))),
    CONSTRAINT "parametres_module_compta_numero_contribuable_check" CHECK ((("numero_contribuable" IS NULL) OR ("char_length"("numero_contribuable") <= 50))),
    CONSTRAINT "parametres_module_compta_numero_rccm_check" CHECK ((("numero_rccm" IS NULL) OR ("char_length"("numero_rccm") <= 50))),
    CONSTRAINT "parametres_module_compta_telephone_check" CHECK ((("telephone" IS NULL) OR ("char_length"("telephone") <= 30)))
);


ALTER TABLE "public"."parametres_module_compta" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parametres_module_compta"."numerotation_auto" IS 'Numérotation automatique des écritures (préfixe par journal_code).';



COMMENT ON COLUMN "public"."parametres_module_compta"."journal_par_defaut" IS 'Journal utilisé pour les opérations dont la catégorie ne fixe pas de journal.';



COMMENT ON COLUMN "public"."parametres_module_compta"."raison_sociale" IS 'Raison sociale (Écran 7 — affiché sur les exports comptables).';



CREATE TABLE IF NOT EXISTS "public"."pieces_justificatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_id" "uuid",
    "transfert_id" "uuid",
    "url" "text" NOT NULL,
    "nom_fichier" "text" NOT NULL,
    "type_mime" "text",
    "taille_octets" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "pieces_justificatives_check" CHECK ((("operation_id" IS NOT NULL) OR ("transfert_id" IS NOT NULL)))
);


ALTER TABLE "public"."pieces_justificatives" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_ca_mensuel" WITH ("security_invoker"='on') AS
 SELECT (EXTRACT(year FROM "Horodatage"))::integer AS "annee",
    (EXTRACT(month FROM "Horodatage"))::integer AS "mois",
    "sum"("Montant net") AS "chiffre_affaire"
   FROM "public"."recettes_wave"
  GROUP BY ((EXTRACT(year FROM "Horodatage"))::integer), ((EXTRACT(month FROM "Horodatage"))::integer)
  ORDER BY ((EXTRACT(year FROM "Horodatage"))::integer), ((EXTRACT(month FROM "Horodatage"))::integer);


ALTER VIEW "public"."vue_ca_mensuel" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."prevision_ca_mensuel" WITH ("security_invoker"='on') AS
 SELECT "annee",
    "mois",
    "chiffre_affaire",
    ("chiffre_affaire" * 1.1) AS "prevision"
   FROM "public"."vue_ca_mensuel";


ALTER VIEW "public"."prevision_ca_mensuel" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_mensuelles" WITH ("security_invoker"='on') AS
 SELECT "date_trunc"('month'::"text", ("date_depense")::timestamp with time zone) AS "mois",
    "sum"("montant") AS "total_depenses"
   FROM "public"."depenses_vehicules"
  GROUP BY ("date_trunc"('month'::"text", ("date_depense")::timestamp with time zone))
  ORDER BY ("date_trunc"('month'::"text", ("date_depense")::timestamp with time zone));


ALTER VIEW "public"."vue_depenses_mensuelles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."prevision_depenses" WITH ("security_invoker"='on') AS
 SELECT "avg"("total_depenses") AS "depense_moyenne_mensuelle"
   FROM "public"."vue_depenses_mensuelles";


ALTER VIEW "public"."prevision_depenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'dispatcher'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE "public"."recettes_wave" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."recettes_wave_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."records_flotte" (
    "id" integer NOT NULL,
    "type_record" "text" NOT NULL,
    "valeur" numeric NOT NULL,
    "date_record" "date" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."records_flotte" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."records_flotte_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."records_flotte_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."records_flotte_id_seq" OWNED BY "public"."records_flotte"."id";



CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" bigint NOT NULL,
    "role" "text" NOT NULL,
    "action" "text" NOT NULL,
    "allowed" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "role_permissions_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'dispatcher'::"text"])))
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."role_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."role_permissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."role_permissions_id_seq" OWNED BY "public"."role_permissions"."id";



CREATE TABLE IF NOT EXISTS "public"."societe_parametres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom_commercial" "text" NOT NULL,
    "raison_sociale" "text" NOT NULL,
    "forme_juridique" "text",
    "adresse" "text",
    "telephone" "text",
    "email" "text",
    "site_web" "text",
    "rccm" "text",
    "numero_cc" "text",
    "capital_social" bigint,
    "regime_fiscal" "text",
    "nif" "text",
    "code_naf" "text",
    "logo_storage_path" "text",
    "exercice_debut_jj_mm" "text" DEFAULT '01-01'::"text" NOT NULL,
    "exercice_fin_jj_mm" "text" DEFAULT '12-31'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "methodes_comptables" "text",
    "engagements_hors_bilan" "text",
    "methode_amortissement" "text" DEFAULT 'lineaire'::"text" NOT NULL,
    "methode_stocks" "text" DEFAULT 'fifo'::"text" NOT NULL,
    CONSTRAINT "societe_parametres_adresse_check" CHECK ((("adresse" IS NULL) OR ("char_length"("adresse") <= 500))),
    CONSTRAINT "societe_parametres_capital_social_check" CHECK ((("capital_social" IS NULL) OR ("capital_social" >= 0))),
    CONSTRAINT "societe_parametres_code_naf_check" CHECK ((("code_naf" IS NULL) OR ("char_length"("code_naf") <= 30))),
    CONSTRAINT "societe_parametres_email_check" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text"))),
    CONSTRAINT "societe_parametres_exercice_debut_jj_mm_check" CHECK (("exercice_debut_jj_mm" ~ '^\d{2}-\d{2}$'::"text")),
    CONSTRAINT "societe_parametres_exercice_fin_jj_mm_check" CHECK (("exercice_fin_jj_mm" ~ '^\d{2}-\d{2}$'::"text")),
    CONSTRAINT "societe_parametres_forme_juridique_check" CHECK ((("forme_juridique" IS NULL) OR ("forme_juridique" = ANY (ARRAY['SARL'::"text", 'SA'::"text", 'SAS'::"text", 'SASU'::"text", 'EI'::"text", 'SCI'::"text", 'SCS'::"text", 'SNC'::"text", 'GIE'::"text", 'autre'::"text"])))),
    CONSTRAINT "societe_parametres_logo_storage_path_check" CHECK ((("logo_storage_path" IS NULL) OR ("char_length"("logo_storage_path") <= 400))),
    CONSTRAINT "societe_parametres_methode_amortissement_check" CHECK (("methode_amortissement" = ANY (ARRAY['lineaire'::"text", 'degressif'::"text"]))),
    CONSTRAINT "societe_parametres_methode_stocks_check" CHECK (("methode_stocks" = ANY (ARRAY['fifo'::"text", 'cmp'::"text", 'lifo'::"text"]))),
    CONSTRAINT "societe_parametres_nif_check" CHECK ((("nif" IS NULL) OR ("char_length"("nif") <= 60))),
    CONSTRAINT "societe_parametres_nom_commercial_check" CHECK (("char_length"(TRIM(BOTH FROM "nom_commercial")) >= 2)),
    CONSTRAINT "societe_parametres_numero_cc_check" CHECK ((("numero_cc" IS NULL) OR ("char_length"("numero_cc") <= 60))),
    CONSTRAINT "societe_parametres_raison_sociale_check" CHECK (("char_length"(TRIM(BOTH FROM "raison_sociale")) >= 2)),
    CONSTRAINT "societe_parametres_rccm_check" CHECK ((("rccm" IS NULL) OR ("char_length"("rccm") <= 60))),
    CONSTRAINT "societe_parametres_regime_fiscal_check" CHECK ((("regime_fiscal" IS NULL) OR ("regime_fiscal" = ANY (ARRAY['tva_assujetti'::"text", 'non_assujetti'::"text"])))),
    CONSTRAINT "societe_parametres_site_web_check" CHECK ((("site_web" IS NULL) OR ("char_length"("site_web") <= 200))),
    CONSTRAINT "societe_parametres_telephone_check" CHECK ((("telephone" IS NULL) OR ("char_length"("telephone") <= 30)))
);


ALTER TABLE "public"."societe_parametres" OWNER TO "postgres";


COMMENT ON TABLE "public"."societe_parametres" IS 'Phase 4.2 — Paramètres société pour PDF officiels (logo + identité légale + exercice par défaut). Singleton.';



COMMENT ON COLUMN "public"."societe_parametres"."methodes_comptables" IS 'PHASE 4.3 — Note 1 : texte libre listant les méthodes comptables appliquées (référentiel, devise, amortissement, etc.)';



COMMENT ON COLUMN "public"."societe_parametres"."engagements_hors_bilan" IS 'PHASE 4.3 — Note 6 : texte libre listant les engagements hors bilan (cautions, avals, crédit-bail, litiges)';



COMMENT ON COLUMN "public"."societe_parametres"."methode_amortissement" IS 'PHASE 4.3 — Méthode d''amortissement par défaut (linéaire ou dégressif)';



COMMENT ON COLUMN "public"."societe_parametres"."methode_stocks" IS 'PHASE 4.3 — Méthode de valorisation stocks (FIFO, CMP, LIFO)';



CREATE TABLE IF NOT EXISTS "public"."taches_suivi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_vehicule" integer,
    "immatriculation" "text" NOT NULL,
    "description" "text" NOT NULL,
    "fait" boolean DEFAULT false,
    "id_entretien" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fait_at" timestamp with time zone
);


ALTER TABLE "public"."taches_suivi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "type" "text" NOT NULL,
    "telephone" "text",
    "email" "text",
    "adresse" "text",
    "raison_sociale" "text",
    "numero_rccm" "text",
    "numero_contribuable" "text",
    "compte_syscohada_parent" "text" NOT NULL,
    "compte_syscohada_suffix" "text",
    "compte_syscohada_code" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("compte_syscohada_suffix" IS NULL) OR ("compte_syscohada_suffix" = ''::"text")) THEN "compte_syscohada_parent"
    ELSE (("compte_syscohada_parent" || '-'::"text") || "compte_syscohada_suffix")
END) STORED,
    "actif" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "tiers_adresse_check" CHECK ((("adresse" IS NULL) OR ("char_length"("adresse") <= 500))),
    CONSTRAINT "tiers_compte_syscohada_parent_check" CHECK (("char_length"("compte_syscohada_parent") >= 2)),
    CONSTRAINT "tiers_compte_syscohada_suffix_check" CHECK ((("compte_syscohada_suffix" IS NULL) OR ("char_length"("compte_syscohada_suffix") <= 8))),
    CONSTRAINT "tiers_email_check" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text"))),
    CONSTRAINT "tiers_nom_check" CHECK (("char_length"(TRIM(BOTH FROM "nom")) >= 2)),
    CONSTRAINT "tiers_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 4000))),
    CONSTRAINT "tiers_numero_contribuable_check" CHECK ((("numero_contribuable" IS NULL) OR ("char_length"("numero_contribuable") <= 60))),
    CONSTRAINT "tiers_numero_rccm_check" CHECK ((("numero_rccm" IS NULL) OR ("char_length"("numero_rccm") <= 60))),
    CONSTRAINT "tiers_raison_sociale_check" CHECK ((("raison_sociale" IS NULL) OR ("char_length"("raison_sociale") <= 200))),
    CONSTRAINT "tiers_telephone_check" CHECK ((("telephone" IS NULL) OR ("char_length"("telephone") <= 30))),
    CONSTRAINT "tiers_type_check" CHECK (("type" = ANY (ARRAY['client'::"text", 'fournisseur'::"text", 'salarie'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transferts_internes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date_transfert" "date" NOT NULL,
    "montant" numeric(18,2) NOT NULL,
    "libelle" "text" NOT NULL,
    "source_compte_id" "uuid",
    "source_caisse_id" "uuid",
    "dest_compte_id" "uuid",
    "dest_caisse_id" "uuid",
    "operation_sortie_id" "uuid",
    "operation_entree_id" "uuid",
    "ecriture_id" "uuid",
    "exercice_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'valide'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "notes" "text",
    CONSTRAINT "chk_transfert_source_dest_different" CHECK (((NOT (("source_caisse_id" IS NOT NULL) AND ("source_caisse_id" = "dest_caisse_id"))) AND (NOT (("source_compte_id" IS NOT NULL) AND ("source_compte_id" = "dest_compte_id"))))),
    CONSTRAINT "transferts_internes_check" CHECK ((("source_compte_id" IS NOT NULL) <> ("source_caisse_id" IS NOT NULL))),
    CONSTRAINT "transferts_internes_check1" CHECK ((("dest_compte_id" IS NOT NULL) <> ("dest_caisse_id" IS NOT NULL))),
    CONSTRAINT "transferts_internes_montant_check" CHECK (("montant" > (0)::numeric)),
    CONSTRAINT "transferts_internes_statut_check" CHECK (("statut" = ANY (ARRAY['brouillon'::"text", 'valide'::"text", 'annule'::"text"])))
);


ALTER TABLE "public"."transferts_internes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."versement_attribution" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_recette" bigint,
    "id_vehicule" integer,
    "jour_exploitation" "date" NOT NULL,
    "montant_attribue" numeric NOT NULL,
    "type_attribution" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "versement_attribution_type_attribution_check" CHECK (("type_attribution" = ANY (ARRAY['normal'::"text", 'jour_meme'::"text", 'split_2j'::"text", 'retard'::"text"])))
);


ALTER TABLE "public"."versement_attribution" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."versements_chauffeurs" (
    "id" bigint NOT NULL,
    "date_versement" "date",
    "id_chauffeur" integer,
    "id_vehicule" integer,
    "montant" numeric,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."versements_chauffeurs" OWNER TO "postgres";


ALTER TABLE "public"."versements_chauffeurs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."versements_chauffeurs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."versements_clients" (
    "id" integer NOT NULL,
    "id_client" integer NOT NULL,
    "mois" character varying(7) NOT NULL,
    "montant" numeric(12,0) NOT NULL,
    "date_versement" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "caisse_id" "uuid",
    "compte_id" "uuid",
    CONSTRAINT "versements_clients_caisse_compte_xor" CHECK (((("caisse_id" IS NULL) AND ("compte_id" IS NULL)) OR (("caisse_id" IS NOT NULL) AND ("compte_id" IS NULL)) OR (("caisse_id" IS NULL) AND ("compte_id" IS NOT NULL))))
);


ALTER TABLE "public"."versements_clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."versements_clients"."caisse_id" IS 'Caisse source du versement (XOR avec compte_id). Default frontend = Wave Boyah. Ajoute le 24/05/2026.';



COMMENT ON COLUMN "public"."versements_clients"."compte_id" IS 'Compte bancaire source du versement (XOR avec caisse_id). Ajoute le 24/05/2026.';



CREATE SEQUENCE IF NOT EXISTS "public"."versements_clients_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."versements_clients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."versements_clients_id_seq" OWNED BY "public"."versements_clients"."id";



CREATE OR REPLACE VIEW "public"."vue_ca_chauffeur_jour" WITH ("security_invoker"='on') AS
 SELECT "c"."nom",
    "date"("r"."Horodatage") AS "date_recette",
    "sum"("r"."Montant net") AS "ca_jour"
   FROM ("public"."recettes_wave" "r"
     LEFT JOIN "public"."chauffeurs" "c" ON (("lower"("split_part"("r"."Nom de contrepartie", ' '::"text", 1)) = "lower"("split_part"("c"."nom", ' '::"text", 1)))))
  GROUP BY "c"."nom", ("date"("r"."Horodatage"))
  ORDER BY ("date"("r"."Horodatage"));


ALTER VIEW "public"."vue_ca_chauffeur_jour" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_ca_journalier" WITH ("security_invoker"='on') AS
 SELECT "date"("Horodatage") AS "date_recette",
    "sum"("Montant net") AS "chiffre_affaire"
   FROM "public"."recettes_wave"
  GROUP BY ("date"("Horodatage"))
  ORDER BY ("date"("Horodatage"));


ALTER VIEW "public"."vue_ca_journalier" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_recettes_vehicules" WITH ("security_invoker"='on') AS
 SELECT "r"."id",
    "r"."Horodatage",
    "r"."Montant net",
    "r"."Identifiant de transaction",
    "r"."Type de transaction",
    "r"."Montant brut",
    "r"."Frais",
    "r"."Solde",
    "r"."Devise",
    "r"."Nom de contrepartie",
    "r"."Nom d'utilisateur",
    "r"."Numéro de téléphone de contrepartie",
    "r"."Numéro de téléphone d'utilisateur",
    COALESCE("c"."nom", "r"."Nom de contrepartie") AS "chauffeur",
    "v"."immatriculation",
    "v"."id_vehicule"
   FROM ((("public"."recettes_wave" "r"
     LEFT JOIN "public"."chauffeurs" "c" ON (("regexp_replace"("r"."Numéro de téléphone de contrepartie", '[^0-9]'::"text", ''::"text", 'g'::"text") = "regexp_replace"("c"."numero_wave", '[^0-9]'::"text", ''::"text", 'g'::"text"))))
     LEFT JOIN "public"."affectation_chauffeurs_vehicules" "a" ON ((("c"."id_chauffeur" = "a"."id_chauffeur") AND ("a"."date_fin" IS NULL))))
     LEFT JOIN "public"."vehicules" "v" ON (("a"."id_vehicule" = "v"."id_vehicule")))
  WHERE ("r"."Montant net" IS NOT NULL);


ALTER VIEW "public"."vue_recettes_vehicules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_ca_vehicule_aujourdhui" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "sum"("Montant net") AS "ca_today"
   FROM "public"."vue_recettes_vehicules"
  WHERE ("date"("Horodatage") = CURRENT_DATE)
  GROUP BY "id_vehicule", "immatriculation";


ALTER VIEW "public"."vue_ca_vehicule_aujourdhui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_ca_vehicule_jour" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "date"("Horodatage") AS "date_recette",
    "sum"("Montant net") AS "ca_jour"
   FROM "public"."vue_recettes_vehicules"
  GROUP BY "id_vehicule", "immatriculation", ("date"("Horodatage"))
  ORDER BY ("date"("Horodatage")) DESC;


ALTER VIEW "public"."vue_ca_vehicule_jour" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_ca_vehicule_mois" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "date_trunc"('month'::"text", "Horodatage") AS "mois",
    "sum"("Montant net") AS "ca_mois"
   FROM "public"."vue_recettes_vehicules"
  GROUP BY "id_vehicule", "immatriculation", ("date_trunc"('month'::"text", "Horodatage"))
  ORDER BY ("date_trunc"('month'::"text", "Horodatage")) DESC;


ALTER VIEW "public"."vue_ca_vehicule_mois" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_ca_vehicules" WITH ("security_invoker"='on') AS
 SELECT "v"."immatriculation",
    "sum"("r"."Montant net") AS "ca_total"
   FROM ("public"."vue_recettes_vehicules" "r"
     LEFT JOIN "public"."vehicules" "v" ON (("r"."id_vehicule" = "v"."id_vehicule")))
  GROUP BY "v"."immatriculation"
  ORDER BY ("sum"("r"."Montant net")) DESC;


ALTER VIEW "public"."vue_ca_vehicules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_chauffeurs_vehicules" WITH ("security_invoker"='on') AS
 SELECT "c"."id_chauffeur",
    "c"."nom",
    "c"."numero_wave",
    "c"."commentaire",
    "c"."actif",
    "v"."id_vehicule",
    "v"."immatriculation"
   FROM (("public"."chauffeurs" "c"
     LEFT JOIN "public"."affectation_chauffeurs_vehicules" "a" ON ((("a"."id_chauffeur" = "c"."id_chauffeur") AND ("a"."date_fin" IS NULL))))
     LEFT JOIN "public"."vehicules" "v" ON (("v"."id_vehicule" = "a"."id_vehicule")));


ALTER VIEW "public"."vue_chauffeurs_vehicules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_dashboard_depenses" WITH ("security_invoker"='on') AS
 SELECT "d"."id_depense",
    "d"."date_depense",
    "d"."montant",
    "d"."type_depense",
    "d"."description",
    "v"."immatriculation"
   FROM ("public"."depenses_vehicules" "d"
     LEFT JOIN "public"."vehicules" "v" ON (("v"."id_vehicule" = "d"."id_vehicule")))
  ORDER BY "d"."date_depense" DESC;


ALTER VIEW "public"."vue_dashboard_depenses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_dashboard_recettes" WITH ("security_invoker"='on') AS
 SELECT "id",
    "Horodatage" AS "date_recette",
    "Montant net" AS "montant",
    "Nom de contrepartie" AS "chauffeur"
   FROM "public"."recettes_wave"
  ORDER BY "Horodatage" DESC;


ALTER VIEW "public"."vue_dashboard_recettes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_dashboard_vehicules" WITH ("security_invoker"='on') AS
 SELECT "v"."id_vehicule",
    "v"."immatriculation",
    "v"."type_vehicule",
    "v"."proprietaire",
    "v"."statut",
    COALESCE("j"."ca_today", (0)::numeric) AS "ca_aujourdhui",
    COALESCE("m"."ca_mois", (0)::numeric) AS "ca_mensuel",
    COALESCE("c"."cout_total", (0)::numeric) AS "cout_total",
    (COALESCE("m"."ca_mois", (0)::numeric) - COALESCE("c"."cout_total", (0)::numeric)) AS "profit"
   FROM ((("public"."vehicules" "v"
     LEFT JOIN "public"."vue_ca_vehicule_aujourdhui" "j" ON (("v"."id_vehicule" = "j"."id_vehicule")))
     LEFT JOIN "public"."vue_ca_vehicule_mois" "m" ON ((("v"."id_vehicule" = "m"."id_vehicule") AND ("m"."mois" = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)))))
     LEFT JOIN "public"."cout_reel_vehicule" "c" ON (("v"."id_vehicule" = "c"."id_vehicule")));


ALTER VIEW "public"."vue_dashboard_vehicules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_aujourdhui" WITH ("security_invoker"='on') AS
 SELECT "sum"("montant") AS "total_depenses"
   FROM "public"."depenses_vehicules"
  WHERE ("date_depense" = CURRENT_DATE);


ALTER VIEW "public"."vue_depenses_aujourdhui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_categories" WITH ("security_invoker"='on') AS
 SELECT "type_depense",
    "sum"("montant") AS "total_depenses"
   FROM "public"."depenses_vehicules"
  GROUP BY "type_depense"
  ORDER BY ("sum"("montant")) DESC;


ALTER VIEW "public"."vue_depenses_categories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_journalieres" WITH ("security_invoker"='on') AS
 SELECT "date_depense",
    "sum"("montant") AS "total_depenses"
   FROM "public"."depenses_vehicules"
  GROUP BY "date_depense"
  ORDER BY "date_depense";


ALTER VIEW "public"."vue_depenses_journalieres" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_mois" WITH ("security_invoker"='on') AS
 SELECT "sum"("montant") AS "total_depenses"
   FROM "public"."depenses_vehicules"
  WHERE ("date_trunc"('month'::"text", ("date_depense")::timestamp with time zone) = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone));


ALTER VIEW "public"."vue_depenses_mois" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_par_categorie" WITH ("security_invoker"='on') AS
 SELECT "type_depense",
    "sum"("montant") AS "total_depenses"
   FROM "public"."depenses_vehicules"
  GROUP BY "type_depense"
  ORDER BY ("sum"("montant")) DESC;


ALTER VIEW "public"."vue_depenses_par_categorie" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_depenses_par_vehicule" WITH ("security_invoker"='on') AS
 SELECT "v"."id_vehicule",
    "v"."immatriculation",
    COALESCE("sum"("d"."montant"), (0)::numeric) AS "total_depenses"
   FROM ("public"."vehicules" "v"
     LEFT JOIN "public"."depenses_vehicules" "d" ON (("d"."id_vehicule" = "v"."id_vehicule")))
  GROUP BY "v"."id_vehicule", "v"."immatriculation"
  ORDER BY COALESCE("sum"("d"."montant"), (0)::numeric) DESC;


ALTER VIEW "public"."vue_depenses_par_vehicule" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_objectif_vehicules" WITH ("security_invoker"='on') AS
 SELECT "id_vehicule",
    "immatriculation",
    "montant de la recette" AS "objectif_journalier"
   FROM "public"."vehicules";


ALTER VIEW "public"."vue_objectif_vehicules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_profit_journalier" WITH ("security_invoker"='on') AS
 SELECT "ca"."date_recette",
    ("ca"."chiffre_affaire" - COALESCE("dep"."total_depenses", (0)::numeric)) AS "profit"
   FROM (( SELECT "date"("recettes_wave"."Horodatage") AS "date_recette",
            "sum"("recettes_wave"."Montant net") AS "chiffre_affaire"
           FROM "public"."recettes_wave"
          GROUP BY ("date"("recettes_wave"."Horodatage"))) "ca"
     LEFT JOIN ( SELECT "depenses_vehicules"."date_depense",
            "sum"("depenses_vehicules"."montant") AS "total_depenses"
           FROM "public"."depenses_vehicules"
          GROUP BY "depenses_vehicules"."date_depense") "dep" ON (("ca"."date_recette" = "dep"."date_depense")))
  ORDER BY "ca"."date_recette";


ALTER VIEW "public"."vue_profit_journalier" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_recettes_chauffeurs" WITH ("security_invoker"='on') AS
 SELECT "r"."id",
    "r"."Horodatage",
    "r"."Identifiant de transaction",
    "r"."Montant net",
    "r"."telephone_chauffeur",
    "c"."id_chauffeur",
    "c"."nom"
   FROM ("public"."recettes_wave" "r"
     LEFT JOIN "public"."chauffeurs" "c" ON (("r"."telephone_chauffeur" = "c"."numero_wave")));


ALTER VIEW "public"."vue_recettes_chauffeurs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_top_vehicule_depenses" WITH ("security_invoker"='on') AS
 SELECT "v"."immatriculation",
    "sum"("d"."montant") AS "total_depenses"
   FROM ("public"."depenses_vehicules" "d"
     LEFT JOIN "public"."vehicules" "v" ON (("v"."id_vehicule" = "d"."id_vehicule")))
  GROUP BY "v"."immatriculation"
  ORDER BY ("sum"("d"."montant")) DESC
 LIMIT 1;


ALTER VIEW "public"."vue_top_vehicule_depenses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vue_voitures_payees" WITH ("security_invoker"='on') AS
 SELECT "v"."id_vehicule",
    "v"."immatriculation",
    "count"("vc"."id") AS "versements"
   FROM ("public"."vehicules" "v"
     LEFT JOIN "public"."versements_chauffeurs" "vc" ON ((("vc"."id_vehicule" = "v"."id_vehicule") AND ("vc"."date_versement" = CURRENT_DATE))))
  GROUP BY "v"."id_vehicule", "v"."immatriculation";


ALTER VIEW "public"."vue_voitures_payees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wave_fr" (
    "Devise" "text",
    "Frais" "text",
    "Horodatage" "text",
    "Identifiant de transaction" "text",
    "Montant brut" "text",
    "Montant net" "text",
    "Nom d'utilisateur" "text",
    "Nom de contrepartie" "text",
    "Numéro de téléphone d'utilisateur" "text",
    "Numéro de téléphone de contrepartie" "text",
    "Solde" "text",
    "Type de transaction" "text"
);


ALTER TABLE "public"."wave_fr" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."activity_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alertes_envoyees" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."alertes_envoyees_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."boyahbot_memory" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."boyahbot_memory_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."chauffeurs_yango_snapshot" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."chauffeurs_yango_snapshot_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."clients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."clients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."records_flotte" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."records_flotte_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."role_permissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."role_permissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."versements_clients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."versements_clients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affectation_chauffeurs_vehicules"
    ADD CONSTRAINT "affectation_chauffeurs_vehicules_pkey" PRIMARY KEY ("id_affectation");



ALTER TABLE ONLY "public"."agent_analyses"
    ADD CONSTRAINT "agent_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_cle_key" UNIQUE ("cle");



ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertes_envoyees"
    ADD CONSTRAINT "alertes_envoyees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_chauffeur_auth"
    ADD CONSTRAINT "app_chauffeur_auth_id_chauffeur_key" UNIQUE ("id_chauffeur");



ALTER TABLE ONLY "public"."app_chauffeur_auth"
    ADD CONSTRAINT "app_chauffeur_auth_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_chauffeur_finances"
    ADD CONSTRAINT "app_chauffeur_finances_id_chauffeur_date_key" UNIQUE ("id_chauffeur", "date");



ALTER TABLE ONLY "public"."app_chauffeur_finances"
    ADD CONSTRAINT "app_chauffeur_finances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_messages_patron"
    ADD CONSTRAINT "app_messages_patron_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_support_conversations"
    ADD CONSTRAINT "app_support_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_support_messages"
    ADD CONSTRAINT "app_support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_versements_mirror"
    ADD CONSTRAINT "app_versements_mirror_id_chauffeur_transaction_id_key" UNIQUE ("id_chauffeur", "transaction_id");



ALTER TABLE ONLY "public"."app_versements_mirror"
    ADD CONSTRAINT "app_versements_mirror_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bilan_mapping"
    ADD CONSTRAINT "bilan_mapping_classe_compte_key" UNIQUE ("classe_compte");



ALTER TABLE ONLY "public"."bilan_mapping"
    ADD CONSTRAINT "bilan_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boyahbot_memory"
    ADD CONSTRAINT "boyahbot_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caisses"
    ADD CONSTRAINT "caisses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendrier"
    ADD CONSTRAINT "calendrier_pkey" PRIMARY KEY ("date");



ALTER TABLE ONLY "public"."categories_operations"
    ADD CONSTRAINT "categories_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chauffeurs"
    ADD CONSTRAINT "chauffeurs_pkey" PRIMARY KEY ("id_chauffeur");



ALTER TABLE ONLY "public"."chauffeurs_yango_snapshot"
    ADD CONSTRAINT "chauffeurs_yango_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chauffeurs_yango_snapshot"
    ADD CONSTRAINT "chauffeurs_yango_snapshot_yango_driver_id_key" UNIQUE ("yango_driver_id");



ALTER TABLE ONLY "public"."clients_documents"
    ADD CONSTRAINT "clients_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clotures"
    ADD CONSTRAINT "clotures_exercice_id_type_periode_key" UNIQUE ("exercice_id", "type", "periode");



ALTER TABLE ONLY "public"."clotures"
    ADD CONSTRAINT "clotures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cockpit_todos"
    ADD CONSTRAINT "cockpit_todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commandes_yango"
    ADD CONSTRAINT "commandes_yango_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comptes_syscohada"
    ADD CONSTRAINT "comptes_syscohada_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."depenses_vehicules"
    ADD CONSTRAINT "depenses_vehicules_pkey" PRIMARY KEY ("id_depense");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_extourne_de_unique" UNIQUE ("extourne_de");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entretiens"
    ADD CONSTRAINT "entretiens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."etats_financiers_archives"
    ADD CONSTRAINT "etats_financiers_archives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercices"
    ADD CONSTRAINT "exercices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journaux"
    ADD CONSTRAINT "journaux_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."journaux"
    ADD CONSTRAINT "journaux_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jours_feries"
    ADD CONSTRAINT "jours_feries_pkey" PRIMARY KEY ("date");



ALTER TABLE ONLY "public"."justificatifs"
    ADD CONSTRAINT "justificatifs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."justifications_versement"
    ADD CONSTRAINT "justifications_versement_id_vehicule_jour_exploitation_key" UNIQUE ("id_vehicule", "jour_exploitation");



ALTER TABLE ONLY "public"."justifications_versement"
    ADD CONSTRAINT "justifications_versement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lignes_ecritures"
    ADD CONSTRAINT "lignes_ecritures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parametres_module_compta"
    ADD CONSTRAINT "parametres_module_compta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pieces_justificatives"
    ADD CONSTRAINT "pieces_justificatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recettes_wave"
    ADD CONSTRAINT "recettes_wave_Identifiant de transaction_key" UNIQUE ("Identifiant de transaction");



ALTER TABLE ONLY "public"."recettes_wave"
    ADD CONSTRAINT "recettes_wave_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."records_flotte"
    ADD CONSTRAINT "records_flotte_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."records_flotte"
    ADD CONSTRAINT "records_flotte_type_record_key" UNIQUE ("type_record");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_action_key" UNIQUE ("role", "action");



ALTER TABLE ONLY "public"."societe_parametres"
    ADD CONSTRAINT "societe_parametres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taches_suivi"
    ADD CONSTRAINT "taches_suivi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients_documents"
    ADD CONSTRAINT "uniq_clients_documents_path" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_pkey" PRIMARY KEY ("id_vehicule");



ALTER TABLE ONLY "public"."versement_attribution"
    ADD CONSTRAINT "versement_attribution_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."versements_chauffeurs"
    ADD CONSTRAINT "versements_chauffeurs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."versements_clients"
    ADD CONSTRAINT "versements_clients_id_client_mois_key" UNIQUE ("id_client", "mois");



ALTER TABLE ONLY "public"."versements_clients"
    ADD CONSTRAINT "versements_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wave_fr"
    ADD CONSTRAINT "wave_fr_tx_id_unique" UNIQUE ("Identifiant de transaction");



CREATE INDEX "ai_insights_created_at_idx" ON "public"."ai_insights" USING "btree" ("created_at" DESC);



CREATE INDEX "app_chauffeur_finances_chauffeur_date_idx" ON "public"."app_chauffeur_finances" USING "btree" ("id_chauffeur", "date" DESC);



CREATE INDEX "app_messages_patron_active_idx" ON "public"."app_messages_patron" USING "btree" ("is_active", "created_at" DESC);



CREATE INDEX "app_support_conversations_chauffeur_idx" ON "public"."app_support_conversations" USING "btree" ("id_chauffeur");



CREATE INDEX "app_support_messages_conversation_idx" ON "public"."app_support_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "app_versements_mirror_chauffeur_paid_idx" ON "public"."app_versements_mirror" USING "btree" ("id_chauffeur", "paid_at" DESC);



CREATE UNIQUE INDEX "categories_operations_libelle_unique" ON "public"."categories_operations" USING "btree" ("libelle");



CREATE INDEX "commandes_yango_created_at_idx" ON "public"."commandes_yango" USING "btree" ("created_at" DESC);



CREATE INDEX "commandes_yango_ended_at_idx" ON "public"."commandes_yango" USING "btree" ("ended_at" DESC);



CREATE INDEX "commandes_yango_status_idx" ON "public"."commandes_yango" USING "btree" ("status");



CREATE INDEX "idx_activity_logs_created_at" ON "public"."activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_agent_conv_chat" ON "public"."agent_conversations" USING "btree" ("telegram_chat_id", "created_at" DESC);



CREATE INDEX "idx_alertes_expiration" ON "public"."alertes_envoyees" USING "btree" ("date_expiration") WHERE ("statut" <> 'ignoree'::"text");



CREATE INDEX "idx_alertes_type_cible" ON "public"."alertes_envoyees" USING "btree" ("type_alerte", "cible", "date_envoi" DESC);



CREATE INDEX "idx_boyahbot_memory_session" ON "public"."boyahbot_memory" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_clients_actif" ON "public"."clients" USING "btree" ("actif") WHERE ("actif" = true);



CREATE INDEX "idx_clients_documents_id_client" ON "public"."clients_documents" USING "btree" ("id_client", "uploaded_at" DESC);



CREATE INDEX "idx_clients_documents_type" ON "public"."clients_documents" USING "btree" ("type") WHERE ("type" IS NOT NULL);



CREATE INDEX "idx_clients_tiers_id" ON "public"."clients" USING "btree" ("tiers_id") WHERE ("tiers_id" IS NOT NULL);



CREATE INDEX "idx_cockpit_todos_done" ON "public"."cockpit_todos" USING "btree" ("done", "created_at" DESC);



CREATE INDEX "idx_commandes_yango_created_at" ON "public"."commandes_yango" USING "btree" ("created_at");



CREATE INDEX "idx_depenses_vehicules_date_depense" ON "public"."depenses_vehicules" USING "btree" ("date_depense");



CREATE INDEX "idx_ecritures_auto" ON "public"."ecritures_comptables" USING "btree" ("exercice_id", "auto_generation_type") WHERE ("auto_generated" = true);



CREATE INDEX "idx_ecritures_date" ON "public"."ecritures_comptables" USING "btree" ("date_ecriture");



CREATE INDEX "idx_ecritures_exercice" ON "public"."ecritures_comptables" USING "btree" ("exercice_id");



CREATE INDEX "idx_ecritures_extourne_de" ON "public"."ecritures_comptables" USING "btree" ("extourne_de") WHERE ("extourne_de" IS NOT NULL);



CREATE INDEX "idx_ecritures_journal" ON "public"."ecritures_comptables" USING "btree" ("journal_code");



CREATE UNIQUE INDEX "idx_ecritures_numero" ON "public"."ecritures_comptables" USING "btree" ("numero");



CREATE INDEX "idx_ef_archives_exercice" ON "public"."etats_financiers_archives" USING "btree" ("exercice_id", "type_etat");



CREATE INDEX "idx_ef_archives_genere_at" ON "public"."etats_financiers_archives" USING "btree" ("genere_at" DESC);



CREATE INDEX "idx_ef_archives_uuid_short" ON "public"."etats_financiers_archives" USING "btree" ("substring"(("uuid_externe")::"text", 1, 12));



COMMENT ON INDEX "public"."idx_ef_archives_uuid_short" IS 'PATCH 4.2 — Index sur les 12 premiers chars uuid_externe pour résolution short URL';



CREATE INDEX "idx_entretiens_prochain" ON "public"."entretiens" USING "btree" ("date_prochain");



CREATE INDEX "idx_entretiens_vehicule" ON "public"."entretiens" USING "btree" ("id_vehicule");



CREATE INDEX "idx_justificatifs_operation_active" ON "public"."justificatifs" USING "btree" ("operation_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_justificatifs_operation_all" ON "public"."justificatifs" USING "btree" ("operation_id");



CREATE INDEX "idx_justificatifs_uploaded_by" ON "public"."justificatifs" USING "btree" ("uploaded_by") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_lignes_compte" ON "public"."lignes_ecritures" USING "btree" ("compte_syscohada_code");



CREATE INDEX "idx_lignes_ecriture" ON "public"."lignes_ecritures" USING "btree" ("ecriture_id");



CREATE INDEX "idx_lignes_lettrage" ON "public"."lignes_ecritures" USING "btree" ("compte_syscohada_code", "lettrage") WHERE ("lettrage" IS NOT NULL);



CREATE INDEX "idx_operations_caisse" ON "public"."operations" USING "btree" ("caisse_id");



CREATE INDEX "idx_operations_categorie" ON "public"."operations" USING "btree" ("categorie_id");



CREATE INDEX "idx_operations_compte" ON "public"."operations" USING "btree" ("compte_id");



CREATE INDEX "idx_operations_date" ON "public"."operations" USING "btree" ("date_operation");



CREATE INDEX "idx_operations_exercice" ON "public"."operations" USING "btree" ("exercice_id");



CREATE INDEX "idx_operations_source" ON "public"."operations" USING "btree" ("source", "source_ref");



CREATE INDEX "idx_operations_statut" ON "public"."operations" USING "btree" ("statut");



CREATE INDEX "idx_operations_tiers" ON "public"."operations" USING "btree" ("tiers_id") WHERE ("tiers_id" IS NOT NULL);



CREATE INDEX "idx_pieces_operation" ON "public"."pieces_justificatives" USING "btree" ("operation_id");



CREATE INDEX "idx_pieces_transfert" ON "public"."pieces_justificatives" USING "btree" ("transfert_id");



CREATE INDEX "idx_recettes_wave_horodatage" ON "public"."recettes_wave" USING "btree" ("Horodatage");



CREATE INDEX "idx_taches_fait" ON "public"."taches_suivi" USING "btree" ("fait");



CREATE INDEX "idx_taches_vehicule" ON "public"."taches_suivi" USING "btree" ("id_vehicule");



CREATE INDEX "idx_tiers_actif" ON "public"."tiers" USING "btree" ("actif");



CREATE INDEX "idx_tiers_contribuable" ON "public"."tiers" USING "btree" ("numero_contribuable") WHERE ("numero_contribuable" IS NOT NULL);



CREATE INDEX "idx_tiers_nom_gin" ON "public"."tiers" USING "gin" ("to_tsvector"('"french"'::"regconfig", COALESCE("nom", ''::"text")));



CREATE INDEX "idx_tiers_nom_lower" ON "public"."tiers" USING "btree" ("lower"("nom"));



CREATE INDEX "idx_tiers_rccm" ON "public"."tiers" USING "btree" ("numero_rccm") WHERE ("numero_rccm" IS NOT NULL);



CREATE INDEX "idx_tiers_syscohada" ON "public"."tiers" USING "btree" ("compte_syscohada_code");



CREATE INDEX "idx_tiers_telephone" ON "public"."tiers" USING "btree" ("telephone") WHERE ("telephone" IS NOT NULL);



CREATE INDEX "idx_tiers_type" ON "public"."tiers" USING "btree" ("type");



CREATE INDEX "idx_transferts_date" ON "public"."transferts_internes" USING "btree" ("date_transfert" DESC);



CREATE INDEX "idx_transferts_dest_caisse" ON "public"."transferts_internes" USING "btree" ("dest_caisse_id");



CREATE INDEX "idx_transferts_dest_compte" ON "public"."transferts_internes" USING "btree" ("dest_compte_id");



CREATE INDEX "idx_transferts_source_caisse" ON "public"."transferts_internes" USING "btree" ("source_caisse_id");



CREATE INDEX "idx_transferts_source_compte" ON "public"."transferts_internes" USING "btree" ("source_compte_id");



CREATE INDEX "idx_transferts_statut" ON "public"."transferts_internes" USING "btree" ("statut");



CREATE INDEX "idx_va_jour" ON "public"."versement_attribution" USING "btree" ("jour_exploitation");



CREATE INDEX "idx_va_vehicule_jour" ON "public"."versement_attribution" USING "btree" ("id_vehicule", "jour_exploitation");



CREATE INDEX "idx_versement_attribution_jour_exploitation" ON "public"."versement_attribution" USING "btree" ("jour_exploitation");



CREATE INDEX "idx_versements_clients_mois" ON "public"."versements_clients" USING "btree" ("mois");



CREATE INDEX "idx_yango_snapshot_driver_id" ON "public"."chauffeurs_yango_snapshot" USING "btree" ("yango_driver_id");



CREATE UNIQUE INDEX "operations_source_source_ref_unique" ON "public"."operations" USING "btree" ("source", "source_ref") WHERE (("source" <> 'transfert_interne'::"text") AND ("source_ref" IS NOT NULL));



CREATE UNIQUE INDEX "uk_exercices_annee" ON "public"."exercices" USING "btree" ("annee");



CREATE UNIQUE INDEX "uq_ef_archives_uuid" ON "public"."etats_financiers_archives" USING "btree" ("uuid_externe");



CREATE UNIQUE INDEX "uq_societe_parametres_singleton" ON "public"."societe_parametres" USING "btree" ((true));



CREATE UNIQUE INDEX "uq_tiers_syscohada_actif" ON "public"."tiers" USING "btree" ("compte_syscohada_code") WHERE ("actif" = true);



CREATE OR REPLACE TRIGGER "app_chauffeur_auth_touch" BEFORE UPDATE ON "public"."app_chauffeur_auth" FOR EACH ROW EXECUTE FUNCTION "public"."app_touch_updated_at"();



CREATE OR REPLACE TRIGGER "app_chauffeur_finances_touch" BEFORE UPDATE ON "public"."app_chauffeur_finances" FOR EACH ROW EXECUTE FUNCTION "public"."app_touch_updated_at"();



CREATE OR REPLACE TRIGGER "app_messages_patron_touch" BEFORE UPDATE ON "public"."app_messages_patron" FOR EACH ROW EXECUTE FUNCTION "public"."app_touch_updated_at"();



CREATE OR REPLACE TRIGGER "app_support_conversations_touch" BEFORE UPDATE ON "public"."app_support_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."app_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_agent_memory_updated_at" BEFORE UPDATE ON "public"."agent_memory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_ecritures_equilibre" BEFORE INSERT OR UPDATE OF "statut" ON "public"."ecritures_comptables" FOR EACH ROW EXECUTE FUNCTION "public"."verifier_equilibre_ecriture"();



CREATE OR REPLACE TRIGGER "tr_ecritures_exercice_clos_lock" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ecritures_comptables" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_exercice_clos_lock_ecriture"();



CREATE OR REPLACE TRIGGER "tr_lignes_ecritures_clos_lock" BEFORE INSERT OR DELETE OR UPDATE ON "public"."lignes_ecritures" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_exercice_clos_lock_ligne"();



CREATE OR REPLACE TRIGGER "tr_operations_exercice_clos_lock" BEFORE INSERT OR DELETE OR UPDATE ON "public"."operations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_exercice_clos_lock"();



CREATE OR REPLACE TRIGGER "tr_operations_justificatif_required" BEFORE INSERT OR UPDATE OF "statut", "type", "tiers_id" ON "public"."operations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_justificatif_required"();



CREATE OR REPLACE TRIGGER "tr_operations_set_exercice" BEFORE INSERT OR UPDATE OF "date_operation" ON "public"."operations" FOR EACH ROW EXECUTE FUNCTION "public"."set_exercice_id_on_operation"();



CREATE OR REPLACE TRIGGER "trg_cascade_operation_to_versement" AFTER INSERT ON "public"."operations" FOR EACH ROW WHEN (("new"."source" = 'versement_client'::"text")) EXECUTE FUNCTION "public"."cascade_operation_to_versement_client"();



CREATE OR REPLACE TRIGGER "trg_cascade_recette_wave" AFTER INSERT OR UPDATE OF "Identifiant de transaction", "Montant net", "Horodatage" ON "public"."recettes_wave" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_recette_wave_to_operation"();



CREATE OR REPLACE TRIGGER "trg_cascade_versement_to_operation" AFTER INSERT OR UPDATE OF "montant" ON "public"."versements_clients" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_versement_client_to_operation"();



CREATE OR REPLACE TRIGGER "trg_sync_operation_to_legacy" AFTER INSERT OR DELETE OR UPDATE ON "public"."operations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_operation_to_legacy"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."affectation_chauffeurs_vehicules"
    ADD CONSTRAINT "affectation_chauffeurs_vehicules_id_chauffeur_fkey" FOREIGN KEY ("id_chauffeur") REFERENCES "public"."chauffeurs"("id_chauffeur");



ALTER TABLE ONLY "public"."affectation_chauffeurs_vehicules"
    ADD CONSTRAINT "affectation_chauffeurs_vehicules_id_vehicule_fkey" FOREIGN KEY ("id_vehicule") REFERENCES "public"."vehicules"("id_vehicule");



ALTER TABLE ONLY "public"."app_support_messages"
    ADD CONSTRAINT "app_support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."app_support_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caisses"
    ADD CONSTRAINT "caisses_archive_par_fkey" FOREIGN KEY ("archive_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."caisses"
    ADD CONSTRAINT "caisses_compte_syscohada_code_fkey" FOREIGN KEY ("compte_syscohada_code") REFERENCES "public"."comptes_syscohada"("code");



ALTER TABLE ONLY "public"."caisses"
    ADD CONSTRAINT "caisses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."caisses"
    ADD CONSTRAINT "caisses_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."categories_operations"
    ADD CONSTRAINT "categories_operations_compte_syscohada_code_fkey" FOREIGN KEY ("compte_syscohada_code") REFERENCES "public"."comptes_syscohada"("code");



ALTER TABLE ONLY "public"."categories_operations"
    ADD CONSTRAINT "categories_operations_journal_par_defaut_fkey" FOREIGN KEY ("journal_par_defaut") REFERENCES "public"."journaux"("code");



ALTER TABLE ONLY "public"."clients_documents"
    ADD CONSTRAINT "clients_documents_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients_documents"
    ADD CONSTRAINT "clients_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_tiers_id_fkey" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clotures"
    ADD CONSTRAINT "clotures_cloture_par_fkey" FOREIGN KEY ("cloture_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clotures"
    ADD CONSTRAINT "clotures_exercice_id_fkey" FOREIGN KEY ("exercice_id") REFERENCES "public"."exercices"("id");



ALTER TABLE ONLY "public"."cockpit_todos"
    ADD CONSTRAINT "cockpit_todos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cockpit_todos"
    ADD CONSTRAINT "cockpit_todos_done_by_fkey" FOREIGN KEY ("done_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_archive_par_fkey" FOREIGN KEY ("archive_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_compte_syscohada_code_fkey" FOREIGN KEY ("compte_syscohada_code") REFERENCES "public"."comptes_syscohada"("code");



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comptes_syscohada"
    ADD CONSTRAINT "comptes_syscohada_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "public"."comptes_syscohada"("code");



ALTER TABLE ONLY "public"."depenses_vehicules"
    ADD CONSTRAINT "depenses_vehicules_id_vehicule_fkey" FOREIGN KEY ("id_vehicule") REFERENCES "public"."vehicules"("id_vehicule");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_exercice_id_fkey" FOREIGN KEY ("exercice_id") REFERENCES "public"."exercices"("id");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_extourne_de_fkey" FOREIGN KEY ("extourne_de") REFERENCES "public"."ecritures_comptables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_journal_code_fkey" FOREIGN KEY ("journal_code") REFERENCES "public"."journaux"("code");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_transfert_id_fkey" FOREIGN KEY ("transfert_id") REFERENCES "public"."transferts_internes"("id");



ALTER TABLE ONLY "public"."ecritures_comptables"
    ADD CONSTRAINT "ecritures_comptables_valide_par_fkey" FOREIGN KEY ("valide_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."entretiens"
    ADD CONSTRAINT "entretiens_id_vehicule_fkey" FOREIGN KEY ("id_vehicule") REFERENCES "public"."vehicules"("id_vehicule") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etats_financiers_archives"
    ADD CONSTRAINT "etats_financiers_archives_exercice_id_fkey" FOREIGN KEY ("exercice_id") REFERENCES "public"."exercices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etats_financiers_archives"
    ADD CONSTRAINT "etats_financiers_archives_genere_par_fkey" FOREIGN KEY ("genere_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercices"
    ADD CONSTRAINT "exercices_cloture_par_fkey" FOREIGN KEY ("cloture_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "fk_operation_ecriture" FOREIGN KEY ("ecriture_id") REFERENCES "public"."ecritures_comptables"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "fk_transfert_ecriture" FOREIGN KEY ("ecriture_id") REFERENCES "public"."ecritures_comptables"("id");



ALTER TABLE ONLY "public"."justificatifs"
    ADD CONSTRAINT "justificatifs_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."justificatifs"
    ADD CONSTRAINT "justificatifs_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."justificatifs"
    ADD CONSTRAINT "justificatifs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."justifications_versement"
    ADD CONSTRAINT "justifications_versement_id_vehicule_fkey" FOREIGN KEY ("id_vehicule") REFERENCES "public"."vehicules"("id_vehicule") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lignes_ecritures"
    ADD CONSTRAINT "lignes_ecritures_compte_syscohada_code_fkey" FOREIGN KEY ("compte_syscohada_code") REFERENCES "public"."comptes_syscohada"("code");



ALTER TABLE ONLY "public"."lignes_ecritures"
    ADD CONSTRAINT "lignes_ecritures_ecriture_id_fkey" FOREIGN KEY ("ecriture_id") REFERENCES "public"."ecritures_comptables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_caisse_id_fkey" FOREIGN KEY ("caisse_id") REFERENCES "public"."caisses"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_operations"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_chauffeur_id_fkey" FOREIGN KEY ("chauffeur_id") REFERENCES "public"."chauffeurs"("id_chauffeur") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_exercice_id_fkey" FOREIGN KEY ("exercice_id") REFERENCES "public"."exercices"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_tiers_id_fkey" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_valide_par_fkey" FOREIGN KEY ("valide_par") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."operations"
    ADD CONSTRAINT "operations_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id_vehicule") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parametres_module_compta"
    ADD CONSTRAINT "parametres_module_compta_journal_par_defaut_fkey" FOREIGN KEY ("journal_par_defaut") REFERENCES "public"."journaux"("code");



ALTER TABLE ONLY "public"."parametres_module_compta"
    ADD CONSTRAINT "parametres_module_compta_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pieces_justificatives"
    ADD CONSTRAINT "pieces_justificatives_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pieces_justificatives"
    ADD CONSTRAINT "pieces_justificatives_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pieces_justificatives"
    ADD CONSTRAINT "pieces_justificatives_transfert_id_fkey" FOREIGN KEY ("transfert_id") REFERENCES "public"."transferts_internes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."societe_parametres"
    ADD CONSTRAINT "societe_parametres_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."taches_suivi"
    ADD CONSTRAINT "taches_suivi_id_entretien_fkey" FOREIGN KEY ("id_entretien") REFERENCES "public"."entretiens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."taches_suivi"
    ADD CONSTRAINT "taches_suivi_id_vehicule_fkey" FOREIGN KEY ("id_vehicule") REFERENCES "public"."vehicules"("id_vehicule") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_dest_caisse_id_fkey" FOREIGN KEY ("dest_caisse_id") REFERENCES "public"."caisses"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_dest_compte_id_fkey" FOREIGN KEY ("dest_compte_id") REFERENCES "public"."comptes"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_exercice_id_fkey" FOREIGN KEY ("exercice_id") REFERENCES "public"."exercices"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_operation_entree_id_fkey" FOREIGN KEY ("operation_entree_id") REFERENCES "public"."operations"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_operation_sortie_id_fkey" FOREIGN KEY ("operation_sortie_id") REFERENCES "public"."operations"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_source_caisse_id_fkey" FOREIGN KEY ("source_caisse_id") REFERENCES "public"."caisses"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_source_compte_id_fkey" FOREIGN KEY ("source_compte_id") REFERENCES "public"."comptes"("id");



ALTER TABLE ONLY "public"."transferts_internes"
    ADD CONSTRAINT "transferts_internes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."versement_attribution"
    ADD CONSTRAINT "versement_attribution_id_vehicule_fkey" FOREIGN KEY ("id_vehicule") REFERENCES "public"."vehicules"("id_vehicule") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."versements_clients"
    ADD CONSTRAINT "versements_clients_caisse_id_fkey" FOREIGN KEY ("caisse_id") REFERENCES "public"."caisses"("id");



ALTER TABLE ONLY "public"."versements_clients"
    ADD CONSTRAINT "versements_clients_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id");



ALTER TABLE ONLY "public"."versements_clients"
    ADD CONSTRAINT "versements_clients_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



CREATE POLICY "Insertion publique ai_insights" ON "public"."ai_insights" FOR INSERT WITH CHECK (true);



CREATE POLICY "Lecture publique ai_insights" ON "public"."ai_insights" FOR SELECT USING (true);



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."affectation_chauffeurs_vehicules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "affectation_chauffeurs_vehicules_boyahbot_reader_sel" ON "public"."affectation_chauffeurs_vehicules" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "affectation_chauffeurs_vehicules_sel_dashboard" ON "public"."affectation_chauffeurs_vehicules" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "affectation_chauffeurs_vehicules_wr_directeur" ON "public"."affectation_chauffeurs_vehicules" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."agent_analyses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_analyses_boyahbot_reader_sel" ON "public"."agent_analyses" FOR SELECT TO "boyahbot_reader" USING (true);



ALTER TABLE "public"."agent_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_conversations_boyahbot_reader_sel" ON "public"."agent_conversations" FOR SELECT TO "boyahbot_reader" USING (true);



ALTER TABLE "public"."agent_memory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_memory_boyahbot_reader_sel" ON "public"."agent_memory" FOR SELECT TO "boyahbot_reader" USING (true);



ALTER TABLE "public"."ai_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertes_envoyees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alertes_envoyees_boyahbot_reader_all" ON "public"."alertes_envoyees" TO "boyahbot_reader" USING (true) WITH CHECK (true);



CREATE POLICY "alertes_envoyees_boyahbot_writer_all" ON "public"."alertes_envoyees" TO "boyahbot_writer" USING (true) WITH CHECK (true);



CREATE POLICY "alertes_envoyees_sel_dashboard" ON "public"."alertes_envoyees" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "alertes_envoyees_wr_directeur" ON "public"."alertes_envoyees" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."app_chauffeur_auth" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_chauffeur_finances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_finances_own" ON "public"."app_chauffeur_finances" TO "authenticated" USING (("id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer)) WITH CHECK (("id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer));



ALTER TABLE "public"."app_messages_patron" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_messages_patron_read" ON "public"."app_messages_patron" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));



CREATE POLICY "app_support_conv_own" ON "public"."app_support_conversations" TO "authenticated" USING (("id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer)) WITH CHECK (("id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer));



ALTER TABLE "public"."app_support_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_support_msg_insert" ON "public"."app_support_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender" = 'chauffeur'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."app_support_conversations" "c"
  WHERE (("c"."id" = "app_support_messages"."conversation_id") AND ("c"."id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer))))));



CREATE POLICY "app_support_msg_select" ON "public"."app_support_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_support_conversations" "c"
  WHERE (("c"."id" = "app_support_messages"."conversation_id") AND ("c"."id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer)))));



CREATE POLICY "app_support_msg_update" ON "public"."app_support_messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_support_conversations" "c"
  WHERE (("c"."id" = "app_support_messages"."conversation_id") AND ("c"."id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer)))));



ALTER TABLE "public"."app_versements_mirror" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_versements_mirror_own" ON "public"."app_versements_mirror" FOR SELECT TO "authenticated" USING (("id_chauffeur" = (("auth"."jwt"() ->> 'id_chauffeur'::"text"))::integer));



CREATE POLICY "authenticated_all_versements" ON "public"."versements_clients" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."bilan_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boyahbot_memory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boyahbot_memory_boyahbot_reader_all" ON "public"."boyahbot_memory" TO "boyahbot_reader" USING (true) WITH CHECK (true);



ALTER TABLE "public"."caisses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendrier" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendrier_boyahbot_reader_sel" ON "public"."calendrier" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "calendrier_sel_dashboard" ON "public"."calendrier" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "calendrier_wr_directeur" ON "public"."calendrier" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."categories_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chauffeurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chauffeurs_boyahbot_reader_sel" ON "public"."chauffeurs" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "chauffeurs_sel_dashboard" ON "public"."chauffeurs" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "chauffeurs_wr_directeur" ON "public"."chauffeurs" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."chauffeurs_yango_snapshot" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chauffeurs_yango_snapshot_boyahbot_reader_sel" ON "public"."chauffeurs_yango_snapshot" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "chauffeurs_yango_snapshot_boyahbot_writer_all" ON "public"."chauffeurs_yango_snapshot" TO "boyahbot_writer" USING (true) WITH CHECK (true);



CREATE POLICY "chauffeurs_yango_snapshot_sel_dashboard" ON "public"."chauffeurs_yango_snapshot" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "chauffeurs_yango_snapshot_wr_directeur" ON "public"."chauffeurs_yango_snapshot" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_boyahbot_reader_sel" ON "public"."clients" FOR SELECT TO "boyahbot_reader" USING (true);



ALTER TABLE "public"."clients_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_documents_boyahbot_reader_sel" ON "public"."clients_documents" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "clients_documents_sel_dashboard" ON "public"."clients_documents" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "clients_documents_wr_directeur" ON "public"."clients_documents" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



CREATE POLICY "clients_sel_dashboard" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "clients_wr_directeur" ON "public"."clients" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."clotures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cockpit_todos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cockpit_todos_delete_authenticated" ON "public"."cockpit_todos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "cockpit_todos_insert_authenticated" ON "public"."cockpit_todos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "cockpit_todos_read_authenticated" ON "public"."cockpit_todos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cockpit_todos_update_authenticated" ON "public"."cockpit_todos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."commandes_yango" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commandes_yango_boyahbot_reader_sel" ON "public"."commandes_yango" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "commandes_yango_sel_dashboard" ON "public"."commandes_yango" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "commandes_yango_wr_directeur" ON "public"."commandes_yango" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."comptes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comptes_syscohada" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."depenses_vehicules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "depenses_vehicules_boyahbot_reader_sel" ON "public"."depenses_vehicules" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "depenses_vehicules_sel_dashboard" ON "public"."depenses_vehicules" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "depenses_vehicules_wr_directeur" ON "public"."depenses_vehicules" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."bilan_mapping" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."caisses" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."categories_operations" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."clotures" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."comptes" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."comptes_syscohada" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."ecritures_comptables" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."etats_financiers_archives" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."exercices" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."journaux" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."justificatifs" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."lignes_ecritures" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."operations" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."parametres_module_compta" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."pieces_justificatives" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."societe_parametres" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."tiers" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



CREATE POLICY "directeur_full_access" ON "public"."transferts_internes" USING ("public"."is_directeur"()) WITH CHECK ("public"."is_directeur"());



ALTER TABLE "public"."ecritures_comptables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entretiens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entretiens_boyahbot_reader_sel" ON "public"."entretiens" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "entretiens_sel_dashboard" ON "public"."entretiens" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "entretiens_wr_directeur" ON "public"."entretiens" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."etats_financiers_archives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journaux" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jours_feries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jours_feries_boyahbot_reader_sel" ON "public"."jours_feries" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "jours_feries_sel_dashboard" ON "public"."jours_feries" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "jours_feries_wr_directeur" ON "public"."jours_feries" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."justificatifs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."justifications_versement" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "justifications_versement_boyahbot_reader_sel" ON "public"."justifications_versement" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "justifications_versement_sel_dashboard" ON "public"."justifications_versement" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "justifications_versement_wr_directeur" ON "public"."justifications_versement" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."lignes_ecritures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "logs_insert" ON "public"."activity_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "logs_select" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parametres_module_compta" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perms_all" ON "public"."role_permissions" TO "service_role" USING (true);



CREATE POLICY "perms_select" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."pieces_justificatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "service_role" USING (true);



ALTER TABLE "public"."recettes_wave" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recettes_wave_boyahbot_reader_sel" ON "public"."recettes_wave" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "recettes_wave_sel_dashboard" ON "public"."recettes_wave" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "recettes_wave_wr_directeur" ON "public"."recettes_wave" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."records_flotte" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "records_flotte_boyahbot_reader_sel" ON "public"."records_flotte" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "records_flotte_boyahbot_writer_all" ON "public"."records_flotte" TO "boyahbot_writer" USING (true) WITH CHECK (true);



CREATE POLICY "records_flotte_sel_dashboard" ON "public"."records_flotte" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "records_flotte_wr_directeur" ON "public"."records_flotte" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."societe_parametres" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."taches_suivi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taches_suivi_boyahbot_reader_sel" ON "public"."taches_suivi" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "taches_suivi_sel_dashboard" ON "public"."taches_suivi" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "taches_suivi_wr_directeur" ON "public"."taches_suivi" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transferts_internes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicules_boyahbot_reader_sel" ON "public"."vehicules" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "vehicules_sel_dashboard" ON "public"."vehicules" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "vehicules_wr_directeur" ON "public"."vehicules" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."versement_attribution" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "versement_attribution_boyahbot_reader_sel" ON "public"."versement_attribution" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "versement_attribution_sel_dashboard" ON "public"."versement_attribution" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "versement_attribution_wr_directeur" ON "public"."versement_attribution" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."versements_chauffeurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "versements_chauffeurs_boyahbot_reader_sel" ON "public"."versements_chauffeurs" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "versements_chauffeurs_sel_dashboard" ON "public"."versements_chauffeurs" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "versements_chauffeurs_wr_directeur" ON "public"."versements_chauffeurs" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());



ALTER TABLE "public"."versements_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wave_fr" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wave_fr_boyahbot_reader_sel" ON "public"."wave_fr" FOR SELECT TO "boyahbot_reader" USING (true);



CREATE POLICY "wave_fr_sel_dashboard" ON "public"."wave_fr" FOR SELECT TO "authenticated" USING ("public"."is_dashboard_user"());



CREATE POLICY "wave_fr_wr_directeur" ON "public"."wave_fr" TO "authenticated" USING ("public"."is_dashboard_directeur"()) WITH CHECK ("public"."is_dashboard_directeur"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."app_messages_patron";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."app_versements_mirror";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON SCHEMA "public" TO "boyahbot_reader";
GRANT USAGE ON SCHEMA "public" TO "boyahbot_writer";






















































































































































REVOKE ALL ON FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ajuster_resultat_exercice"("p_exercice_id" "uuid", "p_force_recalcul" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."app_chauffeur_home"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_chauffeur_home"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_chauffeur_home"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_chauffeur_home"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."app_chauffeur_login"("p_phone" "text", "p_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_chauffeur_login"("p_phone" "text", "p_pin" "text") TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."app_chauffeur_login"("p_phone" "text", "p_pin" "text") FROM "anon", "authenticated";



REVOKE ALL ON FUNCTION "public"."app_chauffeur_set_pin"("p_id_chauffeur" integer, "p_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_chauffeur_set_pin"("p_id_chauffeur" integer, "p_pin" "text") TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."app_chauffeur_set_pin"("p_id_chauffeur" integer, "p_pin" "text") FROM "anon", "authenticated";



REVOKE ALL ON FUNCTION "public"."app_chauffeur_verify_phone"("p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_chauffeur_verify_phone"("p_phone" "text") TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."app_chauffeur_verify_phone"("p_phone" "text") FROM "anon", "authenticated";



REVOKE ALL ON FUNCTION "public"."app_chauffeur_versements"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_chauffeur_versements"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."app_chauffeur_versements"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_chauffeur_versements"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."app_phone_last8"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."app_phone_last8"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_phone_last8"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."app_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."boyah_commission_for_month"("p_mois" "date", "p_commission" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."boyah_commission_for_month"("p_mois" "date", "p_commission" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."boyah_commission_for_month"("p_mois" "date", "p_commission" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."boyah_dashboard_stats"("p_commission" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."boyah_dashboard_stats"("p_commission" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."boyah_dashboard_stats"("p_commission" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."boyah_driver_stats"("p_commission" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."boyah_driver_stats"("p_commission" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."boyah_driver_stats"("p_commission" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cascade_operation_to_versement_client"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cascade_operation_to_versement_client"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_operation_to_versement_client"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_operation_to_versement_client"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cascade_recette_wave_to_operation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cascade_recette_wave_to_operation"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_recette_wave_to_operation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_recette_wave_to_operation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cascade_versement_client_to_operation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cascade_versement_client_to_operation"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_versement_client_to_operation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_versement_client_to_operation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_alerte_peut_envoyer"("p_type_alerte" "text", "p_cible" "text", "p_gravite" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_alerte_peut_envoyer"("p_type_alerte" "text", "p_cible" "text", "p_gravite" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_alerte_peut_envoyer"("p_type_alerte" "text", "p_cible" "text", "p_gravite" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_alerte_peut_envoyer"("p_type_alerte" "text", "p_cible" "text", "p_gravite" "text") TO "boyahbot_reader";



REVOKE ALL ON FUNCTION "public"."compta_unaccent_lite"("p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compta_unaccent_lite"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."compta_unaccent_lite"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compta_unaccent_lite"("p_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text", "p_email" "text", "p_adresse" "text", "p_raison_sociale" "text", "p_numero_rccm" "text", "p_numero_contribuable" "text", "p_suffix_manuel" "text", "p_notes" "text", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text", "p_email" "text", "p_adresse" "text", "p_raison_sociale" "text", "p_numero_rccm" "text", "p_numero_contribuable" "text", "p_suffix_manuel" "text", "p_notes" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text", "p_email" "text", "p_adresse" "text", "p_raison_sociale" "text", "p_numero_rccm" "text", "p_numero_contribuable" "text", "p_suffix_manuel" "text", "p_notes" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tiers"("p_nom" "text", "p_type" "text", "p_telephone" "text", "p_email" "text", "p_adresse" "text", "p_raison_sociale" "text", "p_numero_rccm" "text", "p_numero_contribuable" "text", "p_suffix_manuel" "text", "p_notes" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transfert_interne"("p_date" "date", "p_montant" numeric, "p_libelle" "text", "p_source_caisse_id" "uuid", "p_source_compte_id" "uuid", "p_dest_caisse_id" "uuid", "p_dest_compte_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock_ecriture"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock_ecriture"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock_ecriture"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock_ligne"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock_ligne"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_exercice_clos_lock_ligne"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_justificatif_required"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_justificatif_required"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_justificatif_required"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_tiers_suffix"("p_nom" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_tiers_suffix"("p_nom" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_tiers_suffix"("p_nom" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_tiers_suffix"("p_nom" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generer_ecriture_pour_operation"("p_op_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_dashboard_directeur"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_dashboard_directeur"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_dashboard_directeur"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dashboard_directeur"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_dashboard_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_dashboard_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_dashboard_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dashboard_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_directeur"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_directeur"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_directeur"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculer_resultat_exercice"("p_exercice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_exercice_id_on_operation"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_exercice_id_on_operation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_exercice_id_on_operation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_operation_to_legacy"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_operation_to_legacy"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_operation_to_legacy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_operation_to_legacy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verifier_equilibre_ecriture"() TO "anon";
GRANT ALL ON FUNCTION "public"."verifier_equilibre_ecriture"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verifier_equilibre_ecriture"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_etat_financier"("p_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_etat_financier"("p_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_etat_financier"("p_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_etat_financier"("p_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_etat_financier_by_short"("p_short" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."activity_logs" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."activity_logs_id_seq" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."affectation_chauffeurs_vehicules_id_affectation_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."affectation_chauffeurs_vehicules_id_affectation_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."affectation_chauffeurs_vehicules_id_affectation_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."affectation_chauffeurs_vehicules_id_affectation_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."affectation_chauffeurs_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."affectation_chauffeurs_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."affectation_chauffeurs_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."affectation_chauffeurs_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."agent_analyses" TO "anon";
GRANT ALL ON TABLE "public"."agent_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_analyses" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_analyses" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."agent_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_conversations" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."agent_memory" TO "anon";
GRANT ALL ON TABLE "public"."agent_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_memory" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_memory" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."ai_insights" TO "anon";
GRANT ALL ON TABLE "public"."ai_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_insights" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_insights" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."vehicules_id_vehicule_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vehicules_id_vehicule_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vehicules_id_vehicule_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."vehicules_id_vehicule_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."alerte_assurance" TO "anon";
GRANT ALL ON TABLE "public"."alerte_assurance" TO "authenticated";
GRANT ALL ON TABLE "public"."alerte_assurance" TO "service_role";
GRANT SELECT ON TABLE "public"."alerte_assurance" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."alerte_pneus" TO "anon";
GRANT ALL ON TABLE "public"."alerte_pneus" TO "authenticated";
GRANT ALL ON TABLE "public"."alerte_pneus" TO "service_role";
GRANT SELECT ON TABLE "public"."alerte_pneus" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."alerte_vidange" TO "anon";
GRANT ALL ON TABLE "public"."alerte_vidange" TO "authenticated";
GRANT ALL ON TABLE "public"."alerte_vidange" TO "service_role";
GRANT SELECT ON TABLE "public"."alerte_vidange" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."alerte_visite_technique" TO "anon";
GRANT ALL ON TABLE "public"."alerte_visite_technique" TO "authenticated";
GRANT ALL ON TABLE "public"."alerte_visite_technique" TO "service_role";
GRANT SELECT ON TABLE "public"."alerte_visite_technique" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."alertes_envoyees" TO "anon";
GRANT ALL ON TABLE "public"."alertes_envoyees" TO "authenticated";
GRANT ALL ON TABLE "public"."alertes_envoyees" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."alertes_envoyees" TO "boyahbot_reader";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."alertes_envoyees" TO "boyahbot_writer";



GRANT ALL ON SEQUENCE "public"."alertes_envoyees_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."alertes_envoyees_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."alertes_envoyees_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."alertes_envoyees_id_seq" TO "boyahbot_reader";
GRANT SELECT,USAGE ON SEQUENCE "public"."alertes_envoyees_id_seq" TO "boyahbot_writer";



GRANT ALL ON TABLE "public"."alertes_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."alertes_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."alertes_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."alertes_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."app_chauffeur_auth" TO "anon";
GRANT ALL ON TABLE "public"."app_chauffeur_auth" TO "authenticated";
GRANT ALL ON TABLE "public"."app_chauffeur_auth" TO "service_role";
GRANT SELECT ON TABLE "public"."app_chauffeur_auth" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."app_chauffeur_finances" TO "anon";
GRANT ALL ON TABLE "public"."app_chauffeur_finances" TO "authenticated";
GRANT ALL ON TABLE "public"."app_chauffeur_finances" TO "service_role";
GRANT SELECT ON TABLE "public"."app_chauffeur_finances" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."app_messages_patron" TO "anon";
GRANT ALL ON TABLE "public"."app_messages_patron" TO "authenticated";
GRANT ALL ON TABLE "public"."app_messages_patron" TO "service_role";
GRANT SELECT ON TABLE "public"."app_messages_patron" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."app_support_conversations" TO "anon";
GRANT ALL ON TABLE "public"."app_support_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."app_support_conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."app_support_conversations" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."app_support_messages" TO "anon";
GRANT ALL ON TABLE "public"."app_support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."app_support_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."app_support_messages" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."app_versements_mirror" TO "anon";
GRANT ALL ON TABLE "public"."app_versements_mirror" TO "authenticated";
GRANT ALL ON TABLE "public"."app_versements_mirror" TO "service_role";
GRANT SELECT ON TABLE "public"."app_versements_mirror" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."bilan_mapping" TO "anon";
GRANT ALL ON TABLE "public"."bilan_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."bilan_mapping" TO "service_role";
GRANT SELECT ON TABLE "public"."bilan_mapping" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."boyahbot_memory" TO "anon";
GRANT ALL ON TABLE "public"."boyahbot_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."boyahbot_memory" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."boyahbot_memory" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."boyahbot_memory_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."boyahbot_memory_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."boyahbot_memory_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."boyahbot_memory_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."caisses" TO "anon";
GRANT ALL ON TABLE "public"."caisses" TO "authenticated";
GRANT ALL ON TABLE "public"."caisses" TO "service_role";
GRANT SELECT ON TABLE "public"."caisses" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."calendrier" TO "anon";
GRANT ALL ON TABLE "public"."calendrier" TO "authenticated";
GRANT ALL ON TABLE "public"."calendrier" TO "service_role";
GRANT SELECT ON TABLE "public"."calendrier" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."categories_operations" TO "anon";
GRANT ALL ON TABLE "public"."categories_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."categories_operations" TO "service_role";
GRANT SELECT ON TABLE "public"."categories_operations" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."chauffeurs_id_chauffeur_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chauffeurs_id_chauffeur_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chauffeurs_id_chauffeur_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."chauffeurs_id_chauffeur_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."chauffeurs" TO "anon";
GRANT ALL ON TABLE "public"."chauffeurs" TO "authenticated";
GRANT ALL ON TABLE "public"."chauffeurs" TO "service_role";
GRANT SELECT ON TABLE "public"."chauffeurs" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."recettes_wave" TO "anon";
GRANT ALL ON TABLE "public"."recettes_wave" TO "authenticated";
GRANT ALL ON TABLE "public"."recettes_wave" TO "service_role";
GRANT SELECT ON TABLE "public"."recettes_wave" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."chauffeurs_actifs" TO "anon";
GRANT ALL ON TABLE "public"."chauffeurs_actifs" TO "authenticated";
GRANT ALL ON TABLE "public"."chauffeurs_actifs" TO "service_role";
GRANT SELECT ON TABLE "public"."chauffeurs_actifs" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."chauffeurs_inactifs" TO "anon";
GRANT ALL ON TABLE "public"."chauffeurs_inactifs" TO "authenticated";
GRANT ALL ON TABLE "public"."chauffeurs_inactifs" TO "service_role";
GRANT SELECT ON TABLE "public"."chauffeurs_inactifs" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."chauffeurs_yango_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."chauffeurs_yango_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."chauffeurs_yango_snapshot" TO "service_role";
GRANT SELECT ON TABLE "public"."chauffeurs_yango_snapshot" TO "boyahbot_reader";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."chauffeurs_yango_snapshot" TO "boyahbot_writer";



GRANT ALL ON SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" TO "boyahbot_reader";
GRANT SELECT,USAGE ON SEQUENCE "public"."chauffeurs_yango_snapshot_id_seq" TO "boyahbot_writer";



GRANT ALL ON TABLE "public"."classement_chauffeurs" TO "anon";
GRANT ALL ON TABLE "public"."classement_chauffeurs" TO "authenticated";
GRANT ALL ON TABLE "public"."classement_chauffeurs" TO "service_role";
GRANT SELECT ON TABLE "public"."classement_chauffeurs" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";
GRANT SELECT ON TABLE "public"."clients" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."clients_documents" TO "anon";
GRANT ALL ON TABLE "public"."clients_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."clients_documents" TO "service_role";
GRANT SELECT ON TABLE "public"."clients_documents" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."clients_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."clotures" TO "anon";
GRANT ALL ON TABLE "public"."clotures" TO "authenticated";
GRANT ALL ON TABLE "public"."clotures" TO "service_role";
GRANT SELECT ON TABLE "public"."clotures" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."cockpit_todos" TO "anon";
GRANT ALL ON TABLE "public"."cockpit_todos" TO "authenticated";
GRANT ALL ON TABLE "public"."cockpit_todos" TO "service_role";
GRANT SELECT ON TABLE "public"."cockpit_todos" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."commandes_yango" TO "anon";
GRANT ALL ON TABLE "public"."commandes_yango" TO "authenticated";
GRANT ALL ON TABLE "public"."commandes_yango" TO "service_role";
GRANT SELECT ON TABLE "public"."commandes_yango" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."comptes" TO "anon";
GRANT ALL ON TABLE "public"."comptes" TO "authenticated";
GRANT ALL ON TABLE "public"."comptes" TO "service_role";
GRANT SELECT ON TABLE "public"."comptes" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."comptes_syscohada" TO "anon";
GRANT ALL ON TABLE "public"."comptes_syscohada" TO "authenticated";
GRANT ALL ON TABLE "public"."comptes_syscohada" TO "service_role";
GRANT SELECT ON TABLE "public"."comptes_syscohada" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."depenses_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."depenses_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."depenses_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."depenses_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."cout_reel_vehicule" TO "anon";
GRANT ALL ON TABLE "public"."cout_reel_vehicule" TO "authenticated";
GRANT ALL ON TABLE "public"."cout_reel_vehicule" TO "service_role";
GRANT SELECT ON TABLE "public"."cout_reel_vehicule" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."depenses_anormales" TO "anon";
GRANT ALL ON TABLE "public"."depenses_anormales" TO "authenticated";
GRANT ALL ON TABLE "public"."depenses_anormales" TO "service_role";
GRANT SELECT ON TABLE "public"."depenses_anormales" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."depenses_recurrentes" TO "anon";
GRANT ALL ON TABLE "public"."depenses_recurrentes" TO "authenticated";
GRANT ALL ON TABLE "public"."depenses_recurrentes" TO "service_role";
GRANT SELECT ON TABLE "public"."depenses_recurrentes" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."ecritures_comptables" TO "anon";
GRANT ALL ON TABLE "public"."ecritures_comptables" TO "authenticated";
GRANT ALL ON TABLE "public"."ecritures_comptables" TO "service_role";
GRANT SELECT ON TABLE "public"."ecritures_comptables" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."entretiens" TO "anon";
GRANT ALL ON TABLE "public"."entretiens" TO "authenticated";
GRANT ALL ON TABLE "public"."entretiens" TO "service_role";
GRANT SELECT ON TABLE "public"."entretiens" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."etats_financiers_archives" TO "anon";
GRANT ALL ON TABLE "public"."etats_financiers_archives" TO "authenticated";
GRANT ALL ON TABLE "public"."etats_financiers_archives" TO "service_role";
GRANT SELECT ON TABLE "public"."etats_financiers_archives" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."exercices" TO "anon";
GRANT ALL ON TABLE "public"."exercices" TO "authenticated";
GRANT ALL ON TABLE "public"."exercices" TO "service_role";
GRANT SELECT ON TABLE "public"."exercices" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."journaux" TO "anon";
GRANT ALL ON TABLE "public"."journaux" TO "authenticated";
GRANT ALL ON TABLE "public"."journaux" TO "service_role";
GRANT SELECT ON TABLE "public"."journaux" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."jours_feries" TO "anon";
GRANT ALL ON TABLE "public"."jours_feries" TO "authenticated";
GRANT ALL ON TABLE "public"."jours_feries" TO "service_role";
GRANT SELECT ON TABLE "public"."jours_feries" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."justificatifs" TO "anon";
GRANT ALL ON TABLE "public"."justificatifs" TO "authenticated";
GRANT ALL ON TABLE "public"."justificatifs" TO "service_role";
GRANT SELECT ON TABLE "public"."justificatifs" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."justifications_versement" TO "anon";
GRANT ALL ON TABLE "public"."justifications_versement" TO "authenticated";
GRANT ALL ON TABLE "public"."justifications_versement" TO "service_role";
GRANT SELECT ON TABLE "public"."justifications_versement" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."lignes_ecritures" TO "anon";
GRANT ALL ON TABLE "public"."lignes_ecritures" TO "authenticated";
GRANT ALL ON TABLE "public"."lignes_ecritures" TO "service_role";
GRANT SELECT ON TABLE "public"."lignes_ecritures" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."operations" TO "anon";
GRANT ALL ON TABLE "public"."operations" TO "authenticated";
GRANT ALL ON TABLE "public"."operations" TO "service_role";
GRANT SELECT ON TABLE "public"."operations" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."parametres_module_compta" TO "anon";
GRANT ALL ON TABLE "public"."parametres_module_compta" TO "authenticated";
GRANT ALL ON TABLE "public"."parametres_module_compta" TO "service_role";
GRANT SELECT ON TABLE "public"."parametres_module_compta" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."pieces_justificatives" TO "anon";
GRANT ALL ON TABLE "public"."pieces_justificatives" TO "authenticated";
GRANT ALL ON TABLE "public"."pieces_justificatives" TO "service_role";
GRANT SELECT ON TABLE "public"."pieces_justificatives" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_mensuel" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_mensuel" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_mensuel" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_mensuel" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."prevision_ca_mensuel" TO "anon";
GRANT ALL ON TABLE "public"."prevision_ca_mensuel" TO "authenticated";
GRANT ALL ON TABLE "public"."prevision_ca_mensuel" TO "service_role";
GRANT SELECT ON TABLE "public"."prevision_ca_mensuel" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_mensuelles" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_mensuelles" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_mensuelles" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_mensuelles" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."prevision_depenses" TO "anon";
GRANT ALL ON TABLE "public"."prevision_depenses" TO "authenticated";
GRANT ALL ON TABLE "public"."prevision_depenses" TO "service_role";
GRANT SELECT ON TABLE "public"."prevision_depenses" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."recettes_wave_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recettes_wave_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recettes_wave_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."recettes_wave_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."records_flotte" TO "anon";
GRANT ALL ON TABLE "public"."records_flotte" TO "authenticated";
GRANT ALL ON TABLE "public"."records_flotte" TO "service_role";
GRANT SELECT ON TABLE "public"."records_flotte" TO "boyahbot_reader";
GRANT SELECT,UPDATE ON TABLE "public"."records_flotte" TO "boyahbot_writer";



GRANT ALL ON SEQUENCE "public"."records_flotte_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."records_flotte_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."records_flotte_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."records_flotte_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."role_permissions" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."role_permissions_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."societe_parametres" TO "anon";
GRANT ALL ON TABLE "public"."societe_parametres" TO "authenticated";
GRANT ALL ON TABLE "public"."societe_parametres" TO "service_role";
GRANT SELECT ON TABLE "public"."societe_parametres" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."taches_suivi" TO "anon";
GRANT ALL ON TABLE "public"."taches_suivi" TO "authenticated";
GRANT ALL ON TABLE "public"."taches_suivi" TO "service_role";
GRANT SELECT ON TABLE "public"."taches_suivi" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."tiers" TO "anon";
GRANT ALL ON TABLE "public"."tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."tiers" TO "service_role";
GRANT SELECT ON TABLE "public"."tiers" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."transferts_internes" TO "anon";
GRANT ALL ON TABLE "public"."transferts_internes" TO "authenticated";
GRANT ALL ON TABLE "public"."transferts_internes" TO "service_role";
GRANT SELECT ON TABLE "public"."transferts_internes" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."versement_attribution" TO "anon";
GRANT ALL ON TABLE "public"."versement_attribution" TO "authenticated";
GRANT ALL ON TABLE "public"."versement_attribution" TO "service_role";
GRANT SELECT ON TABLE "public"."versement_attribution" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."versements_chauffeurs" TO "anon";
GRANT ALL ON TABLE "public"."versements_chauffeurs" TO "authenticated";
GRANT ALL ON TABLE "public"."versements_chauffeurs" TO "service_role";
GRANT SELECT ON TABLE "public"."versements_chauffeurs" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."versements_chauffeurs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."versements_chauffeurs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."versements_chauffeurs_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."versements_chauffeurs_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."versements_clients" TO "anon";
GRANT ALL ON TABLE "public"."versements_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."versements_clients" TO "service_role";
GRANT SELECT ON TABLE "public"."versements_clients" TO "boyahbot_reader";



GRANT ALL ON SEQUENCE "public"."versements_clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."versements_clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."versements_clients_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."versements_clients_id_seq" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_chauffeur_jour" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_chauffeur_jour" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_chauffeur_jour" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_chauffeur_jour" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_journalier" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_journalier" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_journalier" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_journalier" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_recettes_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vue_recettes_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_recettes_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_recettes_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_vehicule_aujourdhui" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_vehicule_aujourdhui" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_vehicule_aujourdhui" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_vehicule_aujourdhui" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_vehicule_jour" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_vehicule_jour" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_vehicule_jour" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_vehicule_jour" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_vehicule_mois" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_vehicule_mois" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_vehicule_mois" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_vehicule_mois" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_ca_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vue_ca_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_ca_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_ca_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_chauffeurs_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vue_chauffeurs_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_chauffeurs_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_chauffeurs_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_dashboard_depenses" TO "anon";
GRANT ALL ON TABLE "public"."vue_dashboard_depenses" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_dashboard_depenses" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_dashboard_depenses" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_dashboard_recettes" TO "anon";
GRANT ALL ON TABLE "public"."vue_dashboard_recettes" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_dashboard_recettes" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_dashboard_recettes" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_dashboard_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vue_dashboard_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_dashboard_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_dashboard_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_aujourdhui" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_aujourdhui" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_aujourdhui" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_aujourdhui" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_categories" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_categories" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_journalieres" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_journalieres" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_journalieres" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_journalieres" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_mois" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_mois" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_mois" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_mois" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_par_categorie" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_par_categorie" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_par_categorie" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_par_categorie" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_depenses_par_vehicule" TO "anon";
GRANT ALL ON TABLE "public"."vue_depenses_par_vehicule" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_depenses_par_vehicule" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_depenses_par_vehicule" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_objectif_vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vue_objectif_vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_objectif_vehicules" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_objectif_vehicules" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_profit_journalier" TO "anon";
GRANT ALL ON TABLE "public"."vue_profit_journalier" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_profit_journalier" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_profit_journalier" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_recettes_chauffeurs" TO "anon";
GRANT ALL ON TABLE "public"."vue_recettes_chauffeurs" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_recettes_chauffeurs" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_recettes_chauffeurs" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_top_vehicule_depenses" TO "anon";
GRANT ALL ON TABLE "public"."vue_top_vehicule_depenses" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_top_vehicule_depenses" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_top_vehicule_depenses" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."vue_voitures_payees" TO "anon";
GRANT ALL ON TABLE "public"."vue_voitures_payees" TO "authenticated";
GRANT ALL ON TABLE "public"."vue_voitures_payees" TO "service_role";
GRANT SELECT ON TABLE "public"."vue_voitures_payees" TO "boyahbot_reader";



GRANT ALL ON TABLE "public"."wave_fr" TO "anon";
GRANT ALL ON TABLE "public"."wave_fr" TO "authenticated";
GRANT ALL ON TABLE "public"."wave_fr" TO "service_role";
GRANT SELECT ON TABLE "public"."wave_fr" TO "boyahbot_reader";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON SEQUENCES TO "boyahbot_reader";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "boyahbot_reader";
































-- =============================================================================
-- STORAGE (schema storage — hors pg_dump public ; reinjecte a l'identique)
-- 8 buckets + 28 policies storage.objects (etat prod 12/06/2026, collecte MCP).
-- Place APRES le corps car les policies referencent public.is_directeur().
-- search_path est '' a ce stade (SET du dump) -> on QUALIFIE tout explicitement.
--
-- DETTE P2 (fidelite voulue) :
--   - bucket 'avatars' : 9 policies redondantes (empilees historiquement) ->
--     reproduites TELLES QUELLES ; a consolider plus tard.
--   - buckets 'chauffeurs' et 'clients-docs' : AUCUNE policy (acces service_role
--     + flag public) -> normal, rien a ajouter.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('app-chauffeurs-media', 'app-chauffeurs-media', false, null,     null),
  ('avatars',              'avatars',              true,  null,     null),
  ('chauffeurs',           'chauffeurs',           true,  null,     null),
  ('clients-docs',         'clients-docs',         false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('justificatifs',        'justificatifs',        false, 5242880,  array['application/pdf','image/jpeg','image/png']),
  ('logos',                'logos',                false, 2097152,  array['image/png','image/jpeg','image/svg+xml']),
  ('pieces-comptables',    'pieces-comptables',    false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('vehicules',            'vehicules',            true,  null,     null)
on conflict (id) do nothing;

-- ── avatars (9 — redondantes, fidelite) ──────────────────────────────────────
create policy "Avatars public read"            on storage.objects for select to public        using (bucket_id = 'avatars');
create policy "Avatars service delete"         on storage.objects for delete to public        using (bucket_id = 'avatars');
create policy "Avatars service update"         on storage.objects for update to public        using (bucket_id = 'avatars');
create policy "Avatars service upload"         on storage.objects for insert to public        with check (bucket_id = 'avatars');
create policy "Public can view avatars"        on storage.objects for select to public        using (bucket_id = 'avatars');
create policy "Users can update their avatar"  on storage.objects for update to authenticated using (bucket_id = 'avatars');
create policy "Users can upload their avatar"  on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "authenticated_insert_avatars_storage" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "authenticated_update_avatars_storage" on storage.objects for update to authenticated using (bucket_id = 'avatars');
create policy "public_read_avatars_storage"    on storage.objects for select to public        using (bucket_id = 'avatars');

-- ── vehicules (4) ────────────────────────────────────────────────────────────
create policy "authenticated_insert_vehicules_storage" on storage.objects for insert to authenticated with check (bucket_id = 'vehicules');
create policy "authenticated_update_vehicules_storage" on storage.objects for update to authenticated using (bucket_id = 'vehicules');
create policy "authenticated_delete_vehicules_storage" on storage.objects for delete to authenticated using (bucket_id = 'vehicules');
create policy "public_read_vehicules_storage"          on storage.objects for select to public        using (bucket_id = 'vehicules');

-- ── app-chauffeurs-media (2, scopees par claim id_chauffeur) ─────────────────
create policy "app_media_select" on storage.objects for select to authenticated
  using (bucket_id = 'app-chauffeurs-media' and (storage.foldername(name))[1] = (auth.jwt() ->> 'id_chauffeur'));
create policy "app_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-chauffeurs-media' and (storage.foldername(name))[1] = (auth.jwt() ->> 'id_chauffeur'));

-- ── justificatifs (4, gated public.is_directeur()) ───────────────────────────
create policy "justificatifs_select" on storage.objects for select to public using (bucket_id = 'justificatifs' and public.is_directeur());
create policy "justificatifs_insert" on storage.objects for insert to public with check (bucket_id = 'justificatifs' and public.is_directeur());
create policy "justificatifs_update" on storage.objects for update to public using (bucket_id = 'justificatifs' and public.is_directeur()) with check (bucket_id = 'justificatifs' and public.is_directeur());
create policy "justificatifs_delete" on storage.objects for delete to public using (bucket_id = 'justificatifs' and public.is_directeur());

-- ── logos (4, gated public.is_directeur()) ───────────────────────────────────
create policy "logos_select" on storage.objects for select to public using (bucket_id = 'logos' and public.is_directeur());
create policy "logos_insert" on storage.objects for insert to public with check (bucket_id = 'logos' and public.is_directeur());
create policy "logos_update" on storage.objects for update to public using (bucket_id = 'logos' and public.is_directeur()) with check (bucket_id = 'logos' and public.is_directeur());
create policy "logos_delete" on storage.objects for delete to public using (bucket_id = 'logos' and public.is_directeur());

-- ── pieces-comptables (4, gated public.is_directeur()) ───────────────────────
create policy "pieces_comptables_select" on storage.objects for select to public using (bucket_id = 'pieces-comptables' and public.is_directeur());
create policy "pieces_comptables_insert" on storage.objects for insert to public with check (bucket_id = 'pieces-comptables' and public.is_directeur());
create policy "pieces_comptables_update" on storage.objects for update to public using (bucket_id = 'pieces-comptables' and public.is_directeur()) with check (bucket_id = 'pieces-comptables' and public.is_directeur());
create policy "pieces_comptables_delete" on storage.objects for delete to public using (bucket_id = 'pieces-comptables' and public.is_directeur());

-- =============================================================================
-- FIN BASELINE
-- =============================================================================
