-- 005 ve 006 sonrasında Kelime Avı. Gizli cevaplar private şemada kalır.
begin;
create function private.wordle_marks(p_secret text,p_guess text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n int:=char_length(p_secret); marks text[]; remaining text[]; i int; pos int;
begin
 if n is null or n<>char_length(p_guess) then raise exception 'invalid_word'; end if;
 marks:=array_fill('absent'::text,array[n]);remaining:=array_fill(null::text,array[n]);
 -- Önce yeşiller tüketilir; sonra kalan her harf yalnız bir sarı eşleşme üretir.
 for i in 1..n loop
   if substr(p_secret,i,1)=substr(p_guess,i,1) then marks[i]:='correct';
   else remaining[i]:=substr(p_secret,i,1); end if;
 end loop;
 for i in 1..n loop
   if marks[i]<>'correct' then
     pos:=array_position(remaining,substr(p_guess,i,1));
     if pos is not null then marks[i]:='present';remaining[pos]:=null;end if;
   end if;
 end loop;
 return to_jsonb(marks);
end $$;
create function private.wordhunt_prepare(p_session uuid,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare word text;n int:=(p_state->>'word_length')::int;
begin
 if jsonb_typeof(p_payload) is distinct from 'string' then raise exception 'invalid_word'; end if;
 word:=private.tr_word(p_payload#>>'{}',n,n);
 insert into private.puzzle_secrets values(p_session,p_user,to_jsonb(word));
 return jsonb_set(p_state,array['players',p_actor::text,'prepared'],'true');
end $$;
create function private.wordhunt_guess(p_session uuid,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare word text;secret text;n int:=(p_state->>'word_length')::int;player jsonb:=p_state->'players'->p_actor;
 count int:=(player->>'guess_count')::int;correct boolean;
begin
 if count>=6 then raise exception 'guess_limit'; end if;
 if jsonb_typeof(p_payload) is distinct from 'string' then raise exception 'invalid_word'; end if;
 word:=private.tr_word(p_payload#>>'{}',n,n);
 select answer#>>'{}' into secret from private.puzzle_secrets where session_id=p_session and user_id<>p_user;
 correct:=word=secret;count:=count+1;
 player:=player||jsonb_build_object('history',(player->'history')||jsonb_build_array(
   jsonb_build_object('guess',word,'correct',correct,'marks',private.wordle_marks(secret,word))),
   'guess_count',count,'solved',correct,'done',correct or count=6);
 return jsonb_set(p_state,array['players',p_actor::text],player);
end $$;
create or replace function private.supported_puzzle(p_game text) returns boolean
language sql immutable set search_path='' as $$ select p_game in ('chain','detective','wordhunt'); $$;
create or replace function private.puzzle_prepare(p_session uuid,p_game text,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='chain' then return private.chain_prepare(p_session,p_user,p_state,p_actor,p_payload);
 elsif p_game='detective' then return private.detective_prepare(p_session,p_user,p_state,p_actor,p_payload);
 elsif p_game='wordhunt' then return private.wordhunt_prepare(p_session,p_user,p_state,p_actor,p_payload); end if;
 raise exception 'game_not_available';
end $$;
create or replace function private.puzzle_guess(p_session uuid,p_game text,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='chain' then return private.chain_guess(p_session,p_user,p_state,p_actor,p_payload);
 elsif p_game='detective' then return private.detective_guess(p_session,p_user,p_state,p_actor,p_payload);
 elsif p_game='wordhunt' then return private.wordhunt_guess(p_session,p_user,p_state,p_actor,p_payload); end if;
 raise exception 'game_not_available';
end $$;
create or replace function private.puzzle_outcome(p_game text,p_state jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare winner text;solved0 boolean:=(p_state->'players'->0->>'solved')::boolean;
 solved1 boolean:=(p_state->'players'->1->>'solved')::boolean;finished boolean:=false;
 count0 int:=(p_state->'players'->0->>'guess_count')::int;count1 int:=(p_state->'players'->1->>'guess_count')::int;
begin
 if p_game='chain' then
   select p->>'id' into winner from jsonb_array_elements(p_state->'players') p where (p->>'done')::boolean limit 1;
   finished:=winner is not null;
 elsif p_game='detective' then
   finished:=(count0+count1)%2=0 and (solved0 or solved1);
   if finished and solved0<>solved1 then winner:=p_state->'players'->(case when solved0 then 0 else 1 end)->>'id'; end if;
 elsif p_game='wordhunt' then
   finished:=(p_state->'players'->0->>'done')::boolean and (p_state->'players'->1->>'done')::boolean;
   if finished then
     if solved0 and (not solved1 or count0<count1) then winner:=p_state->'players'->0->>'id';
     elsif solved1 and (not solved0 or count1<count0) then winner:=p_state->'players'->1->>'id'; end if;
   end if;
 end if;
 return jsonb_build_object('finished',finished,'winner_id',winner);
end $$;
create function public.select_word_length(p_room_id uuid,p_length int) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=p_room_id and status='lobby' for update;
 if not found or not private.is_member(p_room_id) then raise exception 'not_a_member'; end if;
 if r.host_id<>auth.uid() then raise exception 'host_only'; end if;
 if r.current_game_id is not null then raise exception 'game_in_progress'; end if;
 if p_length is null or p_length not in(5,6) then raise exception 'invalid_length'; end if;
 if r.word_length=p_length then return; end if;
 update public.rooms set word_length=p_length,revision=revision+1 where id=p_room_id;
 update public.room_players set ready=false where room_id=p_room_id and active;
end $$;
create or replace function private.guard_game_selection() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.current_game_id is not null and (new.auction_theme is distinct from old.auction_theme
   or new.selected_game is distinct from old.selected_game or new.word_length is distinct from old.word_length)
 then raise exception 'game_in_progress';end if;
 return new;
end $$;
revoke all on function private.wordle_marks(text,text),private.wordhunt_prepare(uuid,uuid,jsonb,int,jsonb),
 private.wordhunt_guess(uuid,uuid,jsonb,int,jsonb) from public,anon,authenticated;
revoke all on function public.select_word_length(uuid,int) from public,anon;
grant execute on function public.select_word_length(uuid,int) to authenticated;
commit;
