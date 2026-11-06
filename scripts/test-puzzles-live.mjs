// Gerçek Supabase: üç anonim test kimliği, yalnız yeni test odasına işlem yapılır.
import assert from "node:assert/strict";
import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const env = loadEnv("development", process.cwd(), "VITE_");
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY) throw Error(".env.local eksik");
const clients = [0, 1, 2].map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
let room, code, channel, ownerTimer, guestTimer;
const ids = [];
let count = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  count++;
  console.log("OK: " + label);
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function rpc(i, name, args = {}) {
  const { data, error } = await clients[i].rpc(name, args);
  if (error) throw error;
  return data;
}
async function snapshot(i = 0) {
  return rpc(i, "get_room_snapshot", { p_code: code });
}
async function game() {
  return (await snapshot()).game;
}
const params = (g, i, action, payload = null) => ({
  p_session_id: g.id,
  p_version: g.version,
  p_revision: g.state.players.find((p) => p.id === ids[i]).revision,
  p_request_id: randomUUID(),
  p_action: action,
  p_payload: payload,
});
async function action(i, kind, payload = null, g) {
  return rpc(i, "puzzle_action", params(g ?? (await game()), i, kind, payload));
}
async function start(kind, length) {
  await rpc(0, "select_game", { p_room_id: room, p_game: kind });
  if (length)
    await rpc(0, "select_word_length", { p_room_id: room, p_length: length });
  for (const i of [0, 1])
    await rpc(i, "set_ready", { p_room_id: room, p_ready: true });
  await rpc(0, "start_game", { p_room_id: room });
  return game();
}
async function abortRematch() {
  await rpc(1, "leave_room", { p_room_id: room });
  await rpc(1, "join_room", { p_code: code, p_name: "Puzzle Test B" });
}
const beat = (i) => {
  void rpc(i, "heartbeat", { p_room_id: room }).catch((e) =>
    console.log("Heartbeat: " + e.code),
  );
};
try {
  for (const c of clients) {
    const { data, error } = await c.auth.signInAnonymously();
    if (error) throw error;
    ids.push(data.user.id);
  }
  code = await rpc(0, "create_room", { p_name: "Puzzle Test A" });
  await rpc(1, "join_room", { p_code: code, p_name: "Puzzle Test B" });
  room = (await snapshot()).room.id;
  let g = await start("chain");
  const chainId = g.id;
  let resolveEvent;
  const event = new Promise((resolve) => {
    resolveEvent = resolve;
  });
  let leaked = false;
  await clients[0].realtime.setAuth();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Realtime zaman aşımı")),
      25000,
    );
    channel = clients[0]
      .channel("puzzle-live:" + g.id, {
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
        (payload) => {
          if (
            payload.new.phase === "preparing" ||
            payload.new.phase === "playing"
          ) {
            const text = JSON.stringify(payload.new);
            if (
              !payload.new.state.players.some((p) => p.guess_count > 0) &&
              (text.includes("AĞACI") || text.includes("YILDIZI"))
            )
              leaked = true;
          }
          resolveEvent(true);
        },
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(error ?? Error(status));
        }
      });
  });
  const chainA = ["Elma", "Ağacı", "Yaprağı", "Sarması", "Tatlısı"];
  const chainB = ["Deniz", "Yıldızı", "Işığı", "Rengi", "Tonu"];
  await action(0, "prepare", chainA);
  g = await game();
  check(
    g.phase === "preparing" && !JSON.stringify(g).includes("AĞACI"),
    "Zincir tek hazırlıkta gizli kaldı",
  );
  check(
    (await rpc(1, "my_game_secret", { p_session_id: g.id })) === null,
    "Rakip diğer oyuncunun cevabını alamadı",
  );
  await action(1, "prepare", chainB);
  g = await game();
  check(
    g.phase === "playing" && g.state.hints[ids[0]][1].word === undefined,
    "Zincir iki hazırlıkla yalnız izinli ipuçlarını açtı",
  );
  check(
    (await Promise.race([event, delay(10000).then(() => false)])) && !leaked,
    "Gerçek WebSocket güncellemesinde gizli cevap sızmadı",
  );
  check(
    (await rpc(0, "my_game_secret", { p_session_id: g.id }))[1] === "AĞACI",
    "Kendi kilitli cevap RPC’si çalıştı",
  );
  const outsider = await clients[2]
    .from("game_sessions")
    .select("*")
    .eq("id", g.id);
  check(
    !outsider.error && outsider.data.length === 0,
    "Maç RLS üçüncü oyuncuyu dışladı",
  );
  const forbidden = await clients[2].rpc("my_game_secret", {
    p_session_id: g.id,
  });
  check(
    forbidden.error?.message.includes("not_a_member"),
    "Yetkisiz gizli cevap okuma reddedildi",
  );
  await action(0, "guess", "KÖPRÜ");
  g = await game();
  check(
    g.state.players[0].progress === 1 &&
      !g.state.players[0].history.at(-1).correct,
    "Yanlış zincir tahmini cevap açmadı",
  );
  const shared = g;
  const request = params(g, 0, "guess", "yıldızı");
  const race = await Promise.all([
    clients[0].rpc("puzzle_action", request),
    clients[1].rpc("puzzle_action", params(shared, 1, "guess", "ağacı")),
  ]);
  check(
    race.every((r) => !r.error),
    "İki oyuncunun bağımsız eşzamanlı zincir tahmini kabul edildi",
  );
  await rpc(0, "puzzle_action", request);
  g = await game();
  check(
    g.state.players[0].guess_count === 2 &&
      g.state.players.every((p) => p.progress === 2),
    "İstek tekrarı zinciri iki kez ilerletmedi",
  );
  const refreshed = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: auth } = await clients[0].auth.getSession();
  const restored = await refreshed.auth.setSession({
    access_token: auth.session.access_token,
    refresh_token: auth.session.refresh_token,
  });
  if (restored.error) throw restored.error;
  const restoredGame = await refreshed.rpc("get_room_snapshot", {
    p_code: code,
  });
  check(
    restoredGame.data?.game?.id === chainId &&
      restoredGame.data.game.state.players[0].progress === 2,
    "Aynı kimlikle yeni istemci maçı ve ilerlemeyi geri aldı",
  );
  await refreshed.removeAllChannels();
  ownerTimer = setInterval(() => beat(0), 20000);
  console.log(
    "Bağlantı kesintisi testi: ikinci oyuncunun heartbeat’i 72 saniye durduruluyor.",
  );
  await delay(72000);
  const paused = await clients[0].rpc(
    "puzzle_action",
    params(await game(), 0, "guess", "ışığı"),
  );
  check(
    paused.error?.message.includes("players_offline"),
    "Çevrimdışı oyuncu varken oyun ilerlemedi",
  );
  await rpc(1, "heartbeat", { p_room_id: room });
  guestTimer = setInterval(() => beat(1), 20000);
  for (const word of chainB.slice(2)) await action(0, "guess", word);
  g = await game();
  check(
    g.phase === "finished" &&
      g.state.winner_id === ids[0] &&
      g.state.reveals[ids[1]][1] === "YILDIZI",
    "Zincir doğru kazananla bitti ve cevaplar yalnız sonda açıldı",
  );
  await action(0, "rematch");
  await action(1, "rematch");
  g = await game();
  check(
    g.id !== chainId &&
      g.phase === "preparing" &&
      g.state.players.every((p) => !p.prepared),
    "Zincir rövanşı temiz hazırlık açtı",
  );
  const old = await clients[0].rpc(
    "puzzle_action",
    params({ ...shared, state: { ...shared.state } }, 0, "prepare", chainA),
  );
  check(
    old.error?.message.includes("game_not_current"),
    "Eski maç isteği yeni maçı değiştirmedi",
  );
  await action(0, "prepare", chainA);
  await action(1, "prepare", chainB);
  for (let index = 1; index < 4; index++) {
    await action(0, "guess", chainB[index]);
    await action(1, "guess", chainA[index]);
  }
  g = await game();
  const finishes = await Promise.all([
    clients[0].rpc("puzzle_action", params(g, 0, "guess", chainB[4])),
    clients[1].rpc("puzzle_action", params(g, 1, "guess", chainA[4])),
  ]);
  const accepted = finishes.findIndex((result) => !result.error);
  g = await game();
  check(
    finishes.filter((result) => !result.error).length === 1 &&
      g.phase === "finished" &&
      g.state.winner_id === ids[accepted],
    "Aynı anda son kelimeyi bulanlardan sunucunun ilk kabul ettiği kazandı",
  );
  await action(0, "lobby");
  const lobby = await snapshot();
  check(
    lobby.game === null &&
      lobby.players.length === 2 &&
      lobby.players.every((p) => !p.ready),
    "Bulmaca sonuç ekranından lobiye dönüş üyelikleri korudu",
  );
  g = await start("detective");
  const detectiveId = g.id;
  await action(0, "prepare", "1234");
  await action(1, "prepare", "5678");
  g = await game();
  check(
    !JSON.stringify(g).includes("1234") && !JSON.stringify(g).includes("5678"),
    "Gizli sayılar ortak görüntüye girmedi",
  );
  const first = ids.indexOf(g.state.turn_id);
  await action(first, "guess", first === 0 ? "8765" : "4321");
  g = await game();
  check(
    g.state.players[first].history[0].matches === 4 &&
      !g.state.players[first].solved,
    "Dört rakam eşleşmesi yanlış sıralı sayıyı kazandırmadı",
  );
  const wrong = await clients[first].rpc(
    "puzzle_action",
    params(g, first, "guess", "9012"),
  );
  check(
    wrong.error?.message.includes("not_your_turn"),
    "Sıra dışı sayı tahmini reddedildi",
  );
  await action(1 - first, "guess", "9012");
  await action(first, "guess", first === 0 ? "5678" : "1234");
  g = await game();
  check(
    g.phase === "playing" && !g.state.reveals,
    "İlk bulan rakibinin aynı turdaki hakkını korudu",
  );
  await action(1 - first, "guess", first === 0 ? "1234" : "5678");
  g = await game();
  check(
    g.phase === "finished" && g.state.winner_id === null,
    "Aynı turda iki doğru sayı beraberlik verdi",
  );
  await action(0, "rematch");
  await action(1, "rematch");
  g = await game();
  check(
    g.id !== detectiveId && g.game === "detective" && g.phase === "preparing",
    "Sayı Dedektifi rövanşı yeni gizli sayı hazırlığı açtı",
  );
  await abortRematch();
  g = await start("wordhunt", 6);
  check(
    g.state.word_length === 6,
    "Altı harf modu iki oyuncuya aynı uygulandı",
  );
  await action(0, "prepare", "BARDAK");
  await action(1, "prepare", "YORGAN");
  await action(0, "guess", "KALECİ");
  g = await game();
  check(
    JSON.stringify(g.state.players[0].history[0].marks) ===
      JSON.stringify([
        "absent",
        "present",
        "absent",
        "absent",
        "absent",
        "absent",
      ]),
    "YORGAN / KALECİ örneğinde yalnız A sarı oldu",
  );
  await action(1, "guess", "BARDAK");
  g = await game();
  check(
    g.phase === "playing" && !g.state.reveals,
    "Bir oyuncu bitince diğerinin sonucu beklendi",
  );
  await action(0, "guess", "YORGAN");
  g = await game();
  check(
    g.phase === "finished" && g.state.winner_id === ids[1],
    "Daha az tahminle bulan oyuncu kazandı",
  );
  await action(0, "lobby");
  g = await start("wordhunt", 5);
  await action(0, "prepare", "KALEM");
  await action(1, "prepare", "KABAK");
  await action(0, "guess", "AAAAA");
  g = await game();
  check(
    JSON.stringify(g.state.players[0].history[0].marks) ===
      JSON.stringify(["absent", "correct", "absent", "correct", "absent"]),
    "Tekrarlı harfler yeşiller önce tüketilerek değerlendirildi",
  );
  for (let n = 1; n < 6; n++) await action(0, "guess", "ARMUT");
  for (let n = 0; n < 6; n++) await action(1, "guess", "ARMUT");
  g = await game();
  check(
    g.phase === "finished" &&
      g.state.winner_id === null &&
      g.state.players.every((p) => p.guess_count === 6),
    "İki oyuncu altı hakta bulamayınca beraberlik oldu",
  );
  const seventh = await clients[0].rpc(
    "puzzle_action",
    params(g, 0, "guess", "KABAK"),
  );
  check(!!seventh.error, "Yedinci tahmin kabul edilmedi");
  await action(0, "rematch");
  await action(1, "rematch");
  g = await game();
  check(
    g.phase === "preparing" &&
      g.state.word_length === 5 &&
      g.state.players.every((p) => p.history.length === 0),
    "Kelime Avı rövanşı beş harf modunu koruyup geçmişi sıfırladı",
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
  if (room)
    for (const c of clients) {
      try {
        await c.rpc("leave_room", { p_room_id: room });
      } catch {}
    }
  for (const c of clients) {
    await c.removeAllChannels();
    await c.auth.signOut().catch(() => {});
  }
}
