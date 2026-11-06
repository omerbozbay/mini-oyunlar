import { reverseWav } from "./pcm";
import type { AudioMeta } from "./types";
export interface ReversedAudio extends AudioMeta {
  blob: Blob;
}
export function audioConstructor() {
  const ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!ctor) throw Error("Bu tarayıcı Web Audio ses işlemeyi desteklemiyor.");
  return ctor;
}
export function recorderMime(ctor: typeof MediaRecorder): string | undefined {
  return [
    "audio/webm;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ].find((type) => ctor.isTypeSupported?.(type));
}
export function microphoneError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Mikrofon izni verilmedi. Tarayıcının site izinlerinden mikrofonu açıp yeniden deneyebilirsin.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "Mikrofon bulunamadı. Bir mikrofon bağlayıp yeniden dene.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "Mikrofon başka bir uygulamada kullanılıyor olabilir. Diğer uygulamayı kapatıp yeniden dene.";
  return error instanceof Error
    ? error.message
    : "Ses kaydı başlatılamadı. Yeniden deneyebilirsin.";
}
export async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  if (!blob.size || blob.size > 12_000_000)
    throw Error("Ses dosyası boş veya çok büyük. Yeniden kaydet.");
  const Context = audioConstructor();
  const context = new Context();
  try {
    return await context.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw Error(
      "Ses çözümlenemedi. Kayıt kesilmiş veya biçimi desteklenmiyor olabilir. Yeniden kaydet.",
    );
  } finally {
    await context.close().catch(() => {});
  }
}
export async function reverseAudio(blob: Blob): Promise<ReversedAudio> {
  const decoded = await decodeAudio(blob);
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
    decoded.getChannelData(i).slice(),
  );
  let result: {
    wav: ArrayBuffer;
    frames: number;
    sample_rate: number;
    channels: number;
  };
  if (typeof Worker === "undefined") {
    await new Promise((resolve) => setTimeout(resolve, 0));
    result = reverseWav(channels, decoded.sampleRate);
  } else
    result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./audio.worker.ts", import.meta.url), {
        type: "module",
      });
      const timer = setTimeout(() => {
        worker.terminate();
        reject(Error("Ses işleme tamamlanamadı. Yeniden deneyebilirsin."));
      }, 20000);
      worker.onmessage = (event) => {
        clearTimeout(timer);
        worker.terminate();
        event.data.ok ? resolve(event.data) : reject(Error(event.data.error));
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        reject(
          Error(
            "Ses işleme başlatılamadı. Tarayıcıyı güncelleyip yeniden deneyebilirsin.",
          ),
        );
      };
      worker.postMessage(
        { channels, sampleRate: decoded.sampleRate },
        channels.map((c) => c.buffer),
      );
    });
  return {
    blob: new Blob([result.wav], { type: "audio/wav" }),
    frames: result.frames,
    sample_rate: result.sample_rate,
    channels: result.channels,
  };
}
