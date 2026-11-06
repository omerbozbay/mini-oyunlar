// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReverseBoard } from "../src/games/reverse/ReverseBoard";
import type { ReverseSession } from "../src/games/reverse/types";
const api = vi.hoisted(() => ({ run: vi.fn(), context: vi.fn() }));
vi.mock("../src/games/reverse/api", () => ({ getReverseContext: api.context }));
vi.mock("../src/games/reverse/useReverseActions", () => ({
  useReverseActions: () => ({
    run: api.run,
    busy: false,
    pending: null,
    error: "",
    retry: vi.fn(),
    clear: vi.fn(),
  }),
}));
let root: Root, node: HTMLDivElement, g: ReverseSession;
const players = ["a", "b"].map((id) => ({
  user_id: id,
  room_id: "r",
  name: id,
  active: true,
  ready: false,
  online: true,
  last_seen: "",
  joined_at: "",
}));
async function render(userId = "a", online = true) {
  await act(async () =>
    root.render(
      <ReverseBoard
        session={g}
        userId={userId}
        players={players.map((p, i) => ({ ...p, online: i === 0 || online }))}
        reload={async () => {}}
      />,
    ),
  );
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  api.context.mockResolvedValue({
    my_word: "Gizli kelime",
    listen_status: "unused",
  });
  api.run.mockResolvedValue({});
  g = {
    id: "s",
    room_id: "r",
    game: "reverse",
    theme: null,
    phase: "playing",
    version: 0,
    state: {
      players: [
        { id: "a", name: "İpek", score: 0 },
        { id: "b", name: "Çağrı", score: 0 },
      ],
      starter: 0,
      current: {
        number: 1,
        narrator_id: "a",
        guesser_id: "b",
        phase: "preparing",
        category: null,
        listen_status: "unused",
        mimic_status: "unused",
        ready: [],
        guess: null,
      },
      rounds: [],
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
it("anlatıcıya on kategori sunar; tahminciye hazırlık ve gizli kelimeyi açmaz", async () => {
  await render();
  expect(node.querySelectorAll("option")).toHaveLength(10);
  expect(node.querySelector("#reverse-word")).not.toBeNull();
  await render("b");
  expect(node.querySelector("#reverse-word")).toBeNull();
  expect(node.textContent).not.toContain("Gizli kelime");
});
it("yalnız anlatıcı puanlama görür; çevrimdışıyken karar veremez", async () => {
  g.state.current.phase = "judging";
  g.state.current.guess = "Tarkan";
  await render("a", false);
  expect(node.textContent).toContain("Oyun duraklatıldı");
  const correct = Array.from(node.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("+1 puan"),
  )!;
  expect(correct.disabled).toBe(true);
  await render("b");
  expect(
    Array.from(node.querySelectorAll("button")).some((b) =>
      b.textContent?.includes("+1 puan"),
    ),
  ).toBe(false);
});
it("tahmin aşamasında yalnız tahminci giriş yapabilir", async () => {
  g.state.current.phase = "guessing";
  await render("a");
  expect(node.querySelector("#reverse-guess")).toBeNull();
  await render("b");
  expect(node.querySelector("#reverse-guess")).not.toBeNull();
  expect(node.textContent).toContain("Tek tahminin");
});
it("eşit sonuçta beraberlik ve rövanş/lobi seçeneklerini gösterir", async () => {
  g.phase = "finished";
  g.state.current.number = 6;
  await render();
  expect(node.textContent).toContain("Berabere kaldınız!");
  expect(node.textContent).toContain("Rövanş");
  expect(node.textContent).toContain("Lobiye dön");
});
