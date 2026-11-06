import { useCallback, useEffect, useRef, useState } from "react";
import { ensureIdentity, supabase } from "../../lib/supabase";
import { errorMessage } from "../../lib/validation";
import { fetchRoom, heartbeat } from "./api";
import type { RoomSnapshot } from "./types";

export function useRoom(code: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<
    "connecting" | "live" | "retrying"
  >("connecting");
  const reloadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    let channel:
      | ReturnType<NonNullable<typeof supabase>["channel"]>
      | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let busy = false;
    let subscribedRoomId = "";
    const reload = async () => {
      if (busy || !active) return;
      busy = true;
      try {
        const next = await fetchRoom(code);
        if (next) subscribedRoomId = next.room.id;
        if (active) {
          setSnapshot(next);
          setError("");
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    };
    reloadRef.current = reload;
    setLoading(true);
    setSnapshot(null);
    setError("");
    setConnection("connecting");
    void (async () => {
      try {
        const id = await ensureIdentity();
        if (!active || !supabase) return;
        setUserId(id);
        await reload();
        if (!active) return;
        // Üyelik RLS ile denetlenir; kanal adı veya kod yetki sağlamaz.
        channel = supabase
          .channel(`room:${code}:${id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "rooms",
              filter: `code=eq.${code}`,
            },
            () => {
              void reload();
            },
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "room_players",
              filter: `room_id=eq.${subscribedRoomId || "00000000-0000-0000-0000-000000000000"}`,
            },
            () => {
              void reload();
            },
          )
          .subscribe((status) => {
            if (!active) return;
            setConnection(
              status === "SUBSCRIBED"
                ? "live"
                : status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                  ? "retrying"
                  : "connecting",
            );
            if (status === "SUBSCRIBED") void reload();
          });
        // Realtime kesintisinde durum sorgulaması ve çevrimiçi zaman aşımı devam eder.
        poll = setInterval(() => {
          void reload();
        }, 15000);
      } catch (e) {
        if (active) {
          setError(errorMessage(e));
          setLoading(false);
        }
      }
    })();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      if (poll) clearInterval(poll);
      if (channel) void supabase?.removeChannel(channel);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code]);

  const roomId = snapshot?.room.id;
  useEffect(() => {
    if (!roomId) return;
    const beat = () => {
      void heartbeat(roomId).catch(() => setConnection("retrying"));
    };
    beat();
    const timer = setInterval(beat, 25000);
    const visible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [roomId]);

  const reload = useCallback(() => reloadRef.current(), []);
  return { snapshot, userId, loading, error, connection, reload };
}
