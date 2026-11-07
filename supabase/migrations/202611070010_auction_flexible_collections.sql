-- 009 sonrasında bir kez çalıştırın. RLS ve mevcut oyunlar korunur.
begin;
alter table public.game_sessions drop constraint game_sessions_phase_check;
alter table public.game_sessions add constraint game_sessions_phase_check
 check(phase in('preparing','playing','bidding','arranging','voting','finished','abandoned'));

-- Ürün sayısı veya zorunlu rezerv yok: teklif yalnız kalan bütçeyle sınırlıdır.
create or replace function private.auction_max(p_player jsonb) returns integer
language sql immutable set search_path='' as $$ select greatest(0,(p_player->>'budget')::int); $$;

-- Yalnız mevcut ürün sonuçlanır. Gelecek ürünler hiçbir koşulda atlanmaz.
create or replace function private.auction_settle(p_state jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare s jsonb:=p_state;ps jsonb:=s->'players';idx int:=(s->>'index')::int;
 price int:=(s->>'current_bid')::int;wi int;product jsonb;
begin
 if idx>=jsonb_array_length(s->'products') then raise exception 'invalid_state';end if;
 product:=s->'products'->idx;
 if price>0 then
   wi:=case when ps->0->>'id'=s->>'bidder_id' then 0 else 1 end;
   if ps->wi->>'id' is distinct from s->>'bidder_id' or (ps->wi->>'budget')::int<price then raise exception 'invalid_state';end if;
   product:=product||jsonb_build_object('price',price,'automatic',false,'paid_by',ps->wi->>'id');
   ps:=jsonb_set(ps,array[wi::text,'budget'],to_jsonb((ps->wi->>'budget')::int-price));
   ps:=jsonb_set(ps,array[wi::text,'items'],(ps->wi->'items')||jsonb_build_array(product));
   s:=s||jsonb_build_object('last_award',jsonb_build_object('player_id',ps->wi->>'id','product',product),'last_skipped',null);
 else
   s:=s||jsonb_build_object('skipped',coalesce(s->'skipped','[]'::jsonb)||jsonb_build_array(product),'last_skipped',product,'last_award',null);
 end if;
 idx:=idx+1;
 return s||jsonb_build_object('players',ps,'index',idx,'current_bid',0,'bidder_id',null,'automatic_count',0,'passes','[]'::jsonb,
 'turn_id',case when idx<jsonb_array_length(s->'products') then ps->(((s->>'starter')::int+idx)%2)->>'id' else null end);
end $$;

create or replace function public.auction_action_impl(p_session_id uuid,p_version bigint,p_request_id uuid,
 p_action text,p_amount integer default null,p_choice uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare g public.game_sessions;r public.rooms;s jsonb;ps jsonb;uid uuid:=auth.uid();rid uuid;
 actor int;other int;bid int;digest text;previous text;vote_count int;distinct_votes int;winner uuid;votes jsonb;passes jsonb;
begin
 select room_id into rid from public.game_sessions where id=p_session_id and game='auction';
 select * into r from public.rooms where id=rid and status='lobby' for update;
 if not found or not private.is_member(rid) then raise exception 'not_a_member';end if;
 select * into g from public.game_sessions where id=p_session_id for update;s:=g.state;ps:=s->'players';
 if not exists(select 1 from jsonb_array_elements(ps) p where p->>'id'=uid::text) then raise exception 'not_a_member';end if;
 if p_request_id is null then raise exception 'invalid_request';end if;
 digest:=md5(jsonb_build_array(p_version,p_action,p_amount,p_choice)::text);
 select q.digest into previous from private.auction_requests q where session_id=g.id and user_id=uid and request_id=p_request_id;
 if found then if previous<>digest then raise exception 'request_conflict';end if;return;end if;
 if r.current_game_id is distinct from g.id then raise exception 'game_not_current';end if;
 if p_action is null or p_action not in('bid','pass','confirm','vote','rematch','lobby') then raise exception 'invalid_action';end if;
 if p_action='lobby' then
   if g.phase not in('finished','abandoned') then raise exception 'invalid_phase';end if;
   update public.rooms set current_game_id=null where id=rid;
   update public.room_players set ready=false where room_id=rid and active;
 else
   if(select count(*) from public.room_players where room_id=rid and active and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_offline';end if;
   if p_action in('bid','pass') then
     if g.phase<>'bidding' then raise exception 'invalid_phase';end if;
     if p_version is distinct from g.version then raise exception 'stale_version';end if;
     if s->>'turn_id' is distinct from uid::text then raise exception 'not_your_turn';end if;
     actor:=case when ps->0->>'id'=uid::text then 0 else 1 end;other:=1-actor;bid:=(s->>'current_bid')::int;
     if p_action='bid' then
       if p_amount is null or p_amount<=bid or p_amount<1 or p_amount>private.auction_max(ps->actor) then raise exception 'invalid_bid';end if;
       s:=s||jsonb_build_object('current_bid',p_amount,'bidder_id',uid,'turn_id',ps->other->>'id','passes','[]'::jsonb);
     elsif bid>0 then s:=private.auction_settle(s);
     else
       passes:=coalesce(s->'passes','[]'::jsonb)||jsonb_build_array(uid);
       s:=s||jsonb_build_object('passes',passes,'turn_id',ps->other->>'id');
       if jsonb_array_length(passes)=2 then s:=private.auction_settle(s);end if;
     end if;
     if(s->>'index')::int=jsonb_array_length(s->'products') then g.phase:='arranging';s:=s||jsonb_build_object('arrange_ready','[]'::jsonb);end if;
   elsif p_action='confirm' then
     if g.phase<>'arranging' then raise exception 'invalid_phase';end if;
     if p_version is distinct from g.version then raise exception 'stale_version';end if;
     if not coalesce(s->'arrange_ready','[]'::jsonb)@>jsonb_build_array(uid) then
       s:=s||jsonb_build_object('arrange_ready',coalesce(s->'arrange_ready','[]'::jsonb)||jsonb_build_array(uid));
     end if;
     if jsonb_array_length(s->'arrange_ready')=2 then g.phase:='voting';end if;
   elsif p_action='vote' then
     if g.phase<>'voting' then raise exception 'invalid_phase';end if;
     if p_choice is not null and not exists(select 1 from jsonb_array_elements(ps) p where p->>'id'=p_choice::text) then raise exception 'invalid_vote';end if;
     if exists(select 1 from private.auction_votes where session_id=g.id and user_id=uid) then raise exception 'already_voted';end if;
     insert into private.auction_votes values(g.id,uid,p_choice);
     select count(*),count(distinct coalesce(choice::text,'draw')),jsonb_object_agg(user_id::text,to_jsonb(choice))
       into vote_count,distinct_votes,votes from private.auction_votes where session_id=g.id;
     s:=jsonb_set(s,'{votes_cast}',(s->'votes_cast')||jsonb_build_array(uid));
     if vote_count=2 then
       if distinct_votes=1 then select choice into winner from private.auction_votes where session_id=g.id limit 1;end if;
       s:=s||jsonb_build_object('winner_id',winner,'votes',votes);g.phase:='finished';
     end if;
   else
     if g.phase<>'finished' then raise exception 'invalid_phase';end if;
     if not(s->'rematch_ready')@>jsonb_build_array(uid) then s:=jsonb_set(s,'{rematch_ready}',(s->'rematch_ready')||jsonb_build_array(uid));end if;
     if jsonb_array_length(s->'rematch_ready')=2 then perform private.new_auction(rid);end if;
   end if;
   update public.game_sessions set state=s,phase=g.phase,version=version+1 where id=g.id;
 end if;
 insert into private.auction_requests values(g.id,uid,p_request_id,digest);
 update public.rooms set revision=revision+1 where id=rid;
end $$;

-- Hediye bütçeyi değiştirmez. Yalnız sahip kendi ürününü verebilir; oy başladıktan sonra koleksiyonlar kilitlidir.
create function public.auction_gift(p_session_id uuid,p_version bigint,p_request_id uuid,p_item_id text) returns void
language plpgsql security definer set search_path='' as $$
declare g public.game_sessions;r public.rooms;rid uuid;uid uuid:=auth.uid();s jsonb;ps jsonb;
 actor int;other int;item jsonb;items jsonb;digest text;previous text;
begin
 select room_id into rid from public.game_sessions where id=p_session_id and game='auction';
 select * into r from public.rooms where id=rid and status='lobby' for update;
 if not found or not private.is_member(rid) then raise exception 'not_a_member';end if;
 select * into g from public.game_sessions where id=p_session_id for update;s:=g.state;ps:=s->'players';
 if not exists(select 1 from jsonb_array_elements(ps) p where p->>'id'=uid::text) then raise exception 'not_a_member';end if;
 if p_request_id is null then raise exception 'invalid_request';end if;
 digest:=md5(jsonb_build_array('gift',p_version,p_item_id)::text);
 select q.digest into previous from private.auction_requests q where session_id=g.id and user_id=uid and request_id=p_request_id;
 if found then if previous<>digest then raise exception 'request_conflict';end if;return;end if;
 if r.current_game_id is distinct from g.id then raise exception 'game_not_current';end if;
 if g.phase not in('bidding','arranging') then raise exception 'invalid_phase';end if;
 if p_version is distinct from g.version then raise exception 'stale_version';end if;
 if(select count(*) from public.room_players where room_id=rid and active and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_offline';end if;
 actor:=case when ps->0->>'id'=uid::text then 0 else 1 end;other:=1-actor;
 select value into item from jsonb_array_elements(ps->actor->'items') where value->>'id'=p_item_id;
 if not found then raise exception 'item_not_owned';end if;
 select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into items from jsonb_array_elements(ps->actor->'items') with ordinality t(value,ord) where value->>'id'<>p_item_id;
 item:=item||jsonb_build_object('gifted_by',uid,'paid_by',coalesce(item->>'paid_by',uid::text));
 ps:=jsonb_set(ps,array[actor::text,'items'],items);
 ps:=jsonb_set(ps,array[other::text,'items'],(ps->other->'items')||jsonb_build_array(item));
 s:=s||jsonb_build_object('players',ps,'arrange_ready','[]'::jsonb,
   'last_gift',jsonb_build_object('from',uid,'to',ps->other->>'id','product',item));
 update public.game_sessions set state=s,version=version+1 where id=g.id;
 update public.rooms set revision=revision+1 where id=rid;
 insert into private.auction_requests values(g.id,uid,p_request_id,digest);
end $$;
revoke all on function public.auction_gift(uuid,bigint,uuid,text) from public,anon;
grant execute on function public.auction_gift(uuid,bigint,uuid,text) to authenticated;
revoke all on function public.auction_action_impl(uuid,bigint,uuid,text,integer,uuid) from public,anon,authenticated;
commit;
