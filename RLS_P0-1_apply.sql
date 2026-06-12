-- =============================================================================
-- CORRECTIF P0-1 — Activation RLS sur les tables flotte + flip security_invoker
-- Projet Fleet (iixpsfsqyfnllggvsvfl).  À APPLIQUER EN PROD MANUELLEMENT.
--
-- Construit contre le SCHÉMA PROD RÉEL (introspection lecture seule, 12/06/2026).
-- Ordre : helper -> policies flotte -> policies boyahbot -> flip vues -> ENABLE.
--
-- RÈGLES respectées :
--   * ENABLE ROW LEVEL SECURITY (JAMAIS FORCE) -> les RPC SECURITY DEFINER
--     (app_chauffeur_*, owner=postgres) et le service_role continuent de passer.
--   * Les policies flotte ciblent les UTILISATEURS DASHBOARD (is_dashboard_user),
--     PAS "authenticated" en bloc : le JWT chauffeur porte role=authenticated,
--     donc une policy "authenticated USING(true)" rouvrirait la fuite aux
--     tokens chauffeurs. is_dashboard_user() => false pour un token chauffeur.
--   * boyahbot_reader / boyahbot_writer : policies calquées sur leurs GRANTS
--     réels en prod (préserve l'accès du bot ; n8n passe de toute façon par
--     service_role via /api/agent/process, donc immunisé).
--   * Les 6 tables app_* (RLS déjà OK, scopées par claim id_chauffeur) ne sont
--     PAS touchées.
--
-- IDEMPOTENT : DROP POLICY IF EXISTS avant chaque CREATE ; CREATE OR REPLACE ;
-- ENABLE est sans effet si déjà actif.
--
-- DÉPENDANCE (à traiter en parallèle, hors de ce script) : tout chemin d'écriture
-- qui passe par le client anon/authenticated (et non service_role) exigera une
-- session 'directeur' une fois la RLS active. Concrètement, les 2 routes P0-2
-- app/api/vehicules/update et app/api/chauffeurs/update (client anon, sans auth)
-- doivent être basculées en service_role / gated directeur EN MÊME TEMPS.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) HELPER : is_dashboard_user()
--    true ssi auth.uid() (sub du JWT, uuid) correspond à une ligne profiles.
--    SECURITY DEFINER pour lire profiles malgré sa RLS. Le cast uuid est gardé :
--    un token chauffeur a un sub ENTIER -> auth.uid() lève -> on renvoie false
--    (le chauffeur n'est jamais un utilisateur dashboard).
-- -----------------------------------------------------------------------------
create or replace function public.is_dashboard_user()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
begin
  begin
    v_uid := auth.uid();              -- sub='42' (chauffeur) -> exception
  exception when others then
    return false;
  end;
  if v_uid is null then
    return false;                     -- anon / rôle direct (boyahbot_*) : pas de sub
  end if;
  return exists (select 1 from public.profiles p where p.id = v_uid);
end;
$fn$;

revoke all on function public.is_dashboard_user() from public;
grant execute on function public.is_dashboard_user() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) POLICIES TABLES FLOTTE (19 tables)
--    - SELECT : utilisateurs dashboard (is_dashboard_user)
--    - écriture (ALL) : directeur uniquement (is_directeur)
--    Le service_role (routes API) bypass la RLS ; les RPC definer aussi.
-- -----------------------------------------------------------------------------
do $do$
declare
  t text;
  fleet text[] := array[
    'clients','vehicules','chauffeurs','recettes_wave','depenses_vehicules',
    'versement_attribution','commandes_yango','justifications_versement',
    'jours_feries','entretiens','affectation_chauffeurs_vehicules','taches_suivi',
    'versements_chauffeurs','calendrier','wave_fr','clients_documents',
    'chauffeurs_yango_snapshot','records_flotte','alertes_envoyees'
  ];
begin
  foreach t in array fleet loop
    execute format('drop policy if exists %I on public.%I', t||'_sel_dashboard', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_dashboard_user())',
      t||'_sel_dashboard', t);

    execute format('drop policy if exists %I on public.%I', t||'_wr_directeur', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_directeur()) with check (public.is_directeur())',
      t||'_wr_directeur', t);
  end loop;
end
$do$;

-- -----------------------------------------------------------------------------
-- 3) POLICIES boyahbot_reader (calquées sur ses GRANTS réels)
--    - lecture (true) sur les tables qu'il consomme (flotte + vues sous-jacentes
--      + mémoires agent) ;
--    - écriture (ALL) là où il a un grant d'écriture : alertes_envoyees,
--      boyahbot_memory.
-- -----------------------------------------------------------------------------
do $do$
declare
  t text;
  -- lecture seule pour le reader :
  bot_read text[] := array[
    'clients','vehicules','chauffeurs','recettes_wave','depenses_vehicules',
    'versement_attribution','commandes_yango','justifications_versement',
    'jours_feries','entretiens','affectation_chauffeurs_vehicules','taches_suivi',
    'versements_chauffeurs','calendrier','wave_fr','clients_documents',
    'chauffeurs_yango_snapshot','records_flotte',
    'agent_analyses','agent_conversations','agent_memory'
  ];
