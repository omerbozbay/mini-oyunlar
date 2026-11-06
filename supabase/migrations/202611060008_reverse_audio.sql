-- 001–007 sonrasında, Supabase SQL Editor'de bir kez çalıştırın.
begin;
alter table public.rooms drop constraint rooms_selected_game_check;
alter table public.rooms add constraint rooms_selected_game_check check(selected_game in('auction','chain','detective','wordhunt','reverse'));
alter table public.game_sessions drop constraint game_sessions_game_check;
alter table public.game_sessions add constraint game_sessions_game_check check(game in('auction','chain','detective','wordhunt','reverse'));

create table private.reverse_assets(
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.game_sessions(id) on delete cascade,
 round_no int not null check(round_no between 1 and 6), user_id uuid not null references auth.users(id),
 kind text not null check(kind in('narrator','mimic')), path text not null unique, committed boolean not null default false,
 frames int, sample_rate int, channels int, created_at timestamptz not null default now(), expires_at timestamptz
);
create table private.reverse_rounds(
 session_id uuid not null references public.game_sessions(id) on delete cascade, round_no int not null,
 narrator_id uuid not null, guesser_id uuid not null, answer text,
 narrator_asset uuid references private.reverse_assets(id) on delete set null,
 mimic_asset uuid references private.reverse_assets(id) on delete set null,
 listen_status text not null default 'unused' check(listen_status in('unused','reserved','started','used','failed')),
 listen_token uuid, listen_until timestamptz, started_at timestamptz,
 mimic_status text not null default 'unused' check(mimic_status in('unused','reserved','captured','committed')),
 primary key(session_id,round_no)
);
create table private.reverse_requests(
 session_id uuid not null references public.game_sessions(id) on delete cascade,user_id uuid not null,
 request_id uuid not null,digest text not null,result jsonb not null,primary key(session_id,user_id,request_id)
);
alter table private.reverse_assets enable row level security;
alter table private.reverse_rounds enable row level security;
alter table private.reverse_requests enable row level security;
revoke all on private.reverse_assets,private.reverse_rounds,private.reverse_requests from public,anon,authenticated;

create function private.reverse_round(p_session uuid,p_state jsonb,p_round int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ni int:=((p_state->>'starter')::int+p_round-1)%2;cur jsonb;
begin
 cur:=jsonb_build_object('number',p_round,'narrator_id',p_state->'players'->ni->>'id',
 'guesser_id',p_state->'players'->(1-ni)->>'id','phase','preparing','category',null,
 'listen_status','unused','mimic_status','unused','ready','[]'::jsonb,'guess',null);
 insert into private.reverse_rounds(session_id,round_no,narrator_id,guesser_id)
 values(p_session,p_round,(cur->>'narrator_id')::uuid,(cur->>'guesser_id')::uuid);
 return p_state||jsonb_build_object('current',cur);
end $$;
create function private.new_reverse(p_room uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare ps jsonb;s jsonb;gid uuid;
begin
 select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'score',0) order by joined_at,user_id)
 into ps from public.room_players where room_id=p_room and active;
 if jsonb_array_length(ps)<>2 then raise exception 'players_not_ready';end if;
 s:=jsonb_build_object('players',ps,'starter',floor(random()*2)::int,'rounds','[]'::jsonb,
 'winner_id',null,'rematch_ready','[]'::jsonb);
 insert into public.game_sessions(room_id,game,theme,phase,state) values(p_room,'reverse',null,'playing',s) returning id into gid;
 s:=private.reverse_round(gid,s,1);update public.game_sessions set state=s where id=gid;
 update public.rooms set current_game_id=gid,revision=revision+1 where id=p_room;
 update public.room_players set ready=false where room_id=p_room and active;
 return gid;
end $$;

-- Sadece sunucunun çıkardığı yol için yükleme. Overwrite/update politikası yoktur.
create function private.reverse_can_upload(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.reverse_assets a join public.game_sessions g on g.id=a.session_id
 join public.rooms r on r.current_game_id=g.id
 where a.path=p_path and a.user_id=auth.uid() and not a.committed
 and (a.expires_at is null or a.expires_at>now()) and private.is_member(g.room_id) and g.phase='playing'
 and (g.state->'current'->>'number')::int=a.round_no
 and ((a.kind='narrator' and g.state->'current'->>'phase'='preparing')
 or(a.kind='mimic' and g.state->'current'->>'phase'='imitating')));
