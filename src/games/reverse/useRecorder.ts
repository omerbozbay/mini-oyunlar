import { useEffect, useRef, useState } from "react";
import { audioConstructor, microphoneError, recorderMime } from "./audio";
export function useRecorder() {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "recording" | "recorded" | "error"
  >("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const state = useRef<{
    recorder?: MediaRecorder;
    stream?: MediaStream;
    context?: AudioContext;
    timer?: ReturnType<typeof setInterval>;
    limit?: ReturnType<typeof setTimeout>;
    generation: number;
    discard: boolean;
    active: boolean;
  }>({ generation: 0, discard: false, active: true });
  function cleanup() {
    const s = state.current;
    if (s.timer) clearInterval(s.timer);
    if (s.limit) clearTimeout(s.limit);
    s.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    s.stream = undefined;
    if (s.context) void s.context.close().catch(() => {});
    s.context = undefined;
    if (s.active) setLevel(0);
  }
  function interrupt() {
    const s = state.current;
    s.generation++;
    s.discard = true;
    if (s.recorder?.state === "recording") s.recorder.stop();
    cleanup();
    if (s.active) {
      setBlob(null);
      setStatus("error");
      setError(
        "Kayıt arka plana geçildiği veya mikrofon kesildiği için iptal edildi. Yeniden deneyebilirsin.",
      );
    }
  }
  useEffect(() => {
    state.current.active = true;
    const hidden = () => {
      if (
        document.visibilityState === "hidden" &&
        (state.current.recorder?.state === "recording" ||
          state.current.stream ||
          state.current.context)
      )
        interrupt();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      state.current.active = false;
      state.current.generation++;
      state.current.discard = true;
      if (state.current.recorder?.state === "recording")
        state.current.recorder.stop();
      cleanup();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function start() {
    const s = state.current;
    if (s.context || s.recorder?.state === "recording") return;
    setError("");
    setBlob(null);
    setStatus("requesting");
    s.discard = false;
    // Geç gelen izin/kayıt sonucu, sıfırlanmış veya kapanmış ekranı canlandıramaz.
    const generation = ++s.generation;
    try {
      if (!window.isSecureContext)
        throw Error(
          "Mikrofon için HTTPS veya localhost bağlantısı gerekir. Telefonda güvenli site adresini aç.",
        );
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw Error(
          "Bu tarayıcı ses kaydını desteklemiyor. Güncel Safari veya Chrome ile açmayı deneyebilirsin.",
        );
      const Context = audioConstructor();
      s.context = new Context();
      await s.context.resume();
      if (!s.active || s.discard || generation !== s.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      if (
        !s.active ||
        s.discard ||
        generation !== s.generation ||
        document.visibilityState === "hidden"
      ) {
        stream.getTracks().forEach((t) => t.stop());
        if (generation === s.generation) interrupt();
        return;
      }
      s.stream = stream;
      const mime = recorderMime(MediaRecorder);
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      s.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => interrupt();
      stream.getAudioTracks().forEach((track) => {
        track.onended = interrupt;
      });
      recorder.onstop = () => {
        if (generation !== s.generation) return;
        const result = new Blob(chunks, {
          type: recorder.mimeType || chunks[0]?.type || "audio/webm",
        });
        cleanup();
        if (!s.active || s.discard) return;
        if (!result.size) {
          setStatus("error");
          setError("Ses kaydı boş kaldı. Mikrofonu kontrol edip yeniden dene.");
          return;
        }
        setBlob(result);
        setStatus("recorded");
      };
      const analyser = s.context.createAnalyser();
      analyser.fftSize = 256;
      s.context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const started = performance.now();
      recorder.start();
      setStatus("recording");
      setSeconds(0);
      s.timer = setInterval(() => {
        if (!s.active) return;
        analyser.getFloatTimeDomainData(samples);
        setLevel(
          Math.min(
            1,
            Math.sqrt(
              samples.reduce((sum, v) => sum + v * v, 0) / samples.length,
            ) * 5,
          ),
        );
        setSeconds(Math.min(10, (performance.now() - started) / 1000));
      }, 100);
      s.limit = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 10000);
    } catch (e) {
      if (generation !== s.generation) return;
      cleanup();
      if (s.active) {
        setError(microphoneError(e));
        setStatus("error");
      }
    }
  }
  function stop() {
    if (state.current.recorder?.state === "recording")
      state.current.recorder.stop();
  }
  function reset() {
    state.current.generation++;
    state.current.discard = true;
    if (state.current.recorder?.state === "recording")
      state.current.recorder.stop();
    cleanup();
    setBlob(null);
    setError("");
    setStatus("idle");
    setSeconds(0);
  }
  return { start, stop, reset, status, blob, error, seconds, level };
}
