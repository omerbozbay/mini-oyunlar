import { useState } from "react";
import { rpc } from "../../features/rooms/api";
import { errorMessage } from "../../lib/validation";
import type { PuzzleSession } from "./types";
import { requestId } from "../../lib/requestId";
interface PuzzleCommand {
  p_session_id: string;
  p_version: number;
  p_revision: number;
  p_request_id: string;
  p_action: string;
  p_payload: unknown;
}
export function usePuzzleActions(
  session: PuzzleSession,
  userId: string,
  reload: () => Promise<void>,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PuzzleCommand | null>(null);
  async function execute(cmd: PuzzleCommand) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await rpc("puzzle_action", { ...cmd });
      setPending(null);
      await reload();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      setPending(
        e && typeof e === "object" && "code" in e && e.code === "P0001"
          ? null
          : cmd,
      );
      await reload();
      return false;
    } finally {
      setBusy(false);
    }
  }
  const run = (action: string, payload: unknown = null) =>
    execute({
      p_session_id: session.id,
      p_version: session.version,
      p_revision: session.state.players.find((p) => p.id === userId)!.revision,
      p_request_id: requestId(),
      p_action: action,
      p_payload: payload,
    });
  return {
    run,
    busy,
    error,
    pending,
    retry: () => pending && execute(pending),
    clearPending: () => {
      setPending(null);
      void reload();
    },
  };
}
