export interface AuctionProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  kind: string;
}
export interface WonProduct extends AuctionProduct {
  price: number;
  automatic: boolean;
}
export interface AuctionPlayer {
  id: string;
  name: string;
  budget: number;
  items: WonProduct[];
}
export interface AuctionState {
  players: [AuctionPlayer, AuctionPlayer];
  products: AuctionProduct[];
  index: number;
  starter: number;
  turn_id: string | null;
  current_bid: number;
  bidder_id: string | null;
  votes_cast: string[];
  winner_id: string | null;
  rematch_ready: string[];
  votes?: Record<string, string | null>;
  automatic_count?: number;
  last_award?: { player_id: string; product: WonProduct };
}
export interface AuctionSession {
  id: string;
  room_id: string;
  game: "auction";
  theme: string;
  phase: "bidding" | "voting" | "finished" | "abandoned";
  version: number;
  state: AuctionState;
}
