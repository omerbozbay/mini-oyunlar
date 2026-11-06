import type { AuctionPlayer } from "./types";
// Yalnız arayüz ipucudur; aynı kural PostgreSQL tarafından yeniden doğrulanır.
export function maxBid(player: AuctionPlayer): number {
  return player.items.length >= 5
    ? 0
    : player.budget - (4 - player.items.length);
}
