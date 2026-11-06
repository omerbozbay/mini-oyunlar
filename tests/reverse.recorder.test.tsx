// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRecorder } from "../src/games/reverse/useRecorder";
let root: Root;
let node: HTMLDivElement;
let recorder: ReturnType<typeof useRecorder>;
let getUserMedia: ReturnType<typeof vi.fn>;
let stopTrack: ReturnType<typeof vi.fn>;
let last: FakeRecorder;
class FakeRecorder {
  static isTypeSupported(type: string) {
    return type === "audio/mp4";
  }
  state = "inactive";
  mimeType = "audio/mp4";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    last = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["sound"]) });
    this.onstop?.();
  }
}
function Harness() {
  recorder = useRecorder();
  return <span>{recorder.status}</span>;
}
beforeEach(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  vi.stubGlobal("isSecureContext", true);
  stopTrack = vi.fn();
  const track = { stop: stopTrack, onended: null };
  getUserMedia = vi
    .fn()
    .mockResolvedValue({
      getTracks: () => [track],
      getAudioTracks: () => [track],
    });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createAnalyser() {
        return {
          fftSize: 256,
          getFloatTimeDomainData: (a: Float32Array) => a.fill(0.1),
        };
      }
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
    },
  );
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("izin alır, kayıt başlatır/durdurur ve mikrofonu serbest bırakır", async () => {
  await act(async () => recorder.start());
  expect(recorder.status).toBe("recording");
  expect(getUserMedia).toHaveBeenCalledOnce();
  expect(last.mimeType).toBe("audio/mp4");
  await act(async () => recorder.stop());
  expect(recorder.status).toBe("recorded");
  expect(recorder.blob?.size).toBeGreaterThan(0);
  expect(stopTrack).toHaveBeenCalledOnce();
});
it("10 saniyede otomatik durur", async () => {
  await act(async () => recorder.start());
  await act(async () => vi.advanceTimersByTime(10000));
  expect(last.state).toBe("inactive");
  expect(recorder.status).toBe("recorded");
});
it("izin reddedildiğinde kayıt başlatmadan Türkçe hata verir", async () => {
  getUserMedia.mockRejectedValue({ name: "NotAllowedError" });
  await act(async () => recorder.start());
  expect(recorder.status).toBe("error");
  expect(recorder.error).toContain("Mikrofon izni verilmedi");
});
it("mikrofon yokken ve güvensiz HTTP üzerinde çökmez", async () => {
  getUserMedia.mockRejectedValue({ name: "NotFoundError" });
  await act(async () => recorder.start());
  expect(recorder.error).toContain("Mikrofon bulunamadı");
  vi.stubGlobal("isSecureContext", false);
  await act(async () => recorder.start());
  expect(recorder.error).toContain("HTTPS");
  expect(getUserMedia).toHaveBeenCalledOnce();
});
it("arka planda kaydı iptal eder, kesilmiş blobu gönderime açmaz", async () => {
  await act(async () => recorder.start());
  await act(async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(recorder.status).toBe("error");
  expect(recorder.blob).toBeNull();
  expect(stopTrack).toHaveBeenCalled();
});
it("izin beklerken çift tıklama iki mikrofon açmaz; kapanınca geç gelen stream durur", async () => {
  let resolve!: (value: unknown) => void;
  getUserMedia.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = recorder.start();
    await Promise.resolve();
  });
  await act(async () => recorder.start());
  expect(getUserMedia).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  await act(async () => {
    resolve({ getTracks: () => [{ stop: stopTrack }] });
    await pending;
  });
  expect(stopTrack).toHaveBeenCalledOnce();
});
it("sıfırlama eski kayıt sonucunu geri getirmez", async () => {
  await act(async () => recorder.start());
  await act(async () => recorder.reset());
  expect(recorder.blob).toBeNull();
  expect(recorder.status).toBe("idle");
  expect(stopTrack).toHaveBeenCalled();
});
