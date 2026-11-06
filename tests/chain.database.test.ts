import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { PuzzleDb, users } from "./helpers/puzzle-db";
const h = new PuzzleDb();
const a = ["Elma", "Ağacı", "Yaprağı", "Sarması", "Tatlısı"];
const b = ["deniz", "yıldızı", "ışığı", "rengi", "tonu"];
beforeAll(() => h.init(), 30000);
beforeEach(() => h.start("chain"));
afterAll(() => h.close());
async function prepared() {
  await h.action(0, "prepare", a);
  await h.action(1, "prepare", b);
}
describe("Kelime Zinciri sunucu motoru", () => {
  it("beş kelimeyi doğrular; boş, kısa ve Türkçe olmayan girişleri reddeder", async () => {
    for (const value of [
      null,
      [],
      ["elma"],
      ["a", ...a.slice(1)],
      ["", ...a.slice(1)],
      ["qwerty", ...a.slice(1)],
    ])
      await expect(h.action(0, "prepare", value)).rejects.toThrow();
  });
  it("hazırlığı kilitler, rakibin zincirini public veriye koymaz", async () => {
    await h.action(0, "prepare", a);
    let g = await h.game();
    expect(g.phase).toBe("preparing");
    expect(JSON.stringify(g)).not.toContain("AĞACI");
    await h.user(0);
    expect(await h.scalar("select my_game_secret($1)", [g.id])).toEqual(
      a.map((v) => v.toLocaleUpperCase("tr-TR")),
    );
    await h.user(1);
    expect(await h.scalar("select my_game_secret($1)", [g.id])).toBeNull();
    await expect(h.action(0, "prepare", b)).rejects.toThrow("secret_locked");
    await expect(h.action(0, "guess", "yıldızı")).rejects.toThrow(
      "invalid_phase",
    );
  });
  it("iki hazırlıktan sonra yalnız ilk kelime ve doğru harf/uzunluk ipuçlarını açar", async () => {
    await prepared();
    const g = await h.game();
    expect(g.phase).toBe("playing");
    expect(g.state.hints?.[users[0]][0].word).toBe("DENİZ");
    expect(g.state.hints?.[users[0]][1]).toEqual({ first: "Y", length: 7 });
    expect(JSON.stringify(g)).not.toContain("YILDIZI");
    expect(JSON.stringify(g)).not.toContain("AĞACI");
  });
  it("yanlış tahminde cevap sızdırmaz; kelimeleri sırayla Türkçe normalizasyonuyla açar", async () => {
    await prepared();
    await h.action(0, "guess", "tonu");
    let g = await h.game();
    expect(g.state.players[0].progress).toBe(1);
    expect(g.state.players[0].history[0].correct).toBe(false);
    await h.action(0, "guess", "  yıldızı  ");
    g = await h.game();
    expect(g.state.players[0].progress).toBe(2);
    expect(g.state.hints?.[users[0]][1].word).toBe("YILDIZI");
    await h.action(0, "guess", "ışığı");
    g = await h.game();
    expect(g.state.players[0].progress).toBe(3);
  });
  it("bağımsız oyuncu revizyonları eşzamanlı tahminleri kabul eder, aynı isteği iki kez işlemez", async () => {
    await prepared();
    const g = await h.game();
    const req = randomUUID();
    await h.action(0, "guess", "yıldızı", g, req);
    await h.action(0, "guess", "yıldızı", g, req);
    await h.action(1, "guess", "ağacı", g);
    const n = await h.game();
    expect(n.state.players.map((p) => p.progress)).toEqual([2, 2]);
    expect(n.state.players[0].guess_count).toBe(1);
    await expect(h.action(0, "guess", "ışığı", g)).rejects.toThrow(
      "stale_version",
    );
  });
  it("ilk geçerli tamamlayan kazanır, sonra iki zincir açılır ve rövanş yeni hazırlık açar", async () => {
    await prepared();
    for (const word of b.slice(1)) await h.action(0, "guess", word);
    const g = await h.game();
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBe(users[0]);
    expect(g.state.reveals?.[users[1]]).toEqual(
      b.map((v) => v.toLocaleUpperCase("tr-TR")),
    );
    await expect(h.action(1, "guess", "ağacı")).rejects.toThrow(
      "invalid_phase",
    );
    await h.action(0, "rematch");
    await h.action(1, "rematch");
    const next = await h.game();
    expect(next.id).not.toBe(g.id);
    expect(next.phase).toBe("preparing");
    expect(next.state.players.every((p) => !p.prepared)).toBe(true);
    await expect(h.action(0, "prepare", a, g)).rejects.toThrow(
      "game_not_current",
    );
  });
  it("RLS, özel tablo izinleri, motor yönlendirmesi ve çevrimdışı duraklama korunur", async () => {
    await prepared();
    const g = await h.game();
    await h.user(1);
    await expect(
      h.db.query("select * from private.puzzle_secrets"),
    ).rejects.toThrow("permission denied");
    await h.user(2);
    expect(await h.scalar("select count(*)::int from game_sessions")).toBe(0);
    await expect(h.scalar("select my_game_secret($1)", [g.id])).rejects.toThrow(
      "not_a_member",
    );
    await expect(h.action(2, "guess", "yıldızı")).rejects.toThrow(
      "not_a_member",
    );
    await h.user(0);
    await expect(
      h.db.query("select auction_action($1,$2,$3,'rematch')", [
        g.id,
        g.version,
        randomUUID(),
      ]),
    ).rejects.toThrow("invalid_game");
    await h.stale(1);
    await expect(h.action(0, "guess", "yıldızı")).rejects.toThrow(
      "players_offline",
    );
    await h.beat(1);
    await h.action(0, "guess", "yıldızı");
    expect((await h.game()).id).toBe(g.id);
  });
  it("sınırsız yanlış tahminde kilitlenmez; son 50 geçmiş saklansa da sayacı korur", async () => {
    await prepared();
    for (let i = 0; i < 55; i++) await h.action(0, "guess", "KÖPRÜ");
    let g = await h.game();
    expect(g.state.players[0].guess_count).toBe(55);
    expect(g.state.players[0].history).toHaveLength(50);
    await h.action(0, "guess", "yıldızı");
    g = await h.game();
    expect(g.state.players[0].progress).toBe(2);
    expect(g.state.players[0].guess_count).toBe(56);
  });
  it("eski Açık Artırma uygulamasını doğrudan çağırma izni vermez", async () => {
    const g = await h.game();
    await expect(
      h.db.query("select auction_action_impl($1,$2,$3,'rematch')", [
        g.id,
        g.version,
        randomUUID(),
      ]),
    ).rejects.toThrow("permission denied");
  });
});
