-- İlk migration'dan SONRA bir kez çalıştırın. Oda üyeliği ve RLS korunur.
begin;

-- Tek sorguda oda + oyuncular + güvenilir sunucu zamanı. Invoker olduğundan
-- SELECT işlemlerinde mevcut üye bazlı RLS politikaları aynen uygulanır.
create or replace function public.get_room_snapshot(p_code text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'room', to_jsonb(r),
    'players', coalesce((select jsonb_agg(to_jsonb(p) order by p.joined_at)
      from public.room_players p where p.room_id = r.id and p.active), '[]'::jsonb),
    'server_time', statement_timestamp()
  ) from public.rooms r where r.code = upper(btrim(p_code)) and r.status = 'lobby';
$$;
revoke all on function public.get_room_snapshot(text) from public, anon;
grant execute on function public.get_room_snapshot(text) to authenticated;

-- Süresi dolmuş bir bağlantı yeniden canlandırıldığında eski "hazır" durumu
-- geri taşınmaz. Aynı koruma join_room'un tekrar katılma yolunda da geçerlidir.
create or replace function private.reset_expired_ready() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.last_seen <= statement_timestamp() - interval '70 seconds' then
    new.ready := false;
  end if;
  return new;
end;
$$;
revoke all on function private.reset_expired_ready() from public, anon, authenticated;
create trigger reset_expired_ready before update on public.room_players
  for each row execute function private.reset_expired_ready();

create or replace function public.heartbeat(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz;
begin
  -- Diğer oda değişiklikleriyle aynı kilit sırası kullanılır.
  perform 1 from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  v_now := statement_timestamp();
  -- Üyeliği silmeden yalnız hazır bayrağını temizler. Realtime UPDATE üretir.
  update public.room_players set ready = false
    where room_id = p_room_id and active and ready
      and last_seen <= v_now - interval '70 seconds';
  update public.room_players set last_seen = v_now
    where room_id = p_room_id and user_id = auth.uid() and active
      and last_seen < v_now - interval '15 seconds';
end;
$$;

create or replace function public.set_ready(p_room_id uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if p_ready is null then raise exception 'players_not_ready'; end if;
  if p_ready and not exists(select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid() and active
      and last_seen > statement_timestamp() - interval '70 seconds') then
    raise exception 'player_offline';
  end if;
  update public.room_players set ready = p_ready, last_seen = statement_timestamp()
    where room_id = p_room_id and user_id = auth.uid() and active;
  update public.rooms set revision = revision + 1 where id = p_room_id;
end;
$$;

-- Başlatma için de istemcinin saatini/hazır görünümünü değil sunucu lease'ini kullan.
create or replace function public.start_game(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_host uuid;
begin
  select host_id into v_host from public.rooms where id = p_room_id and status = 'lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if v_host <> auth.uid() then raise exception 'host_only'; end if;
  if (select count(*) from public.room_players where room_id = p_room_id and active and ready
    and last_seen > statement_timestamp() - interval '70 seconds') <> 2 then
    raise exception 'players_not_ready';
  end if;
  raise exception 'game_not_available';
end;
$$;
-- CREATE OR REPLACE mevcut execute ACL'lerini korur; yine de açıkça sınırla.
revoke all on function public.heartbeat(uuid), public.set_ready(uuid,boolean), public.start_game(uuid) from public, anon;
grant execute on function public.heartbeat(uuid), public.set_ready(uuid,boolean), public.start_game(uuid) to authenticated;
commit;
