import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { PuzzleDb, users } from "./helpers/puzzle-db";
import type {
  ReverseSession,
  AudioTicket,
  ListenTicket,
} from "../src/games/reverse/types";
const h = new PuzzleDb();
beforeAll(() => h.init(), 30000);
afterAll(() => h.close());
async function game() {
  await h.user(0);
  return h.scalar<ReverseSession>("select get_room_snapshot($1)->'game'", [
    h.code,
  ]);
}
async function act<T = Record<string, unknown>>(
  actor: number,
  action: string,
  payload: unknown = {},
  g?: ReverseSession,
  request = randomUUID(),
): Promise<T> {
  const s = g ?? (await game());
  await h.user(actor);
  return h.scalar("select reverse_action($1,$2,$3,$4,$5,$6)", [
    s.id,
    s.state.current.number,
    s.version,
    request,
    action,
    JSON.stringify(payload),
  ]);
}
const role = (g: ReverseSession, narrator = true) =>
  users.indexOf(
    narrator ? g.state.current.narrator_id : g.state.current.guesser_id,
  );
async function upload(actor: number, ticket: AudioTicket, frames = 8000) {
  await h.user(actor);
  await h.db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)",
    [
      "reverse-audio",
      ticket.path,
      users[actor],
      JSON.stringify({ size: 44 + frames * 2, mimetype: "audio/wav" }),
    ],
  );
}
async function readable(actor: number, path: string) {
  await h.user(actor);
  return h.scalar<number>(
    "select count(*)::int from storage.objects where name=$1",
    [path],
  );
}
async function sendNarrator() {
  let g = await game();
  const n = role(g);
  const ticket = await act<AudioTicket>(n, "upload_ticket");
  await upload(n, ticket);
  await act(n, "send_audio", {
    ticket: ticket.id,
    frames: 8000,
    sample_rate: 8000,
    channels: 1,
    category: "Şarkıcılar",
    word: "TARKAN",
  });
  return ticket;
}
async function listen() {
  let g = await game();
  const p = role(g, false);
  const ticket = await act<ListenTicket>(p, "reserve_listen");
  await act(p, "start_listen", { token: ticket.token });
  await h.db.exec("reset role");
  await h.db.query(
    "update private.reverse_rounds set started_at=now()-interval '2 seconds' where session_id=$1 and round_no=$2",
    [g.id, g.state.current.number],
  );
  await act(p, "finish_listen", { token: ticket.token });
  return ticket;
}
async function mimic() {
  const g = await game();
  const p = role(g, false);
  const ticket = await act<AudioTicket>(p, "reserve_mimic");
  await act(p, "mimic_captured");
  await upload(p, ticket);
  await act(p, "send_mimic", {
    ticket: ticket.id,
    frames: 8000,
    sample_rate: 8000,
    channels: 1,
  });
  return ticket;
}
async function completeRound(correct = true) {
  await sendNarrator();
  await listen();
  await mimic();
  let g = await game();
  await act(role(g, false), "guess", { guess: "Tarkan" });
  g = await game();
  await act(role(g), "judge", { correct });
}
beforeEach(async () => {
  await h.db.exec(
    "reset role;truncate public.rooms cascade;truncate storage.objects",
  );
  await h.user(0);
  h.code = await h.scalar("select create_room('İpek')");
  h.room = await h.scalar("select id from rooms");
  await h.db.query("select select_game($1,'reverse')", [h.room]);
  await h.user(1);
  await h.db.query("select join_room($1,'Çağrı')", [h.code]);
  await h.db.query("select set_ready($1,true)", [h.room]);
  await h.user(0);
  await h.db.query("select set_ready($1,true)", [h.room]);
  await h.db.query("select start_game($1)", [h.room]);
});
describe("Tersine Konuş sunucu ve Storage RLS", () => {
  it("private bucket kurar, rolleri rastgele başlatır ve sahte yola yüklemeyi reddeder", async () => {
    const g = await game();
    expect(g.game).toBe("reverse");
    expect(g.state.current.number).toBe(1);
    expect(users.slice(0, 2)).toContain(g.state.current.narrator_id);
    await h.db.exec("reset role");
    expect(
      await h.scalar("select public from storage.buckets where id=$1", [
        "reverse-audio",
      ]),
    ).toBe(false);
    await h.user(0);
    await expect(
      h.db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('reverse-audio','fake.wav',$1)",
        [users[0]],
      ),
    ).rejects.toThrow("row-level security");
  });
  it("yalnız anlatıcı ses gönderir; metin ve dosya rakibe erken açılmaz", async () => {
    let g = await game();
    await expect(act(role(g, false), "upload_ticket")).rejects.toThrow(
      "not_your_role",
    );
    const t = await sendNarrator();
    g = await game();
    expect(g.state.current.phase).toBe("listening");
    expect(JSON.stringify(g)).not.toContain("TARKAN");
    expect(await readable(role(g), t.path)).toBe(1);
    expect(await readable(role(g, false), t.path)).toBe(0);
    await h.user(role(g, false));
    expect(
      (
        await h.scalar<{ my_word: string | null }>(
          "select reverse_context($1,1)",
          [g.id],
        )
      ).my_word,
    ).toBeNull();
  });
  it("10 saniyeyi, WAV boyutunu ve dosya sahibini doğrular", async () => {
    const g = await game(),
      n = role(g);
    const t = await act<AudioTicket>(n, "upload_ticket");
    await upload(n, t);
    await expect(
      act(n, "send_audio", {
        ticket: t.id,
        frames: 80001,
        sample_rate: 8000,
        channels: 1,
        category: "Şehirler",
        word: "İzmir",
      }),
    ).rejects.toThrow("invalid_audio");
    await expect(
      act(n, "send_audio", {
        ticket: t.id,
        frames: 10,
        sample_rate: 8000,
        channels: 1,
        category: "Şehirler",
        word: "İzmir",
      }),
    ).rejects.toThrow("invalid_audio");
  });
  it("dinleme hakkı yalnız ses bitince kullanılır, refresh ve tekrar yeni hak açmaz", async () => {
    const t = await sendNarrator();
    let g = await game();
    const p = role(g, false);
    const lease = await act<ListenTicket>(p, "reserve_listen");
    expect(await readable(p, t.path)).toBe(1);
    await act(p, "start_listen", { token: lease.token });
    expect(await readable(p, t.path)).toBe(0);
    await expect(act(p, "reserve_listen")).rejects.toThrow(
      "listen_unavailable",
    );
    await expect(
      act(p, "finish_listen", { token: lease.token }),
    ).rejects.toThrow("listen_not_finished");
    await h.db.exec("reset role");
    await h.db.query(
      "update private.reverse_rounds set started_at=now()-interval '2 seconds'",
    );
    await act(p, "finish_listen", { token: lease.token });
    g = await game();
    expect(g.state.current).toMatchObject({
      phase: "imitating",
      listen_status: "used",
    });
    await expect(
      act(p, "start_listen", { token: lease.token }),
    ).rejects.toThrow("listen_unavailable");
  });
  it("yükleme/decode hatasında hak tüketmez; başlamış oynatma hatasını anlatıcı onayla açar", async () => {
    await sendNarrator();
    const g = await game();
    const p = role(g, false),
      n = role(g);
    let lease = await act<ListenTicket>(p, "reserve_listen");
    await act(p, "cancel_listen", { token: lease.token });
    expect((await game()).state.current.listen_status).toBe("unused");
    lease = await act(p, "reserve_listen");
    await act(p, "start_listen", { token: lease.token });
    await act(p, "listen_failed", { token: lease.token });
    await expect(act(p, "allow_listen_retry")).rejects.toThrow("not_your_role");
    await act(n, "allow_listen_retry");
    const again = await act<ListenTicket>(p, "reserve_listen");
    expect(again.token).not.toBe(lease.token);
  });
  it("taklit teknik hata kurtarması verir; gönderilen taklidi değiştirmez", async () => {
    await sendNarrator();
    await listen();
    let g = await game();
    const p = role(g, false);
    const old = await act<AudioTicket>(p, "reserve_mimic");
    await act(p, "mimic_captured");
    await act(p, "mimic_failed");
    const next = await act<AudioTicket>(p, "reserve_mimic");
    expect(next.id).not.toBe(old.id);
    await act(p, "mimic_captured");
    await upload(p, next);
    await act(p, "send_mimic", {
      ticket: next.id,
      frames: 8000,
      sample_rate: 8000,
      channels: 1,
    });
    g = await game();
    expect(g.state.current.phase).toBe("guessing");
    await expect(act(p, "mimic_failed")).rejects.toThrow("not_your_role");
    expect(await readable(role(g), next.path)).toBe(0);
  });
  it("tek tahmin, anlatıcı puanlama ve idempotency uygular; sonra metin ve ses açılır", async () => {
    const narr = await sendNarrator();
    await listen();
    const mim = await mimic();
    let g = await game();
    const p = role(g, false),
      n = role(g);
    await act(p, "guess", { guess: "Tarkan" });
    await expect(act(p, "guess", { guess: "Başka" })).rejects.toThrow(
      "not_your_role",
    );
    await expect(act(p, "judge", { correct: true })).rejects.toThrow(
      "not_your_role",
    );
    g = await game();
    const key = randomUUID();
    await act(n, "judge", { correct: true }, g, key);
    await act(n, "judge", { correct: true }, g, key);
    g = await game();
    expect(g.state.players[p].score).toBe(1);
    expect(g.state.current.answer).toBe("TARKAN");
    expect(await readable(p, narr.path)).toBe(1);
    expect(await readable(n, mim.path)).toBe(1);
  });
  it("altı turda üçer rol dağıtır, skor kazananı belirler, rövanş ve eski tur koruması çalışır", async () => {
    const roles = [0, 0];
    for (let i = 0; i < 6; i++) {
      let g = await game();
      roles[role(g)]++;
      await completeRound(role(g, false) === 0);
      if (i < 5) {
        await act(0, "next");
        await act(1, "next");
      }
    }
    let g = await game();
    expect(roles).toEqual([3, 3]);
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBe(users[0]);
    expect(g.state.players.map((p) => p.score)).toEqual([3, 0]);
    expect(g.state.rounds).toHaveLength(6);
    const old = g;
    await act(0, "rematch");
    await act(1, "rematch");
    g = await game();
    expect(g.id).not.toBe(old.id);
    expect(g.state.current.number).toBe(1);
    expect(g.state.players.every((p) => p.score === 0)).toBe(true);
    await expect(act(0, "next", {}, old)).rejects.toThrow("game_not_current");
  }, 15000);
  it("eşit puanda beraberlik, sonuçtan lobi ve iki kişilik üyelik korunur", async () => {
    for (let i = 0; i < 6; i++) {
      await completeRound(true);
      if (i < 5) {
        await act(0, "next");
        await act(1, "next");
      }
    }
    const g = await game();
    expect(g.state.players.map((p) => p.score)).toEqual([3, 3]);
    expect(g.state.winner_id).toBeNull();
    await act(0, "lobby");
    expect(await game()).toBeNull();
    expect(
      await h.scalar("select count(*)::int from room_players where active"),
    ).toBe(2);
  }, 15000);
  it("üçüncü kişi dosyayı/cevabı okuyamaz; bağlantı kopması ilerlemeyi durdurur", async () => {
    const t = await sendNarrator();
    const g = await game();
    expect(await readable(2, t.path)).toBe(0);
    await h.user(2);
    await expect(
      h.scalar("select reverse_context($1,1)", [g.id]),
    ).rejects.toThrow("not_a_member");
    await expect(act(2, "reserve_listen")).rejects.toThrow("not_a_member");
    await h.stale(1);
    await expect(act(role(g, false), "reserve_listen")).rejects.toThrow(
      "players_offline",
    );
    await h.beat(1);
    await act(role(g, false), "reserve_listen");
    expect((await game()).id).toBe(g.id);
  });
  it("24 saat sonunda dosya erişimini kapatır ve yalnız service_role temizleyebilir", async () => {
    const t = await sendNarrator();
    let g = await game();
    await h.user(1);
    await h.db.query("select leave_room($1)", [h.room]);
    await h.db.exec("reset role");
    expect(
      await h.scalar(
        "select expires_at is not null from private.reverse_assets where id=$1",
        [t.id],
      ),
    ).toBe(true);
    await h.db.query(
      "update private.reverse_assets set expires_at=now()-interval '1 second'",
    );
    expect(await readable(0, t.path)).toBe(0);
    await expect(
      h.db.query("select expired_reverse_audio(100)"),
    ).rejects.toThrow("permission denied");
    await h.db.exec("reset role;set role service_role");
    expect(await h.scalar("select expired_reverse_audio(100)")).toBe(t.path);
    await h.db.query("select confirm_audio_cleanup($1)", [[t.path]]);
    await h.db.exec("reset role");
    expect(
      await h.scalar(
        "select count(*)::int from private.reverse_assets where id=$1",
        [t.id],
      ),
    ).toBe(0);
  });
  it("temizlik aktif maç dosyasını süresi dolmadan metadata'dan silmez", async () => {
    const t = await sendNarrator();
    await h.db.exec("reset role;set role service_role");
    await h.db.query("select confirm_audio_cleanup($1)", [[t.path]]);
    await h.db.exec("reset role");
    expect(
      await h.scalar(
        "select count(*)::int from private.reverse_assets where id=$1",
        [t.id],
      ),
    ).toBe(1);
  });
});
