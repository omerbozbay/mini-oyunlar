import { it, expect, vi } from "vitest";
// @ts-expect-error Node yönetici aracının bağımsız ESM modülü.
import { cleanupReverseAudio } from "../scripts/cleanup-reverse-audio.mjs";
function fixture() {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: ["one.wav"], error: null })
    .mockResolvedValue({ data: [], error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc,
    remove,
    client: { rpc, storage: { from: vi.fn().mockReturnValue({ remove }) } },
  };
}
it("varsayılan temizlik dosya silmeden yalnız sayım yapar", async () => {
  const f = fixture();
  await cleanupReverseAudio(f.client, false, vi.fn());
  expect(f.remove).not.toHaveBeenCalled();
});
it("önce Storage API ile siler, ardından metadata temizliğini onaylar", async () => {
  const f = fixture();
  expect(await cleanupReverseAudio(f.client, true, vi.fn())).toBe(1);
  expect(f.remove).toHaveBeenCalledWith(["one.wav"]);
  expect(f.rpc).toHaveBeenCalledWith("confirm_audio_cleanup", {
    p_paths: ["one.wav"],
  });
  expect(f.remove.mock.invocationCallOrder[0]).toBeLessThan(
    f.rpc.mock.invocationCallOrder[1],
  );
});
it("Storage silme hatasında metadata kaydını korur", async () => {
  const f = fixture();
  f.remove.mockResolvedValue({ error: Error("unavailable") });
  await expect(cleanupReverseAudio(f.client, true, vi.fn())).rejects.toThrow(
    "unavailable",
  );
  expect(f.rpc).toHaveBeenCalledTimes(1);
});