$$;
create function private.reverse_can_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.reverse_assets a join public.game_sessions g on g.id=a.session_id
 join private.reverse_rounds r on r.session_id=a.session_id and r.round_no=a.round_no
 where a.path=p_path and (a.expires_at is null or a.expires_at>now()) and private.is_member(g.room_id)
 and auth.uid() in(r.narrator_id,r.guesser_id)
 and (a.user_id=auth.uid() or(a.committed and(
   exists(select 1 from jsonb_array_elements(g.state->'rounds') x where (x->>'number')::int=a.round_no)
   or(a.kind='narrator' and r.guesser_id=auth.uid() and r.listen_status='reserved' and r.listen_until>now())))));
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('reverse-audio','reverse-audio',false,2000000,array['audio/wav','audio/x-wav']);
create policy reverse_audio_insert on storage.objects for insert to authenticated
 with check(bucket_id='reverse-audio' and owner_id=auth.uid()::text and private.reverse_can_upload(name));
create policy reverse_audio_select on storage.objects for select to authenticated
 using(bucket_id='reverse-audio' and private.reverse_can_read(name));
-- Kullanıcı yalnız kendi henüz gönderilmemiş dosyasını kaldırabilir.
create policy reverse_audio_delete on storage.objects for delete to authenticated
 using(bucket_id='reverse-audio' and private.reverse_can_upload(name));

create function private.reverse_commit_asset(p_id uuid,p_user uuid,p_frames int,p_rate int,p_channels int) returns void
language plpgsql security definer set search_path='' as $$
declare a private.reverse_assets;size bigint;mime text;owner text;
begin
 select * into a from private.reverse_assets where id=p_id;
 if not found or a.user_id<>p_user or a.committed or not private.reverse_can_upload(a.path) then raise exception 'invalid_audio_ticket';end if;
 if p_frames is null or p_rate is null or p_channels is null or p_rate not between 8000 and 96000
 or p_channels not between 1 and 8 or p_frames<1 or p_frames::numeric/p_rate>10 then raise exception 'invalid_audio';end if;
 select (metadata->>'size')::bigint,metadata->>'mimetype',owner_id into size,mime,owner
 from storage.objects where bucket_id='reverse-audio' and name=a.path;
 if not found or owner<>p_user::text or mime not in('audio/wav','audio/x-wav')
 or size is null or size>2000000 or size<>44+p_frames::bigint*p_channels*2 then raise exception 'invalid_audio';end if;
 update private.reverse_assets set committed=true,frames=p_frames,sample_rate=p_rate,channels=p_channels where id=p_id;
end $$;

