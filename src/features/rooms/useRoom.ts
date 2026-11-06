import { useCallback, useEffect, useRef, useState } from "react";
import { ensureIdentity, supabase } from "../../lib/supabase";
import { errorMessage } from "../../lib/validation";
import { fetchRoom, heartbeat } from "./api";
import type { RoomSnapshot } from "./types";
import { HEARTBEAT_INTERVAL_MS, playerPresence, serverClock } from "./presence";

export function useRoom(code: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverNow, setServerNow] = useState(Number.NaN);
  const clockRef = useRef<((time: number) => number) | null>(null);
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
    let refreshAgain = false;
    let subscribedRoomId = "";
    const reload = async () => {
      if (!active) return;
      if (busy) {
        // Sorgu sürerken gelen teklif/Realtime olayını kaybetme. Sonrasında
        // tek bir güncel görüntü daha al; eski fiyat ekranda takılı kalmasın.
        refreshAgain = true;
        return;
      }
      busy = true;
      try {
        const next = await fetchRoom(code);
        if (next) subscribedRoomId = next.room.id;
        if (active) {
          clockRef.current = next
            ? serverClock(next.server_time, performance.now())
            : null;
          setServerNow(clockRef.current?.(performance.now()) ?? Number.NaN);
          setSnapshot(next);
          setError("");
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        busy = false;
        if (active) setLoading(false);
        if (active && refreshAgain) {
          refreshAgain = false;
          void reload();
        }
      }
    };
    reloadRef.current = reload;
    setLoading(true);
    setSnapshot(null);
    clockRef.current = null;
    setServerNow(Number.NaN);
    setError("");
    setConnection("connecting");
    void (async () => {
      try {
        const id = await ensureIdentity();
        if (!active || !supabase) return;
        // Anonim girişten hemen sonra kanal açılırken JWT'nin Realtime'a
        // aktarılmasını bekle; aksi halde ilk abonelik yetkisiz kalabilir.
        await supabase.realtime.setAuth();
        if (!active) return;
        setUserId(id);
        await reload();
        if (!active) return;
        // Üyelik RLS ile denetlenir; kanal adı veya kod yetki sağlamaz.
        channel = supabase
          // Kanalın açılmasını değil PostgreSQL aboneliğinin hazır olmasını bekle.
          .channel(`room:${code}:${id}`, {
            config: {
              postgres_changes_options: { wait: true, timeout: 15000 },
            },
          })
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
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "game_sessions",
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
      if (document.visibilityState === "visible") {
        setServerNow(clockRef.current?.(performance.now()) ?? Number.NaN);
        void reload();
      }
    };
    // Veri/Realtime olayı gelmese ve ağ kesilse de lease süresi ekranda dolar.
    const clockTimer = setInterval(() => {
      if (active)
        setServerNow(clockRef.current?.(performance.now()) ?? Number.NaN);
    }, 1000);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(clockTimer);
      if (poll) clearInterval(poll);
      if (channel) void supabase?.removeChannel(channel);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code]);

  const roomId = snapshot?.room.id;
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    let busy = false;
    const beat = () => {
      if (busy || !active) return;
      busy = true;
      void heartbeat(roomId)
        .then(() => {
          if (active) void reloadRef.current();
        })
        .catch(() => {
          if (active) setConnection("retrying");
        })
        .finally(() => {
          busy = false;
        });
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const visible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", beat);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", beat);
    };
  }, [roomId]);

  const reload = useCallback(() => reloadRef.current(), []);
  const players =
    snapshot?.players.map((player) => playerPresence(player, serverNow)) ?? [];
  return { snapshot, players, userId, loading, error, connection, reload };
}
