-- =============================================================================
-- AUTO-TEST TRANSACTIONNEL du correctif P0-1 (RLS) — À LANCER EN PROD PAR TOI.
-- Projet Fleet (iixpsfsqyfnllggvsvfl).
--
-- GARANTIES :
--   * UNE seule transaction : BEGIN ... ROLLBACK. AUCUN COMMIT. Rien ne persiste.
--   * SET LOCAL statement_timeout = '5s' (aucun verrou long).
--   * SET LOCAL ROLE (borné à la transaction) pour tester sous chaque rôle.
--   * Applique le correctif EN MÉMOIRE, exécute les tests témoins sur les VRAIES
--     données + VRAIS rôles, imprime PASS/FAIL, puis ROLLBACK tout.
--
-- COMMENT LIRE : exécute le script en entier (psql : `psql -f`, ou Studio SQL
--   editor) puis lis les messages NOTICE (psql les affiche ; en Studio,
--   onglet "Messages"/"Logs"). Tous les tests doivent afficher [PASS].
-- APRÈS : lance la section "VÉRIF NON-PERSISTANCE" tout en bas (hors transaction)
--   pour prouver que rien n'a survécu.
-- =============================================================================

BEGIN;
SET LOCAL statement_timeout = '5s';

-- Permet à la session courante de SET ROLE vers les rôles bot (rollback-é).
DO $g$
begin
  execute 'grant boyahbot_reader to ' || quote_ident(current_user);
  execute 'grant boyahbot_writer to ' || quote_ident(current_user);
exception when others then
  raise notice 'note: grant des roles bot impossible (%). Lance le script en role postgres.', sqlerrm;
end
$g$;

-- 0) BASELINES (rôle privilégié courant : RLS-immune) -------------------------
create temp table _b on commit drop as
select
  (select count(*) from public.clients)                                         as clients,
  (select count(*) from public.vehicules where sous_gestion is true)            as veh_sg,
  (select count(*) from public.commandes_yango)                                 as cmd,
  (select count(*) from public.vue_recettes_vehicules)                          as vrv,
  (select count(*) from public.entretiens where huile_moteur is true)           as entr_huile,
  (select count(*) from public.alertes_envoyees)                                as alertes,
  (select count(*) from public.versements_clients
     where mois = to_char((now() at time zone 'UTC') - interval '1 month','YYYY-MM')) as vers_m1;

-- =============================================================================
-- APPLY (identique à RLS_P0-1_apply.sql, sans BEGIN/COMMIT)
-- =============================================================================
create or replace function public.is_dashboard_user()
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp as $fn$
declare v_uid uuid;
begin
  begin v_uid := auth.uid(); exception when others then return false; end;
  if v_uid is null then return false; end if;
  return exists (select 1 from public.profiles p where p.id = v_uid);
end $fn$;
revoke all on function public.is_dashboard_user() from public;
grant execute on function public.is_dashboard_user() to authenticated, service_role;

-- Helper directeur GARDÉ (cast uuid protégé) — voir RLS_P0-1_apply.sql §1 bis.
create or replace function public.is_dashboard_directeur()
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp as $fnd$
declare v_uid uuid;
begin
  begin v_uid := auth.uid(); exception when others then return false; end;
  if v_uid is null then return false; end if;
  return exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'directeur');
end $fnd$;
revoke all on function public.is_dashboard_directeur() from public;
grant execute on function public.is_dashboard_directeur() to authenticated, service_role;

do $do$
declare t text;
  fleet text[] := array['clients','vehicules','chauffeurs','recettes_wave','depenses_vehicules',
    'versement_attribution','commandes_yango','justifications_versement','jours_feries','entretiens',
    'affectation_chauffeurs_vehicules','taches_suivi','versements_chauffeurs','calendrier','wave_fr',
    'clients_documents','chauffeurs_yango_snapshot','records_flotte','alertes_envoyees'];