create function public.reverse_context(p_session_id uuid,p_round int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.game_sessions;r private.reverse_rounds;uid uuid:=auth.uid();
begin
 select * into g from public.game_sessions where id=p_session_id and game='reverse';
 select * into r from private.reverse_rounds where session_id=p_session_id and round_no=p_round;
 if not found or g.id is null or not private.is_member(g.room_id) or uid not in(r.narrator_id,r.guesser_id) then raise exception 'not_a_member';end if;
 return jsonb_build_object('my_word',case when uid=r.narrator_id then r.answer else null end,
 'listen_token',case when uid=r.guesser_id then r.listen_token else null end,'listen_status',r.listen_status,
 'started_at',r.started_at,'listen_until',r.listen_until,'mimic_status',r.mimic_status,
 'narrator_audio',(select to_jsonb(a) from private.reverse_assets a where id=r.narrator_asset and private.reverse_can_read(a.path)),
 'mimic_audio',(select to_jsonb(a) from private.reverse_assets a where id=r.mimic_asset and private.reverse_can_read(a.path)));
end $$;

create function public.reverse_action(p_session_id uuid,p_round int,p_version bigint,p_request_id uuid,
 p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.game_sessions;room public.rooms;r private.reverse_rounds;s jsonb;cur jsonb;
 uid uuid:=auth.uid();rid uuid;digest text;old private.reverse_requests;result jsonb:='{}';
 a private.reverse_assets;ticket uuid;v_kind text;category text;word text;guess text;correct boolean;idx int;ps jsonb;
begin
 select room_id into rid from public.game_sessions where id=p_session_id and game='reverse';
 select * into room from public.rooms where id=rid and status='lobby' for update;
 if not found or not private.is_member(rid) then raise exception 'not_a_member';end if;
 select * into g from public.game_sessions where id=p_session_id for update;s:=g.state;cur:=s->'current';
 if not exists(select 1 from jsonb_array_elements(s->'players') p where p->>'id'=uid::text) then raise exception 'not_a_member';end if;
 if p_request_id is null then raise exception 'invalid_request';end if;
 digest:=md5(jsonb_build_array(p_round,p_version,p_action,p_payload)::text);
 select * into old from private.reverse_requests where session_id=p_session_id and user_id=uid and request_id=p_request_id;
 if found then if old.digest<>digest then raise exception 'request_conflict';end if;return old.result;end if;
 if room.current_game_id is distinct from p_session_id then raise exception 'game_not_current';end if;
 if p_action='lobby' then
   if g.phase not in('finished','abandoned') then raise exception 'invalid_phase';end if;
   update public.rooms set current_game_id=null where id=rid;update public.room_players set ready=false where room_id=rid and active;
 else
   if(select count(*) from public.room_players where room_id=rid and active and last_seen>now()-interval '70 seconds')<>2 then raise exception 'players_offline';end if;
   if p_action='rematch' then
     if g.phase<>'finished' then raise exception 'invalid_phase';end if;
     if not(s->'rematch_ready')@>jsonb_build_array(uid) then s:=jsonb_set(s,'{rematch_ready}',(s->'rematch_ready')||jsonb_build_array(uid));end if;
     if jsonb_array_length(s->'rematch_ready')=2 then perform private.new_reverse(rid);end if;
   else
     if g.phase<>'playing' then raise exception 'invalid_phase';end if;
     if p_round is distinct from (cur->>'number')::int then raise exception 'stale_round';end if;
     select * into r from private.reverse_rounds where session_id=g.id and round_no=p_round for update;
     if p_action in('upload_ticket','reserve_mimic') then
       v_kind:=case when p_action='upload_ticket' then 'narrator' else 'mimic' end;
       if(v_kind='narrator' and(uid<>r.narrator_id or cur->>'phase'<>'preparing'))
       or(v_kind='mimic' and(uid<>r.guesser_id or cur->>'phase'<>'imitating')) then raise exception 'not_your_role';end if;
       if v_kind='mimic' and r.mimic_status in('captured','committed') then raise exception 'mimic_locked';end if;
       select * into a from private.reverse_assets where session_id=g.id and round_no=p_round and user_id=uid
         and reverse_assets.kind=v_kind and not committed and expires_at is null order by created_at desc limit 1;
       if not found then
         ticket:=gen_random_uuid();
         insert into private.reverse_assets(id,session_id,round_no,user_id,kind,path)
         values(ticket,g.id,p_round,uid,v_kind,g.id::text||'/'||p_round||'/'||uid::text||'/'||ticket||'.wav') returning * into a;
       end if;
       if v_kind='narrator' then r.narrator_asset:=a.id;else r.mimic_asset:=a.id;r.mimic_status:='reserved';end if;
       result:=jsonb_build_object('id',a.id,'path',a.path);
     elsif p_action='send_audio' then
       if uid<>r.narrator_id or cur->>'phase'<>'preparing' then raise exception 'not_your_role';end if;
       category:=btrim(p_payload->>'category');word:=btrim(p_payload->>'word');
       if category is null or char_length(category) not between 2 and 60 or word is null or char_length(word) not between 1 and 120 then raise exception 'invalid_reverse_word';end if;
       ticket:=(p_payload->>'ticket')::uuid;if ticket is distinct from r.narrator_asset then raise exception 'invalid_audio_ticket';end if;
       perform private.reverse_commit_asset(ticket,uid,(p_payload->>'frames')::int,(p_payload->>'sample_rate')::int,(p_payload->>'channels')::int);
       r.answer:=word;cur:=cur||jsonb_build_object('phase','listening','category',category);
     elsif p_action='reserve_listen' then
       if uid<>r.guesser_id or cur->>'phase'<>'listening' then raise exception 'not_your_role';end if;
       if r.listen_status='reserved' and r.listen_until<=now() then r.listen_status:='unused';end if;
       if r.listen_status not in('unused','reserved') then raise exception 'listen_unavailable';end if;
       if r.listen_status='unused' then r.listen_token:=gen_random_uuid();r.listen_status:='reserved';end if;
       r.listen_until:=now()+interval '90 seconds';
       select * into a from private.reverse_assets where id=r.narrator_asset and committed and(expires_at is null or expires_at>now());
       if not found then raise exception 'audio_expired';end if;
       result:=jsonb_build_object('token',r.listen_token,'audio',to_jsonb(a));
     elsif p_action in('start_listen','finish_listen','listen_failed','cancel_listen') then
       if uid<>r.guesser_id or cur->>'phase'<>'listening' or r.listen_token is distinct from (p_payload->>'token')::uuid then raise exception 'listen_unavailable';end if;
       if p_action='start_listen' then
         if r.listen_status<>'reserved' or r.listen_until<=now() then raise exception 'listen_unavailable';end if;
         r.listen_status:='started';r.started_at:=clock_timestamp();
       elsif p_action='finish_listen' then
         select * into a from private.reverse_assets where id=r.narrator_asset;
         if r.listen_status<>'started' or clock_timestamp()<r.started_at+make_interval(secs=>a.frames::double precision/a.sample_rate) then raise exception 'listen_not_finished';end if;
         r.listen_status:='used';cur:=cur||jsonb_build_object('phase','imitating');
       elsif p_action='cancel_listen' then
         if r.listen_status<>'reserved' then raise exception 'listen_unavailable';end if;
         r.listen_status:='unused';r.listen_token:=null;
       else
         if r.listen_status not in('started','reserved') then raise exception 'listen_unavailable';end if;
         if r.listen_status='reserved' then r.listen_status:='unused';r.listen_token:=null;
         else r.listen_status:='failed';end if;
       end if;
     elsif p_action='allow_listen_retry' then
       if uid<>r.narrator_id or r.listen_status<>'failed' or cur->>'phase'<>'listening' then raise exception 'not_your_role';end if;
       r.listen_status:='unused';r.listen_token:=null;r.started_at:=null;
     elsif p_action in('mimic_captured','mimic_failed') then
       if uid<>r.guesser_id or cur->>'phase'<>'imitating' or r.mimic_status='committed' then raise exception 'not_your_role';end if;
       if p_action='mimic_captured' then
         if r.mimic_status not in('reserved','captured') then raise exception 'invalid_phase';end if;r.mimic_status:='captured';
       else
         update private.reverse_assets set expires_at=now() where id=r.mimic_asset and not committed;
         r.mimic_asset:=null;r.mimic_status:='unused';
       end if;
     elsif p_action='send_mimic' then
       if uid<>r.guesser_id or cur->>'phase'<>'imitating' or r.mimic_status<>'captured' then raise exception 'not_your_role';end if;
       ticket:=(p_payload->>'ticket')::uuid;if ticket is distinct from r.mimic_asset then raise exception 'invalid_audio_ticket';end if;
       perform private.reverse_commit_asset(ticket,uid,(p_payload->>'frames')::int,(p_payload->>'sample_rate')::int,(p_payload->>'channels')::int);
       r.mimic_status:='committed';cur:=cur||jsonb_build_object('phase','guessing');
     elsif p_action='guess' then
       if uid<>r.guesser_id or cur->>'phase'<>'guessing' then raise exception 'not_your_role';end if;
       if p_version is distinct from g.version then raise exception 'stale_version';end if;
       guess:=btrim(p_payload->>'guess');if guess is null or char_length(guess) not between 1 and 120 then raise exception 'invalid_reverse_word';end if;
       cur:=cur||jsonb_build_object('guess',guess,'phase','judging');
     elsif p_action='judge' then
       if uid<>r.narrator_id or cur->>'phase'<>'judging' then raise exception 'not_your_role';end if;
       if p_version is distinct from g.version then raise exception 'stale_version';end if;
       if jsonb_typeof(p_payload->'correct') is distinct from 'boolean' then raise exception 'invalid_action';end if;
       correct:=(p_payload->>'correct')::boolean;ps:=s->'players';idx:=case when ps->0->>'id'=r.guesser_id::text then 0 else 1 end;
       if correct then ps:=jsonb_set(ps,array[idx::text,'score'],to_jsonb((ps->idx->>'score')::int+1));end if;
       cur:=cur||jsonb_build_object('phase','revealed','answer',r.answer,'correct',correct);
       s:=s||jsonb_build_object('players',ps,'rounds',(s->'rounds')||jsonb_build_array(cur));
       if p_round=6 then
         g.phase:='finished';
         s:=s||jsonb_build_object('winner_id',case when(ps->0->>'score')::int>(ps->1->>'score')::int then ps->0->>'id'
           when(ps->1->>'score')::int>(ps->0->>'score')::int then ps->1->>'id' else null end);
       end if;
     elsif p_action='next' then
       if cur->>'phase'<>'revealed' or p_round>=6 then raise exception 'invalid_phase';end if;
       if not(cur->'ready')@>jsonb_build_array(uid) then cur:=jsonb_set(cur,'{ready}',(cur->'ready')||jsonb_build_array(uid));end if;
       if jsonb_array_length(cur->'ready')=2 then s:=private.reverse_round(g.id,s,p_round+1);cur:=s->'current';end if;
     else raise exception 'invalid_action';end if;
     update private.reverse_rounds set answer=r.answer,narrator_asset=r.narrator_asset,mimic_asset=r.mimic_asset,
       listen_status=r.listen_status,listen_token=r.listen_token,listen_until=r.listen_until,started_at=r.started_at,mimic_status=r.mimic_status
       where session_id=g.id and round_no=p_round;
     cur:=cur||jsonb_build_object('listen_status',case when p_action='next' and jsonb_array_length(cur->'ready')=0 then 'unused' else r.listen_status end,
       'mimic_status',case when p_action='next' and jsonb_array_length(cur->'ready')=0 then 'unused' else r.mimic_status end);
     s:=jsonb_set(s,'{current}',cur);
   end if;
   update public.game_sessions set state=s,phase=g.phase,version=version+1 where id=g.id;
 end if;
 insert into private.reverse_requests values(g.id,uid,p_request_id,digest,result);
 update public.rooms set revision=revision+1 where id=rid;
 return result;
end $$;

-- Aktif maçta saklama saati işletilmez. Bitince/terk edilince 24 saat sonra erişim kapanır.
create function private.reverse_retention() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.game='reverse' and new.phase in('finished','abandoned') and old.phase is distinct from new.phase then
 update private.reverse_assets set expires_at=coalesce(expires_at,now()+interval '24 hours') where session_id=new.id;end if;return new;
end $$;
create trigger reverse_retention after update on public.game_sessions for each row execute function private.reverse_retention();
create function public.expired_reverse_audio(p_limit int default 100) returns setof text
language sql stable security definer set search_path='' as $$
 select a.path from private.reverse_assets a join public.game_sessions g on g.id=a.session_id where
 (a.expires_at<=now() or(g.phase='playing' and not exists(select 1 from public.room_players p where p.room_id=g.room_id and p.active and p.last_seen>now()-interval '7 days')))
 order by a.created_at limit greatest(1,least(p_limit,100));
$$;
create function public.confirm_audio_cleanup(p_paths text[]) returns void
language sql security definer set search_path='' as $$
 delete from private.reverse_assets where path=any(p_paths) and path in(select public.expired_reverse_audio(100));
$$;
create or replace function public.select_game(p_room_id uuid,p_game text) returns void
language plpgsql security definer set search_path='' as $$
declare host uuid;
begin
 select host_id into host from public.rooms where id=p_room_id and status='lobby' for update;
 if not found or not private.is_member(p_room_id) then raise exception 'not_a_member';end if;
 if host<>auth.uid() then raise exception 'host_only';end if;
 if p_game is null or p_game not in('auction','chain','detective','wordhunt','reverse') then raise exception 'invalid_game';end if;
 if(select selected_game from public.rooms where id=p_room_id)=p_game then return;end if;
 update public.room_players set ready=false where room_id=p_room_id and active;
 update public.rooms set selected_game=p_game,revision=revision+1 where id=p_room_id;
end $$;
create or replace function public.start_game(p_room_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=p_room_id and status='lobby' for update;
 if not found or not private.is_member(p_room_id) then raise exception 'not_a_member';end if;
 if r.host_id<>auth.uid() then raise exception 'host_only';end if;
 if r.current_game_id is not null then raise exception 'game_in_progress';end if;
 if(select count(*) from public.room_players where room_id=p_room_id and active and ready and last_seen>now()-interval '70 seconds')<>2 then raise exception 'players_not_ready';end if;
 if r.selected_game='auction' then perform private.new_auction(p_room_id);
 elsif r.selected_game='reverse' then perform private.new_reverse(p_room_id);
 elsif private.supported_puzzle(r.selected_game) then perform private.new_puzzle(p_room_id,r.selected_game,r.word_length);
 else raise exception 'game_not_available';end if;
end $$;
revoke all on function private.reverse_round(uuid,jsonb,int),private.new_reverse(uuid),private.reverse_can_upload(text),
 private.reverse_can_read(text),private.reverse_commit_asset(uuid,uuid,int,int,int),private.reverse_retention() from public,anon,authenticated;
grant execute on function private.reverse_can_upload(text),private.reverse_can_read(text) to authenticated;
revoke all on function public.reverse_context(uuid,int),public.reverse_action(uuid,int,bigint,uuid,text,jsonb) from public,anon;
grant execute on function public.reverse_context(uuid,int),public.reverse_action(uuid,int,bigint,uuid,text,jsonb) to authenticated;
revoke all on function public.expired_reverse_audio(int),public.confirm_audio_cleanup(text[]) from public,anon,authenticated;
grant execute on function public.expired_reverse_audio(int),public.confirm_audio_cleanup(text[]) to service_role;
commit;
