import type { GameId } from "../../games/types";

export interface Room {
  id: string;
  code: string;
  host_id: string;
  selected_game: GameId;
  status: "lobby" | "closed";
  revision: number;
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
}
