import { useEffect, useState } from "react";
import { Mic, Square, RefreshCw, LoaderCircle } from "lucide-react";
import { downloadAudio } from "./api";
import { useRecorder } from "./useRecorder";
export type Recorder = ReturnType<typeof useRecorder>;
export function Wave({
  level = 0.4,
  playing = false,
}: {
  level?: number;
  playing?: boolean;
}) {
  return (
    <div
      className={`reverse-wave ${playing ? "wave-playing" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: 21 }, (_, i) => (
        <i
          key={i}
          style={{
            height: `${12 + Math.abs(Math.sin(i * 1.3)) * 42}px`,
            transform: `scaleY(${0.15 + level * 0.85})`,
            animationDelay: `${i * 35}ms`,
          }}
        />
      ))}
    </div>
  );
}
export function AudioPreview({ blob, label }: { blob: Blob; label: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return (
    <div className="audio-preview">
      <span>{label}</span>
      {url && (
        <audio
          controls
          src={url}
          preload="metadata"
          controlsList="nodownload"
          aria-label={label}
        />
      )}
    </div>
  );
}
export function RemotePreview({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const [blob, setBlob] = useState<Blob | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setBlob(await downloadAudio(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ses yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }
  return blob ? (
    <AudioPreview blob={blob} label={label} />
  ) : (
    <div className="remote-audio">
      <button
        className="outline-button"
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        {busy ? <LoaderCircle size={15} className="spin" /> : null}
        {label}
      </button>
      {error && (
        <p role="alert" className="small notice error">
          {error}
        </p>
      )}
    </div>
  );
}
export function RecorderWidget({
  recorder,
  disabled,
  onStart,
  retake = false,
}: {
  recorder: Recorder;
  disabled: boolean;
  onStart: () => void;
  retake?: boolean;
}) {
  return (
    <div className="recorder-widget">
      <Wave level={recorder.level} playing={recorder.status === "recording"} />
      <div className="record-duration">
        <span>{recorder.seconds.toFixed(1)} sn</span>
        <span>en fazla 10 sn</span>
      </div>
      <meter
        min={0}
        max={1}
        value={recorder.level}
        aria-label="Canlı mikrofon seviyesi"
      />
      <div className="record-buttons">
        {recorder.status === "recording" ? (
          <button className="primary-button" onClick={recorder.stop}>
            <Square size={17} /> Kaydı durdur
          </button>
        ) : !recorder.blob ? (
          <button
            className="primary-button"
            disabled={disabled || recorder.status === "requesting"}
            onClick={onStart}
          >
            {recorder.status === "requesting" ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Mic size={18} />
            )}{" "}
            {recorder.status === "requesting"
              ? "Mikrofon bekleniyor…"
              : "Kaydı başlat"}
          </button>
        ) : retake ? (
          <button
            className="outline-button"
            disabled={disabled}
            onClick={recorder.reset}
          >
            <RefreshCw size={16} /> Yeniden kaydet
          </button>
        ) : (
          <span className="small muted">
            Taklit kaydın alındı. Şimdi sesini ters çevir.
          </span>
        )}
      </div>
      {recorder.blob && (
        <AudioPreview blob={recorder.blob} label="Bu cihazdaki kaydım" />
      )}
      {recorder.error && (
        <p className="notice error" role="alert">
          {recorder.error}
        </p>
      )}
    </div>
  );
}
