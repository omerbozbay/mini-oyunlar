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
  it("açılışta 16 TL üst sınırını gösterir ve ilk pası kapatır", async () => {
    await render();
    expect(node.textContent).toContain("16 TL");
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
  it("dokuz tema sunar, misafirin tema seçmesini engeller", async () => {
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
    expect(node.querySelectorAll("button")).toHaveLength(9);
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
      node.querySelector("img")?.dispatchEvent(new Event("error")),
    );
    expect(node.querySelector(".product-fallback")).not.toBeNull();
    expect(button("Teklif ver").disabled).toBe(false);
  });
});
