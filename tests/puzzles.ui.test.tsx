// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
import { PuzzleBoard } from "../src/games/puzzles/PuzzleBoard";
import type { PuzzleSession } from "../src/games/puzzles/types";
import type { Player } from "../src/features/rooms/types";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/features/rooms/api", () => ({ rpc: api.rpc }));
let root: Root;
let node: HTMLDivElement;
let g: PuzzleSession;
const members = ["a", "b"].map((id) => ({
  user_id: id,
  room_id: "r",
  name: id,
  active: true,
  ready: false,
  online: true,
  last_seen: new Date().toISOString(),
  joined_at: new Date().toISOString(),
}));
async function render(players: (Player & { online: boolean })[] = members) {
  await act(async () =>
    root.render(
      <PuzzleBoard
        session={g}
        userId="a"
        players={players}
        reload={async () => {}}
      />,
    ),
  );
}
function button(label: string) {
  const found = Array.from(node.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) throw Error(label);
  return found;
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  api.rpc.mockResolvedValue(null);
  g = {
    id: "s",
    room_id: "r",
    game: "chain",
    theme: null,
    phase: "preparing",
    version: 0,
    state: {
      players: ["a", "b"].map((id) => ({
        id,
        name: id === "a" ? "İpek" : "Çağrı",
        prepared: false,
        revision: 0,
        progress: 1,
        history: [],
        done: false,
        solved: false,
        guess_count: 0,
      })) as unknown as PuzzleSession["state"]["players"],
      word_length: 5,
      starter: 0,
      turn_id: "a",
      round: 1,
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
describe("Üç bulmacanın arayüzü", () => {
  it("beş gizli kelime alanı sunar ve boş zinciri kilitlemez", async () => {
    await render();
    expect(node.querySelectorAll("input")).toHaveLength(5);
    expect(button("Zincirimi Hazırladım").disabled).toBe(true);
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("tahminde yalnız izinli ipuçlarını gösterir ve çevrimdışıyken kontrolleri kapatır", async () => {
    g.phase = "playing";
    g.state.hints = {
      a: [
        { first: "E", length: 4, word: "ELMA" },
        { first: "A", length: 5 },
        { first: "Y", length: 7 },
        { first: "S", length: 7 },
        { first: "T", length: 7 },
      ],
    };
    await render();
    expect(node.textContent).toContain("ELMA");
    expect(node.textContent).not.toContain("AĞACI");
    await render(members.map((p) => ({ ...p, online: p.user_id === "a" })));
    expect(node.textContent).toContain("Oyun duraklatıldı");
    expect((node.querySelector("input") as HTMLInputElement).disabled).toBe(
      true,
    );
  });
  it("yalnız kendi cevabını RPC ile ister; hazırlanan zinciri değiştirtmez", async () => {
    g.state.players[0].prepared = true;
    api.rpc.mockResolvedValue([
      "ELMA",
      "AĞACI",
      "YAPRAĞI",
      "SARMASI",
      "TATLISI",
    ]);
    await render();
    expect(api.rpc).toHaveBeenCalledWith("my_game_secret", {
      p_session_id: "s",
    });
    expect(node.querySelectorAll("input")).toHaveLength(0);
    expect(node.textContent).toContain("Zincirin kilitlendi");
  });
  it("sonuçta iki zinciri ve rövanşı sunar", async () => {
    g.phase = "finished";
    g.state.winner_id = "a";
    g.state.reveals = {
      a: ["ELMA", "AĞACI", "YAPRAĞI", "SARMASI", "TATLISI"],
      b: ["DENİZ", "YILDIZI", "IŞIĞI", "RENGİ", "TONU"],
    };
    await render();
    expect(node.textContent).toContain("İpek kazandı");
    await act(async () => button("Rövanş").click());
    expect(api.rpc).toHaveBeenCalledWith(
      "puzzle_action",
      expect.objectContaining({ p_action: "rematch", p_session_id: "s" }),
    );
  });
  it("Sayı Dedektifi hazırlığında sayısal klavye ve gizli kilitleme sunar", async () => {
    g.game = "detective";
    await render();
    expect(node.querySelector("input")?.getAttribute("inputmode")).toBe(
      "numeric",
    );
    expect(button("Sayımı Kilitle").disabled).toBe(true);
    expect(node.textContent).not.toContain("Zincirimi Hazırladım");
  });
  it("sıra ve tur adaletini gösterir; konum bilgisi göstermez", async () => {
    g.game = "detective";
    g.phase = "playing";
    g.state.turn_id = "b";
    g.state.players[0].history = [
      { guess: "4321", matches: 4, correct: false },
    ];
    g.state.players[0].guess_count = 1;
    await render();
    expect((node.querySelector("input") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(node.textContent).toContain("4 doğru rakam");
    g.state.turn_id = "a";
    g.state.players[1].solved = true;
    await render();
    expect(node.textContent).toContain("bu turdaki son tahmin hakkın sende");
    expect((node.querySelector("input") as HTMLInputElement).disabled).toBe(
      false,
    );
  });
  it("Kelime Avı altı harf hazırlığında sayaç gösterir", async () => {
    g.game = "wordhunt";
    g.state.word_length = 6;
    await render();
    expect(node.textContent).toContain("0/6 harf");
    expect(button("Kelimemi Kilitle").disabled).toBe(true);
  });
  it("ekran klavyesi I ve İ dahil 29 harf içerir ve Türkçe tahmini sunucuya gönderir", async () => {
    g.game = "wordhunt";
    g.phase = "playing";
    await render();
    expect(node.querySelectorAll(".keyboard-letters>button")).toHaveLength(29);
    for (const letter of ["K", "İ", "T", "A", "P"])
      await act(async () => button(letter).click());
    expect((node.querySelector("input") as HTMLInputElement).value).toBe(
      "KİTAP",
    );
    await act(async () => button("Enter").click());
    expect(api.rpc).toHaveBeenCalledWith(
      "puzzle_action",
      expect.objectContaining({ p_action: "guess", p_payload: "KİTAP" }),
    );
  });
  it("fiziksel klavye ve silme çalışır, kısayollar tahmine karışmaz", async () => {
    g.game = "wordhunt";
    g.phase = "playing";
    await render();
    for (const key of ["k", "i", "t", "a", "p"])
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
      });
    expect((node.querySelector("input") as HTMLInputElement).value).toBe(
      "KİTAP",
    );
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }),
      );
    });
    expect((node.querySelector("input") as HTMLInputElement).value).toBe(
      "KİTA",
    );
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "x",
          ctrlKey: true,
          bubbles: true,
        }),
      );
    });
    expect((node.querySelector("input") as HTMLInputElement).value).toBe(
      "KİTA",
    );
  });
  it("sunucunun harf renklerini erişilebilir etiketlerle gösterir", async () => {
    g.game = "wordhunt";
    g.phase = "playing";
    g.state.players[0].history = [
      {
        guess: "AAAAA",
        correct: false,
        marks: ["absent", "correct", "absent", "correct", "absent"],
      },
    ];
    g.state.players[0].guess_count = 1;
    await render();
    expect(node.querySelectorAll(".word-cell.mark-correct")).toHaveLength(2);
    expect(node.querySelector('[aria-label="A, doğru konum"]')).not.toBeNull();
    expect(button("A").classList.contains("mark-correct")).toBe(true);
  });
  it("bitiren oyuncu rakibini beklerken yedinci tahmin arayüzünü açmaz", async () => {
    g.game = "wordhunt";
    g.phase = "playing";
    g.state.players[0].done = true;
    g.state.players[0].guess_count = 6;
    await render();
    expect(node.textContent).toContain("Altı tahminin tamamlandı");
    expect(node.querySelector(".turkish-keyboard")).toBeNull();
    expect(node.querySelector("input")).toBeNull();
    expect(node.textContent).not.toContain("Beraberlik!");
  });
  it("belirsiz ağ hatasında aynı gizli hazırlık komutunu aynı UUID ile tekrarlar", async () => {
    g.phase = "finished";
    api.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await render();
    await act(async () => button("Rövanş").click());
    const first = api.rpc.mock.calls[0][1];
    await act(async () => button("İsteği yeniden dene").click());
    expect(api.rpc.mock.calls[1][1]).toEqual(first);
  });
});
