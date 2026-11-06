-- 001–004 sonrasında çalıştırın. Açık Artırma verileri ve RPC'leri korunur.
begin;
alter table public.game_sessions drop constraint game_sessions_game_check;
alter table public.game_sessions add constraint game_sessions_game_check check(game in ('auction','chain','detective','wordhunt'));
alter table public.game_sessions drop constraint game_sessions_phase_check;
alter table public.game_sessions add constraint game_sessions_phase_check check(phase in ('preparing','playing','bidding','voting','finished','abandoned'));
alter table public.game_sessions alter column theme drop not null;
alter table public.rooms add column word_length integer not null default 5 check(word_length in (5,6));

-- Bu tablolar API'ye ve Realtime publication'ına açılmaz.
create table private.puzzle_secrets (
 session_id uuid not null references public.game_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id), answer jsonb not null,
 primary key(session_id,user_id)
);
create table private.puzzle_requests (
 session_id uuid not null references public.game_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id), request_id uuid not null, digest text not null,
 primary key(session_id,user_id,request_id)
);
alter table private.puzzle_secrets enable row level security;
alter table private.puzzle_requests enable row level security;
revoke all on private.puzzle_secrets,private.puzzle_requests from public,anon,authenticated;

create function private.tr_word(p_value text,p_min int,p_max int) returns text
language plpgsql immutable set search_path='' as $$
declare word text;
begin
 word := translate(normalize(btrim(p_value),NFC),
   'abcçdefgğhıijklmnoöprsştuüvyz','ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ');
 if word is null or char_length(word) not between p_min and p_max
   or word !~ '^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$' then raise exception 'invalid_word'; end if;
 return word;
end $$;

create function private.new_puzzle(p_room uuid,p_game text,p_length int) returns uuid
language plpgsql security definer set search_path='' as $$
declare ps jsonb; gid uuid; starter int;
begin
 if p_game not in ('chain','detective','wordhunt') or p_length not in (5,6) then raise exception 'invalid_game'; end if;
 select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'prepared',false,'revision',0,
   'progress',1,'history','[]'::jsonb,'done',false,'solved',false,'guess_count',0) order by joined_at,user_id)
   into ps from public.room_players where room_id=p_room and active;
 if jsonb_array_length(ps)<>2 then raise exception 'players_not_ready'; end if;
 starter:=floor(random()*2)::int;
 insert into public.game_sessions(room_id,game,theme,phase,state) values(p_room,p_game,null,'preparing',
   jsonb_build_object('players',ps,'word_length',p_length,'starter',starter,'turn_id',ps->starter->>'id',
   'round',1,'winner_id',null,'rematch_ready','[]'::jsonb)) returning id into gid;
 update public.rooms set current_game_id=gid,revision=revision+1 where id=p_room;
 update public.room_players set ready=false where room_id=p_room and active;
 return gid;
end $$;

-- Yalnız çağıran oyuncunun kendi kilitli cevabı döndürülür. Rakip ID parametresi yoktur.
create function public.my_game_secret(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.game_sessions g where g.id=p_session_id and private.is_member(g.room_id)
   and exists(select 1 from jsonb_array_elements(g.state->'players') p where p->>'id'=auth.uid()::text))
 then raise exception 'not_a_member'; end if;
 return (select answer from private.puzzle_secrets where session_id=p_session_id and user_id=auth.uid());
end $$;

