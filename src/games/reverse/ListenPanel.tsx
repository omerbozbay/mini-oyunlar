import { useEffect, useRef, useState } from "react";
import { Headphones, LoaderCircle, Check } from "lucide-react";
import { audioConstructor, decodeAudio } from "./audio";
import { downloadAudio } from "./api";
import { Wave } from "./AudioWidgets";
import type { ListenTicket, ReverseContext } from "./types";
export type ReverseRun = (
  action: string,
  payload?: unknown,
) => Promise<Record<string, unknown> | null>;
export function ListenPanel({
  context,
  disabled,
  run,
}: {
  context: ReverseContext | null;
  disabled: boolean;
  run: ReverseRun;
}) {
  const [ready, setReady] = useState<{
      ticket: ListenTicket;
      buffer: AudioBuffer;
    } | null>(null),
    [loading, setLoading] = useState(false),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState("");
  const live = useRef<{
    context?: AudioContext;
    source?: AudioBufferSourceNode;
    active: boolean;
    token?: string;
  }>({ active: true });
  useEffect(() => {
    live.current.active = true;
    const hidden = () => {
      if (document.visibilityState === "hidden" && live.current.source) {
        const s = live.current;
        s.source!.onended = null;
        s.source!.stop();
        s.source = undefined;
        void s.context?.close().catch(() => {});
        setPlaying(false);
        setError(
          "Oynatma arka plana geçildiği için kesildi. Anlatıcıdan yeni dinleme izni isteyebilirsin.",
        );
        void run("listen_failed", { token: s.token });
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      const s = live.current;
      s.active = false;
      if (s.source) {
        s.source.onended = null;
        s.source.stop();
      }
      void s.context?.close().catch(() => {});
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function prepare() {
    if (disabled || loading) return;
    setLoading(true);
    setError("");
    let lease: ListenTicket | null = null;
    try {
      const result = await run("reserve_listen");
      if (!result) return;
      lease = result as unknown as ListenTicket;
      const blob = await downloadAudio(lease.audio.path);
      const buffer = await decodeAudio(blob);
      if (
        buffer.duration > 10.1 ||
        Math.abs(
          buffer.duration - lease.audio.frames / lease.audio.sample_rate,
        ) > 0.15
      )
        throw Error("Ses dosyası beklenen süreyle eşleşmiyor.");
      if (live.current.active) setReady({ ticket: lease, buffer });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ses hazırlanamadı.");
      if (lease) await run("cancel_listen", { token: lease.token });
    } finally {
      if (live.current.active) setLoading(false);
    }
  }
  async function play() {
    if (!ready || disabled || playing) return;
    setError("");
    let started = false;
    const ticket = ready.ticket;
    try {
      const Context = audioConstructor();
      const audio = new Context();
      live.current.context = audio;
      await audio.resume();
      if (!(await run("start_listen", { token: ticket.token }))) {
        await audio.close();
        return;
      }
      started = true;
      if (!live.current.active || document.visibilityState === "hidden")
        throw Error("Oynatma kesildi; yeniden dinleme izni isteyebilirsin.");
      const source = audio.createBufferSource();
      source.buffer = ready.buffer;
      source.connect(audio.destination);
      live.current.source = source;
      live.current.token = ticket.token;
      source.onended = () => {
        live.current.source = undefined;
        void audio.close().catch(() => {});
        if (live.current.active) {
          setPlaying(false);
          setReady(null);
          void run("finish_listen", { token: ticket.token });
        }
      };
      source.start();
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ses oynatılamadı.");
      if (live.current.source) {
        live.current.source.onended = null;
        try {
          live.current.source.stop();
        } catch {
          /* Başlamamış kaynak durdurulamaz. */
        }
        live.current.source = undefined;
      }
      void live.current.context?.close().catch(() => {});
      await run(started ? "listen_failed" : "cancel_listen", {
        token: ticket.token,
      });
      setReady(null);
      setPlaying(false);
    }
  }
  const status = context?.listen_status ?? "unused";
  return (
    <div className="listen-panel">
      <Wave playing={playing} />
      <p>
        Bu ters kaydı bir kez dinleyebilirsin. Kulaklığını hazırla; sonra
        duyduğunu taklit edeceksin.
      </p>
      {playing ? (
        <p className="listen-playing" role="status">
          <Headphones size={18} /> Ses oynatılıyor…
        </p>
      ) : status === "failed" ? (
        <p className="notice setup">
          Hata bildirildi. Anlatıcının yeniden dinleme izni vermesi bekleniyor.
        </p>
      ) : status === "started" ? (
        <div className="listen-recovery">
          <p>Dinleme başladı olarak kaydedilmiş. Yenileme yeni hak açmaz.</p>
          <button
            className="primary-button"
            disabled={disabled}
            onClick={() => {
              void run("finish_listen", { token: context?.listen_token });
            }}
          >
            <Check size={16} /> Dinlemeyi tamamladım
          </button>
          <button
            className="outline-button"
            disabled={disabled}
            onClick={() => {
              void run("listen_failed", { token: context?.listen_token });
            }}
          >
            Ses oynatılamadı / kesildi
          </button>
        </div>
      ) : ready ? (
        <button
          className="primary-button"
          disabled={disabled}
          onClick={() => {
            void play();
          }}
        >
          <Headphones size={18} /> Tersten Sesi Dinle
        </button>
      ) : (
        <button
          className="primary-button"
          disabled={disabled || loading}
          onClick={() => {
            void prepare();
          }}
        >
          {loading ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Headphones size={18} />
          )}{" "}
          {loading ? "Ses hazırlanıyor…" : "Dinleme için sesi hazırla"}
        </button>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
