import { describe, expect, it } from "vitest";
import { playerPresence, serverClock } from "../src/features/rooms/presence";
import type { Player } from "../src/features/rooms/types";

const time = Date.parse("2026-11-06T12:00:00Z");
const player: Player = {
  room_id: "room",
  user_id: "user",
  name: "İpek",
  ready: true,
  active: true,
  joined_at: new Date(time).toISOString(),
  last_seen: new Date(time).toISOString(),
};

describe("heartbeat lease", () => {
  it("son kalp atışından 70 saniye sonra çevrimdışı ve hazır değil sayar", () => {
    expect(playerPresence(player, time + 69999)).toMatchObject({
      online: true,
      ready: true,
    });
    expect(playerPresence(player, time + 70000)).toMatchObject({
      online: false,
      ready: false,
      active: true,
    });
  });
  it("bilinmeyen zaman, bozuk tarih ve ayrılmış üyeyi çevrimiçi saymaz", () => {
    expect(playerPresence(player, NaN).online).toBe(false);
    expect(
      playerPresence({ ...player, last_seen: "invalid" }, time).online,
    ).toBe(false);
    expect(playerPresence({ ...player, active: false }, time).online).toBe(
      false,
    );
  });
  it("yerel tarih/saat yerine sunucuya bağlı monoton süreyi kullanır", () => {
    const clock = serverClock(new Date(time).toISOString(), 1000);
    expect(clock(71000)).toBe(time + 70000);
    expect(playerPresence(player, clock(71000)).online).toBe(false);
    // İstemcinin Date.now değeri hesaplamanın hiçbir aşamasında kullanılmaz.
    expect(clock(500)).toBe(time);
  });
});