create function private.chain_prepare(p_session uuid,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare answers jsonb := '[]'; value jsonb; hints jsonb := '{}'; ps jsonb; owner uuid; chain jsonb; entries jsonb;
begin
 if jsonb_typeof(p_payload) is distinct from 'array' or jsonb_array_length(p_payload)<>5 then raise exception 'invalid_chain'; end if;
 for value in select * from jsonb_array_elements(p_payload) loop
   if jsonb_typeof(value) is distinct from 'string' then raise exception 'invalid_chain'; end if;
   answers:=answers||jsonb_build_array(private.tr_word(value#>>'{}',2,40));
 end loop;
 insert into private.puzzle_secrets values(p_session,p_user,answers);
 ps:=jsonb_set(p_state->'players',array[p_actor::text,'prepared'],'true');
 p_state:=jsonb_set(p_state,'{players}',ps);
 if (ps->0->>'prepared')::boolean and (ps->1->>'prepared')::boolean then
   -- Her oyuncu için rakip zincirin yalnız izinli projeksiyonu hazırlanır.
   for owner,chain in select user_id,answer from private.puzzle_secrets where session_id=p_session loop
     select jsonb_agg(jsonb_build_object('first',left(v#>>'{}',1),'length',char_length(v#>>'{}'))
       ||case when n=1 then jsonb_build_object('word',v#>>'{}') else '{}'::jsonb end order by n)
       into entries from jsonb_array_elements(chain) with ordinality as t(v,n);
     hints:=jsonb_set(hints,array[ps->(case when ps->0->>'id'=owner::text then 1 else 0 end)->>'id'],entries);
   end loop;
   p_state:=p_state||jsonb_build_object('hints',hints);
 end if;
 return p_state;
end $$;

create function private.chain_guess(p_session uuid,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare word text; answer jsonb; target int := (p_state->'players'->p_actor->>'progress')::int;
  correct boolean; player jsonb := p_state->'players'->p_actor;
begin
 if jsonb_typeof(p_payload) is distinct from 'string' then raise exception 'invalid_word'; end if;
 word:=private.tr_word(p_payload#>>'{}',2,40);
 select s.answer into answer from private.puzzle_secrets s where session_id=p_session and user_id<>p_user;
 correct:=word=answer->>target;
 -- Sınırsız hak; görünür geçmiş yalnız son 50 tahmini saklar.
 player:=player||jsonb_build_object('guess_count',(player->>'guess_count')::int+1,
   'history',(player->'history')||jsonb_build_array(jsonb_build_object('guess',word,'correct',correct,'target',target)));
 if jsonb_array_length(player->'history')>50 then player:=jsonb_set(player,'{history}',(player->'history')-0); end if;
 if correct then
   p_state:=jsonb_set(p_state,array['hints',p_user::text,target::text,'word'],to_jsonb(word));
   player:=player||jsonb_build_object('progress',target+1,'done',target=4,'solved',target=4);
 end if;
 return jsonb_set(p_state,array['players',p_actor::text],player);
end $$;

create function private.supported_puzzle(p_game text) returns boolean
language sql immutable set search_path='' as $$ select p_game='chain'; $$;
create function private.puzzle_prepare(p_session uuid,p_game text,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='chain' then return private.chain_prepare(p_session,p_user,p_state,p_actor,p_payload); end if;
 raise exception 'game_not_available';
end $$;
create function private.puzzle_guess(p_session uuid,p_game text,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='chain' then return private.chain_guess(p_session,p_user,p_state,p_actor,p_payload); end if;
 raise exception 'game_not_available';
end $$;
create function private.puzzle_outcome(p_game text,p_state jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare winner text;
begin
 if p_game='chain' then
   select p->>'id' into winner from jsonb_array_elements(p_state->'players') p where (p->>'done')::boolean limit 1;
 end if;
 return jsonb_build_object('finished',winner is not null,'winner_id',winner);
end $$;

-- Oyun türlerine ait hazırlama/tahmin fonksiyonları ayrı kalır; ortak güvenlik tek yerde.
create function public.puzzle_action(p_session_id uuid,p_version bigint,p_revision int,p_request_id uuid,
 p_action text,p_payload jsonb default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms; g public.game_sessions; rid uuid; uid uuid:=auth.uid(); actor int;
 s jsonb; digest text; previous text; finished boolean:=false; winner uuid; outcome jsonb;
begin
 select room_id into rid from public.game_sessions where id=p_session_id;
 select * into r from public.rooms where id=rid and status='lobby' for update;
 if not found or not private.is_member(rid) then raise exception 'not_a_member'; end if;
 select * into g from public.game_sessions where id=p_session_id for update;
 if g.game not in ('chain','detective','wordhunt') then raise exception 'invalid_game'; end if;
 s:=g.state;
 if not exists(select 1 from jsonb_array_elements(s->'players') p where p->>'id'=uid::text) then raise exception 'not_a_member'; end if;
 actor:=case when s->'players'->0->>'id'=uid::text then 0 else 1 end;
 if p_request_id is null then raise exception 'invalid_request'; end if;
 digest:=md5(jsonb_build_array(p_version,p_revision,p_action,p_payload)::text);
 select q.digest into previous from private.puzzle_requests q where session_id=p_session_id and user_id=uid and request_id=p_request_id;
 if found then if previous<>digest then raise exception 'request_conflict'; end if; return; end if;
 if r.current_game_id is distinct from p_session_id then raise exception 'game_not_current'; end if;
 if p_action is null or p_action not in ('prepare','guess','rematch','lobby') then raise exception 'invalid_action'; end if;
 if p_action='lobby' then
   if g.phase not in ('finished','abandoned') then raise exception 'invalid_phase'; end if;
   update public.rooms set current_game_id=null,revision=revision+1 where id=rid;
   update public.room_players set ready=false where room_id=rid and active;
 else
   if (select count(*) from public.room_players where room_id=rid and active
     and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_offline'; end if;
   if p_action='rematch' then
     if g.phase<>'finished' then raise exception 'invalid_phase'; end if;
     if not(s->'rematch_ready')@>jsonb_build_array(uid) then
       s:=jsonb_set(s,'{rematch_ready}',(s->'rematch_ready')||jsonb_build_array(uid));
       update public.game_sessions set state=s,version=version+1 where id=p_session_id;
     end if;
     if jsonb_array_length(s->'rematch_ready')=2 then perform private.new_puzzle(rid,g.game,(s->>'word_length')::int); end if;
   else
     if p_revision is distinct from (s->'players'->actor->>'revision')::int then raise exception 'stale_version'; end if;
     if p_action='prepare' then
       if g.phase<>'preparing' then raise exception 'invalid_phase'; end if;
       if (s->'players'->actor->>'prepared')::boolean then raise exception 'secret_locked'; end if;
       s:=private.puzzle_prepare(g.id,g.game,uid,s,actor,p_payload);
       if (s->'players'->0->>'prepared')::boolean and (s->'players'->1->>'prepared')::boolean then g.phase:='playing'; end if;
     else
       if g.phase<>'playing' then raise exception 'invalid_phase'; end if;
       if (s->'players'->actor->>'done')::boolean then raise exception 'player_finished'; end if;
       if g.game='detective' and p_version is distinct from g.version then raise exception 'stale_version'; end if;
       s:=private.puzzle_guess(g.id,g.game,uid,s,actor,p_payload);
       outcome:=private.puzzle_outcome(g.game,s);
       finished:=(outcome->>'finished')::boolean; winner:=(outcome->>'winner_id')::uuid;
     end if;
     s:=jsonb_set(s,array['players',actor::text,'revision'],to_jsonb(p_revision+1));
     if finished then
       s:=s||jsonb_build_object('winner_id',winner,'reveals',(select jsonb_object_agg(user_id::text,answer) from private.puzzle_secrets where session_id=g.id));
       g.phase:='finished';
     end if;
     update public.game_sessions set state=s,phase=g.phase,version=version+1 where id=g.id;
   end if;
 end if;
 insert into private.puzzle_requests values(p_session_id,uid,p_request_id,digest);
 update public.rooms set revision=revision+1 where id=rid;
end $$;

-- Sonraki migration'lar yalnız bu başlatıcıya oyun ekleyecek.
create or replace function public.start_game(p_room_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=p_room_id and status='lobby' for update;
 if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
 if r.host_id<>auth.uid() then raise exception 'host_only'; end if;
 if r.current_game_id is not null then raise exception 'game_in_progress'; end if;
 if(select count(*) from public.room_players where room_id=p_room_id and active and ready
   and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_not_ready'; end if;
 if r.selected_game='auction' then perform private.new_auction(p_room_id);
 elsif private.supported_puzzle(r.selected_game) then perform private.new_puzzle(p_room_id,r.selected_game,r.word_length);
 else raise exception 'game_not_available'; end if;
end $$;

-- Mevcut genel RPC'nin yanlış oyun motoruna yönlendirilmesini önle.
alter function public.auction_action(uuid,bigint,uuid,text,integer,uuid) rename to auction_action_impl;
revoke all on function public.auction_action_impl(uuid,bigint,uuid,text,integer,uuid) from public,anon,authenticated;
create function public.auction_action(p_session_id uuid,p_version bigint,p_request_id uuid,p_action text,
 p_amount int default null,p_choice uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.game_sessions where id=p_session_id and game='auction') then raise exception 'invalid_game'; end if;
 perform public.auction_action_impl(p_session_id,p_version,p_request_id,p_action,p_amount,p_choice);
end $$;
revoke all on function private.tr_word(text,int,int),private.new_puzzle(uuid,text,int),
 private.chain_prepare(uuid,uuid,jsonb,int,jsonb),private.chain_guess(uuid,uuid,jsonb,int,jsonb) from public,anon,authenticated;
revoke all on function private.supported_puzzle(text),private.puzzle_prepare(uuid,text,uuid,jsonb,int,jsonb),
 private.puzzle_guess(uuid,text,uuid,jsonb,int,jsonb),private.puzzle_outcome(text,jsonb) from public,anon,authenticated;
revoke all on function public.puzzle_action(uuid,bigint,int,uuid,text,jsonb),public.my_game_secret(uuid),
 public.auction_action(uuid,bigint,uuid,text,int,uuid),public.start_game(uuid) from public,anon;
grant execute on function public.puzzle_action(uuid,bigint,int,uuid,text,jsonb),public.my_game_secret(uuid),
 public.auction_action(uuid,bigint,uuid,text,int,uuid),public.start_game(uuid) to authenticated;
commit;
