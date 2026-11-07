import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, it, expect, describe } from "vitest";
import type { AuctionSession } from "../src/games/auction/types";
import themes from "../src/games/auction/themes.json";
import { installStorageSchema } from "./helpers/storage-db";
const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];
let db: PGlite;
let roomid: string;
let code: string;
async function user(i: number) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[i],
  ]);
  await db.exec("set role authenticated");
}
async function scalar<T>(sql: string, args: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, args);
  return Object.values(r.rows[0])[0];
}
async function game(): Promise<AuctionSession> {
  await user(0);
  return scalar("select get_room_snapshot($1)->'game'", [code]);
}
async function act(
  g: AuctionSession,
  action: string,
  amount: number | null = null,
  choice: string | null = null,
  actor?: number,
  request = randomUUID(),
) {
  await user(actor ?? ids.indexOf(g.state.turn_id!));
  await db.query("select public.auction_action($1,$2,$3,$4,$5,$6)", [
    g.id,
    g.version,
    request,
    action,
    amount,
    choice,
  ]);
}
async function finish(confirm = true) {
  let g = await game();
  let guard = 0;
  while (g.phase === "bidding") {
    if (++guard > 50) throw Error("Dağıtım kilitlendi");
    if (g.state.players.some((p) => p.budget === 0)) {
      const chooser =
        g.state.players.find((p) => p.budget > 0)?.id ?? g.state.turn_id!;
      await act(g, "allocate", null, chooser, ids.indexOf(chooser));
      g = await game();
      continue;
    }
    const canOpen =
      g.state.players.find((p) => p.id === g.state.turn_id)!.budget > 0;
    await act(
      g,
      g.state.current_bid === 0 && canOpen ? "bid" : "pass",
      g.state.current_bid === 0 && canOpen ? 1 : null,
    );
    g = await game();
  }
  if (confirm && g.phase === "arranging") {
    await act(g, "confirm", null, null, 0);
    await act(await game(), "confirm", null, null, 1);
    g = await game();
  }
  return g;
}
async function gift(
  g: AuctionSession,
  actor: number,
  item: string,
  request = randomUUID(),
) {
  await user(actor);
  await db.query("select auction_gift($1,$2,$3,$4)", [
    g.id,
    g.version,
    request,
    item,
  ]);
}
async function winProduct(actor: number, price = 1) {
  let g = await game();
  if (g.state.turn_id !== ids[actor]) {
    await act(g, "bid", 1);
    g = await game();
  }
  await act(g, "bid", Math.max(price, g.state.current_bid + 1));
  await act(await game(), "pass");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await installStorageSchema(db);
  for (const id of ids)
    await db.query("insert into auth.users values($1)", [id]);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("reset role;truncate public.rooms cascade");
  await user(0);
  code = await scalar("select create_room('İpek')");
  roomid = await scalar("select id from rooms");
  await user(1);
  await scalar("select join_room($1,'Çağrı')", [code]);
  await db.query("select set_ready($1,true)", [roomid]);
  await user(0);
  await db.query("select set_ready($1,true)", [roomid]);
  await db.query("select start_game($1)", [roomid]);
});
afterAll(async () => {
  await db?.close();
});
describe("Açık Artırma PostgreSQL motoru", () => {
  it("yediye üç ürün dağılımına ve tüm on ürünün görünmesine izin verir", async () => {
    for (let i = 0; i < 10; i++) {
      const g = await game();
      expect(g.phase).toBe("bidding");
      expect(g.state.index).toBe(i);
      await winProduct(i < 7 ? 0 : 1);
    }
    const g = await game();
    expect(g.phase).toBe("arranging");
    expect(g.state.players.map((p) => p.items.length)).toEqual([7, 3]);
    expect(g.state.players.every((p) => p.budget >= 0)).toBe(true);
  });
  it("birinin parası bitince diğeri her ürünü ücretsiz kendine veya karşıya verir; bütçesi azalmaz", async () => {
    await winProduct(0, 20);
    for (let i = 1; i < 10; i++) {
      let g = await game();
      expect(g.phase).toBe("bidding");
      expect(g.state.index).toBe(i);
      await expect(act(g, "bid", 1, null, 1)).rejects.toThrow(
        "allocation_required",
      );
      await expect(act(g, "allocate", null, ids[0], 0)).rejects.toThrow(
        "not_your_turn",
      );
      const key = randomUUID(),
        receiver = ids[i < 7 ? 0 : 1];
      await act(g, "allocate", null, receiver, 1, key);
      await act(g, "allocate", null, receiver, 1, key);
      expect((await game()).state.players.map((p) => p.budget)).toEqual([
        0, 20,
      ]);
    }
    const g = await game();
    expect(g.phase).toBe("arranging");
    expect(g.state.players.map((p) => p.items.length)).toEqual([7, 3]);
    expect(
      g.state.players.flatMap((p) => p.items).filter((i) => i.free),
    ).toHaveLength(9);
    expect(g.state.skipped ?? []).toHaveLength(0);
  });
  it("iki bütçe varken ücretsiz dağıtım yapılamaz ve ilk pas ürünü atlamaz", async () => {
    const g = await game();
    await expect(act(g, "allocate", null, ids[0], 0)).rejects.toThrow(
      "allocation_unavailable",
    );
    await expect(act(g, "pass")).rejects.toThrow("cannot_pass_first");
    expect((await game()).state.index).toBe(0);
  });
  it("yalnız sahip ürünü hediye eder, para iadesi veya çift ürün oluşmaz ve aynı istek tekrarı etkisizdir", async () => {
    await winProduct(0);
    const g = await game(),
      item = g.state.players[0].items[0],
      key = randomUUID();
    await expect(gift(g, 1, item.id)).rejects.toThrow("item_not_owned");
    await expect(gift(g, 2, item.id)).rejects.toThrow("not_a_member");
    await gift(g, 0, item.id, key);
    await gift(g, 0, item.id, key);
    const next = await game();
    expect(next.state.players[0].items).toHaveLength(0);
    expect(next.state.players[1].items).toHaveLength(1);
    expect(next.state.players.map((p) => p.budget)).toEqual(
      g.state.players.map((p) => p.budget),
    );
    expect(next.state.players[1].items[0].paid_by).toBe(ids[0]);
    expect(next.state.turn_id).toBe(g.state.turn_id);
    expect(next.state.index).toBe(g.state.index);
    await expect(gift(g, 0, item.id)).rejects.toThrow("stale_version");
    await expect(gift(g, 0, "other", key)).rejects.toThrow("request_conflict");
  });
  it("koleksiyon onayı iki oyuncuyu bekler; hediye onayları sıfırlar ve oylamadan sonra hediye verilemez", async () => {
    let g = await finish(false);
    await act(g, "confirm", null, null, 0);
    g = await game();
    expect(g.phase).toBe("arranging");
    await gift(g, 0, g.state.players[0].items[0].id);
    g = await game();
    expect(g.state.arrange_ready).toEqual([]);
    await expect(act(g, "vote", null, null, 0)).rejects.toThrow(
      "invalid_phase",
    );
    await act(g, "confirm", null, null, 0);
    await act(await game(), "confirm", null, null, 1);
    g = await game();
    expect(g.phase).toBe("voting");
    await expect(gift(g, 1, g.state.players[1].items[0].id)).rejects.toThrow(
      "invalid_phase",
    );
  });
  it("çevrimdışı oyuncu varken hediye verilemez; eski maç yeni koleksiyonu değiştiremez", async () => {
    await winProduct(0);
    const g = await game();
    await db.exec("reset role");
    await db.query(
      "update room_players set last_seen=now()-interval '80 seconds' where user_id=$1",
      [ids[1]],
    );
    await expect(gift(g, 0, g.state.players[0].items[0].id)).rejects.toThrow(
      "players_offline",
    );
    await user(1);
    await db.query("select heartbeat($1)", [roomid]);
    let next = await finish();
    await act(next, "vote", null, null, 0);
    await act(await game(), "vote", null, null, 1);
    next = await game();
    await act(next, "rematch", null, null, 0);
    await act(await game(), "rematch", null, null, 1);
    await expect(gift(g, 0, g.state.players[0].items[0].id)).rejects.toThrow(
      "game_not_current",
    );
  });
  it("sunucuda on farklı ürünü, iki bütçeyi ve rastgele başlangıç sırasını sabitler", async () => {
    const g = await game();
    expect(g.state.products).toHaveLength(10);
    expect(new Set(g.state.products.map((p) => p.id)).size).toBe(10);
    expect(g.state.players.map((p) => p.budget)).toEqual([20, 20]);
    expect(ids.slice(0, 2)).toContain(g.state.turn_id);
    expect((await game()).state.products).toEqual(g.state.products);
  });
  it("ilk pası, sıra dışı işlemi ve geçersiz teklifleri reddeder", async () => {
    const g = await game();
    await expect(
      act(g, "bid", 1, null, 1 - ids.indexOf(g.state.turn_id!)),
    ).rejects.toThrow("not_your_turn");
    for (const bid of [0, -1, 21, 100, null])
      await expect(act(g, "bid", bid)).rejects.toThrow("invalid_bid");
    await expect(act(g, "pass")).rejects.toThrow("cannot_pass_first");
    expect((await game()).state.index).toBe(0);
  });
  it("teklif sırasını değiştirir, eski sürümü reddeder, pasla tek ürün verir", async () => {
    let g = await game();
    const old = g;
    await act(g, "bid", 1);
    g = await game();
    expect(g.state.turn_id).not.toBe(old.state.turn_id);
    await expect(act(old, "bid", 2)).rejects.toThrow("stale_version");
    await act(g, "bid", 2);
    g = await game();
    await act(g, "pass");
    g = await game();
    expect(g.state.index).toBe(1);
    expect(g.state.players.flatMap((p) => p.items)).toHaveLength(1);
    expect(g.state.current_bid).toBe(0);
    expect(g.state.turn_id).toBe(g.state.players[(g.state.starter + 1) % 2].id);
  });
  it("aynı isteği bir kez uygular; aynı anahtarla başka eylemi reddeder", async () => {
    const g = await game();
    const request = randomUUID();
    await act(g, "bid", 1, null, undefined, request);
    await act(g, "bid", 1, null, ids.indexOf(g.state.turn_id!), request);
    expect((await game()).version).toBe(1);
    await expect(
      act(g, "bid", 2, null, ids.indexOf(g.state.turn_id!), request),
    ).rejects.toThrow("request_conflict");
  });
  it("20 TL bütçenin tamamına teklif verir; rakibin pası yalnız mevcut ürünü tahsis eder", async () => {
    const g = await game();
    await act(g, "bid", 20);
    expect((await game()).state.index).toBe(0);
    await act(await game(), "pass");
    const n = await game();
    expect(n.state.index).toBe(1);
    expect(n.state.players.find((p) => p.id === g.state.turn_id)?.budget).toBe(
      0,
    );
    expect(
      n.state.players.find((p) => p.id === g.state.turn_id)?.items[0].price,
    ).toBe(20);
  });
  it("on ürün tek tek sonuçlanır; otomatik dağıtım veya bütçe rezervi olmaz", async () => {
    const g = await finish();
    expect(g.phase).toBe("voting");
    expect(g.state.index).toBe(10);
    expect(g.state.players.map((p) => p.items.length)).toEqual([5, 5]);
    const items = g.state.players.flatMap((p) => p.items);
    expect(new Set(items.map((p) => p.id)).size).toBe(10);
    expect(items.some((p) => p.automatic)).toBe(false);
    for (const p of g.state.players) {
      expect(p.budget).toBeGreaterThanOrEqual(0);
      expect(p.budget).toBe(20 - p.items.reduce((n, i) => n + i.price, 0));
    }
  });
  it.each([
    [0, 0, 0],
    [0, 1, null],
    [null, null, null],
    [1, null, null],
  ])(
    "gizli oyları gerçek kimlikle değerlendirir: %s / %s",
    async (a, b, winner) => {
      let g = await finish();
      await act(g, "vote", null, a === null ? null : ids[a], 0);
      g = await game();
      expect(g.phase).toBe("voting");
      expect(g.state.votes).toBeUndefined();
      expect(g.state.winner_id).toBeNull();
      await user(1);
      await expect(
        db.query("select * from private.auction_votes"),
      ).rejects.toThrow("permission denied");
      await act(g, "vote", null, b === null ? null : ids[b], 1);
      g = await game();
      expect(g.phase).toBe("finished");
      expect(g.state.winner_id).toBe(winner === null ? null : ids[winner]);
    },
  );
  it("bağlantı kopunca hamleyi durdurur, heartbeat sonrası aynı maç devam eder", async () => {
    const g = await game();
    await db.exec("reset role");
    await db.query(
      "update room_players set last_seen=now()-interval '80 seconds' where user_id=$1",
      [ids[1]],
    );
    await expect(act(g, "bid", 1)).rejects.toThrow("players_offline");
    await user(1);
    await db.query("select heartbeat($1)", [roomid]);
    await act(g, "bid", 1);
    expect((await game()).id).toBe(g.id);
  });
  it("tema ve oyun değişimini maçta engeller, dışarıdan bütçe/ürün yazdırmaz", async () => {
    const g = await game();
    await expect(
      db.query("select select_auction_theme($1,'home')", [roomid]),
    ).rejects.toThrow("game_in_progress");
    await expect(
      db.query("select select_game($1,'chain')", [roomid]),
    ).rejects.toThrow("game_in_progress");
    await expect(
      db.query("update game_sessions set state='{}'"),
    ).rejects.toThrow("permission denied");
    await user(2);
    expect(await scalar("select count(*)::int from game_sessions")).toBe(0);
    await expect(act(g, "bid", 1, null, 2)).rejects.toThrow("not_a_member");
  });
  it("iki tarafın rövanş onayıyla aynı temada yeni rastgele maç açar", async () => {
    let g = await finish();
    await act(g, "vote", null, null, 0);
    g = await game();
    await act(g, "vote", null, null, 1);
    g = await game();
    await act(g, "rematch", null, null, 0);
    expect((await game()).id).toBe(g.id);
    await act(await game(), "rematch", null, null, 1);
    const next = await game();
    expect(next.id).not.toBe(g.id);
    expect(next.theme).toBe(g.theme);
    expect(next.phase).toBe("bidding");
    expect(next.state.products).not.toEqual(g.state.products);
    expect(next.state.players.map((p) => p.budget)).toEqual([20, 20]);
  });
  it("sonuçtan lobiye döner, tema seçimi hazır durumlarını sıfırlar", async () => {
    let g = await finish();
    await act(g, "vote", null, null, 0);
    await act(await game(), "vote", null, null, 1);
    await act(await game(), "lobby", null, null, 0);
    expect(await game()).toBeNull();
    await user(1);
    await db.query("select set_ready($1,true)", [roomid]);
    await expect(
      db.query("select select_auction_theme($1,'home')", [roomid]),
    ).rejects.toThrow("host_only");
    await user(0);
    await db.query("select select_auction_theme($1,'home')", [roomid]);
    expect(
      await scalar("select count(*)::int from room_players where ready"),
    ).toBe(0);
    expect(await scalar("select auction_theme from rooms")).toBe("home");
  });
  it("açık ayrılma maçı terk edilmiş yapar ve kalan oyuncuyu lobiye döndürür", async () => {
    const g = await game();
    await user(1);
    await db.query("select leave_room($1)", [roomid]);
    await user(0);
    expect(await game()).toBeNull();
    expect(
      await scalar("select phase from game_sessions where id=$1", [g.id]),
    ).toBe("abandoned");
  });
  it("bir oyuncu on ürünü de alabilir; beşten sonra da sonraki ürün gösterilir", async () => {
    let g = await game();
    while (g.phase === "bidding") {
      const actor = ids.indexOf(g.state.turn_id!);
      if (g.state.current_bid === 0) await act(g, "bid", 1);
      else if (actor === 0) await act(g, "bid", g.state.current_bid + 1);
      else await act(g, "pass");
      g = await game();
      if (g.state.index === 5) expect(g.phase).toBe("bidding");
    }
    expect(g.state.players[0].items).toHaveLength(10);
    expect(g.state.players[1].items).toHaveLength(0);
    expect(g.state.players[1].budget).toBe(20);
    expect(g.phase).toBe("arranging");
  });
  it("tüm temalarda farklı bütçe stratejileriyle hiçbir maç kilitlenmez", async () => {
    let seed = 41;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const theme of themes) {
      let g = await game();
      if (g.theme !== theme.id) {
        g = await finish();
        await act(g, "vote", null, null, 0);
        await act(await game(), "vote", null, null, 1);
        await act(await game(), "lobby", null, null, 0);
        await user(0);
        await db.query("select select_auction_theme($1,$2)", [
          roomid,
          theme.id,
        ]);
        await db.query("select set_ready($1,true)", [roomid]);
        await user(1);
        await db.query("select set_ready($1,true)", [roomid]);
        await user(0);
        await db.query("select start_game($1)", [roomid]);
        g = await game();
      }
      let steps = 0;
      while (g.phase === "bidding") {
        expect(++steps).toBeLessThan(80);
        if (g.state.players.some((p) => p.budget === 0)) {
          const chooser =
            g.state.players.find((p) => p.budget > 0)?.id ?? g.state.turn_id!;
          await act(
            g,
            "allocate",
            null,
            random() < 0.5 ? ids[0] : ids[1],
            ids.indexOf(chooser),
          );
          g = await game();
          continue;
        }
        const p = g.state.players.find((p) => p.id === g.state.turn_id)!;
        const max = p.budget;
        for (const player of g.state.players) {
          expect(player.budget).toBeGreaterThanOrEqual(0);
        }
        if (
          max <= g.state.current_bid ||
          (g.state.current_bid > 0 && random() < 0.4)
        )
          await act(g, "pass");
        else
          await act(
            g,
            "bid",
            g.state.current_bid +
              1 +
              Math.floor(random() * (max - g.state.current_bid)),
          );
        g = await game();
      }
      expect(g.phase).toBe("arranging");
      await act(g, "confirm", null, null, 0);
      await act(await game(), "confirm", null, null, 1);
      g = await game();
      expect(
        g.state.products.every((p) => p.id.startsWith(theme.id + "-")),
      ).toBe(true);
      expect(
        new Set([
          ...g.state.players.flatMap((p) => p.items.map((i) => i.id)),
          ...(g.state.skipped ?? []).map((p) => p.id),
        ]).size,
      ).toBe(10);
    }
  }, 15000);
});
