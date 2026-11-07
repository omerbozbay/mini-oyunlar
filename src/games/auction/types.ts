export interface AuctionProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  image_cell?: number;
  kind: string;
}
export interface WonProduct extends AuctionProduct {
  price: number;
  automatic: boolean;
  paid_by?: string | null;
  gifted_by?: string | null;
  free?: boolean;
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
  passes?: string[];
  arrange_ready?: string[];
  skipped?: AuctionProduct[];
  last_skipped?: AuctionProduct | null;
  last_gift?: { from: string; to: string; product: WonProduct };
  last_award?: { player_id: string; product: WonProduct };
}
export interface AuctionSession {
  id: string;
  room_id: string;
  game: "auction";
  theme: string;
  phase: "bidding" | "arranging" | "voting" | "finished" | "abandoned";
  version: number;
  state: AuctionState;
}
