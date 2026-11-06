import { ensureIdentity, supabase } from "../../lib/supabase";
import { playerName, roomCode } from "../../lib/validation";
import type { RoomSnapshot } from "./types";
import type { GameId } from "../../games/types";

export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) throw new Error("Önce Supabase bağlantısını yapılandır.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function enterRoom(name: string, code?: string): Promise<string> {
  const cleanName = playerName(name);
  const cleanCode = code === undefined ? undefined : roomCode(code);
  await ensureIdentity();
  return cleanCode === undefined
    ? rpc<string>("create_room", { p_name: cleanName })
    : rpc<string>("join_room", { p_name: cleanName, p_code: cleanCode });
}

export async function currentRoom(): Promise<string | null> {
  await ensureIdentity();
  return rpc<string | null>("current_room");
}

export async function fetchRoom(code: string): Promise<RoomSnapshot | null> {
  return rpc<RoomSnapshot | null>("get_room_snapshot", { p_code: code });
}

export const setReady = (roomId: string, ready: boolean) =>
  rpc("set_ready", { p_room_id: roomId, p_ready: ready });
export const selectGame = (roomId: string, game: GameId) =>
  rpc("select_game", { p_room_id: roomId, p_game: game });
export const leaveRoom = (roomId: string) =>
  rpc("leave_room", { p_room_id: roomId });
export const heartbeat = (roomId: string) =>
  rpc("heartbeat", { p_room_id: roomId });
