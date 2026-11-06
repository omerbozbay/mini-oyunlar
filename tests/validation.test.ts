import { describe, expect, it } from "vitest";
import { errorMessage, playerName, roomCode } from "../src/lib/validation";
import { games } from "../src/games/registry";

describe("Türkçe girişler ve sürüm kapsamı", () => {
  it("Türkçe isimleri ve boşlukları korur", () => {
    expect(playerName("  İpek   Çağrı  ")).toBe("İpek Çağrı");
  });
  it("uzunluk ve görünmeyen karakterleri denetler", () => {
    expect(() => playerName("A")).toThrow();
    expect(() => playerName("x".repeat(25))).toThrow();
    expect(() => playerName("İp\u200bek")).toThrow();
    expect(playerName("🙂".repeat(24))).toHaveLength(48);
  });
  it("oda kodunu normalleştirir ve hatalı kodları reddeder", () => {
    expect(roomCode(" af093c ")).toBe("AF093C");
    for (const code of ["", "12345", "1234567", "Ğ23456", "<script>"])
      expect(() => roomCode(code)).toThrow();
  });
  it("veritabanı ve ağ hatalarını anlaşılır gösterir", () => {
    expect(errorMessage({ message: "room_full" })).toContain("dolu");
    expect(
      errorMessage({ message: "Could not find function in schema cache" }),
    ).toContain("kurulmamış");
    expect(errorMessage(new TypeError("Failed to fetch"))).toContain(
      "ulaşılamadı",
    );
  });
  it("dört oyunu oynanabilir gibi göstermez", () => {
    expect(games).toHaveLength(4);
    expect(new Set(games.map((game) => game.id)).size).toBe(4);
    expect(
      games.every(
        (game) => game.status === "coming-soon" && game.rules.length > 0,
      ),
    ).toBe(true);
  });
});
