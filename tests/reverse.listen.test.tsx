// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { ListenPanel, type ReverseRun } from "../src/games/reverse/ListenPanel";
import type { ReverseContext } from "../src/games/reverse/types";
const mock = vi.hoisted(() => ({ download: vi.fn(), decode: vi.fn() }));
vi.mock("../src/games/reverse/api", () => ({ downloadAudio: mock.download }));
vi.mock("../src/games/reverse/audio", () => ({
  decodeAudio: mock.decode,
  audioConstructor: () => window.AudioContext,
}));
let root: Root, node: HTMLDivElement, run: ReturnType<typeof vi.fn<ReverseRun>>;
let source: {
  buffer: unknown;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
};
const context = {
  my_word: null,
  listen_token: "token",
  listen_status: "unused",
  listen_until: null,
  started_at: null,
  mimic_status: "unused",
  narrator_audio: null,
  mimic_audio: null,
} as ReverseContext;
function button(text: string) {
  const b = Array.from(node.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  );
  if (!b) throw Error(text);
  return b;
}
async function render(value = context) {
  await act(async () =>
    root.render(<ListenPanel context={value} disabled={false} run={run} />),
  );
}
beforeEach(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  source = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createBufferSource() {
        return source;
      }
    },
  );
  mock.download.mockResolvedValue(new Blob(["wav"]));
  mock.decode.mockResolvedValue({ duration: 1 });
  run = vi.fn(async (action: string) =>
    action === "reserve_listen"
      ? {
          token: "token",
          audio: { path: "file.wav", frames: 8000, sample_rate: 8000 },
        }
      : {},
  );
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("kullanıcı etkileşiminden önce otomatik ses çalmaz; bitişte hakkı tüketir", async () => {
  expect(source.start).not.toHaveBeenCalled();
  await act(async () => button("sesi hazırla").click());
  expect(mock.download).toHaveBeenCalledWith("file.wav");
  expect(source.start).not.toHaveBeenCalled();
  await act(async () => button("Tersten Sesi Dinle").click());
  expect(source.start).toHaveBeenCalledOnce();
  expect(run).toHaveBeenCalledWith("start_listen", { token: "token" });
  expect(run).not.toHaveBeenCalledWith("finish_listen", expect.anything());
  await act(async () => source.onended?.());
  expect(run).toHaveBeenCalledWith("finish_listen", { token: "token" });
});
it("bozuk dosyada rezervasyonu iptal eder ve dinleme başlatmaz", async () => {
  mock.decode.mockRejectedValue(Error("Bozuk ses"));
  await act(async () => button("sesi hazırla").click());
  expect(run).toHaveBeenCalledWith("cancel_listen", { token: "token" });
  expect(source.start).not.toHaveBeenCalled();
  expect(node.textContent).toContain("Bozuk ses");
});
it("oynatma başlatılamazsa teknik hata bildirir", async () => {
  source.start.mockImplementation(() => {
    throw Error("Playback blocked");
  });
  await act(async () => button("sesi hazırla").click());
  await act(async () => button("Tersten Sesi Dinle").click());
  expect(run).toHaveBeenCalledWith("listen_failed", { token: "token" });
  expect(run).not.toHaveBeenCalledWith("finish_listen", expect.anything());
});
it("yenilemeden dönen started durumu dosyayı tekrar indirmez", async () => {
  await render({ ...context, listen_status: "started" });
  expect(node.textContent).toContain("Yenileme yeni hak açmaz");
  expect(mock.download).not.toHaveBeenCalled();
  await act(async () => button("kesildi").click());
  expect(run).toHaveBeenCalledWith("listen_failed", { token: "token" });
});
it("arka plana geçince oynatmayı durdurur ve hata kurtarmasını açar", async () => {
  await act(async () => button("sesi hazırla").click());
  await act(async () => button("Tersten Sesi Dinle").click());
  await act(async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(source.stop).toHaveBeenCalledOnce();
  expect(run).toHaveBeenCalledWith("listen_failed", { token: "token" });
});
