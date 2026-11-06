// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  reverseChannels,
  reverseWav,
  encodeWav,
} from "../src/games/reverse/pcm";
import {
  recorderMime,
  microphoneError,
  decodeAudio,
} from "../src/games/reverse/audio";
afterEach(() => vi.unstubAllGlobals());
describe("PCM ses işleme", () => {
  it.each([8000, 44100, 48000, 96000])(
    "örnekleme hızını ve stereo kanal sırasını korur: %i",
    (rate) => {
      const left = new Float32Array([-0.5, 0, 0.5, 1]);
      const right = new Float32Array([1, 0.5, 0, -0.5]);
      const result = reverseWav([left, right], rate);
      const view = new DataView(result.wav);
      expect(view.getUint32(24, true)).toBe(rate);
      expect(view.getUint16(22, true)).toBe(2);
      expect(view.getUint32(40, true)).toBe(16);
      expect(view.getInt16(44, true)).toBe(32767);
      expect(view.getInt16(46, true)).toBe(-16384);
      expect(view.getInt16(56, true)).toBe(-16384);
      expect(Array.from(left)).toEqual([-0.5, 0, 0.5, 1]);
      expect(result.frames).toBe(4);
    },
  );
  it("bütün kanalların zaman yönünü ayrı ayrı ters çevirir", () => {
    const channels = Array.from(
      { length: 8 },
      (_, i) => new Float32Array([i, i + 1, i + 2]),
    );
    expect(reverseChannels(channels).map((c) => Array.from(c))).toEqual(
      channels.map((c) => Array.from(c).reverse()),
    );
  });
  it("codec son paket taşmasını 10 saniyeye keser", () => {
    expect(reverseWav([new Float32Array(81000)], 8000).frames).toBe(80000);
    expect(() => encodeWav([new Float32Array(81000)], 8000)).toThrow();
  });
  it("boş, uyumsuz, aşırı büyük ve sonlu olmayan örnekleri reddeder", () => {
    expect(() => reverseWav([], 8000)).toThrow();
    expect(() => encodeWav([new Float32Array([NaN])], 8000)).toThrow();
    expect(() =>
      reverseChannels([new Float32Array(1), new Float32Array(2)]),
    ).toThrow();
    expect(() => encodeWav([new Float32Array(1)], 1)).toThrow();
    expect(() =>
      encodeWav(
        Array.from({ length: 8 }, () => new Float32Array(960000)),
        96000,
      ),
    ).toThrow();
  });
});
describe("Tarayıcı ses biçimi ve hata kurtarma", () => {
  it.each(["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"])(
    "desteklenen %s biçimini çalışma anında seçer",
    (mime) => {
      expect(
        recorderMime({
          isTypeSupported: (type: string) => type === mime,
        } as typeof MediaRecorder),
      ).toBe(mime);
    },
  );
  it("biçim bulunamazsa tarayıcının varsayılanını kullanır", () => {
    expect(
      recorderMime({
        isTypeSupported: () => false,
      } as unknown as typeof MediaRecorder),
    ).toBeUndefined();
  });
  it.each(["NotAllowedError", "NotFoundError", "NotReadableError"])(
    "%s için Türkçe açıklama verir",
    (name) => {
      expect(microphoneError({ name })).toMatch(/Mikrofon/);
      expect(microphoneError({ name })).not.toContain(name);
    },
  );
  it("bozuk ses çözümlemesini anlaşılır hata ile bitirip contexti kapatır", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "AudioContext",
      class {
        close = close;
        decodeAudioData = vi.fn().mockRejectedValue(Error("codec"));
      },
    );
    await expect(decodeAudio(new Blob(["broken"]))).rejects.toThrow(
      "Ses çözümlenemedi",
    );
    expect(close).toHaveBeenCalledOnce();
    await expect(decodeAudio(new Blob([]))).rejects.toThrow("boş");
  });
});
