-- =============================================================================
-- Correctif P1 — RLS versements_clients
-- =============================================================================
-- Remplace la policy LOOSE « authenticated_all_versements » (tout JWT authenticated,
-- y compris le token chauffeur de l'app mobile) par le pattern flotte du 12/06 :
--   - lecture  : dashboard (is_dashboard_user) + bot reporting (boyahbot_reader)
--   - ecriture : directeur seul (is_dashboard_directeur)
--
-- ETAT REEL : DEJA applique en PROD le 13/06/2026 (execute a la main dans Supabase
-- Studio, hors migration). Ce fichier le TRACE dans la source unique et rejoue
-- proprement sur tout futur tenant (la baseline 12/06 porte encore la policy loose).
--
-- DEPLOIEMENT PROD : NE PAS `db push` (l'etat est deja present) ->
--   supabase migration repair --status applied 20260613150251
-- Idempotent (DROP IF EXISTS avant chaque CREATE) : rejouable sans casse.
--
-- Selftest transactionnel du 13/06 (4 roles, BEGIN..ROLLBACK) : directeur SELECT+
-- INSERT OK ; boyahbot_reader SELECT OK ; token chauffeur SELECT = 0 (trou ferme) ;
-- dispatcher SELECT OK mais INSERT bloque. 7/7 PASS.
-- =============================================================================

-- 1. Supprimer la policy loose
drop policy if exists "authenticated_all_versements" on "public"."versements_clients";

-- 2. Lecture dashboard (directeur + dispatcher + admin via is_dashboard_user)
drop policy if exists "versements_clients_sel_dashboard" on "public"."versements_clients";
create policy "versements_clients_sel_dashboard"
  on "public"."versements_clients"
  for select to authenticated
  using (public.is_dashboard_user());

-- 3. Ecriture reservee au directeur
drop policy if exists "versements_clients_wr_directeur" on "public"."versements_clients";
create policy "versements_clients_wr_directeur"
  on "public"."versements_clients"
  for all to authenticated
  using (public.is_dashboard_directeur())
  with check (public.is_dashboard_directeur());

-- 4. Lecture bot reporting (boyahbot_reader) — inutilisee par n8n a ce jour,
--    posee par coherence avec le pattern flotte (le grant SELECT existe deja).
drop policy if exists "versements_clients_boyahbot_reader_sel" on "public"."versements_clients";
create policy "versements_clients_boyahbot_reader_sel"
  on "public"."versements_clients"
  for select to boyahbot_reader
  using (true);
