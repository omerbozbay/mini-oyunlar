import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { PuzzleDb, users } from "./helpers/puzzle-db";
const h = new PuzzleDb();
beforeAll(() => h.init(), 30000);
beforeEach(() => h.start("detective"));
afterAll(() => h.close());
async function prepared() {
  await h.action(0, "prepare", "1234");
  await h.action(1, "prepare", "5678");
}
describe("Sayı Dedektifi sunucu motoru", () => {
  it("dört hane, ilk rakam ve tekrarsızlık kurallarını uygular", async () => {
    for (const input of [
      "0123",
      "1123",
      "123",
      "12345",
      "12a4",
      "-123",
      1234,
      null,
    ])
      await expect(h.action(0, "prepare", input)).rejects.toThrow(
        "invalid_number",
      );
    await h.action(0, "prepare", " 1234 ");
    await h.user(0);
    expect(
      await h.scalar("select my_game_secret($1)", [(await h.game()).id]),
    ).toBe("1234");
  });
  it("sayılar kilitlenmeden başlamaz ve gizli sayılar public kayda girmez", async () => {
    await h.action(0, "prepare", "1234");
    await expect(h.action(1, "guess", "5678")).rejects.toThrow("invalid_phase");
    await h.action(1, "prepare", "5678");
    const g = await h.game();
    expect(g.phase).toBe("playing");
    expect(JSON.stringify(g)).not.toContain("1234");
    expect(JSON.stringify(g)).not.toContain("5678");
  });
  it("konum ipucu vermez; dört eşleşen rakam tam sayı farklıysa kazandırmaz", async () => {
    await prepared();
    let g = await h.game();
    const actor = users.indexOf(g.state.turn_id);
    await h.action(actor, "guess", actor === 0 ? "8765" : "4321");
    g = await h.game();
    expect(g.state.players[actor].history[0]).toEqual({
      guess: actor === 0 ? "8765" : "4321",
      matches: 4,
      correct: false,
    });
    expect(g.phase).toBe("playing");
    expect(g.state.players[actor].solved).toBe(false);
  });
  it("sıra dışını ve eski sürümü reddeder; istek tekrarı tek tahmindir", async () => {
    await prepared();
    const g = await h.game();
    const actor = users.indexOf(g.state.turn_id);
    await expect(h.action(1 - actor, "guess", "9012", g)).rejects.toThrow(
      "not_your_turn",
    );
    const request = randomUUID();
    await h.action(actor, "guess", "9012", g, request);
    await h.action(actor, "guess", "9012", g, request);
    expect((await h.game()).state.players[actor].guess_count).toBe(1);
    await expect(h.action(1 - actor, "guess", "9012", g)).rejects.toThrow(
      "stale_version",
    );
  });
  it("ilk bulan oyuncudan sonra rakibin aynı turdaki son hakkını korur; ikisi bulursa berabere", async () => {
    await prepared();
    let g = await h.game();
    const first = users.indexOf(g.state.turn_id);
    await h.action(first, "guess", first === 0 ? "5678" : "1234");
    g = await h.game();
    expect(g.phase).toBe("playing");
    expect(g.state.winner_id).toBeNull();
    expect(g.state.reveals).toBeUndefined();
    await h.action(1 - first, "guess", first === 0 ? "1234" : "5678");
    g = await h.game();
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBeNull();
    expect(g.state.reveals).toEqual({ [users[0]]: "1234", [users[1]]: "5678" });
  });
  it("yalnız ilk oyuncu bulduğunda tur sonunda onu kazandırır", async () => {
    await prepared();
    let g = await h.game();
    const first = users.indexOf(g.state.turn_id);
    await h.action(first, "guess", first === 0 ? "5678" : "1234");
    await h.action(1 - first, "guess", "9012");
    g = await h.game();
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBe(users[first]);
  });
  it("ikinci oyuncu bulduğunda turu bitirir ve rövanşta sayıları sıfırlar", async () => {
    await prepared();
    let g = await h.game();
    const first = users.indexOf(g.state.turn_id);
    await h.action(first, "guess", "9012");
    await h.action(1 - first, "guess", first === 0 ? "1234" : "5678");
    g = await h.game();
    expect(g.state.winner_id).toBe(users[1 - first]);
    await h.action(0, "rematch");
    await h.action(1, "rematch");
    const next = await h.game();
    expect(next.game).toBe("detective");
    expect(next.id).not.toBe(g.id);
    expect(
      next.state.players.every((p) => p.history.length === 0 && !p.prepared),
    ).toBe(true);
  });
  it("bağlantı kesilince ilerlemez, yenileme aynı maçı ve sırayı getirir", async () => {
    await prepared();
    const g = await h.game();
    await h.stale(1);
    await expect(
      h.action(users.indexOf(g.state.turn_id), "guess", "9012"),
    ).rejects.toThrow("players_offline");
    expect((await h.game()).state.turn_id).toBe(g.state.turn_id);
    await h.beat(1);
    await h.action(users.indexOf(g.state.turn_id), "guess", "9012");
    expect((await h.game()).id).toBe(g.id);
  });
  it("altı tahmin sınırı uygulamaz ve bütün sayı geçmişini korur", async () => {
    await prepared();
    for (let i = 0; i < 16; i++) {
      const g = await h.game();
      await h.action(users.indexOf(g.state.turn_id), "guess", "9012");
    }
    const g = await h.game();
    expect(g.phase).toBe("playing");
    expect(g.state.round).toBe(9);
    expect(
      g.state.players.every(
        (p) => p.guess_count === 8 && p.history.length === 8,
      ),
    ).toBe(true);
  });
});
