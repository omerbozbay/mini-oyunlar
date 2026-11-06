import type { GameId } from "../../games/types";
import type { AuctionSession } from "../../games/auction/types";
import type { PuzzleSession } from "../../games/puzzles/types";
import type { ReverseSession } from "../../games/reverse/types";

export interface Room {
  id: string;
  code: string;
  host_id: string;
  selected_game: GameId;
  status: "lobby" | "closed";
  revision: number;
  auction_theme?: string;
  current_game_id?: string | null;
  word_length?: 5 | 6;
}

export interface Player {
  room_id: string;
  user_id: string;
  name: string;
  ready: boolean;
  active: boolean;
  joined_at: string;
  last_seen: string;
}

export interface RoomSnapshot {
  room: Room;
  players: Player[];
  server_time: string;
  game?: AuctionSession | PuzzleSession | ReverseSession | null;
}
