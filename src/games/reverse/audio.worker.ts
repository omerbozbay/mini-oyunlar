import { reverseWav } from "./pcm";
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = (event) => {
  try {
    const result = reverseWav(event.data.channels, event.data.sampleRate);
    scope.postMessage({ ok: true, ...result }, [result.wav]);
  } catch (error) {
    scope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Ses işlenemedi.",
    });
  }
};
