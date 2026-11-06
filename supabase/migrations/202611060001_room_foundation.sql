-- İkimiz ilk sürüm: oyunlar henüz oynanamaz. SQL Editor'de tek işlem olarak çalıştırın.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$'),
  host_id uuid not null references auth.users(id),
  selected_game text not null default 'auction' check (selected_game in ('auction','chain','detective','wordhunt')),
  status text not null default 'lobby' check (status in ('lobby','closed')),
  revision bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 2 and 24),
  ready boolean not null default false,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);
-- Bir anonim kimlik aynı anda yalnızca bir aktif odada yer alabilir.
create unique index one_active_room_per_user on public.room_players(user_id) where active;
create index active_room_members on public.room_players(room_id) where active;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
revoke all on public.rooms, public.room_players from anon, authenticated;
grant select on public.rooms, public.room_players to authenticated;

-- SECURITY DEFINER yardımcı fonksiyon politikada sonsuz RLS döngüsünü önler.
-- Kullanıcı parametresi alınmaz; yetki her zaman JWT'deki auth.uid() ile belirlenir.
create function private.is_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.room_players
    where room_id = p_room_id and user_id = (select auth.uid()) and active);
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

create policy member_reads_room on public.rooms for select to authenticated
  using (private.is_member(id));
create policy member_reads_players on public.room_players for select to authenticated
  using (private.is_member(room_id) and active);

create function private.check_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare v_name text := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
begin
  if v_name is null or char_length(v_name) not between 2 and 24
    or v_name ~ '[[:cntrl:]]' or v_name ~ '[​‌‍‎‏﻿]' then
    raise exception 'invalid_name';
  end if;
  return v_name;
end;
$$;
revoke all on function private.check_name(text) from public, anon, authenticated;

create function public.current_room() returns text
language sql stable security definer set search_path = '' as $$
  select r.code from public.rooms r join public.room_players p on p.room_id = r.id
    where p.user_id = (select auth.uid()) and p.active and r.status = 'lobby' limit 1;
$$;

create function public.create_room(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_code text; v_name text;
begin
  if v_user is null then raise exception 'auth_required'; end if;
  v_name := private.check_name(p_name);
  -- Aynı kimlikle eşzamanlı oda açma/katılma işlemlerini sıraya alır.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists(select 1 from public.room_players where user_id = v_user and active) then
    raise exception 'already_in_room';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.rooms(code, host_id) values (v_code, v_user)
      on conflict (code) do nothing returning id into v_id;
    exit when v_id is not null;
  end loop;
  insert into public.room_players(room_id,user_id,name) values(v_id,v_user,v_name);
  return v_code;
end;
$$;

create function public.join_room(p_code text, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_room public.rooms; v_name text;
begin
  if v_user is null then raise exception 'auth_required'; end if;
  v_name := private.check_name(p_name);
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into v_room from public.rooms where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status <> 'lobby' then raise exception 'room_closed'; end if;
  -- Yenileme/aynı isteğin tekrarı üçüncü bir üyelik oluşturmaz.
  if exists(select 1 from public.room_players where room_id = v_room.id and user_id = v_user and active) then
    update public.room_players set name = v_name, last_seen = now() where room_id = v_room.id and user_id = v_user;
    update public.rooms set revision = revision + 1 where id = v_room.id;
    return v_room.code;
  end if;
  if exists(select 1 from public.room_players where user_id = v_user and active) then raise exception 'already_in_room'; end if;
  if (select count(*) from public.room_players where room_id = v_room.id and active) >= 2 then raise exception 'room_full'; end if;
  insert into public.room_players(room_id,user_id,name) values(v_room.id,v_user,v_name)
    on conflict(room_id,user_id) do update set active = true, name = v_name, ready = false, joined_at = now(), last_seen = now();
  update public.room_players set ready = false where room_id = v_room.id and active;
  update public.rooms set revision = revision + 1 where id = v_room.id;
  return v_room.code;
end;
$$;

create function public.set_ready(p_room_id uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if p_ready is null then raise exception 'players_not_ready'; end if;
  update public.room_players set ready = p_ready, last_seen = now() where room_id = p_room_id and user_id = auth.uid() and active;
  update public.rooms set revision = revision + 1 where id = p_room_id;
end;
$$;

create function public.select_game(p_room_id uuid, p_game text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_host uuid;
begin
  select host_id into v_host from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if v_host <> auth.uid() then raise exception 'host_only'; end if;
  if p_game is null or p_game not in ('auction','chain','detective','wordhunt') then raise exception 'invalid_game'; end if;
  if (select selected_game from public.rooms where id = p_room_id) = p_game then return; end if;
  update public.room_players set ready = false where room_id = p_room_id and active;
  update public.rooms set selected_game = p_game, revision = revision + 1 where id = p_room_id;
end;
$$;

create function public.start_game(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_host uuid;
begin
  select host_id into v_host from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if v_host <> auth.uid() then raise exception 'host_only'; end if;
  if (select count(*) from public.room_players where room_id = p_room_id and active and ready and last_seen > now() - interval '70 seconds') <> 2 then
    raise exception 'players_not_ready';
  end if;
  -- Yeni oyunlar sunucu doğrulaması ve özel gizli-durum deposuyla eklenecek.
  -- Henüz motor yokken sahte bir oyun oturumu açılmaz.
  raise exception 'game_not_available';
end;
$$;

create function public.heartbeat(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  update public.room_players set last_seen = now()
    where room_id = p_room_id and user_id = auth.uid() and active and last_seen < now() - interval '15 seconds';
end;
$$;

create function public.leave_room(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_next uuid;
begin
  perform 1 from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  update public.room_players set active = false, ready = false where room_id = p_room_id and user_id = auth.uid();
  update public.room_players set ready = false where room_id = p_room_id and active;
  select user_id into v_next from public.room_players where room_id = p_room_id and active order by joined_at limit 1;
  update public.rooms set host_id = coalesce(v_next,host_id), status = case when v_next is null then 'closed' else 'lobby' end,
    revision = revision + 1 where id = p_room_id;
end;
$$;

-- PostgreSQL fonksiyonları varsayılan olarak PUBLIC'e açık olabilir. Her RPC'yi kapatıp yalnız authenticated'a açıyoruz.
revoke all on function public.current_room() from public, anon;
revoke all on function public.create_room(text) from public, anon;
revoke all on function public.join_room(text,text) from public, anon;
revoke all on function public.set_ready(uuid,boolean) from public, anon;
revoke all on function public.select_game(uuid,text) from public, anon;
revoke all on function public.start_game(uuid) from public, anon;
revoke all on function public.heartbeat(uuid) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.current_room(), public.create_room(text), public.join_room(text,text),
  public.set_ready(uuid,boolean), public.select_game(uuid,text), public.start_game(uuid),
  public.heartbeat(uuid), public.leave_room(uuid) to authenticated;

-- Yalnız UPDATE/INSERT yükleri kullanılır; ayrılma soft-delete + oda revizyonuyla bildirilir.
do $$
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.room_players;
  end if;
end;
$$;
commit;