begin
  foreach t in array fleet loop
    execute format('drop policy if exists %I on public.%I', t||'_sel_dashboard', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_dashboard_user())', t||'_sel_dashboard', t);
    execute format('drop policy if exists %I on public.%I', t||'_wr_directeur', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_dashboard_directeur()) with check (public.is_dashboard_directeur())', t||'_wr_directeur', t);
  end loop;
end $do$;

do $do$
declare t text;
  bot_read text[] := array['clients','vehicules','chauffeurs','recettes_wave','depenses_vehicules',
    'versement_attribution','commandes_yango','justifications_versement','jours_feries','entretiens',
    'affectation_chauffeurs_vehicules','taches_suivi','versements_chauffeurs','calendrier','wave_fr',
    'clients_documents','chauffeurs_yango_snapshot','records_flotte',
    'agent_analyses','agent_conversations','agent_memory'];
begin
  foreach t in array bot_read loop
    execute format('drop policy if exists %I on public.%I', t||'_boyahbot_reader_sel', t);
    execute format('create policy %I on public.%I for select to boyahbot_reader using (true)', t||'_boyahbot_reader_sel', t);
  end loop;
end $do$;

drop policy if exists alertes_envoyees_boyahbot_reader_all on public.alertes_envoyees;
create policy alertes_envoyees_boyahbot_reader_all on public.alertes_envoyees
  for all to boyahbot_reader using (true) with check (true);
drop policy if exists boyahbot_memory_boyahbot_reader_all on public.boyahbot_memory;
create policy boyahbot_memory_boyahbot_reader_all on public.boyahbot_memory
  for all to boyahbot_reader using (true) with check (true);

do $do$
declare t text;
  bot_write text[] := array['alertes_envoyees','chauffeurs_yango_snapshot','records_flotte'];
begin
  foreach t in array bot_write loop
    execute format('drop policy if exists %I on public.%I', t||'_boyahbot_writer_all', t);
    execute format('create policy %I on public.%I for all to boyahbot_writer using (true) with check (true)', t||'_boyahbot_writer_all', t);
  end loop;
end $do$;

do $do$
declare v text;
  views text[] := array['alerte_assurance','alerte_pneus','alerte_vidange','alerte_visite_technique',
    'alertes_vehicules','chauffeurs_actifs','chauffeurs_inactifs','classement_chauffeurs','cout_reel_vehicule',
    'depenses_anormales','depenses_recurrentes','prevision_ca_mensuel','prevision_depenses','vue_ca_chauffeur_jour',
    'vue_ca_journalier','vue_ca_mensuel','vue_ca_vehicule_aujourdhui','vue_ca_vehicule_jour','vue_ca_vehicule_mois',
    'vue_ca_vehicules','vue_chauffeurs_vehicules','vue_dashboard_depenses','vue_dashboard_recettes','vue_dashboard_vehicules',
    'vue_depenses_aujourdhui','vue_depenses_categories','vue_depenses_journalieres','vue_depenses_mensuelles','vue_depenses_mois',
    'vue_depenses_par_categorie','vue_depenses_par_vehicule','vue_objectif_vehicules','vue_profit_journalier',
    'vue_recettes_chauffeurs','vue_recettes_vehicules','vue_top_vehicule_depenses','vue_voitures_payees'];
begin
  foreach v in array views loop
    execute format('alter view public.%I set (security_invoker = on)', v);
  end loop;
end $do$;

-- DROP des policies legacy permissives (correctif du FAIL T5a) AVANT l'ENABLE.
-- Sinon authenticated_all_* (USING(true) TO authenticated) s'additionne en OR et
-- rouvre la fuite aux tokens authenticated/chauffeur une fois la RLS active.
drop policy if exists authenticated_all_clients    on public.clients;
drop policy if exists authenticated_all_vehicules  on public.vehicules;
drop policy if exists authenticated_all_chauffeurs on public.chauffeurs;

