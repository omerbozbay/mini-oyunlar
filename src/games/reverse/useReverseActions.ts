import { useRef, useState } from "react";
import { errorMessage } from "../../lib/validation";
import { reverseCommand, sendReverseCommand, type ReverseCommand } from "./api";
import type { ReverseSession } from "./types";
export function useReverseActions(
  session: ReverseSession,
  reload: () => Promise<void>,
) {
  const current = useRef(session);
  current.current = session;
  const running = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<ReverseCommand | null>(null);
  async function execute(cmd: ReverseCommand) {
    if (running.current) return null;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await sendReverseCommand(cmd);
      setPending(null);
      await reload();
      return result;
    } catch (e) {
      setError(errorMessage(e));
      setPending(
        e && typeof e === "object" && "code" in e && e.code === "P0001"
          ? null
          : cmd,
      );
      await reload();
      return null;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    pending,
    run: (action: string, payload: unknown = {}) =>
      execute(reverseCommand(current.current, action, payload)),
    retry: () => (pending ? execute(pending) : null),
    clear: () => {
      setPending(null);
      void reload();
    },
  };
}
