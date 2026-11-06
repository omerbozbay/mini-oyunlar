-- 005 sonrasında Sayı Dedektifi; mevcut oyunlara ait kayıtlar değiştirilmez.
begin;
create function private.four_digits(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare value text:=btrim(p_value);
begin
 if value is null or value!~'^[1-9][0-9]{3}$' or
   (select count(distinct substr(value,i,1)) from generate_series(1,4) i)<>4 then raise exception 'invalid_number'; end if;
 return value;
end $$;
create function private.detective_prepare(p_session uuid,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare value text;
begin
 if jsonb_typeof(p_payload) is distinct from 'string' then raise exception 'invalid_number'; end if;
 value:=private.four_digits(p_payload#>>'{}');
 insert into private.puzzle_secrets values(p_session,p_user,to_jsonb(value));
 return jsonb_set(p_state,array['players',p_actor::text,'prepared'],'true');
end $$;
create function private.detective_guess(p_session uuid,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare value text; secret text; matches int; correct boolean; player jsonb:=p_state->'players'->p_actor; total int;
begin
 if p_state->>'turn_id'<>p_user::text then raise exception 'not_your_turn'; end if;
 if jsonb_typeof(p_payload) is distinct from 'string' then raise exception 'invalid_number'; end if;
 value:=private.four_digits(p_payload#>>'{}');
 select answer#>>'{}' into secret from private.puzzle_secrets where session_id=p_session and user_id<>p_user;
 select count(*) into matches from generate_series(1,4) i where strpos(secret,substr(value,i,1))>0;
 correct:=value=secret;
 player:=player||jsonb_build_object('history',(player->'history')||jsonb_build_array(
   jsonb_build_object('guess',value,'matches',matches,'correct',correct)),
   'guess_count',(player->>'guess_count')::int+1,'done',correct,'solved',correct);
 p_state:=jsonb_set(p_state,array['players',p_actor::text],player);
 total:=(p_state->'players'->0->>'guess_count')::int+(p_state->'players'->1->>'guess_count')::int;
 return p_state||jsonb_build_object('turn_id',p_state->'players'->(1-p_actor)->>'id','round',total/2+1);
end $$;
create or replace function private.supported_puzzle(p_game text) returns boolean
language sql immutable set search_path='' as $$ select p_game in ('chain','detective'); $$;
create or replace function private.puzzle_prepare(p_session uuid,p_game text,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='chain' then return private.chain_prepare(p_session,p_user,p_state,p_actor,p_payload);
 elsif p_game='detective' then return private.detective_prepare(p_session,p_user,p_state,p_actor,p_payload); end if;
 raise exception 'game_not_available';
end $$;
create or replace function private.puzzle_guess(p_session uuid,p_game text,p_user uuid,p_state jsonb,p_actor int,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='chain' then return private.chain_guess(p_session,p_user,p_state,p_actor,p_payload);
 elsif p_game='detective' then return private.detective_guess(p_session,p_user,p_state,p_actor,p_payload); end if;
 raise exception 'game_not_available';
end $$;
create or replace function private.puzzle_outcome(p_game text,p_state jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare winner text; solved0 boolean:=(p_state->'players'->0->>'solved')::boolean;
 solved1 boolean:=(p_state->'players'->1->>'solved')::boolean; finished boolean:=false;
 total int:=(p_state->'players'->0->>'guess_count')::int+(p_state->'players'->1->>'guess_count')::int;
begin
 if p_game='chain' then
   select p->>'id' into winner from jsonb_array_elements(p_state->'players') p where (p->>'done')::boolean limit 1;
   finished:=winner is not null;
 elsif p_game='detective' then
   -- Turun ikinci tahmini gelene kadar ilk bulan oyuncu için sonuç kesinleşmez.
   finished:=total%2=0 and (solved0 or solved1);
   if finished and solved0<>solved1 then winner:=p_state->'players'->(case when solved0 then 0 else 1 end)->>'id'; end if;
 end if;
 return jsonb_build_object('finished',finished,'winner_id',winner);
end $$;
revoke all on function private.four_digits(text),private.detective_prepare(uuid,uuid,jsonb,int,jsonb),
 private.detective_guess(uuid,uuid,jsonb,int,jsonb) from public,anon,authenticated;
commit;
