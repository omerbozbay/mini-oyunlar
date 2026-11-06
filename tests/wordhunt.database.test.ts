import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PuzzleDb, users } from "./helpers/puzzle-db";
const h = new PuzzleDb();
beforeAll(() => h.init(), 30000);
beforeEach(() => h.start("wordhunt"));
afterAll(() => h.close());
async function prepare(a = "KALEM", b = "KİTAP") {
  await h.action(0, "prepare", a);
  await h.action(1, "prepare", b);
}
describe("Kelime Avı sunucu motoru", () => {
  it("yalnız seçilen uzunlukta Türkçe harfleri kabul eder, cevapları gizler", async () => {
    for (const v of ["ELMA", "YORGAN", "QWERT", "12345", "A B C", null])
      await expect(h.action(0, "prepare", v)).rejects.toThrow("invalid_word");
    await prepare();
    const g = await h.game();
    expect(g.phase).toBe("playing");
    expect(JSON.stringify(g)).not.toContain("KALEM");
    expect(JSON.stringify(g)).not.toContain("KİTAP");
    await h.user(1);
    expect(await h.scalar("select my_game_secret($1)", [g.id])).toBe("KİTAP");
  });
  it("Türkçe I/İ ve NFC dönüşümünü doğru uygular", async () => {
    await prepare("ışığı", "incir");
    await h.action(0, "guess", " iNCİR ");
    let g = await h.game();
    expect(g.state.players[0].solved).toBe(true);
    expect(g.phase).toBe("playing");
    await h.action(1, "guess", "ışığı");
    g = await h.game();
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBeNull();
  });
  it("tekrarlanan harfleri önce yeşil, sonra kalan sayılara göre sarı yapar", async () => {
    await h.db.exec("reset role");
    expect(
      await h.scalar("select private.wordle_marks($1,$2)", ["KABAK", "AAAAA"]),
    ).toEqual(["absent", "correct", "absent", "correct", "absent"]);
    expect(
      await h.scalar("select private.wordle_marks($1,$2)", ["KABAK", "BAAAA"]),
    ).toEqual(["present", "correct", "absent", "correct", "absent"]);
  });
  it("altı harf modunda YORGAN / KALECİ örneğinde yalnız A sarıdır", async () => {
    await h.start("wordhunt", 6);
    await prepare("BARDAK", "YORGAN");
    await h.action(0, "guess", "KALECİ");
    const g = await h.game();
    expect(g.state.players[0].history[0].marks).toEqual([
      "absent",
      "present",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
    await h.user(0);
    await expect(
      h.db.query("select select_word_length($1,5)", [h.room]),
    ).rejects.toThrow("game_in_progress");
  });
  it("altıncı yanlışta hakkı bitirir; yedinciyi reddeder ve diğer oyuncuyu bekler", async () => {
    await prepare();
    for (let i = 0; i < 6; i++) await h.action(0, "guess", "ARMUT");
    let g = await h.game();
    expect(g.state.players[0]).toMatchObject({
      done: true,
      solved: false,
      guess_count: 6,
    });
    expect(g.phase).toBe("playing");
    expect(g.state.reveals).toBeUndefined();
    await expect(h.action(0, "guess", "KİTAP")).rejects.toThrow(
      "player_finished",
    );
    await h.action(1, "guess", "KALEM");
    g = await h.game();
    expect(g.state.winner_id).toBe(users[1]);
  });
  it("daha az tahminle bulan kazanır; ilk bitiren erken kazandırılmaz", async () => {
    await prepare();
    await h.action(0, "guess", "KİTAP");
    expect((await h.game()).phase).toBe("playing");
    await h.action(1, "guess", "ARMUT");
    await h.action(1, "guess", "KALEM");
    const g = await h.game();
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBe(users[0]);
    expect(g.state.reveals).toEqual({
      [users[0]]: "KALEM",
      [users[1]]: "KİTAP",
    });
  });
  it("iki oyuncu da altı hakta bulamazsa berabere kalır ve rövanş temiz hazırlanır", async () => {
    await prepare();
    for (let i = 0; i < 6; i++) {
      await h.action(0, "guess", "ARMUT");
      await h.action(1, "guess", "ARMUT");
    }
    const g = await h.game();
    expect(g.phase).toBe("finished");
    expect(g.state.winner_id).toBeNull();
    await h.action(0, "rematch");
    await h.action(1, "rematch");
    const next = await h.game();
    expect(next.game).toBe("wordhunt");
    expect(next.state.word_length).toBe(5);
    expect(next.phase).toBe("preparing");
    expect(next.state.reveals).toBeUndefined();
  });
  it("harf modunu yalnız sahip maçtan önce seçer; hazır durumları sıfırlanır", async () => {
    let g = await h.game();
    await h.action(0, "prepare", "KALEM");
    await h.user(1);
    await h.db.query("select leave_room($1)", [h.room]);
    await h.user(1);
    await h.db.query("select join_room($1,'Çağrı')", [h.code]);
    await h.user(0);
    await h.db.query("select set_ready($1,true)", [h.room]);
    await h.user(1);
    await expect(
      h.db.query("select select_word_length($1,6)", [h.room]),
    ).rejects.toThrow("host_only");
    await h.user(0);
    await h.db.query("select select_word_length($1,6)", [h.room]);
    expect(
      await h.scalar("select count(*)::int from room_players where ready"),
    ).toBe(0);
    await expect(
      h.db.query("select select_word_length($1,7)", [h.room]),
    ).rejects.toThrow("invalid_length");
  });
  it("oyuncular kendi revizyonlarıyla bağımsız tahmin edebilir; yanlış cevap ve RLS sızmaz", async () => {
    await prepare();
    const g = await h.game();
    await h.action(0, "guess", "ARMUT", g);
    await h.action(1, "guess", "ARMUT", g);
    const n = await h.game();
    expect(n.state.players.map((p) => p.guess_count)).toEqual([1, 1]);
    expect(JSON.stringify(n)).not.toContain("KALEM");
    await h.user(2);
    await expect(h.scalar("select my_game_secret($1)", [g.id])).rejects.toThrow(
      "not_a_member",
    );
    await expect(h.action(2, "guess", "KALEM")).rejects.toThrow("not_a_member");
  });
});
