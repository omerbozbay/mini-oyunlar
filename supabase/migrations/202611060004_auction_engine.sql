-- 001, 002 ve 003 migration'larından SONRA bir kez çalıştırın.
begin;
alter table public.rooms add column auction_theme text not null default 'pizza'
  references private.auction_catalog(theme);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  game text not null default 'auction' check (game = 'auction'),
  theme text not null references private.auction_catalog(theme),
  phase text not null check (phase in ('bidding','voting','finished','abandoned')),
  version bigint not null default 0,
  state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.rooms add column current_game_id uuid references public.game_sessions(id) on delete set null;
create index game_room on public.game_sessions(room_id);
alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from public, anon, authenticated;
grant select on public.game_sessions to authenticated;
create policy member_reads_games on public.game_sessions for select to authenticated
  using (private.is_member(room_id));

-- Oylar oylama bitene kadar API ve Realtime'a kesinlikle açılmaz.
create table private.auction_votes (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  choice uuid references auth.users(id),
  primary key(session_id,user_id)
);
create table private.auction_requests (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  digest text not null,
  primary key(session_id,user_id,request_id)
);
alter table private.auction_votes enable row level security;
alter table private.auction_requests enable row level security;
revoke all on private.auction_votes, private.auction_requests from public, anon, authenticated;

create function private.auction_max(p_player jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case when jsonb_array_length(p_player->'items') >= 5 then 0
    else (p_player->>'budget')::int - (4 - jsonb_array_length(p_player->'items')) end;
$$;

create function private.new_auction(p_room uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_theme text; v_pool jsonb; v_products jsonb; v_players jsonb; v_id uuid; v_starter int;
begin
  select auction_theme into v_theme from public.rooms where id=p_room;
  select items into v_pool from private.auction_catalog where theme=v_theme;
  select jsonb_agg(item) into v_products from
    (select value as item from jsonb_array_elements(v_pool) order by random() limit 10) picked;
  select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'budget',20,'items','[]'::jsonb) order by joined_at,user_id)
    into v_players from public.room_players where room_id=p_room and active;
  v_starter := floor(random()*2)::int;
  insert into public.game_sessions(room_id,theme,phase,state) values(p_room,v_theme,'bidding',
    jsonb_build_object('players',v_players,'products',v_products,'index',0,'starter',v_starter,
      'turn_id',v_players->v_starter->>'id','current_bid',0,'bidder_id',null,
      'votes_cast','[]'::jsonb,'winner_id',null,'rematch_ready','[]'::jsonb)) returning id into v_id;
  update public.rooms set current_game_id=v_id,revision=revision+1 where id=p_room;
  update public.room_players set ready=false where room_id=p_room and active;
  return v_id;
end;
$$;

