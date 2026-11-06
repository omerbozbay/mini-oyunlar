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
  invalid_reverse_word:
    "Kategori 2–60, gizli kelime ve tahmin 1–120 karakter olmalı.",
  invalid_audio:
    "Ses dosyası doğrulanamadı. En fazla 10 saniyelik WAV kaydını yeniden hazırlayabilirsin.",
  invalid_audio_ticket:
    "Ses yükleme izni geçerli değil. Güncel turu yeniden yükle.",
  audio_expired: "Bu sesin saklama süresi dolmuş veya dosya bulunamıyor.",
  not_your_role:
    "Bu işlem bu aşamada diğer oyuncuya ait veya zaten tamamlandı.",
  stale_round: "Tur değişmiş. Eski kayıt veya istek yeni turu etkileyemez.",
  listen_unavailable:
    "Bu dinleme hakkı şu anda kullanılamaz. Güncel durumu kontrol et.",
  listen_not_finished:
    "Ses henüz tamamlanmış görünmüyor. Birkaç saniye sonra yeniden deneyebilirsin.",
  mimic_locked:
    "Taklit kaydın alındı. Normal akışta yeniden kayıt yapılamaz; teknik hata kurtarmasını kullanabilirsin.",
  invalid_length: "Kelime uzunluğu 5 veya 6 harf olmalı.",
  guess_limit:
    "Altı tahmin hakkını tamamladın. Arkadaşının sonucunu bekleyelim.",
  invalid_number:
    "Sayı dört farklı rakamdan oluşmalı ve ilk rakam sıfır olmamalı.",
  invalid_chain:
    "Tam beş kelime yazmalısın; her kelime en az iki Türkçe harf içermeli.",
  invalid_word: "Kelimenin uzunluğunu ve Türkçe harflerini kontrol et.",
  secret_locked: "Cevabın kilitlendi; bu maçta değiştirilemez.",
  player_finished: "Tahminlerini tamamladın. Arkadaşının sonucunu bekleyelim.",
  invalid_theme: "Geçerli bir tema seç.",
  game_in_progress: "Oyun oturumu açıkken tema veya oyun değiştirilemez.",
  game_not_current: "Bu maç artık güncel değil. Odanın son durumunu yenile.",
  stale_version: "Oyun ilerlemiş. Güncel durum yüklendi; sıranı kontrol et.",
  not_your_turn: "Şimdi diğer oyuncunun sırası.",
  players_offline: "Oyun duraklatıldı. İki oyuncu da çevrimiçi olmalı.",
  cannot_pass_first: "İlk teklif verilmeden pas geçilemez.",
  invalid_bid: "Teklif en az 1 TL artmalı ve gösterilen üst sınırı aşmamalı.",
  collection_full: "Beş ürününü tamamladın.",
  invalid_phase: "Bu işlem oyunun şu anki aşamasında yapılamaz.",
  already_voted: "Tercihin zaten kaydedildi. Diğer oyuncuyu bekleyelim.",
  invalid_vote:
    "Yalnız bu maçtaki oyunculardan birini veya beraberliği seçebilirsin.",
  request_conflict:
    "İstek kimliği başka bir hamlede kullanılmış. Güncel durumu yenile.",
  player_offline:
    "Bağlantın henüz yenilenmedi. Birkaç saniye sonra yeniden hazır olabilirsin.",
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
