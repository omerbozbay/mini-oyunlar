import type { AuctionPlayer } from "./types";
// Yalnız arayüz ipucudur; aynı kural PostgreSQL tarafından yeniden doğrulanır.
export function maxBid(player: AuctionPlayer): number {
  return Math.max(0, player.budget);
}
