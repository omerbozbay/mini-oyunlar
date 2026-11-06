import { rpc } from "../../features/rooms/api";
import { supabase } from "../../lib/supabase";
import { requestId } from "../../lib/requestId";
import type {
  ReverseSession,
  ReverseContext,
  AudioTicket,
  AudioMeta,
} from "./types";
export const AUDIO_BUCKET = "reverse-audio";
export const getReverseContext = (session: string, round: number) =>
  rpc<ReverseContext>("reverse_context", {
    p_session_id: session,
    p_round: round,
  });
export function reverseCommand(
  session: ReverseSession,
  action: string,
  payload: unknown = {},
) {
  return {
    p_session_id: session.id,
    p_round: session.state.current.number,
    p_version: session.version,
    p_request_id: requestId(),
    p_action: action,
    p_payload: payload,
  };
}
export type ReverseCommand = ReturnType<typeof reverseCommand>;
export const sendReverseCommand = (command: ReverseCommand) =>
  rpc<Record<string, unknown>>("reverse_action", { ...command });
export async function uploadAudio(ticket: AudioTicket, blob: Blob) {
  if (!supabase) throw Error("Supabase bağlantısı kurulamadı.");
  const bucket = supabase.storage.from(AUDIO_BUCKET);
  const upload = () =>
    bucket.upload(ticket.path, blob, {
      contentType: "audio/wav",
      upsert: false,
      cacheControl: "0",
    });
  const { error } = await upload();
  if (!error) return;
  if (
    String((error as { statusCode?: string }).statusCode) !== "409" &&
    !/already exists|duplicate/i.test(error.message)
  )
    throw error;
  // Kayıp yanıtın tekrarı aynı dosyayı kullanır. Anlatıcının yeni kaydı eski
  // dosyayla karışmasın: yalnız gönderilmemiş dosyayı RLS izniyle değiştir.
  const existing = await downloadAudio(ticket.path);
  const [before, after] = await Promise.all([
    existing.arrayBuffer(),
    blob.arrayBuffer(),
  ]);
  const bytes = new Uint8Array(before),
    next = new Uint8Array(after);
  if (
    bytes.length === next.length &&
    bytes.every((value, i) => value === next[i])
  )
    return;
  const removed = await bucket.remove([ticket.path]);
  if (removed.error) throw removed.error;
  const retried = await upload();
  if (retried.error) throw retried.error;
}
export async function downloadAudio(path: string) {
  if (!supabase) throw Error("Supabase bağlantısı kurulamadı.");
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    // Yeni nonce CDN'deki eski izinli cevabı, no-store tarayıcı önbelleğini atlar.
    .download(path, { cacheNonce: requestId() }, { cache: "no-store" });
  if (error)
    throw Error(
      "Ses alınamadı. Bağlantıyı veya kaydın saklama süresini kontrol et.",
    );
  return data;
}
export function audioPayload(ticket: AudioTicket, meta: AudioMeta) {
  return {
    ticket: ticket.id,
    frames: meta.frames,
    sample_rate: meta.sample_rate,
    channels: meta.channels,
  };
}
