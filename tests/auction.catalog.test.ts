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
  it("dokuz temanın her birinde 16 farklı yerel görselli ürün vardır", () => {
    expect(themes).toHaveLength(9);
    const ids = new Set();
    for (const theme of themes) {
      expect(theme.items).toHaveLength(16);
      for (const item of theme.items) {
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
        expect(item.description.length).toBeGreaterThan(10);
        expect(existsSync(`public${item.image}`)).toBe(true);
        const svg = readFileSync(`public${item.image}`, "utf8");
        expect(svg).toContain("<svg");
        expect(svg).not.toMatch(/href=["']https?:/);
      }
    }
    expect(ids.size).toBe(144);
  });
  it("sunucu ürün havuzu istemcideki katalogla aynıdır", () => {
    const sql = readFileSync(
      "supabase/migrations/202611060003_auction_catalog.sql",
      "utf8",
    );
    for (const theme of themes)
      expect(sql).toContain(JSON.stringify(theme.items));
  });
  it("bütçe rezervi örneklerini hesaplar", () => {
    expect(maxBid({ id: "a", name: "A", budget: 20, items: [] })).toBe(16);
    expect(
      maxBid({ id: "a", name: "A", budget: 10, items: [{}, {}] as never[] }),
    ).toBe(8);
    expect(
      maxBid({
        id: "a",
        name: "A",
        budget: 10,
        items: [{}, {}, {}, {}, {}] as never[],
      }),
    ).toBe(0);
  });
});
