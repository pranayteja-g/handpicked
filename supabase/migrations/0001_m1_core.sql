-- Handpicked M1: profiles, friendships, invites, blocks + RLS + RPCs
-- Run once in Supabase Dashboard > SQL Editor, on the NEW Handpicked project.
-- Auth model: username + auto-generated secret key. The app signs up with a
-- synthetic email and the secret key as the password (see src/data/api.ts).

-- ============================================================ tables
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- canonical ordering (user_a < user_b) so a pair exists at most once
create table public.friendships (
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b_idx on public.friendships (user_b);

create table public.invites (
  code       text primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked    boolean not null default false
);
create index invites_owner_idx on public.invites (owner_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ============================================================ privileges
-- Supabase grants broad defaults on public tables; strip them, then grant the minimum.
revoke all on public.profiles, public.friendships, public.invites, public.blocks
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, delete on public.friendships to authenticated;
grant select on public.invites to authenticated;
grant select, delete on public.blocks to authenticated;

-- ============================================================ RLS helpers
-- Both only ever look at the caller (auth.uid()), so they leak nothing about other pairs.
create function public.is_my_friend(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(auth.uid(), other)
      and user_b = greatest(auth.uid(), other)
  );
$$;

create function public.i_blocked(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = auth.uid() and blocked_id = other
  );
$$;

-- ============================================================ RLS
alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;
alter table public.invites     enable row level security;
alter table public.blocks      enable row level security;

-- profiles: me, my friends, and people I blocked (so I can list/unblock them)
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_my_friend(id)
    or public.i_blocked(id)
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- friendships: only rows I'm part of; created via accept_invite() only
create policy friendships_select on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy friendships_delete on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- invites: only my own; created/revoked via RPC
create policy invites_select_own on public.invites
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- blocks: only mine; created via block_user()
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- ============================================================ signup trigger
-- The app passes username + display_name as signUp metadata.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_display  text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), v_username);
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, left(v_display, 40));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ RPCs
create function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where username = lower(p_username)
  );
$$;

-- Name + avatar of an invite's owner, so the invitee sees who invited them.
-- Zero rows = invalid, revoked or expired.
create function public.preview_invite(p_code text)
returns table (display_name text, username text)
language sql stable security definer set search_path = ''
as $$
  select p.display_name, p.username
  from public.invites i
  join public.profiles p on p.id = i.owner_id
  where i.code = p_code
    and not i.revoked
    and (i.expires_at is null or i.expires_at > now());
$$;

-- New invite replaces (revokes) any active one. p_days null = never expires.
create function public.create_invite(p_days int default 7)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  v_exp  timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  update public.invites set revoked = true
  where owner_id = v_uid and not revoked;

  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_exp  := case when p_days is null then null
                 else now() + make_interval(days => least(greatest(p_days, 1), 90)) end;

  insert into public.invites (code, owner_id, expires_at) values (v_code, v_uid, v_exp);
  return query select v_code, v_exp;
end;
$$;

create function public.revoke_my_invite()
returns void
language sql security definer set search_path = ''
as $$
  update public.invites set revoked = true
  where owner_id = auth.uid() and not revoked;
$$;

create function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select owner_id into v_owner
  from public.invites
  where code = p_code and not revoked and (expires_at is null or expires_at > now());

  if v_owner is null then raise exception 'invalid_invite'; end if;
  if v_owner = v_uid then raise exception 'own_invite'; end if;

  if exists (select 1 from public.blocks where blocker_id = v_uid and blocked_id = v_owner) then
    raise exception 'you_blocked';
  end if;
  -- do not reveal that the owner blocked me
  if exists (select 1 from public.blocks where blocker_id = v_owner and blocked_id = v_uid) then
    raise exception 'invalid_invite';
  end if;

  if (select count(*) from public.friendships where v_uid in (user_a, user_b)) >= 100
     or (select count(*) from public.friendships where v_owner in (user_a, user_b)) >= 100 then
    raise exception 'friend_limit';
  end if;

  insert into public.friendships (user_a, user_b)
  values (least(v_uid, v_owner), greatest(v_uid, v_owner))
  on conflict do nothing;

  return v_owner;
end;
$$;

create function public.block_user(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_user = v_uid then raise exception 'self'; end if;

  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user)
  on conflict do nothing;

  delete from public.friendships
  where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
end;
$$;

-- Deletes the auth user; everything else cascades from profiles.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ============================================================ function privileges
revoke execute on function public.handle_new_user()          from public, anon, authenticated;

revoke execute on function public.username_available(text)  from public;
revoke execute on function public.preview_invite(text)       from public;
grant  execute on function public.username_available(text)   to anon, authenticated;
grant  execute on function public.preview_invite(text)       to anon, authenticated;

revoke execute on function public.is_my_friend(uuid)         from public, anon;
revoke execute on function public.i_blocked(uuid)            from public, anon;
revoke execute on function public.create_invite(int)         from public, anon;
revoke execute on function public.revoke_my_invite()         from public, anon;
revoke execute on function public.accept_invite(text)        from public, anon;
revoke execute on function public.block_user(uuid)           from public, anon;
revoke execute on function public.delete_my_account()        from public, anon;

grant execute on function public.is_my_friend(uuid)          to authenticated;
grant execute on function public.i_blocked(uuid)             to authenticated;
grant execute on function public.create_invite(int)          to authenticated;
grant execute on function public.revoke_my_invite()          to authenticated;
grant execute on function public.accept_invite(text)         to authenticated;
grant execute on function public.block_user(uuid)            to authenticated;
grant execute on function public.delete_my_account()         to authenticated;
