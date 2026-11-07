// 010 uygulanmış olabilir: onu değiştirmeden kullanıcı düzeltmesini 011'e taşır.
import { readFileSync, writeFileSync } from "node:fs";
const source = readFileSync(
  "supabase/migrations/202611070010_auction_flexible_collections.sql",
  "utf8",
);
let impl = source.slice(
  source.indexOf("create or replace function public.auction_action_impl("),
  source.indexOf("-- Hediye bütçeyi"),
);
impl = impl.replace(
  "('bid','pass','confirm','vote','rematch','lobby')",
  "('bid','pass','allocate','confirm','vote','rematch','lobby')",
);
impl = impl.replace(
  "if p_action in('bid','pass') then",
  `if p_action='allocate' then
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
   elsif p_action in('bid','pass') then`,
);
impl = impl.replace(
  "if s->>'turn_id' is distinct from uid::text then raise exception 'not_your_turn';end if;",
  `if (ps->0->>'budget')::int=0 or (ps->1->>'budget')::int=0 then raise exception 'allocation_required';end if;
     if s->>'turn_id' is distinct from uid::text then raise exception 'not_your_turn';end if;`,
);
const before = impl.indexOf(
  "     elsif bid>0 then s:=private.auction_settle(s);",
);
const after = impl.indexOf(
  "     if(s->>'index')::int=jsonb_array_length(s->'products')",
  before,
);
impl =
  impl.slice(0, before) +
  `     else
       if bid=0 then raise exception 'cannot_pass_first';end if;
       s:=private.auction_settle(s);
     end if;
` +
  impl.slice(after);
const header = `-- 009 ve 010 sonrasında bir kez çalıştırın. Ürün alınmadan geçilmez.
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
`;
writeFileSync(
  "supabase/migrations/202611070011_auction_required_allocation.sql",
  header +
    impl +
    `revoke all on function public.auction_action_impl(uuid,bigint,uuid,text,integer,uuid) from public,anon,authenticated;
commit;
`,
);
console.log("011 migration üretildi; uygulanmış 010 değiştirilmedi.");
