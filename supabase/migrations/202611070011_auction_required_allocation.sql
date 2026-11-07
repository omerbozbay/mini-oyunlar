-- 009 ve 010 sonrasında bir kez çalıştırın. Ürün alınmadan geçilmez.
-- Bir oyuncunun bütçesi bitince diğer oyuncu kalanları PARA KESİLMEDEN sırayla dağıtır.
begin;
create function private.auction_allocate(p_state jsonb,p_chooser uuid,p_receiver uuid) returns jsonb
language plpgsql set search_path='' as $$
declare s jsonb:=p_state;ps jsonb:=s->'players';idx int:=(s->>'index')::int;receiver int;product jsonb;
begin
 if idx>=jsonb_array_length(s->'products') then raise exception 'invalid_state';end if;
 receiver:=case when ps->0->>'id'=p_receiver::text then 0 else 1 end;
 product:=(s->'products'->idx)||jsonb_build_object('price',0,'automatic',false,'free',true,'paid_by',null,
   'gifted_by',case when p_chooser<>p_receiver then p_chooser else null end);
 ps:=jsonb_set(ps,array[receiver::text,'items'],(ps->receiver->'items')||jsonb_build_array(product));
 idx:=idx+1;
 return s||jsonb_build_object('players',ps,'index',idx,'current_bid',0,'bidder_id',null,'passes','[]'::jsonb,
   'last_skipped',null,'last_award',jsonb_build_object('player_id',p_receiver,'product',product),
   'turn_id',case when idx<jsonb_array_length(s->'products') then ps->(((s->>'starter')::int+idx)%2)->>'id' else null end);
end $$;
revoke all on function private.auction_allocate(jsonb,uuid,uuid) from public,anon,authenticated;
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
 if p_action is null or p_action not in('bid','pass','allocate','confirm','vote','rematch','lobby') then raise exception 'invalid_action';end if;
 if p_action='lobby' then
   if g.phase not in('finished','abandoned') then raise exception 'invalid_phase';end if;
   update public.rooms set current_game_id=null where id=rid;
   update public.room_players set ready=false where room_id=rid and active;
 else
   if(select count(*) from public.room_players where room_id=rid and active and last_seen>statement_timestamp()-interval '70 seconds')<>2 then raise exception 'players_offline';end if;
   if p_action='allocate' then
     if g.phase<>'bidding' then raise exception 'invalid_phase';end if;
     if p_version is distinct from g.version then raise exception 'stale_version';end if;
     if (s->>'current_bid')::int<>0 or ((ps->0->>'budget')::int>0 and (ps->1->>'budget')::int>0) then raise exception 'allocation_unavailable';end if;
     actor:=case when ps->0->>'id'=uid::text then 0 else 1 end;other:=1-actor;
     if ((ps->actor->>'budget')::int=0 and (ps->other->>'budget')::int>0)
       or ((ps->0->>'budget')::int=0 and (ps->1->>'budget')::int=0 and s->>'turn_id' is distinct from uid::text)
       then raise exception 'not_your_turn';end if;
     if p_choice is null or not exists(select 1 from jsonb_array_elements(ps) p where p->>'id'=p_choice::text) then raise exception 'invalid_recipient';end if;
     s:=private.auction_allocate(s,uid,p_choice);
     if(s->>'index')::int=jsonb_array_length(s->'products') then g.phase:='arranging';s:=s||jsonb_build_object('arrange_ready','[]'::jsonb);end if;
   elsif p_action in('bid','pass') then
     if g.phase<>'bidding' then raise exception 'invalid_phase';end if;
     if p_version is distinct from g.version then raise exception 'stale_version';end if;
     if (ps->0->>'budget')::int=0 or (ps->1->>'budget')::int=0 then raise exception 'allocation_required';end if;
     if s->>'turn_id' is distinct from uid::text then raise exception 'not_your_turn';end if;
     actor:=case when ps->0->>'id'=uid::text then 0 else 1 end;other:=1-actor;bid:=(s->>'current_bid')::int;
     if p_action='bid' then
       if p_amount is null or p_amount<=bid or p_amount<1 or p_amount>private.auction_max(ps->actor) then raise exception 'invalid_bid';end if;
       s:=s||jsonb_build_object('current_bid',p_amount,'bidder_id',uid,'turn_id',ps->other->>'id','passes','[]'::jsonb);
     else
       if bid=0 then raise exception 'cannot_pass_first';end if;
       s:=private.auction_settle(s);
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

revoke all on function public.auction_action_impl(uuid,bigint,uuid,text,integer,uuid) from public,anon,authenticated;
commit;
