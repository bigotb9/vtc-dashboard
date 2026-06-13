-- ============================================================================
-- Boyah Driver App — Phase 5 migration: « Signaler » (in-app chat + handling)
--
-- Extends the Phase 2 support layer (app_support_conversations /
-- app_support_messages) into a one-rolling-thread-per-driver chat that the
-- Fleet dashboard agents can triage, claim and answer. Backend only — the
-- dashboard UI and FCM push are out of scope for this checkpoint.
--
-- SHARED DATABASE with Fleet (vtc-dashboard / project iixpsfsqyfnllggvsvfl).
-- This migration is written to be SAFE for the live Fleet project:
--   * It does NOT alter / rename / drop any existing Fleet table or function.
--   * The ONLY write to a Fleet-owned table is an additive, idempotent seed of
--     two rows-per-role into public.role_permissions (see §12). Nothing else
--     touches Fleet data.
--   * It only adds new columns / policies / functions to the app_-prefixed
--     tables created in Phase 2, plus two agent-side storage policies.
--   * No hard foreign key is introduced: pris_en_charge_par / agent_id are
--     *soft* uuid references to profiles.id (so a profile delete never cascades
--     into app data), exactly like the soft id_chauffeur references elsewhere.
--
-- WHY A CUSTOM PERMISSION HELPER (app_dashboard_has_perm) INSTEAD OF REUSING ONE:
--   Fleet has no generic has_permission() helper — the dashboard enforces
--   granular permissions in application code and only ships is_directeur().
--   is_directeur() calls the bare auth.uid(), which casts the JWT 'sub' claim to
--   uuid. Driver tokens carry an INTEGER sub (e.g. '42'), so that cast raises
--   and would poison any policy OR-evaluated for a driver request. We therefore
--   add app_current_uid() (a guarded auth.uid() that returns NULL for drivers)
--   and build app_dashboard_has_perm() on top of it. The permission *keys*
--   ('manage_signalements' / 'reassign_signalements') are the stable contract
--   the dashboard checks in code AND the DB enforces in RLS.
--
-- HOW TO APPLY: review, then run in the Supabase SQL editor (so it stays out of
-- Fleet's own migration history) or via psql as an admin/owner role (the
-- SECURITY DEFINER functions must be owned by an admin so they can maintain the
-- parent thread row regardless of RLS). Idempotent (IF NOT EXISTS / OR REPLACE /
-- ON CONFLICT / guarded DO blocks) and safe to re-run.
--
-- pg_cron is OPT-IN: §14 schedules the stale-thread auto-release only if the
-- pg_cron extension is installed, and degrades to a NOTICE otherwise.
-- ============================================================================


-- ============================================================================
-- §1. app_current_uid() — driver-safe wrapper around auth.uid()
-- ----------------------------------------------------------------------------
-- auth.uid() casts the JWT 'sub' claim to uuid. Dashboard users have a uuid sub;
-- drivers have an integer sub, so the cast raises. We swallow the error and
-- return NULL, meaning "this caller is not an auth.users (dashboard) user".
-- Used by every agent-side policy so a driver request never throws while
-- Postgres OR-evaluates the agent policies against the same row.
-- ============================================================================
create or replace function public.app_current_uid()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
begin
  return auth.uid();
exception
  when others then
    return null;
end;
$fn$;


