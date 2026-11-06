import { rpc } from "../../features/rooms/api";
import type { AuctionSession } from "./types";
export const selectTheme = (roomId: string, theme: string) =>
  rpc("select_auction_theme", { p_room_id: roomId, p_theme: theme });
export const startAuction = (roomId: string) =>
  rpc("start_game", { p_room_id: roomId });
export interface AuctionCommand {
  p_session_id: string;
  p_version: number;
  p_request_id: string;
  p_action: string;
  p_amount: number | null;
  p_choice: string | null;
}
function requestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Telefonda HTTP yerel ağ önizlemesinde randomUUID bulunmayabilir.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function command(
  session: AuctionSession,
  action: string,
  amount: number | null = null,
  choice: string | null = null,
): AuctionCommand {
  return {
    p_session_id: session.id,
    p_version: session.version,
    p_request_id: requestId(),
    p_action: action,
    p_amount: amount,
    p_choice: choice,
  };
}
export const sendCommand = (action: AuctionCommand) =>
  rpc("auction_action", { ...action });
