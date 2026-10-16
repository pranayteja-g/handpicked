-- Handpicked M2: recommendations, recipients, read-state, image bucket + RLS + RPCs
-- Run AFTER 0001_m1_core.sql, in Supabase Dashboard > SQL Editor.

-- ============================================================ tables
create table public.recommendations (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  category   text not null
    check (category in ('movie_tv','music','book','food','place','product','app','other')),
  title      text not null check (char_length(btrim(title)) between 1 and 100),
  note       text check (note is null or char_length(note) <= 500),
  url        text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  image_path text check (
    image_path is null
    or (char_length(image_path) <= 200 and image_path like author_id::text || '/%')
  ),
  created_at timestamptz not null default now()
);
create index recommendations_author_idx on public.recommendations (author_id, created_at desc);

create table public.recommendation_recipients (
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  recipient_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (recommendation_id, recipient_id)
);
create index recommendation_recipients_user_idx
  on public.recommendation_recipients (recipient_id, recommendation_id);

-- Per-user read state. Private: nobody else (not even the author) can see when you read.
create table public.rec_reads (
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  read_at           timestamptz not null default now(),
  primary key (recommendation_id, user_id)
);

-- ============================================================ privileges
revoke all on public.recommendations, public.recommendation_recipients, public.rec_reads
  from anon, authenticated;

grant select, delete on public.recommendations to authenticated;
grant update (category, title, note, url) on public.recommendations to authenticated;
grant select on public.recommendation_recipients to authenticated;
grant select on public.rec_reads to authenticated;

-- ============================================================ access helpers
-- Author, or a chosen recipient who is CURRENTLY a friend of the author.
create function public.can_see_rec(p_rec uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.recommendations r
    where r.id = p_rec
      and (
        r.author_id = auth.uid()
        or (
          public.is_my_friend(r.author_id)
          and exists (
            select 1 from public.recommendation_recipients rr
            where rr.recommendation_id = r.id and rr.recipient_id = auth.uid()
          )
        )
      )
  );
$$;

-- Do I share a visible recommendation with this person (they are its author or a co-recipient)?
-- Lets recipients see each other's names, as the send screen warns.
create function public.shares_rec_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.recommendation_recipients mine
    join public.recommendations r on r.id = mine.recommendation_id
    left join public.recommendation_recipients theirs
      on theirs.recommendation_id = r.id and theirs.recipient_id = other
    where mine.recipient_id = auth.uid()
      and public.is_my_friend(r.author_id)
      and (r.author_id = other or theirs.recipient_id is not null)
  );
$$;

create function public.can_see_image(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.recommendations r
    where r.image_path = p_path and public.can_see_rec(r.id)
  );
$$;

-- ============================================================ RLS
alter table public.recommendations           enable row level security;
alter table public.recommendation_recipients enable row level security;
alter table public.rec_reads                 enable row level security;

create policy recs_select on public.recommendations
  for select to authenticated
  using (public.can_see_rec(id));

create policy recs_update_own on public.recommendations
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy recs_delete_own on public.recommendations
  for delete to authenticated
  using (author_id = (select auth.uid()));

create policy recipients_select on public.recommendation_recipients
  for select to authenticated
  using (public.can_see_rec(recommendation_id));

create policy reads_select_own on public.rec_reads
  for select to authenticated
  using (user_id = (select auth.uid()));

-- widen profiles visibility: co-recipients
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_my_friend(id)
    or public.i_blocked(id)
    or public.shares_rec_with(id)
  );

-- ============================================================ RPCs
create function public.create_recommendation(
  p_category   text,
  p_title      text,
  p_note       text,
  p_url        text,
  p_image_path text,
  p_recipients uuid[],
  p_all        boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_friend uuid[];
  v_ids    uuid[];
  v_want   uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  if (select count(*) from public.recommendations
      where author_id = v_uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'daily_limit';
  end if;

  select coalesce(array_agg(case when user_a = v_uid then user_b else user_a end), '{}')
    into v_friend
  from public.friendships where v_uid in (user_a, user_b);

  if p_all then
    v_ids := v_friend;
  else
    select coalesce(array_agg(distinct x), '{}') into v_want from unnest(coalesce(p_recipients, '{}')) x;
    if exists (select 1 from unnest(v_want) w where w <> all (v_friend)) then
      raise exception 'not_friends';
    end if;
    v_ids := v_want;
  end if;

  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'no_recipients'; end if;

  begin
    insert into public.recommendations (author_id, category, title, note, url, image_path)
    values (
      v_uid, p_category, btrim(p_title),
      nullif(btrim(coalesce(p_note, '')), ''),
      nullif(btrim(coalesce(p_url, '')), ''),
      nullif(p_image_path, '')
    )
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'invalid_input';
  end;

  insert into public.recommendation_recipients (recommendation_id, recipient_id)
  select v_id, unnest(v_ids);

  return v_id;
end;
$$;

create function public.mark_read(p_rec uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.can_see_rec(p_rec) then raise exception 'not_found'; end if;
  insert into public.rec_reads (recommendation_id, user_id) values (p_rec, auth.uid())
  on conflict do nothing;
end;
$$;

-- Unread = received, still friends with the author, not yet opened.
create function public.unread_count()
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
  from public.recommendation_recipients rr
  join public.recommendations r on r.id = rr.recommendation_id
  where rr.recipient_id = auth.uid()
    and public.is_my_friend(r.author_id)
    and not exists (
      select 1 from public.rec_reads x
      where x.recommendation_id = r.id and x.user_id = auth.uid()
    );
$$;

-- ============================================================ function privileges
revoke execute on function public.can_see_rec(uuid)      from public, anon;
revoke execute on function public.shares_rec_with(uuid)  from public, anon;
revoke execute on function public.can_see_image(text)    from public, anon;
revoke execute on function public.create_recommendation(text,text,text,text,text,uuid[],boolean) from public, anon;
revoke execute on function public.mark_read(uuid)        from public, anon;
revoke execute on function public.unread_count()         from public, anon;

grant execute on function public.can_see_rec(uuid)       to authenticated;
grant execute on function public.shares_rec_with(uuid)   to authenticated;
grant execute on function public.can_see_image(text)     to authenticated;
grant execute on function public.create_recommendation(text,text,text,text,text,uuid[],boolean) to authenticated;
grant execute on function public.mark_read(uuid)         to authenticated;
grant execute on function public.unread_count()          to authenticated;

-- ============================================================ image storage
-- Private bucket. Files live under "<user_id>/<random>.webp|jpg". ~400 KB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rec-images', 'rec-images', false, 400000, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy rec_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rec-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy rec_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rec-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_see_image(name)
    )
  );

create policy rec_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rec-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
