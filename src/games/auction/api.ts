import { rpc } from "../../features/rooms/api";
import type { AuctionSession } from "./types";
import { requestId } from "../../lib/requestId";
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
