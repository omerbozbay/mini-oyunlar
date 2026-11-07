// İsteğe bağlı gerçek Supabase entegrasyon testi. Test kimlikleri ve kapalı oda geçmişi kalabilir.
import assert from "node:assert/strict";
import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const env = loadEnv("development", process.cwd(), "VITE_");
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY)
  throw Error(".env.local bağlantı anahtarı eksik.");
const clients = [0, 1, 2].map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
let roomid, channel, ownerTimer, guestTimer;
let count = 0;
let code;
const check = (value, label) => {
  assert.ok(value, label);
  count++;
  console.log("OK: " + label);
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}
const snapshot = () => rpc(clients[0], "get_room_snapshot", { p_code: code });
let identities = [];
const params = (g, action, amount = null, choice = null) => ({
  p_session_id: g.id,
  p_version: g.version,
  p_request_id: randomUUID(),
  p_action: action,
  p_amount: amount,
  p_choice: choice,
});
async function action(g, kind, amount = null, choice = null, who) {
  return rpc(
    clients[who ?? identities.indexOf(g.state.turn_id)],
    "auction_action",
    params(g, kind, amount, choice),
  );
}
async function finish(confirm = true, split = false) {
  let g = (await snapshot()).game;
  let steps = 0;
  while (g.phase === "bidding") {
    if (++steps > 60) throw Error("Maç kilitlendi");
    const current = g.state.players.find((p) => p.id === g.state.turn_id);
    const target = identities[g.state.index < 7 ? 0 : 1];
    if (g.state.players.some((p) => p.budget === 0)) {
      const chooser =
        g.state.players.find((p) => p.budget > 0)?.id ?? g.state.turn_id;
      await action(
        g,
        "allocate",
        null,
        split ? target : chooser,
        identities.indexOf(chooser),
      );
      g = (await snapshot()).game;
      continue;
    }
    const bid = split
      ? current.id === target || g.state.current_bid === 0
      : g.state.current_bid === 0;
    await action(g, bid ? "bid" : "pass", bid ? g.state.current_bid + 1 : null);
    g = (await snapshot()).game;
  }
  if (confirm && g.phase === "arranging") {
    await action(g, "confirm", null, null, 0);
    await action((await snapshot()).game, "confirm", null, null, 1);
    g = (await snapshot()).game;
  }
  return g;
}
const beat = (client) => {
  void rpc(client, "heartbeat", { p_room_id: roomid }).catch((error) =>
    console.log("Heartbeat: " + error.code),
  );
};
try {
  for (const client of clients) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    identities.push(data.user.id);
  }
  code = await rpc(clients[0], "create_room", { p_name: "Auction Test A" });
  await rpc(clients[1], "join_room", {
    p_code: code,
    p_name: "Auction Test B",
  });
  let s = await snapshot();
  roomid = s.room.id;
  await rpc(clients[0], "select_auction_theme", {
    p_room_id: roomid,
    p_theme: "home",
  });
  check(
    (await rpc(clients[1], "get_room_snapshot", { p_code: code })).room
      .auction_theme === "home",
    "Tema iki kimlikte aynı",
  );
  for (const c of clients.slice(0, 2))
    await rpc(c, "set_ready", { p_room_id: roomid, p_ready: true });
  await rpc(clients[0], "start_game", { p_room_id: roomid });
  s = await snapshot();
  let g = s.game;
  const sessionid = g.id;
  check(
    g.theme === "home" &&
      g.state.products.length === 10 &&
      new Set(g.state.products.map((p) => p.id)).size === 10,
    "Sunucu on farklı ürünü sabitledi",
  );
  const denied = await clients[2]
    .from("game_sessions")
    .select("*")
    .eq("id", g.id);
  check(
    !denied.error && denied.data.length === 0,
    "Maç RLS üçüncü oyuncuyu engelledi",
  );
  const tamper = await clients[1]
    .from("game_sessions")
    .update({ state: {} })
    .eq("id", g.id);
  check(
    tamper.error?.code === "42501",
    "Doğrudan oyun durumu yazması engellendi",
  );
  await clients[0].realtime.setAuth();
  let eventResolve;
  const updateEvent = new Promise((resolve) => {
    eventResolve = resolve;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Realtime zaman aşımı")),
      25000,
    );
    channel = clients[0]
      .channel("auction-integration:" + g.id, {
        config: { postgres_changes_options: { wait: true, timeout: 15000 } },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: "id=eq." + g.id,
        },
        () => eventResolve(true),
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(error ?? Error(status));
        }
      });
  });
  const actor = identities.indexOf(g.state.turn_id);
  const first = params(g, "bid", 1);
  const race = await Promise.all([
    clients[actor].rpc("auction_action", first),
    clients[1 - actor].rpc("auction_action", params(g, "bid", 2)),
  ]);
  check(
    !race[0].error && !!race[1].error,
    "Aynı sürümle eşzamanlı iki tekliften yalnız geçerli olan kabul edildi",
  );
  await rpc(clients[actor], "auction_action", first);
  check(
    (await snapshot()).game.version === 1,
    "Tekrarlanan istek hamleyi iki kez uygulamadı",
  );
  check(
    await Promise.race([updateEvent, delay(10000).then(() => false)]),
    "Teklif gerçek WebSocket üzerinden yayımlandı",
  );
  // Sayfa yenilemesine eşdeğer: aynı oturumu yeni, depolamasız SDK istemcisine yükle.
  const refreshed = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: identity } = await clients[1].auth.getSession();
  const restored = await refreshed.auth.setSession({
    access_token: identity.session.access_token,
    refresh_token: identity.session.refresh_token,
  });
  if (restored.error) throw restored.error;
  check(
    (await rpc(refreshed, "get_room_snapshot", { p_code: code })).game.id ===
      sessionid,
    "Aynı kimlikle yeni istemci mevcut maçı geri yükledi",
  );
  await refreshed.removeAllChannels();
  ownerTimer = setInterval(() => beat(clients[0]), 20000);
  console.log(
    "Bağlantı duraklaması için 72 saniye bekleniyor (yalnız ilk oyuncu heartbeat gönderiyor).",
  );
  await delay(72000);
  g = (await snapshot()).game;
  const paused = await clients[0].rpc(
    "auction_action",
    params(g, "bid", g.state.current_bid + 1),
  );
  check(
    paused.error?.message.includes("players_offline"),
    "Çevrimdışı oyuncu varken yeni teklif sunucuda reddedildi",
  );
  await rpc(clients[1], "heartbeat", { p_room_id: roomid });
  guestTimer = setInterval(() => beat(clients[1]), 20000);
  check(
    (await snapshot()).game.id === sessionid,
    "Yeniden bağlantı aynı maç ve sırayı korudu",
  );
  g = await finish(false, true);
  check(
    g.phase === "arranging" &&
      g.state.index === 10 &&
      g.state.players[0].items.length === 7 &&
      g.state.players[1].items.length === 3,
    "On ürün tek tek görüldü, yediye üç koleksiyon oluştu",
  );
  check(
    g.state.players.every(
      (p) =>
        p.budget === 20 - p.items.reduce((sum, i) => sum + i.price, 0) &&
        p.budget >= 0,
    ),
    "Bütçe toplamları doğru ve ürün rezervi yok",
  );
  await action(g, "confirm", null, null, 0);
  g = (await snapshot()).game;
  const balances = g.state.players.map((p) => p.budget);
  const gift = {
    p_session_id: g.id,
    p_version: g.version,
    p_request_id: randomUUID(),
    p_item_id: g.state.players[0].items[0].id,
  };
  const giftDenied = await clients[1].rpc("auction_gift", gift);
  check(
    giftDenied.error?.message.includes("item_not_owned"),
    "Rakibin ürünü hediye edilemedi",
  );
  await rpc(clients[0], "auction_gift", gift);
  await rpc(clients[0], "auction_gift", gift);
  g = (await snapshot()).game;
  check(
    g.state.players[0].items.length === 6 &&
      g.state.players[1].items.length === 4 &&
      JSON.stringify(g.state.players.map((p) => p.budget)) ===
        JSON.stringify(balances),
    "Hediye bir kez aktarıldı, bütçeler değişmedi",
  );
  check(
    g.state.arrange_ready.length === 0,
    "Hediye önceki koleksiyon onayını sıfırladı",
  );
  await action(g, "confirm", null, null, 0);
  await action((await snapshot()).game, "confirm", null, null, 1);
  g = (await snapshot()).game;
  const late = await clients[0].rpc("auction_gift", {
    ...gift,
    p_request_id: randomUUID(),
    p_version: g.version,
    p_item_id: g.state.players[0].items[0].id,
  });
  check(
    g.phase === "voting" && late.error?.message.includes("invalid_phase"),
    "İki onaydan sonra oylama açıldı ve hediye kilitlendi",
  );
  await action(g, "vote", null, identities[0], 0);
  g = (await snapshot()).game;
  check(
    g.phase === "voting" && g.state.votes === undefined,
    "İlk tercih oylama bitmeden açılmadı",
  );
  await action(g, "vote", null, identities[0], 1);
  g = (await snapshot()).game;
  check(
    g.phase === "finished" && g.state.winner_id === identities[0],
    "İki aynı gerçek kazanan kimliği doğru sonucu üretti",
  );
  await action(g, "rematch", null, null, 0);
  check(
    (await snapshot()).game.id === sessionid,
    "Tek onay rövanşı başlatmadı",
  );
  await action((await snapshot()).game, "rematch", null, null, 1);
  const rematch = (await snapshot()).game;
  check(
    rematch.id !== sessionid &&
      rematch.theme === "home" &&
      rematch.state.players.every((p) => p.budget === 20),
    "İki onay yeni bütçeli aynı tema rövanşı başlattı",
  );
  check(
    JSON.stringify(rematch.state.products) !== JSON.stringify(g.state.products),
    "Rövanş ürünleri yeniden rastgele seçildi",
  );
  g = await finish();
  await action(g, "vote", null, identities[0], 0);
  await action((await snapshot()).game, "vote", null, identities[1], 1);
  g = (await snapshot()).game;
  check(
    g.phase === "finished" && g.state.winner_id === null,
    "İki farklı kazanan tercihi beraberlik oldu",
  );
  await action(g, "lobby", null, null, 0);
  s = await snapshot();
  check(
    s.game === null &&
      s.players.length === 2 &&
      s.players.every((p) => !p.ready),
    "Lobiye dönüş üyeliği koruyup hazır durumlarını sıfırladı",
  );
  await rpc(clients[0], "select_auction_theme", {
    p_room_id: roomid,
    p_theme: "meals",
  });
  for (const c of clients.slice(0, 2))
    await rpc(c, "set_ready", { p_room_id: roomid, p_ready: true });
  await rpc(clients[0], "start_game", { p_room_id: roomid });
  g = (await snapshot()).game;
  check(
    g.theme === "meals" &&
      g.state.products.length === 10 &&
      g.state.products.every(
        (p) =>
          p.image.endsWith("meals.webp") &&
          p.image_cell >= 0 &&
          p.image_cell < 20,
      ),
    "Yeni yemek temasında on farklı fotoğraf kartı seçildi",
  );
  if (g.state.turn_id !== identities[0]) {
    await action(g, "bid", 1);
    g = (await snapshot()).game;
  }
  await action(g, "bid", 20);
  await action((await snapshot()).game, "pass");
  g = (await snapshot()).game;
  check(
    g.state.index === 1 &&
      g.phase === "bidding" &&
      g.state.players[0].budget === 0,
    "İlk ürün 20 TL’ye alındı; kalan dokuz ürün atlanmadı",
  );
  const poor = await clients[0].rpc(
    "auction_action",
    params(g, "allocate", null, identities[0]),
  );
  check(
    poor.error?.message.includes("not_your_turn"),
    "Bütçesi biten oyuncu dağıtımı yönetemedi",
  );
  const stateVersion = g.version;
  const firstFree = params(g, "allocate", null, identities[0]);
  await rpc(clients[1], "auction_action", firstFree);
  await rpc(clients[1], "auction_action", firstFree);
  g = (await snapshot()).game;
  check(
    g.state.index === 2 && g.version === stateVersion + 1,
    "Ücretsiz seçim aynı UUID ile yalnız bir kez uygulandı",
  );
  for (let index = 2; index < 10; index++) {
    check(
      g.state.index === index && g.phase === "bidding",
      `Kalan ürün ${index + 1} ayrı gösterildi`,
    );
    await action(g, "allocate", null, identities[index < 7 ? 0 : 1], 1);
    g = (await snapshot()).game;
  }
  check(
    g.phase === "arranging" &&
      g.state.players[0].items.length === 7 &&
      g.state.players[1].items.length === 3 &&
      g.state.players[1].budget === 20,
    "Ücretsiz kendine/karşıya dağıtım 7–3 bitti, parası kalandan hiç para kesilmedi",
  );
  check(
    g.state.players
      .flatMap((p) => p.items)
      .filter((p) => p.free && p.price === 0).length === 9,
    "Dokuz ücretsiz ürün koleksiyonlara tek tek eklendi",
  );
  console.log(JSON.stringify({ result: "PASS", checks: count }));
} catch (error) {
  console.error(
    JSON.stringify({
      result: "FAIL",
      checks: count,
      code: error.code ?? null,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  if (ownerTimer) clearInterval(ownerTimer);
  if (guestTimer) clearInterval(guestTimer);
  if (channel) await clients[0].removeChannel(channel);
  if (roomid)
    for (const c of clients) {
      try {
        await c.rpc("leave_room", { p_room_id: roomid });
      } catch {}
    }
  for (const c of clients) {
    await c.removeAllChannels();
    await c.auth.signOut().catch(() => {});
  }
}