begin
  foreach t in array bot_read loop
    execute format('drop policy if exists %I on public.%I', t||'_boyahbot_reader_sel', t);
    execute format(
      'create policy %I on public.%I for select to boyahbot_reader using (true)',
      t||'_boyahbot_reader_sel', t);
  end loop;
end
$do$;

-- reader a aussi un accès écriture (ALL) ici :
drop policy if exists alertes_envoyees_boyahbot_reader_all on public.alertes_envoyees;
create policy alertes_envoyees_boyahbot_reader_all on public.alertes_envoyees
  for all to boyahbot_reader using (true) with check (true);

drop policy if exists boyahbot_memory_boyahbot_reader_all on public.boyahbot_memory;
create policy boyahbot_memory_boyahbot_reader_all on public.boyahbot_memory
  for all to boyahbot_reader using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 4) POLICIES boyahbot_writer (calquées sur ses GRANTS réels)
--    écrit : alertes_envoyees, chauffeurs_yango_snapshot, records_flotte.
-- -----------------------------------------------------------------------------
do $do$
declare
  t text;
  bot_write text[] := array['alertes_envoyees','chauffeurs_yango_snapshot','records_flotte'];
begin
  foreach t in array bot_write loop
    execute format('drop policy if exists %I on public.%I', t||'_boyahbot_writer_all', t);
    execute format(
      'create policy %I on public.%I for all to boyahbot_writer using (true) with check (true)',
      t||'_boyahbot_writer_all', t);
  end loop;
end
$do$;

-- -----------------------------------------------------------------------------
-- 5) FLIP DES 37 VUES EN security_invoker = on
--    Sinon elles s'exécutent en droits du créateur (postgres) et CONTOURNENT la
--    RLS. En invoker, chaque consommateur (dashboard authenticated / boyahbot_
--    reader / anon) voit la vue selon SES policies sur les tables sous-jacentes.
--    Tables de base sous-jacentes (toutes couvertes ci-dessus) : vehicules,
--    recettes_wave, chauffeurs, depenses_vehicules,
--    affectation_chauffeurs_vehicules, versements_chauffeurs.
-- -----------------------------------------------------------------------------
do $do$
declare
  v text;
  views text[] := array[
    'alerte_assurance','alerte_pneus','alerte_vidange','alerte_visite_technique',
    'alertes_vehicules','chauffeurs_actifs','chauffeurs_inactifs','classement_chauffeurs',
    'cout_reel_vehicule','depenses_anormales','depenses_recurrentes','prevision_ca_mensuel',
    'prevision_depenses','vue_ca_chauffeur_jour','vue_ca_journalier','vue_ca_mensuel',
    'vue_ca_vehicule_aujourdhui','vue_ca_vehicule_jour','vue_ca_vehicule_mois','vue_ca_vehicules',
    'vue_chauffeurs_vehicules','vue_dashboard_depenses','vue_dashboard_recettes','vue_dashboard_vehicules',
    'vue_depenses_aujourdhui','vue_depenses_categories','vue_depenses_journalieres','vue_depenses_mensuelles',
    'vue_depenses_mois','vue_depenses_par_categorie','vue_depenses_par_vehicule','vue_objectif_vehicules',
    'vue_profit_journalier','vue_recettes_chauffeurs','vue_recettes_vehicules','vue_top_vehicule_depenses',
    'vue_voitures_payees'
  ];
begin
  foreach v in array views loop
    execute format('alter view public.%I set (security_invoker = on)', v);
  end loop;
end
$do$;

-- -----------------------------------------------------------------------------
-- 6) ENABLE ROW LEVEL SECURITY (jamais FORCE) sur les 23 tables exposées
-- -----------------------------------------------------------------------------
do $do$
declare
  t text;
  tbls text[] := array[
    -- flotte / données métier
    'clients','vehicules','chauffeurs','recettes_wave','depenses_vehicules',
    'versement_attribution','commandes_yango','justifications_versement',
    'jours_feries','entretiens','affectation_chauffeurs_vehicules','taches_suivi',
    'versements_chauffeurs','calendrier','wave_fr','clients_documents',
    'chauffeurs_yango_snapshot','records_flotte','alertes_envoyees',
    -- mémoires agent/bot (anon-exposées aussi)
    'agent_analyses','agent_conversations','agent_memory','boyahbot_memory'
  ];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$do$;

COMMIT;

-- =============================================================================
-- DURCISSEMENT OPTIONNEL (défense en profondeur — NON inclus dans la transaction)
-- anon possède aujourd'hui TOUS les droits DML sur les tables flotte
-- (ex. clients : DELETE,INSERT,SELECT,UPDATE). La RLS sans policy anon bloque
-- déjà tout, mais on peut retirer les grants superflus :
--
--   revoke insert, update, delete, truncate on
--     public.clients, public.vehicules, public.chauffeurs, public.recettes_wave,
--     public.depenses_vehicules, public.versement_attribution, public.commandes_yango,
--     public.justifications_versement, public.jours_feries, public.entretiens,
--     public.affectation_chauffeurs_vehicules, public.taches_suivi,
--     public.versements_chauffeurs, public.calendrier, public.wave_fr,
--     public.clients_documents, public.chauffeurs_yango_snapshot, public.records_flotte,
--     public.alertes_envoyees
--   from anon;
--   -- (et REVOKE SELECT sur anon là où aucune lecture publique n'est voulue)
-- =============================================================================