-- Tek ürünün tahsisi ve beş ürün tamamlanınca kalanların 1 TL'den otomatik dağıtımı.
create function private.auction_settle(p_state jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare s jsonb := p_state; ps jsonb := s->'players'; wi int; other int; idx int := (s->>'index')::int;
  price int := (s->>'current_bid')::int; product jsonb; cnt int; auto_count int := 0;
begin
  wi := case when ps->0->>'id'=s->>'bidder_id' then 0 else 1 end;
  product := (s->'products'->idx) || jsonb_build_object('price',price,'automatic',false);
  ps := jsonb_set(ps,array[wi::text,'budget'],to_jsonb((ps->wi->>'budget')::int-price));
  ps := jsonb_set(ps,array[wi::text,'items'],(ps->wi->'items') || jsonb_build_array(product));
  s := s || jsonb_build_object('last_award',jsonb_build_object('player_id',ps->wi->>'id','product',product));
  idx := idx+1;
  if jsonb_array_length(ps->wi->'items')=5 then
    other := 1-wi;
    while idx < 10 loop
      if (ps->other->>'budget')::int < 1 or jsonb_array_length(ps->other->'items')>=5 then raise exception 'invalid_state'; end if;
      product := (s->'products'->idx) || jsonb_build_object('price',1,'automatic',true);
      ps := jsonb_set(ps,array[other::text,'items'],(ps->other->'items') || jsonb_build_array(product));
      ps := jsonb_set(ps,array[other::text,'budget'],to_jsonb((ps->other->>'budget')::int-1));
      idx := idx+1; auto_count := auto_count+1;
    end loop;
  end if;
  s := s || jsonb_build_object('players',ps,'index',idx,'current_bid',0,'bidder_id',null,'automatic_count',auto_count,
    'turn_id',case when idx<10 then ps->(((s->>'starter')::int+idx)%2)->>'id' else null end);
  return s;
end;
$$;

create function public.select_auction_theme(p_room_id uuid,p_theme text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id=p_room_id and status='lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if r.host_id<>auth.uid() then raise exception 'host_only'; end if;
  if r.current_game_id is not null then raise exception 'game_in_progress'; end if;
  if not exists(select 1 from private.auction_catalog where theme=p_theme) then raise exception 'invalid_theme'; end if;
  if r.auction_theme=p_theme then return; end if;
  update public.rooms set auction_theme=p_theme,revision=revision+1 where id=p_room_id;
  update public.room_players set ready=false where room_id=p_room_id and active;
end;
$$;

create or replace function public.start_game(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id=p_room_id and status='lobby' for update;
  if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
  if r.host_id<>auth.uid() then raise exception 'host_only'; end if;
  if r.current_game_id is not null then raise exception 'game_in_progress'; end if;
  if (select count(*) from public.room_players where room_id=p_room_id and active and ready
    and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_not_ready'; end if;
  if r.selected_game<>'auction' then raise exception 'game_not_available'; end if;
  perform private.new_auction(p_room_id);
end;
$$;

create function public.auction_action(p_session_id uuid,p_version bigint,p_request_id uuid,
  p_action text,p_amount integer default null,p_choice uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.game_sessions; r public.rooms; s jsonb; ps jsonb; uid uuid := auth.uid();
  roomid uuid; actor int; other int; bid int; maxbid int; digest text; previous text;
  vote_count int; distinct_votes int; winner uuid; votes jsonb;
begin
  select room_id into roomid from public.game_sessions where id=p_session_id;
  select * into r from public.rooms where id=roomid and status='lobby' for update;
  if not found or not private.is_member(roomid) then raise exception 'not_a_member'; end if;
  select * into g from public.game_sessions where id=p_session_id for update;
  s := g.state; ps := s->'players';
  if not exists(select 1 from jsonb_array_elements(ps) p where p->>'id'=uid::text) then raise exception 'not_a_member'; end if;
  if p_request_id is null then raise exception 'invalid_request'; end if;
  digest := md5(jsonb_build_array(p_version,p_action,p_amount,p_choice)::text);
  select q.digest into previous from private.auction_requests q
    where session_id=p_session_id and user_id=uid and request_id=p_request_id;
  if found then
    if previous<>digest then raise exception 'request_conflict'; end if;
    return;
  end if;
  if r.current_game_id is distinct from p_session_id then raise exception 'game_not_current'; end if;
  if p_action is null or p_action not in ('bid','pass','vote','rematch','lobby') then raise exception 'invalid_action'; end if;
  if p_action='lobby' then
    if g.phase not in ('finished','abandoned') then raise exception 'invalid_phase'; end if;
    update public.rooms set current_game_id=null,revision=revision+1 where id=roomid;
    update public.room_players set ready=false where room_id=roomid and active;
  else
    -- Bağlantı duraklaması sunucuda doğrulanır, istemci durumuna güvenilmez.
    if (select count(*) from public.room_players where room_id=roomid and active
      and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_offline'; end if;
    if p_action in ('bid','pass') then
      if g.phase<>'bidding' then raise exception 'invalid_phase'; end if;
      if p_version is distinct from g.version then raise exception 'stale_version'; end if;
      if s->>'turn_id'<>uid::text then raise exception 'not_your_turn'; end if;
      actor := case when ps->0->>'id'=uid::text then 0 else 1 end; other:=1-actor;
      if jsonb_array_length(ps->actor->'items')>=5 then raise exception 'collection_full'; end if;
      bid := (s->>'current_bid')::int;
      if p_action='bid' then
        maxbid := private.auction_max(ps->actor);
        if p_amount is null or p_amount<=bid or p_amount<1 or p_amount>maxbid then raise exception 'invalid_bid'; end if;
        s := s || jsonb_build_object('current_bid',p_amount,'bidder_id',uid,'turn_id',ps->other->>'id');
        -- Rakip artıramıyorsa sunucu güvenle pas kabul edip ürünü tahsis eder.
        if private.auction_max(ps->other)<=p_amount then s:=private.auction_settle(s); end if;
      else
        if bid=0 or s->>'bidder_id' is null then raise exception 'cannot_pass_first'; end if;
        s:=private.auction_settle(s);
      end if;
      update public.game_sessions set state=s,phase=case when (s->>'index')::int=10 then 'voting' else 'bidding' end,
        version=version+1 where id=p_session_id;
    elsif p_action='vote' then
      if g.phase<>'voting' then raise exception 'invalid_phase'; end if;
      if p_choice is not null and not exists(select 1 from jsonb_array_elements(ps) p where p->>'id'=p_choice::text) then raise exception 'invalid_vote'; end if;
      if exists(select 1 from private.auction_votes where session_id=p_session_id and user_id=uid) then raise exception 'already_voted'; end if;
      insert into private.auction_votes values(p_session_id,uid,p_choice);
      select count(*),count(distinct coalesce(choice::text,'draw')),
        jsonb_object_agg(user_id::text,to_jsonb(choice)) into vote_count,distinct_votes,votes
        from private.auction_votes where session_id=p_session_id;
      s:=jsonb_set(s,'{votes_cast}',(s->'votes_cast') || jsonb_build_array(uid));
      if vote_count=2 then
        if distinct_votes=1 then select choice into winner from private.auction_votes where session_id=p_session_id limit 1; end if;
        s:=s || jsonb_build_object('winner_id',winner,'votes',votes);
      end if;
      update public.game_sessions set state=s,phase=case when vote_count=2 then 'finished' else 'voting' end,
        version=version+1 where id=p_session_id;
    else
      if g.phase<>'finished' then raise exception 'invalid_phase'; end if;
      if not (s->'rematch_ready') @> jsonb_build_array(uid) then
        s:=jsonb_set(s,'{rematch_ready}',(s->'rematch_ready') || jsonb_build_array(uid));
        update public.game_sessions set state=s,version=version+1 where id=p_session_id;
      end if;
      if jsonb_array_length(s->'rematch_ready')=2 then perform private.new_auction(roomid); end if;
    end if;
  end if;
  insert into private.auction_requests values(p_session_id,uid,p_request_id,digest);
  update public.rooms set revision=revision+1 where id=roomid;
end;
$$;

-- Devam eden maçta tema/oyun değişimi sunucuda engellenir.
create function private.guard_game_selection() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.current_game_id is not null and
    (new.auction_theme is distinct from old.auction_theme or new.selected_game is distinct from old.selected_game) then
    raise exception 'game_in_progress';
  end if;
  return new;
end;
$$;
create trigger guard_game_selection before update on public.rooms for each row execute function private.guard_game_selection();

-- "Odadan ayrıl" maçı bitirir; ağ kaybı bu trigger'ı çalıştırmaz.
create function private.abandon_game_on_leave() returns trigger
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if old.active and not new.active then
    select current_game_id into gid from public.rooms where id=old.room_id for update;
    if gid is not null then
      update public.game_sessions set phase=case when phase='finished' then phase else 'abandoned' end,
        version=version+1 where id=gid;
      update public.rooms set current_game_id=null,revision=revision+1 where id=old.room_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger abandon_game_on_leave before update on public.room_players for each row execute function private.abandon_game_on_leave();

-- Yenileme tek RPC'de mevcut maçı da geri getirir. Oylar yalnız tamamlanınca state'e girer.
create or replace function public.get_room_snapshot(p_code text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('room',to_jsonb(r),
    'players',coalesce((select jsonb_agg(to_jsonb(p) order by p.joined_at,p.user_id)
      from public.room_players p where p.room_id=r.id and p.active),'[]'::jsonb),
    'game',(select to_jsonb(g) from public.game_sessions g where g.id=r.current_game_id),
    'server_time',statement_timestamp())
    from public.rooms r where r.code=upper(btrim(p_code)) and r.status='lobby';
$$;

revoke all on function private.auction_max(jsonb),private.new_auction(uuid),private.auction_settle(jsonb),
  private.guard_game_selection(),private.abandon_game_on_leave() from public,anon,authenticated;
revoke all on function public.select_auction_theme(uuid,text),public.auction_action(uuid,bigint,uuid,text,integer,uuid),
  public.start_game(uuid) from public,anon;
grant execute on function public.select_auction_theme(uuid,text),public.auction_action(uuid,bigint,uuid,text,integer,uuid),
  public.start_game(uuid) to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.game_sessions;
  end if;
end $$;
commit;
