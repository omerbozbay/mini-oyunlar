export function playerName(value: string): string {
  const name = value.trim().replace(/\s+/gu, " ");
  if (Array.from(name).length < 2 || Array.from(name).length > 24) {
    throw new Error("İsmin 2–24 karakter arasında olmalı.");
  }
  if (/[\p{Cc}\p{Cf}]/u.test(name))
    throw new Error("İsminde görünmeyen karakterler bulunamaz.");
  return name;
}

export function roomCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(code))
    throw new Error("Altı karakterli oda kodunu kontrol et.");
  return code;
}

const messages: Record<string, string> = {
  auth_required: "Kimliğin doğrulanamadı. Lütfen yeniden bağlan.",
  invalid_name: "İsmin 2–24 karakter arasında olmalı.",
  room_not_found: "Bu kodla bir oda bulunamadı. Kodu kontrol et.",
  room_full: "Bu oda iki kişilik ve şu anda dolu.",
  not_a_member: "Bu odada aktif üyeliğin yok.",
  host_only: "Bu işlemi yalnızca oda sahibi yapabilir.",
  players_not_ready: "Başlamak için iki oyuncu da hazır olmalı.",
  game_not_available:
    "Bu oyun henüz geliştirme aşamasında. Şimdilik lobide buluşabilirsiniz.",
  invalid_game: "Geçerli bir oyun seç.",
  already_in_room:
    "Zaten bir odadasın. Önce mevcut odana dön veya odadan ayrıl.",
  room_closed: "Bu oda kapanmış. Yeni bir oda oluşturabilirsin.",
};

export function errorMessage(error: unknown): string {
  if (!(error && typeof error === "object" && "message" in error))
    return "Bir sorun oluştu. Yeniden deneyebilirsin.";
  const message = String(error.message);
  for (const [code, translation] of Object.entries(messages))
    if (message.includes(code)) return translation;
  if (/schema cache|does not exist|PGRST202|PGRST205/i.test(message))
    return "Oda sistemi henüz kurulmamış. README içindeki Supabase kurulum adımlarını tamamla.";
  if (/anonymous sign-ins are disabled/i.test(message))
    return "Supabase panelinde anonim girişleri etkinleştirmen gerekiyor.";
  if (/fetch|network|load failed/i.test(message))
    return "Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.";
  if (/invalid api key|invalid.*key|jwt/i.test(message))
    return "Supabase bağlantı anahtarını kontrol et.";
  if (error instanceof Error && !("code" in error)) return message;
  return "İşlem tamamlanamadı. Bağlantını ve Supabase kurulumunu kontrol et.";
}
