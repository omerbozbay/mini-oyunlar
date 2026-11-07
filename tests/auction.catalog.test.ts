import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import themes from "../src/games/auction/themes.json";
import { maxBid } from "../src/games/auction/rules";
import { command } from "../src/games/auction/api";
import type { AuctionSession } from "../src/games/auction/types";
describe("Açık Artırma kataloğu ve bütçe ipuçları", () => {
  it("HTTP yerel önizlemesinde randomUUID yokken geçerli istek kimliği üretir", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });
    try {
      expect(
        command({ id: "session", version: 2 } as AuctionSession, "bid", 1)
          .p_request_id,
      ).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("17 temada 312 farklı yerel görselli ürün vardır", () => {
    expect(themes).toHaveLength(17);
    const ids = new Set();
    for (const theme of themes) {
      expect(theme.items.length).toBeGreaterThanOrEqual(16);
      for (const item of theme.items) {
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
        expect(item.description.length).toBeGreaterThan(10);
        expect(existsSync(`public${item.image}`)).toBe(true);
        const asset = readFileSync(`public${item.image}`);
        if ("image_cell" in item) {
          expect(asset.toString("ascii", 0, 4)).toBe("RIFF");
          expect(asset.toString("ascii", 8, 12)).toBe("WEBP");
          expect(item.image_cell).toBeGreaterThanOrEqual(0);
          expect(item.image_cell).toBeLessThan(20);
        } else {
          expect(asset.toString()).toContain("<svg");
          expect(asset.toString()).not.toMatch(/href=["']https?:/);
        }
      }
    }
    expect(ids.size).toBe(312);
  });
  it("sunucu ürün havuzu istemcideki katalogla aynıdır", () => {
    const sql = readFileSync(
      "supabase/migrations/202611070009_auction_expanded_catalog.sql",
      "utf8",
    );
    for (const theme of themes)
      expect(sql).toContain(JSON.stringify(theme.items));
  });
  it("ürün sayısından bağımsız kalan bütçeyi teklif sınırı yapar", () => {
    expect(maxBid({ id: "a", name: "A", budget: 20, items: [] })).toBe(20);
    expect(
      maxBid({ id: "a", name: "A", budget: 10, items: [{}, {}] as never[] }),
    ).toBe(10);
    expect(
      maxBid({
        id: "a",
        name: "A",
        budget: 10,
        items: [{}, {}, {}, {}, {}] as never[],
      }),
    ).toBe(10);
  });
  it("istenen yeni temaların her birinde 20 seçenek ve pizzada sosis/mısır vardır", () => {
    for (const id of [
      "heroes",
      "meals",
      "teatime",
      "series",
      "survival",
      "dessert",
      "commanders",
      "countries",
      "powers",
    ])
      expect(themes.find((t) => t.id === id)?.items).toHaveLength(20);
    const pizza = themes.find((t) => t.id === "pizza")!;
    expect(pizza.items.map((i) => i.name)).toEqual(
      expect.arrayContaining(["Sosis", "Mısır"]),
    );
  });
});
