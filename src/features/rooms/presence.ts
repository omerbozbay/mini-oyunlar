import type { Player } from "./types";

export const HEARTBEAT_INTERVAL_MS = 25_000;
// SQL migration'daki 70 saniyelik lease ile aynı tutulmalıdır.
export const ONLINE_TIMEOUT_MS = 70_000;

export function playerPresence(player: Player, serverNow: number) {
  const lastSeen = Date.parse(player.last_seen);
  const online =
    player.active &&
    Number.isFinite(serverNow) &&
    Number.isFinite(lastSeen) &&
    lastSeen > serverNow - ONLINE_TIMEOUT_MS;
  return { ...player, online, ready: online && player.ready };
}

// Telefonun duvar saati yanlış olsa bile süre performance.now ile ilerler.
export function serverClock(serverTime: string, sampledAt: number) {
  const serverMs = Date.parse(serverTime);
  return (monotonicNow: number) =>
    serverMs + Math.max(0, monotonicNow - sampledAt);
}
