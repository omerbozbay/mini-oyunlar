export const MAX_RECORD_SECONDS = 10;
export const MAX_AUDIO_BYTES = 2_000_000;
export function reverseChannels(channels: Float32Array[]): Float32Array[] {
  if (
    channels.length < 1 ||
    channels.length > 8 ||
    !channels[0].length ||
    channels.some((c) => c.length !== channels[0].length)
  )
    throw Error("Geçersiz ses kanalları.");
  return channels.map((channel) => channel.slice().reverse());
}
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
): ArrayBuffer {
  const frames = channels[0]?.length ?? 0;
  const count = channels.length;
  const size = 44 + frames * count * 2;
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 96000 ||
    frames < 1 ||
    frames / sampleRate > MAX_RECORD_SECONDS ||
    count < 1 ||
    count > 8 ||
    channels.some((c) => c.length !== frames) ||
    size > MAX_AUDIO_BYTES
  )
    throw Error(
      "Kayıt en fazla 10 saniye ve 2 MB olabilir. Lütfen yeniden kaydet.",
    );
  const result = new ArrayBuffer(size);
  const view = new DataView(result);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, size - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, size - 44, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++)
    for (const channel of channels) {
      const sample = channel[frame];
      if (!Number.isFinite(sample))
        throw Error("Ses dosyası geçersiz örnekler içeriyor.");
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        offset,
        Math.round(value * (value < 0 ? 32768 : 32767)),
        true,
      );
      offset += 2;
    }
  return result;
}
export function reverseWav(channels: Float32Array[], sampleRate: number) {
  // MediaRecorder'ın son codec paketindeki küçük taşma kesilir; hız ve örnekleme oranı değişmez.
  const length = Math.min(
    channels[0]?.length ?? 0,
    Math.floor(sampleRate * MAX_RECORD_SECONDS),
  );
  const reversed = reverseChannels(
    channels.map((channel) => channel.slice(0, length)),
  );
  return {
    wav: encodeWav(reversed, sampleRate),
    frames: length,
    sample_rate: sampleRate,
    channels: reversed.length,
  };
}
