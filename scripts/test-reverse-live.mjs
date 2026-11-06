// Storage/Realtime/oyun protokolü testi; gerçek mikrofon veya işitme donanımı simüle edilmez.
import assert from "node:assert/strict";
import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { reverseWav } from "../src/games/reverse/pcm.ts";
const env = loadEnv("development", process.cwd(), "VITE_");
const clients = [0, 1, 2].map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
let room, code, channel, timer;
const ids = [];
let checks = 0;
const paths = [];
const check = (value, label) => {
  assert.ok(value, label);
  checks++;
  console.log("OK: " + label);
};
async function rpc(i, name, args = {}) {
  const { data, error } = await clients[i].rpc(name, args);
  if (error) throw error;
  return data;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const game = async () =>
  (await rpc(0, "get_room_snapshot", { p_code: code })).game;
const params = (g, action, payload = {}) => ({
  p_session_id: g.id,
  p_round: g.state.current.number,
  p_version: g.version,
  p_request_id: randomUUID(),
  p_action: action,
  p_payload: payload,
});
async function action(i, kind, payload = {}) {
  return rpc(i, "reverse_action", params(await game(), kind, payload));
}
async function upload(i, ticket, packet) {
  const { error } = await clients[i].storage
    .from("reverse-audio")
    .upload(ticket.path, new Blob([packet.wav], { type: "audio/wav" }), {
      contentType: "audio/wav",
      upsert: false,
    });
  if (error) throw error;
  paths.push(ticket.path);
}
const meta = (ticket, p) => ({
  ticket: ticket.id,
  frames: p.frames,
  sample_rate: p.sample_rate,
  channels: p.channels,
});
const read = async (i, path) => {
  const result = await clients[i].storage
    .from("reverse-audio")
    .download(path, { cacheNonce: randomUUID() }, { cache: "no-store" });
  return !result.error && !!result.data;
};
try {
  for (const client of clients) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    ids.push(data.user.id);
  }
  code = await rpc(0, "create_room", { p_name: "Reverse Test A" });
  await rpc(1, "join_room", { p_code: code, p_name: "Reverse Test B" });
  room = (await rpc(0, "get_room_snapshot", { p_code: code })).room.id;
  await rpc(0, "select_game", { p_room_id: room, p_game: "reverse" });
  for (const i of [0, 1])
    await rpc(i, "set_ready", { p_room_id: room, p_ready: true });
  await rpc(0, "start_game", { p_room_id: room });
  let g = await game();
  const firstId = g.id;
  check(
    g.game === "reverse" && g.state.current.number === 1,
    "Beşinci oyun gerçek sunucuda başladı",
  );
  timer = setInterval(() => {
    for (const i of [0, 1])
      void rpc(i, "heartbeat", { p_room_id: room }).catch(() => {});
  }, 20000);
  await clients[0].realtime.setAuth();
  let resolveEvent;
  const received = new Promise((resolve) => {
    resolveEvent = resolve;
  });
  let leaked = false;
  await new Promise((resolve, reject) => {
    const limit = setTimeout(
      () => reject(Error("Realtime zaman aşımı")),
      25000,
    );
    channel = clients[0]
      .channel("reverse-live:" + g.id, {
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
        (event) => {
          if (
            event.new.state.current.phase !== "revealed" &&
            event.new.state.rounds.length === 0 &&
            JSON.stringify(event.new).includes("GİZLİ TEST")
          )
            leaked = true;
          resolveEvent(true);
        },
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(limit);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(limit);
          reject(error ?? Error(status));
        }
      });
  });
  const packet = reverseWav(
    [Float32Array.from({ length: 160 }, (_, i) => Math.sin(i / 9) * 0.3)],
    8000,
  );
  const roles = [0, 0];
  clearInterval(timer);
  timer = setInterval(() => {
    void rpc(0, "heartbeat", { p_room_id: room }).catch(() => {});
  }, 20000);
  console.log(
    "Bağlantı kesintisi: ikinci oyuncunun heartbeat’i 72 saniye durduruluyor.",
  );
  await delay(72000);
  const interrupted = await game();
  const narratorIndex = ids.indexOf(interrupted.state.current.narrator_id);
  const blocked = await clients[narratorIndex].rpc(
    "reverse_action",
    params(interrupted, "upload_ticket"),
  );
  check(
    blocked.error?.message === "players_offline",
    "Çevrimdışı oyuncu varken sesli oyun ilerlemedi",
  );
  await rpc(1, "heartbeat", { p_room_id: room });
  check(
    (await game()).id === firstId &&
      (await game()).state.current.phase === "preparing",
    "Yeniden bağlantı aynı maç ve aşamayı korudu",
  );
  clearInterval(timer);
  timer = setInterval(() => {
    for (const i of [0, 1])
      void rpc(i, "heartbeat", { p_room_id: room }).catch(() => {});
  }, 20000);
  for (let round = 1; round <= 6; round++) {
    g = await game();
    const n = ids.indexOf(g.state.current.narrator_id),
      p = 1 - n;
    roles[n]++;
    const ticket = await action(n, "upload_ticket");
    await upload(n, ticket, packet);
    await action(n, "send_audio", {
      ...meta(ticket, packet),
      category: "Özel test",
      word: round === 1 ? "GİZLİ TEST" : "Tur " + round,
    });
    g = await game();
    check(
      g.state.current.phase === "listening" &&
        !JSON.stringify(g.state.current).includes(
          round === 1 ? "GİZLİ TEST" : "Tur " + round,
        ),
      `Tur ${round}: gizli metin ortak veride açılmadı`,
    );
    if (round === 1) {
      check(
        (await Promise.race([received, delay(10000).then(() => false)])) &&
          !leaked,
        "Gerçek Realtime güncellemesi gizli metin sızdırmadı",
      );
      check(
        !(await read(2, ticket.path)),
        "Üçüncü kimlik ses dosyasını indiremedi",
      );
      check(
        !(await read(p, ticket.path)),
        "Tahminci dinleme izni almadan dosyayı indiremedi",
      );
      const response = await fetch(
        clients[0].storage.from("reverse-audio").getPublicUrl(ticket.path).data
          .publicUrl,
      );
      check(!response.ok, "Bucket public URL üzerinden ses vermedi");
      const fake = await clients[p].storage
        .from("reverse-audio")
        .upload("fake.wav", new Blob([packet.wav], { type: "audio/wav" }));
      check(!!fake.error, "Sunucu bileti olmadan yükleme reddedildi");
    }
    let lease = await action(p, "reserve_listen");
    check(
      await read(p, lease.audio.path),
      `Tur ${round}: süreli yetkili dosya erişimi çalıştı`,
    );
    if (round === 1) {
      await action(p, "cancel_listen", { token: lease.token });
      g = await game();
      check(
        g.state.current.listen_status === "unused",
        "Oynatma başlamadan yükleme/decode hatası hakkı tüketmedi",
      );
      lease = await action(p, "reserve_listen");
    }
    await action(p, "start_listen", { token: lease.token });
    if (round === 1) {
      const again = await clients[p].rpc(
        "reverse_action",
        params(await game(), "reserve_listen"),
      );
      check(
        !!again.error,
        "Sayfa yenilemesi gibi ikinci rezervasyon reddedildi",
      );
      check(
        !(await read(p, ticket.path)),
        "Oynatma başladıktan sonra yeni dosya indirme kapandı",
      );
      const restored = await rpc(p, "reverse_context", {
        p_session_id: g.id,
        p_round: 1,
      });
      check(
        restored.listen_status === "started" &&
          restored.listen_token === lease.token &&
          restored.narrator_audio === null,
        "Yenileme dinleme durumunu koruyup yeniden oynatmayı açmadı",
      );
    }
    await delay(30);
    await action(p, "finish_listen", { token: lease.token });
    const mimic = await action(p, "reserve_mimic");
    await action(p, "mimic_captured");
    await upload(p, mimic, packet);
    await action(p, "send_mimic", meta(mimic, packet));
    if (round === 1) {
      check(
        !(await read(n, mimic.path)),
        "Taklit sesi sonuçtan önce anlatıcıya açılmadı",
      );
      check(
        await read(p, mimic.path),
        "Tahminci kendi ters taklidini sınırsız dinleyebilir",
      );
    }
    await action(p, "guess", { guess: "Tahmin " + round });
    g = await game();
    if (round === 1) {
      const wrong = await clients[p].rpc(
        "reverse_action",
        params(g, "judge", { correct: true }),
      );
      check(!!wrong.error, "Tahminci puanlama yapamadı");
      const second = await clients[p].rpc(
        "reverse_action",
        params(g, "guess", { guess: "İkinci" }),
      );
      check(!!second.error, "İkinci tahmin reddedildi");
    }
    const decision = params(g, "judge", { correct: p === 0 });
    await rpc(n, "reverse_action", decision);
    await rpc(n, "reverse_action", decision);
    g = await game();
    check(
      g.state.rounds.length === round &&
        g.state.current.answer ===
          (round === 1 ? "GİZLİ TEST" : "Tur " + round),
      `Tur ${round}: puanlama tekrarı etkisiz, gizli kelime yalnız sonuçta açıldı`,
    );
    if (round === 1) {
      check(
        (await read(p, ticket.path)) && (await read(n, mimic.path)),
        "Tur sonunda iki ters ses iki oyuncuya da açıldı",
      );
    }
    if (round < 6) {
      const old = g;
      await action(0, "next");
      await action(1, "next");
      if (round === 1) {
        const stale = await clients[0].rpc(
          "reverse_action",
          params(old, "next"),
        );
        check(!!stale.error, "Eski tur isteği sonraki turu etkileyemedi");
      }
    }
  }
  g = await game();
  check(
    g.phase === "finished" &&
      g.state.rounds.length === 6 &&
      roles[0] === 3 &&
      roles[1] === 3,
    "Altı tur ve üçer anlatıcı rolü tamamlandı",
  );
  check(
    g.state.winner_id === ids[0] &&
      g.state.players[0].score === 3 &&
      g.state.players[1].score === 0,
    "Puanlar ve kazanan doğru hesaplandı",
  );
  const cleanup = await clients[0].rpc("expired_reverse_audio", {
    p_limit: 100,
  });
  check(!!cleanup.error, "Normal oyuncu yönetici medya temizliğini çağıramadı");
  await action(0, "rematch");
  await action(1, "rematch");
  g = await game();
  check(
    g.id !== firstId &&
      g.state.current.number === 1 &&
      g.state.players.every((player) => player.score === 0),
    "Rövanş yeni maç ve sıfır puan açtı",
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      checks,
      uploadedFiles: paths.length,
      hardwareTest: false,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      result: "FAIL",
      checks,
      code: error.code ?? null,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  if (timer) clearInterval(timer);
  if (channel) await clients[0].removeChannel(channel);
  if (room)
    for (const client of clients) {
      try {
        await client.rpc("leave_room", { p_room_id: room });
      } catch {}
    }
  for (const client of clients) {
    await client.removeAllChannels();
    await client.auth.signOut().catch(() => {});
  }
}
