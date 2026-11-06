import { it, expect, vi, beforeEach } from "vitest";
import { downloadAudio, uploadAudio } from "../src/games/reverse/api";
const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { storage: { from: () => storage } },
}));
vi.mock("../src/features/rooms/api", () => ({ rpc: vi.fn() }));
const ticket = { id: "ticket", path: "session/1/user/ticket.wav" };
beforeEach(() => {
  vi.resetAllMocks();
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
});
it("her indirmede yeni nonce ve no-store ile güncel yetkiyi sorgular", async () => {
  storage.download.mockResolvedValue({ data: new Blob(["wav"]), error: null });
  await downloadAudio(ticket.path);
  await downloadAudio(ticket.path);
  expect(storage.download.mock.calls[0][1].cacheNonce).not.toBe(
    storage.download.mock.calls[1][1].cacheNonce,
  );
  expect(storage.download.mock.calls[0][2]).toEqual({ cache: "no-store" });
});
it("yükleme yanıtı kaybolduğunda aynı dosyayı silmeden yeniden kullanır", async () => {
  storage.upload.mockResolvedValue({
    error: { statusCode: "409", message: "exists" },
  });
  storage.download.mockResolvedValue({ data: new Blob(["same"]), error: null });
  await uploadAudio(ticket, new Blob(["same"]));
  expect(storage.remove).not.toHaveBeenCalled();
  expect(storage.upload).toHaveBeenCalledOnce();
});
it("anlatıcı yeniden kayıt yaptıysa eski gönderilmemiş dosyayla karıştırmaz", async () => {
  storage.upload.mockResolvedValueOnce({
    error: { statusCode: "409", message: "exists" },
  });
  storage.download.mockResolvedValue({ data: new Blob(["old"]), error: null });
  const next = new Blob(["new"]);
  await uploadAudio(ticket, next);
  expect(storage.remove).toHaveBeenCalledWith([ticket.path]);
  expect(storage.upload).toHaveBeenCalledTimes(2);
  expect(storage.upload.mock.calls[1][1]).toBe(next);
  expect(storage.upload.mock.calls[1][2].upsert).toBe(false);
});
it("RLS silmeyi reddederse eski dosyayı yeni kayıt diye göndermez", async () => {
  storage.upload.mockResolvedValueOnce({
    error: { statusCode: "409", message: "exists" },
  });
  storage.download.mockResolvedValue({ data: new Blob(["old"]), error: null });
  storage.remove.mockResolvedValue({ error: Error("denied") });
  await expect(uploadAudio(ticket, new Blob(["new"]))).rejects.toThrow(
    "denied",
  );
  expect(storage.upload).toHaveBeenCalledOnce();
});
it("indirme hatasını kullanıcıya Türkçe olarak iletir", async () => {
  storage.download.mockResolvedValue({ error: Error("denied") });
  await expect(downloadAudio(ticket.path)).rejects.toThrow("Ses alınamadı");
});
