// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { AuctionBoard, ThemePicker } from "../src/games/auction/Auction";
import type { AuctionSession } from "../src/games/auction/types";
import type { Player } from "../src/features/rooms/types";
import themes from "../src/games/auction/themes.json";
const api = vi.hoisted(() => ({ sendCommand: vi.fn() }));
vi.mock("../src/games/auction/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sendCommand: api.sendCommand,
}));
let node: HTMLDivElement;
let root: Root;
let g: AuctionSession;
const members: (Player & { online: boolean })[] = ["a", "b"].map((id) => ({
  user_id: id,
  room_id: "room",
  name: id,
  active: true,
  ready: false,
  online: true,
  last_seen: new Date().toISOString(),
  joined_at: new Date().toISOString(),
}));
const reload = vi.fn(async () => {});
async function render(user = "a", players = members) {
  await act(async () =>
    root.render(
      <AuctionBoard
        session={g}
        userId={user}
        players={players}
        reload={reload}
      />,
    ),
  );
}
function button(text: string) {
  const b = Array.from(node.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!b) throw Error("Buton yok: " + text);
  return b;
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  api.sendCommand.mockResolvedValue(undefined);
  g = {
    id: "session",
    room_id: "room",
    game: "auction",
    theme: "pizza",
    version: 0,
    phase: "bidding",
    state: {
      players: [
        { id: "a", name: "İpek", budget: 20, items: [] },
        { id: "b", name: "Çağrı", budget: 20, items: [] },
      ],
      products: themes[0].items.slice(0, 10),
      index: 0,
      starter: 0,
      turn_id: "a",
      current_bid: 0,
      bidder_id: null,
      votes_cast: [],
      winner_id: null,
      rematch_ready: [],
    },
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.clearAllMocks();
});
describe("Açık Artırma arayüzü", () => {
  it("açılışta tüm 20 TL bütçeyi kullanabilir ve ilk pası kapatır", async () => {
    await render();
    expect(node.textContent).toContain("20 TL");
    expect(button("Pas").disabled).toBe(true);
    expect(button("Teklif ver").disabled).toBe(false);
    await act(async () => button("+5").click());
    expect((node.querySelector("input") as HTMLInputElement).value).toBe("5");
    await act(async () => button("Teklif ver").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ p_action: "bid", p_amount: 5, p_version: 0 }),
    );
  });
  it("sırası olmayan ve bağlantısı kopan oyuncunun kontrollerini kapatır", async () => {
    await render("b");
    expect(button("Teklif ver").disabled).toBe(true);
    await render(
      "a",
      members.map((p) => ({ ...p, online: p.user_id === "a" })),
    );
    expect(button("Teklif ver").disabled).toBe(true);
    expect(node.textContent).toContain("Oyun duraklatıldı");
  });
  it("belirsiz ağ sonucunu aynı istek UUID’siyle yeniden gönderir", async () => {
    api.sendCommand.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await render();
    await act(async () => button("Teklif ver").click());
    const sent = api.sendCommand.mock.calls[0][0];
    await act(async () => button("İsteği yeniden dene").click());
    expect(api.sendCommand.mock.calls[1][0]).toEqual(sent);
    expect(api.sendCommand.mock.calls[1][0].p_request_id).toBe(
      sent.p_request_id,
    );
  });
  it("oyu kullanıcının gerçek kazanan kimliğiyle gönderir ve gizli tercih göstermez", async () => {
    g.phase = "voting";
    g.state.index = 10;
    g.state.votes_cast = ["b"];
    await render();
    expect(node.textContent).not.toContain("Rakibin seçimi");
    await act(async () => button("Rakibim kazandı").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ p_action: "vote", p_choice: "b" }),
    );
  });
  it("rövanş ve lobi seçeneklerini yalnız sonuçta sunar", async () => {
    g.phase = "finished";
    g.state.index = 10;
    g.state.winner_id = "a";
    await render();
    expect(node.textContent).toContain("İpek kazandı");
    await act(async () => button("Aynı temada rövanş").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ p_action: "rematch" }),
    );
    await act(async () => button("Oyun lobisine dön").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ p_action: "lobby" }),
    );
  });
  it("on yedi tema sunar, misafirin tema seçmesini engeller", async () => {
    const select = vi.fn();
    await act(async () =>
      root.render(
        <ThemePicker
          selected="pizza"
          host={false}
          disabled={false}
          onSelect={select}
        />,
      ),
    );
    expect(node.querySelectorAll("button")).toHaveLength(17);
    expect(
      Array.from(node.querySelectorAll("button")).every((b) => b.disabled),
    ).toBe(true);
    await act(async () =>
      root.render(
        <ThemePicker
          selected="pizza"
          host
          disabled={false}
          onSelect={select}
        />,
      ),
    );
    await act(async () => node.querySelectorAll("button")[8].click());
    expect(select).toHaveBeenCalledWith("home");
  });
  it("görsel yükleme hatası hamleleri kilitlemez", async () => {
    await render();
    await act(async () =>
      node.querySelector("image")?.dispatchEvent(new Event("error")),
    );
    expect(node.querySelector(".product-fallback")).not.toBeNull();
    expect(button("Teklif ver").disabled).toBe(false);
  });
  it("yalnız kendi ürününde hediye düğmesi sunar ve ürün kimliğini gönderir", async () => {
    g.state.players[0].items = [
      { ...themes[0].items[0], price: 1, automatic: false },
    ];
    g.state.players[1].items = [
      { ...themes[0].items[1], price: 1, automatic: false },
    ];
    await render();
    expect(node.querySelectorAll(".gift-button")).toHaveLength(1);
    await act(async () => button("Arkadaşına ver").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        p_action: "gift",
        p_choice: themes[0].items[0].id,
      }),
    );
  });
  it("on ürün sonrasında koleksiyon onayı gösterir; oylamada hediye düğmelerini kapatır", async () => {
    g.phase = "arranging";
    g.state.index = 10;
    await render();
    expect(button("Koleksiyonum hazır").disabled).toBe(false);
    await act(async () => button("Koleksiyonum hazır").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ p_action: "confirm" }),
    );
    g.phase = "voting";
    await render();
    expect(node.querySelector(".gift-button")).toBeNull();
    expect(node.textContent).not.toContain("/5");
  });
  it("bir bütçe bitince parası kalan oyuncuya ücretsiz iki hedef sunar", async () => {
    g.state.players[1].budget = 0;
    await render();
    expect(node.textContent).toContain("para kesilmez");
    expect(button("Ücretsiz kendime al").disabled).toBe(false);
    await act(async () => button("Ücretsiz arkadaşıma ver").click());
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ p_action: "allocate", p_choice: "b" }),
    );
    await render("b");
    expect(button("Ücretsiz kendime al").disabled).toBe(true);
    expect(node.querySelector("#auction-amount")).toBeNull();
  });
});
