// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "../src/features/rooms/types";

const mocks = vi.hoisted(() => ({
  fetchRoom: vi.fn(),
  heartbeat: vi.fn(),
  ensureIdentity: vi.fn(),
  removeChannel: vi.fn(),
  callbacks: [] as (() => void)[],
  subscribe: vi.fn(),
  channel: vi.fn(),
}));
vi.mock("../src/features/rooms/api", () => ({
  fetchRoom: mocks.fetchRoom,
  heartbeat: mocks.heartbeat,
}));
vi.mock("../src/lib/supabase", () => ({
  ensureIdentity: mocks.ensureIdentity,
  supabase: {
    realtime: { setAuth: async () => {} },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));
import { useRoom } from "../src/features/rooms/useRoom";

const base = Date.parse("2026-11-06T12:00:00Z");
let root: Root;
let node: HTMLDivElement;
let current: ReturnType<typeof useRoom>;
let ownerSeen: number;
let guestSeen: number;
let guestReady: boolean;
function Probe() {
  current = useRoom("AF1234");
  return null;
}
function snapshot(): RoomSnapshot {
  return {
    server_time: new Date(base + performance.now()).toISOString(),
    room: {
      id: "room",
      code: "AF1234",
      host_id: "owner",
      selected_game: "chain",
      revision: 0,
      status: "lobby",
    },
    players: [
      ["owner", ownerSeen, true],
      ["guest", guestSeen, guestReady],
    ].map(([id, seen, ready]) => ({
      room_id: "room",
      user_id: String(id),
      name: String(id),
      active: true,
      ready: Boolean(ready),
      joined_at: new Date(base).toISOString(),
      last_seen: new Date(base + Number(seen)).toISOString(),
    })),
  };
}
async function mount() {
  await act(async () => {
    root.render(<Probe />);
  });
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({
    toFake: [
      "Date",
      "performance",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
    ],
  });
  // Telefonun tarihi sunucudan yıllarca farklı olsa bile durum doğru hesaplanır.
  vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
  ownerSeen = 0;
  guestSeen = 0;
  guestReady = true;
  mocks.callbacks = [];
  mocks.ensureIdentity.mockResolvedValue("owner");
  mocks.fetchRoom.mockImplementation(async () => snapshot());
  mocks.heartbeat.mockImplementation(async () => {
    ownerSeen = performance.now();
  });
  mocks.removeChannel.mockResolvedValue(undefined);
  mocks.channel.mockImplementation(() => {
    const channel = {
      on: vi.fn((_kind: unknown, _filter: unknown, callback: () => void) => {
        mocks.callbacks.push(callback);
        return channel;
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        void Promise.resolve().then(() => callback("SUBSCRIBED"));
        return channel;
      }),
    };
    return channel;
  });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("lobi bağlantı yaşam döngüsü", () => {
  it("yerel saat yanlış olsa da sekmesi kapanan oyuncu 70 saniyede çevrimdışı ve hazır değil olur", async () => {
    await mount();
    expect(current.players.every((p) => p.online && p.ready)).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(69000);
    });
    expect(current.players[1].online).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(current.players[1]).toMatchObject({
      online: false,
      ready: false,
      active: true,
    });
    expect(current.players[0].online).toBe(true);
    expect(current.players).toHaveLength(2);
  });
  it("tüm ağ istekleri başarısız olsa bile zaman aşımı göstergesini yeniler", async () => {
    await mount();
    mocks.fetchRoom.mockRejectedValue(new TypeError("Failed to fetch"));
    mocks.heartbeat.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(71000);
    });
    expect(current.players.every((p) => !p.online && !p.ready)).toBe(true);
    expect(current.players).toHaveLength(2);
  });
  it("Realtime ile yenilenen heartbeat oyuncuyu geri getirir; eski hazır rozetini getirmez", async () => {
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(71000);
    });
    guestSeen = performance.now();
    guestReady = false;
    await act(async () => {
      mocks.callbacks[1]();
    });
    expect(current.players[1]).toMatchObject({
      online: true,
      ready: false,
      active: true,
    });
  });
  it("sayfa kapanışında timerları ve aboneliği kaldırır, üyeliğe yazma isteği göndermez", async () => {
    await mount();
    const beats = mocks.heartbeat.mock.calls.length;
    await act(async () => root.unmount());
    expect(mocks.removeChannel).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100000);
    });
    expect(mocks.heartbeat).toHaveBeenCalledTimes(beats);
    // Bu hook leave_room çağrısına sahip değildir; ayrılma yalnız açık kullanıcı eylemidir.
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(node);
  });
  it("online olayı heartbeat’i beklemeden yeniden gönderir", async () => {
    await mount();
    const beats = mocks.heartbeat.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(mocks.heartbeat).toHaveBeenCalledTimes(beats + 1);
  });
});
