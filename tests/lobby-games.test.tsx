import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi } from "vitest";
import type { RoomSnapshot } from "../src/features/rooms/types";
import type {
  PuzzleSession,
  PuzzleId,
  PuzzlePlayer,
} from "../src/games/puzzles/types";
import type { AuctionSession } from "../src/games/auction/types";
import themes from "../src/games/auction/themes.json";
const state = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../src/features/rooms/useRoom", () => ({
  useRoom: () => state.value,
}));
import App from "../src/App";
const player = (id: string): PuzzlePlayer => ({
  id,
  name: id,
  prepared: false,
  revision: 0,
  progress: 1,
  history: [],
  done: false,
  solved: false,
  guess_count: 0,
});
function page(game: RoomSnapshot["game"], selected = "chain", host = "a") {
  const room = {
    id: "r",
    code: "AF1234",
    host_id: host,
    selected_game: selected,
    status: "lobby",
    revision: 0,
    word_length: 6,
  };
  const players = ["a", "b"].map((id) => ({
    room_id: "r",
    user_id: id,
    name: id,
    ready: true,
    active: true,
    online: true,
    joined_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  }));
  state.value = {
    snapshot: { room, players, server_time: new Date().toISOString(), game },
    players,
    userId: "a",
    loading: false,
    error: "",
    connection: "live",
    reload: async () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/oda/AF1234"]}>
      <App />
    </MemoryRouter>,
  );
}
it.each(["chain", "detective", "wordhunt"] as PuzzleId[])(
  "lobi %s hazırlığını doğru oyun bileşenine yönlendirir",
  (id) => {
    const game: PuzzleSession = {
      id: "s",
      room_id: "r",
      game: id,
      phase: "preparing",
      theme: null,
      version: 0,
      state: {
        players: [player("a"), player("b")],
        word_length: 6,
        starter: 0,
        turn_id: "a",
        round: 1,
        winner_id: null,
        rematch_ready: [],
      },
    };
    const html = page(game, id);
    expect(html).toContain(
      id === "chain"
        ? "Zincirimi Hazırladım"
        : id === "detective"
          ? "Sayımı Kilitle"
          : "Kelimemi Kilitle",
    );
    expect(html).toContain("Oyun oturumu açık");
  },
);
it("mevcut Açık Artırma lobi üzerinden aynı arayüzü açar", () => {
  const game: AuctionSession = {
    id: "s",
    room_id: "r",
    game: "auction",
    theme: "pizza",
    phase: "bidding",
    version: 0,
    state: {
      players: [
        { id: "a", name: "a", budget: 20, items: [] },
        { id: "b", name: "b", budget: 20, items: [] },
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
  expect(page(game, "auction")).toContain("Teklif ver");
});
it("Kelime Avı lobisi seçili altı harfi ve dört hazır oyunu gösterir", () => {
  const html = page(null, "wordhunt");
  expect(html).toContain("Kaç harfle oynayalım");
  expect(html).toContain('aria-pressed="true"');
  expect(html).not.toContain(">Yakında<");
  expect(html).toContain("Oyunu başlat");
});