do $do$
declare t text;
  tbls text[] := array['clients','vehicules','chauffeurs','recettes_wave','depenses_vehicules',
    'versement_attribution','commandes_yango','justifications_versement','jours_feries','entretiens',
    'affectation_chauffeurs_vehicules','taches_suivi','versements_chauffeurs','calendrier','wave_fr',
    'clients_documents','chauffeurs_yango_snapshot','records_flotte','alertes_envoyees',
    'agent_analyses','agent_conversations','agent_memory','boyahbot_memory'];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $do$;

-- =============================================================================
-- TESTS TÉMOINS (sous chaque rôle). Chaque test est isolé : une erreur -> FAIL,
-- mais la transaction continue (et finira par ROLLBACK).
-- =============================================================================
DO $t$
declare
  b   record;
  got int;
  r   jsonb;
begin
  select * into b from _b;
  raise notice '=== BASELINE: clients=% veh_sg=% cmd=% vrv=% entr_huile=% alertes=% vers_m1=% ===',
    b.clients, b.veh_sg, b.cmd, b.vrv, b.entr_huile, b.alertes, b.vers_m1;

  -- T1 ANON : ne voit rien (fuite colmatée) -------------------------------
  begin
    execute 'set local role anon';
    perform set_config('request.jwt.claims', null, true);
    got := (select count(*) from public.clients);
    raise notice '[%] T1a anon SELECT clients = % (attendu 0)', case when got=0 then 'PASS' else 'FAIL' end, got;
    got := (select count(*) from public.vue_recettes_vehicules);
    raise notice '[%] T1b anon SELECT vue_recettes_vehicules = % (attendu 0)', case when got=0 then 'PASS' else 'FAIL' end, got;
    reset role;
  exception when others then reset role; raise notice '[FAIL] T1 anon : %', sqlerrm; end;

  -- T2 boyahbot_reader : MÊMES comptes qu'à la baseline ---------------------
  begin
    execute 'set local role boyahbot_reader';
    got := (select count(*) from public.clients);
    raise notice '[%] T2a reader clients = % (attendu %)', case when got=b.clients then 'PASS' else 'FAIL' end, got, b.clients;
    got := (select count(*) from public.vehicules where sous_gestion is true);
    raise notice '[%] T2b reader vehicules sous_gestion = % (attendu %)', case when got=b.veh_sg then 'PASS' else 'FAIL' end, got, b.veh_sg;
    got := (select count(*) from public.commandes_yango);
    raise notice '[%] T2c reader commandes_yango = % (attendu %)', case when got=b.cmd then 'PASS' else 'FAIL' end, got, b.cmd;
    got := (select count(*) from public.vue_recettes_vehicules);
    raise notice '[%] T2d reader vue_recettes_vehicules = % (attendu %)', case when got=b.vrv then 'PASS' else 'FAIL' end, got, b.vrv;
    got := (select count(*) from public.entretiens where huile_moteur is true);
    raise notice '[%] T2e reader entretiens huile_moteur = % (attendu %)', case when got=b.entr_huile then 'PASS' else 'FAIL' end, got, b.entr_huile;
    got := (select count(*) from public.alertes_envoyees);
    raise notice '[%] T2f reader alertes_envoyees = % (attendu %)', case when got=b.alertes then 'PASS' else 'FAIL' end, got, b.alertes;
    reset role;
  exception when others then reset role; raise notice '[FAIL] T2 boyahbot_reader : %', sqlerrm; end;

  -- T3 boyahbot_writer : INSERT alertes_envoyees OK ; ne lit pas clients -----
  begin
    execute 'set local role boyahbot_writer';
    begin
      insert into public.alertes_envoyees(type_alerte,gravite,cible,message_envoye,statut)
      values ('_selftest_rls','info','_selftest','_selftest','envoyee');
      raise notice '[PASS] T3a writer INSERT alertes_envoyees OK (autorisé par RLS)';
    exception
      when insufficient_privilege then raise notice '[FAIL] T3a writer INSERT bloqué par la RLS : %', sqlerrm;
      when others then raise notice '[PASS] T3a writer INSERT passe la RLS (arrêté par une contrainte non-RLS : %)', sqlerrm;
    end;
    -- Le writer n'a pas de GRANT SELECT sur clients -> "permission denied" (avant
    -- meme l'evaluation RLS). C'est PLUS strict que "0 ligne" = comportement voulu.
    begin
      got := (select count(*) from public.clients);
      raise notice '[%] T3b writer SELECT clients = % (attendu 0 ou permission denied)', case when got=0 then 'PASS' else 'FAIL' end, got;
    exception when insufficient_privilege then
      raise notice '[PASS] T3b writer SELECT clients -> permission denied (plus strict que 0 ligne, OK)';
    end;
    reset role;
  exception when others then reset role; raise notice '[FAIL] T3 boyahbot_writer : %', sqlerrm; end;

  -- T4 DASHBOARD (directeur) : voit tout comme la baseline ------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"b9906ac7-79f2-4cd1-836f-9cc97609e5df","role":"authenticated"}', true);
    got := (select count(*) from public.clients);
    raise notice '[%] T4a dashboard(directeur) clients = % (attendu %)', case when got=b.clients then 'PASS' else 'FAIL' end, got, b.clients;
    got := (select count(*) from public.vue_recettes_vehicules);
    raise notice '[%] T4b dashboard vue_recettes_vehicules = % (attendu %)', case when got=b.vrv then 'PASS' else 'FAIL' end, got, b.vrv;
    got := (select count(*) from public.versements_clients
              where mois = to_char((now() at time zone 'UTC') - interval '1 month','YYYY-MM'));
    raise notice '[%] T4c dashboard versements_clients M-1 = % (attendu %)', case when got=b.vers_m1 then 'PASS' else 'FAIL' end, got, b.vers_m1;
    reset role;
    perform set_config('request.jwt.claims', null, true);
  exception when others then reset role; raise notice '[FAIL] T4 dashboard : %', sqlerrm; end;

  -- T5 TOKEN CHAUFFEUR (authenticated + id_chauffeur entier) ----------------
  --    -> ne doit RIEN voir des tables flotte (is_dashboard_user=false)
  --    -> mais les RPC SECURITY DEFINER doivent continuer de répondre.
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"6","role":"authenticated","id_chauffeur":6}', true);
    got := (select count(*) from public.clients);
    raise notice '[%] T5a chauffeur SELECT clients = % (attendu 0 — pas un user dashboard)', case when got=0 then 'PASS' else 'FAIL' end, got;
    r := public.app_chauffeur_home();
    raise notice '[%] T5b chauffeur app_chauffeur_home ok=% vehicle_present=%',
      case when (r->>'ok')='true' then 'PASS' else 'FAIL' end, r->>'ok', (r->'vehicle' is not null);
    r := public.app_chauffeur_versements(5);
    raise notice '[%] T5c chauffeur app_chauffeur_versements ok=% n=%',
      case when (r->>'ok')='true' then 'PASS' else 'FAIL' end, r->>'ok',
      jsonb_array_length(coalesce(r->'versements','[]'::jsonb));
    reset role;
    perform set_config('request.jwt.claims', null, true);
  exception when others then reset role; raise notice '[FAIL] T5 chauffeur : %', sqlerrm; end;

  raise notice '=== FIN DES TESTS — tout va être ROLLBACK ===';
end
$t$;

ROLLBACK;

-- =============================================================================
-- VÉRIF NON-PERSISTANCE (à lancer APRÈS le ROLLBACK ci-dessus ; doit montrer
-- que RIEN n'a survécu : RLS toujours off, helper + policies absents).
-- =============================================================================
-- select relname, relrowsecurity as rls_on
-- from pg_class where relname in ('clients','vehicules','recettes_wave') ;        -- attendu rls_on = false
-- select to_regprocedure('public.is_dashboard_user()') is null as helper_absent;  -- attendu true
-- select count(*) as policies_selftest_restantes from pg_policies
--   where policyname like '%\_sel\_dashboard' or policyname like '%boyahbot\_%';   -- attendu 0