-- ============================================================================
-- §2. app_dashboard_has_perm(action) — granular dashboard permission check
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it can read profiles + role_permissions regardless of the
-- caller's RLS. Returns false for drivers/anon (no dashboard uid). 'directeur'
-- is the org-wide superuser (mirrors Fleet's is_directeur(); note 'directeur' is
-- intentionally NOT a row in role_permissions — its CHECK forbids it).
-- ============================================================================
create or replace function public.app_dashboard_has_perm(p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid  uuid;
  v_role text;
begin
  v_uid := public.app_current_uid();
  if v_uid is null then
    return false;
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    return false;
  end if;

  if v_role = 'directeur' then
    return true;
  end if;

  return exists (
    select 1
    from public.role_permissions rp
    where rp.role   = v_role
      and rp.action = p_action
      and rp.allowed is true
  );
end;
$fn$;


-- ============================================================================
-- §3. Extend app_support_conversations into a single claimable thread/driver
-- ----------------------------------------------------------------------------
-- pris_en_charge_par : soft uuid ref to profiles.id of the agent who owns the
--                      thread (NULL = free / unclaimed). NO hard FK.
-- pris_en_charge_at  : when it was claimed.
-- pris_en_charge_nom : denormalised agent display label for the driver's
--                      "Suivi par X" banner. profiles has no name column and the
--                      driver JWT cannot read auth.users, so the DASHBOARD must
--                      set this label when it claims/answers a thread. The app
--                      degrades to a generic "Pris en charge" when it is NULL.
-- ============================================================================
alter table public.app_support_conversations
  add column if not exists pris_en_charge_par uuid,
  add column if not exists pris_en_charge_at  timestamptz,
  add column if not exists pris_en_charge_nom text;

-- One rolling thread per driver. Phase 2 created a NON-unique index on
-- id_chauffeur; replace it with a UNIQUE index so app_support_open_thread() can
-- upsert via ON CONFLICT (id_chauffeur). Safe: this feature is new, so there is
-- at most one existing row per driver.
drop index if exists public.app_support_conversations_chauffeur_idx;
create unique index if not exists app_support_conversations_chauffeur_uidx
  on public.app_support_conversations (id_chauffeur);


-- ============================================================================
-- §4. Extend app_support_messages with the authoring agent
-- ----------------------------------------------------------------------------
-- agent_id : soft uuid ref to profiles.id for 'support' messages (NULL for
--            'chauffeur' messages). Force-set by the trigger in §5; never
--            trusted from the client. NO hard FK.
--
-- NOTE on the type enum: Phase 2 already defines type in
-- ('text','image','video','audio'). We keep those English keys. The app maps
-- its French affordances onto them: photo -> 'image', vidéo -> 'video',
-- vocal -> 'audio', texte -> 'text'.
-- ============================================================================
alter table public.app_support_messages
  add column if not exists agent_id uuid;


-- ============================================================================
-- §5. BEFORE INSERT trigger — upsert thread state + ATOMIC agent claim
-- ----------------------------------------------------------------------------
-- Fires before every message insert and is the heart of the concurrency model.
--
-- For a 'support' (agent) message:
--   * force agent_id = app_current_uid() (reject if NULL — agents must be
--     authenticated dashboard users);
--   * SELECT ... FOR UPDATE the parent thread to SERIALISE concurrent agent
--     replies. The row lock is what closes the two-agent race: the second agent
--     blocks until the first commits, then re-reads the now-claimed row;
--   * if the thread is free -> claim it (set pris_en_charge_par + _at);
--   * if owned by this agent -> just append;
--   * if owned by ANOTHER agent -> only a 'reassign_signalements' supervisor may
--     reply (and replying does NOT steal ownership); a 'manage'-only agent is
--     rejected here, so exactly one reply can ever land on a contested thread;
--   * bump last_message_at, reopen (status='open') and increment the driver's
--     unread counter.
--
-- For a 'chauffeur' (driver) message: force agent_id=NULL, bump last_message_at,
-- reopen a closed thread (the driver coming back), and leave ownership intact
-- (the §13 pg_cron job releases it later if the driver goes unanswered).
--
-- ORDERING NOTE: Postgres runs BEFORE ROW triggers *before* RLS WITH CHECK, so
-- the client may insert with agent_id NULL and the RLS agent-insert policy still
-- sees the trigger-stamped agent_id. The trigger's FOR UPDATE + re-check is the
-- load-bearing guard; RLS is defence-in-depth.
-- ============================================================================
create or replace function public.app_support_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid          uuid;
  v_conv         public.app_support_conversations%rowtype;
  v_has_manage   boolean;
  v_has_reassign boolean;
begin
  if new.sender = 'support' then
    v_uid := public.app_current_uid();
    if v_uid is null then
      raise exception 'app_support: an agent message requires an authenticated dashboard user'
        using errcode = '42501';
    end if;
    new.agent_id := v_uid;

    -- Serialise concurrent agent replies on the same thread.
    select * into v_conv
    from public.app_support_conversations
    where id = new.conversation_id
    for update;

    if not found then
      raise exception 'app_support: conversation % not found', new.conversation_id
        using errcode = '23503';
    end if;

    v_has_manage   := public.app_dashboard_has_perm('manage_signalements');
    v_has_reassign := public.app_dashboard_has_perm('reassign_signalements');

    if v_conv.pris_en_charge_par is null then
      -- Free thread: first writer claims it (requires manage or reassign).
      if not (v_has_manage or v_has_reassign) then
        raise exception 'app_support: missing manage_signalements permission'
          using errcode = '42501';
      end if;
      update public.app_support_conversations
         set pris_en_charge_par   = v_uid,
             pris_en_charge_at    = now(),
             last_message_at      = now(),
             status               = 'open',
             unread_for_chauffeur = unread_for_chauffeur + 1
       where id = new.conversation_id;

    elsif v_conv.pris_en_charge_par = v_uid then
      -- Already this agent's thread: just append.
      update public.app_support_conversations
         set last_message_at      = now(),
             status               = 'open',
             unread_for_chauffeur = unread_for_chauffeur + 1
       where id = new.conversation_id;

    else
      -- Owned by another agent: only a supervisor may reply, without stealing it.
      if not v_has_reassign then
        raise exception 'app_support: thread already handled by another agent'
          using errcode = '42501';
      end if;
      update public.app_support_conversations
         set last_message_at      = now(),
             status               = 'open',
             unread_for_chauffeur = unread_for_chauffeur + 1
       where id = new.conversation_id;
    end if;

  else
    -- 'chauffeur' message: drivers never author agent fields.
    new.agent_id := null;
    update public.app_support_conversations
       set last_message_at = now(),
           status          = 'open'   -- a new driver message reopens a closed thread
     where id = new.conversation_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists app_support_messages_on_insert on public.app_support_messages;
create trigger app_support_messages_on_insert
  before insert on public.app_support_messages
  for each row execute function public.app_support_on_message_insert();


-- ============================================================================
-- §6. RPC app_support_open_thread() — driver opens (or fetches) their thread
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so the driver can create their single thread without holding
-- a direct INSERT policy on conversations. id_chauffeur is taken from the
-- verified JWT claim (never client input). Returns the thread as jsonb.
-- ============================================================================
create or replace function public.app_support_open_thread()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id_chauffeur int;
  v_conv         public.app_support_conversations%rowtype;
begin
  v_id_chauffeur := nullif(auth.jwt() ->> 'id_chauffeur', '')::int;
  if v_id_chauffeur is null then
    raise exception 'app_support: missing id_chauffeur claim' using errcode = '42501';
  end if;

  insert into public.app_support_conversations (id_chauffeur)
  values (v_id_chauffeur)
  on conflict (id_chauffeur) do nothing;

  select * into v_conv
  from public.app_support_conversations
  where id_chauffeur = v_id_chauffeur;

  return jsonb_build_object(
    'id',                   v_conv.id,
    'id_chauffeur',         v_conv.id_chauffeur,
    'status',               v_conv.status,
    'last_message_at',      v_conv.last_message_at,
    'unread_for_chauffeur', v_conv.unread_for_chauffeur,
    'pris_en_charge',       (v_conv.pris_en_charge_par is not null),
    'pris_en_charge_nom',   v_conv.pris_en_charge_nom,
    'pris_en_charge_at',    v_conv.pris_en_charge_at,
    'created_at',           v_conv.created_at
  );
end;
$fn$;


-- ============================================================================
-- §7. RPC app_support_mark_read() — driver acknowledges agent messages
-- ----------------------------------------------------------------------------
-- Stamps read_at on the driver's unread 'support' messages and zeroes the
-- unread counter. SECURITY DEFINER; scoped to the caller's own thread.
-- ============================================================================
create or replace function public.app_support_mark_read()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id_chauffeur int;
  v_conv_id      uuid;
begin
  v_id_chauffeur := nullif(auth.jwt() ->> 'id_chauffeur', '')::int;
  if v_id_chauffeur is null then
    raise exception 'app_support: missing id_chauffeur claim' using errcode = '42501';
  end if;

  select id into v_conv_id
  from public.app_support_conversations
  where id_chauffeur = v_id_chauffeur;

  if v_conv_id is null then
    return;
  end if;

  update public.app_support_messages
     set read_at = now()
   where conversation_id = v_conv_id
     and sender = 'support'
     and read_at is null;

  update public.app_support_conversations
     set unread_for_chauffeur = 0
   where id = v_conv_id;
end;
$fn$;


-- ============================================================================
-- §8. RPC app_support_auto_release(max_hours) — free stale unanswered threads
-- ----------------------------------------------------------------------------
-- Releases the claim on any OPEN thread whose latest message is from the driver
-- and older than max_hours (default 2) — i.e. the owning agent went silent.
-- Returns how many threads were released. service_role / pg_cron only (§9).
-- ============================================================================
create or replace function public.app_support_auto_release(p_max_hours int default 2)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  with released as (
    update public.app_support_conversations c
       set pris_en_charge_par = null,
           pris_en_charge_at  = null,
           pris_en_charge_nom = null
     where c.status = 'open'
       and c.pris_en_charge_par is not null
       and c.last_message_at is not null
       and c.last_message_at < now() - make_interval(hours => greatest(p_max_hours, 1))
       and (
         select m.sender
         from public.app_support_messages m
         where m.conversation_id = c.id
         order by m.created_at desc
         limit 1
       ) = 'chauffeur'
    returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$fn$;


-- ============================================================================
-- §9. Function grants
-- ============================================================================
grant execute on function public.app_current_uid()             to authenticated;
grant execute on function public.app_dashboard_has_perm(text)  to authenticated;
grant execute on function public.app_support_open_thread()     to authenticated;
grant execute on function public.app_support_mark_read()       to authenticated;

-- auto_release is a privileged maintenance routine: keep it off the client.
revoke all on function public.app_support_auto_release(integer) from public, anon, authenticated;
grant execute on function public.app_support_auto_release(integer) to service_role;


-- ============================================================================
-- §10. Row Level Security — conversations
-- ----------------------------------------------------------------------------
-- Replace the Phase 2 broad FOR ALL driver policy with read-only driver access
-- (driver writes go exclusively through the SECURITY DEFINER RPCs above) plus
-- agent read/update policies.
-- ============================================================================
drop policy if exists app_support_conv_own on public.app_support_conversations;

-- Driver: read only their own thread.
drop policy if exists app_support_conv_select_driver on public.app_support_conversations;
create policy app_support_conv_select_driver on public.app_support_conversations
  for select to authenticated
  using (id_chauffeur = nullif(auth.jwt() ->> 'id_chauffeur', '')::int);

-- Agent (manage or reassign): read every thread for triage.
drop policy if exists app_support_conv_select_agent on public.app_support_conversations;
create policy app_support_conv_select_agent on public.app_support_conversations
  for select to authenticated
  using (
    public.app_dashboard_has_perm('manage_signalements')
    or public.app_dashboard_has_perm('reassign_signalements')
  );

-- Agent update: a manager may take a free thread or modify/close their own; a
-- supervisor (reassign) may modify/close/reassign ANY thread. A manager can
-- never assign ownership to another agent (WITH CHECK limits to NULL or self).
drop policy if exists app_support_conv_update_agent on public.app_support_conversations;
create policy app_support_conv_update_agent on public.app_support_conversations
  for update to authenticated
  using (
    public.app_dashboard_has_perm('reassign_signalements')
    or (
      public.app_dashboard_has_perm('manage_signalements')
      and (pris_en_charge_par is null or pris_en_charge_par = public.app_current_uid())
    )
  )
  with check (
    public.app_dashboard_has_perm('reassign_signalements')
    or (
      public.app_dashboard_has_perm('manage_signalements')
      and (pris_en_charge_par is null or pris_en_charge_par = public.app_current_uid())
    )
  );


-- ============================================================================
-- §11. Row Level Security — messages
-- ============================================================================
drop policy if exists app_support_msg_select on public.app_support_messages;
drop policy if exists app_support_msg_insert on public.app_support_messages;
drop policy if exists app_support_msg_update on public.app_support_messages;

-- Driver: read messages in their own thread.
drop policy if exists app_support_msg_select_driver on public.app_support_messages;
create policy app_support_msg_select_driver on public.app_support_messages
  for select to authenticated
  using (exists (
    select 1 from public.app_support_conversations c
    where c.id = conversation_id
      and c.id_chauffeur = nullif(auth.jwt() ->> 'id_chauffeur', '')::int));

-- Agent (manage or reassign): read messages in any thread.
drop policy if exists app_support_msg_select_agent on public.app_support_messages;
create policy app_support_msg_select_agent on public.app_support_messages
  for select to authenticated
  using (
    public.app_dashboard_has_perm('manage_signalements')
    or public.app_dashboard_has_perm('reassign_signalements')
  );

-- Driver insert: only into their own thread, as 'chauffeur', never as an agent.
drop policy if exists app_support_msg_insert_driver on public.app_support_messages;
create policy app_support_msg_insert_driver on public.app_support_messages
  for insert to authenticated
  with check (
    sender = 'chauffeur'
    and agent_id is null
    and exists (
      select 1 from public.app_support_conversations c
      where c.id = conversation_id
        and c.id_chauffeur = nullif(auth.jwt() ->> 'id_chauffeur', '')::int)
  );

-- Agent insert: as 'support', stamped with own uid (the §5 trigger force-sets
-- agent_id before this check). A supervisor may reply on any thread; a manager
-- only on a free or self-owned thread. The trigger additionally serialises the
-- claim so a contested free thread accepts exactly one reply.
drop policy if exists app_support_msg_insert_agent on public.app_support_messages;
create policy app_support_msg_insert_agent on public.app_support_messages
  for insert to authenticated
  with check (
    sender = 'support'
    and agent_id = public.app_current_uid()
    and (
      public.app_dashboard_has_perm('reassign_signalements')
      or (
        public.app_dashboard_has_perm('manage_signalements')
        and exists (
          select 1 from public.app_support_conversations c
          where c.id = conversation_id
            and (c.pris_en_charge_par is null
                 or c.pris_en_charge_par = public.app_current_uid()))
      )
    )
  );


-- ============================================================================
-- §12. Storage — let agents read/write thread media
-- ----------------------------------------------------------------------------
-- Phase 2 already namespaces objects per driver ("<id_chauffeur>/<file>") and
-- gives the driver select/insert on their own folder. Here we let dashboard
-- agents (manage or reassign) read driver attachments and post their own.
-- Convention for new objects: "<id_chauffeur>/<message_id>.<ext>".
-- ============================================================================
drop policy if exists app_media_select_agent on storage.objects;
create policy app_media_select_agent on storage.objects
  for select to authenticated
  using (
    bucket_id = 'app-chauffeurs-media'
    and (
      public.app_dashboard_has_perm('manage_signalements')
      or public.app_dashboard_has_perm('reassign_signalements')
    )
  );

drop policy if exists app_media_insert_agent on storage.objects;
create policy app_media_insert_agent on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'app-chauffeurs-media'
    and (
      public.app_dashboard_has_perm('manage_signalements')
      or public.app_dashboard_has_perm('reassign_signalements')
    )
  );


-- ============================================================================
-- §13. Seed dashboard permissions  (the ONLY write to a Fleet-owned table)
-- ----------------------------------------------------------------------------
-- Additive + idempotent. role_permissions.role CHECK only allows 'admin' /
-- 'dispatcher', so 'directeur' is deliberately omitted (it is granted via the
-- superuser bypass in app_dashboard_has_perm). Admin gets both permissions by
-- default; dispatcher is seeded explicitly disabled so the keys exist and the
-- dashboard can toggle them per role. These keys are the contract the dashboard
-- checks in code AND the DB enforces in RLS — do not rename them.
--   * manage_signalements  : see all threads, take a free thread, reply only on
--                            own/free threads.
--   * reassign_signalements: supervisor — release/reassign any thread and reply
--                            despite another agent's lock.
-- ============================================================================
insert into public.role_permissions (role, action, allowed) values
  ('admin',      'manage_signalements',   true),
  ('admin',      'reassign_signalements', true),
  ('dispatcher', 'manage_signalements',   false),
  ('dispatcher', 'reassign_signalements', false)
on conflict (role, action) do nothing;


-- ============================================================================
-- §14. Realtime — publish both tables to supabase_realtime (guarded)
-- ============================================================================
do $do$
begin
  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'app_support_conversations'
    ) then
      execute 'alter publication supabase_realtime add table public.app_support_conversations';
    end if;
  exception when undefined_object then null;  -- publication absent: skip
  end;

  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'app_support_messages'
    ) then
      execute 'alter publication supabase_realtime add table public.app_support_messages';
    end if;
  exception when undefined_object then null;
  end;
end
$do$;


-- ============================================================================
-- §15. pg_cron — auto-release stale threads every 10 min (OPT-IN)
-- ----------------------------------------------------------------------------
-- Only schedules if pg_cron is installed. N = 2h is the default; edit the
-- argument below (or the schedule) to taste. Degrades to a NOTICE so applying
-- the migration never fails on environments without pg_cron / cron privileges.
-- ============================================================================
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      if exists (select 1 from cron.job where jobname = 'app_support_auto_release') then
        perform cron.unschedule('app_support_auto_release');
      end if;
      perform cron.schedule(
        'app_support_auto_release',
        '*/10 * * * *',
        $job$ select public.app_support_auto_release(2); $job$
      );
    exception when others then
      raise notice 'app_support: could not schedule pg_cron job (%). Schedule it manually if you want auto-release.', sqlerrm;
    end;
  else
    raise notice 'app_support: pg_cron not installed; stale-thread auto-release will not run. Enable pg_cron and re-run §15, or call app_support_auto_release() from an external scheduler.';
  end if;
end
$do$;

-- ============================================================================
-- END Phase 5 migration
-- ============================================================================
