import type { GameDefinition } from "./types";

export const games: GameDefinition[] = [
  {
    id: "auction",
    title: "Açık Artırma",
    category: "STRATEJİ & PAZARLIK",
    description: "Bütçeni iyi kullan, en güzel kombinasyonu sen kur.",
    emoji: "🍕",
    color: "peach",
    status: "coming-soon",
    rules: [
      "20 TL bütçe, 10 ürün ve bolca tatlı rekabet.",
      "Sırayla teklif ver veya pas geç. Her oyuncu 5 ürün toplar.",
      "En iyi kombinasyonu birlikte oylayın.",
    ],
  },
  {
    id: "chain",
    title: "Kelime Zinciri",
    category: "KELİME & ÇAĞRIŞIM",
    description: "Bir kelime diğerini çağırır. Bakalım aklından ne geçiyor?",
    emoji: "🔗",
    color: "lavender",
    status: "coming-soon",
    rules: [
      "Birbiriniz için beş kelimelik zincirler hazırlayın.",
      "İlk kelime açık; diğerlerinde ilk harf ve uzunluk ipucu var.",
      "Süre ve yanlış tahmin sınırı yok. İlk tamamlayan kazanır.",
    ],
  },
  {
    id: "detective",
    title: "Sayı Dedektifi",
    category: "MANTIK & GİZEM",
    description: "İpuçlarını birleştir, gizli sayının peşine düş.",
    emoji: "🔎",
    color: "mint",
    status: "coming-soon",
    rules: [
      "Tekrarsız, ilk rakamı sıfır olmayan dört haneli sayı belirleyin.",
      "Sırayla tahmin edin ve doğru rakam sayısını takip edin.",
      "İlk bulan kazanır. Aynı turda bulursanız beraberlik!",
    ],
  },
  {
    id: "wordhunt",
    title: "Kelime Avı",
    category: "KELİME & KEŞİF",
    description: "Altı tahmin, renkli ipuçları. O kelimeyi bulabilir misin?",
    emoji: "🌿",
    color: "butter",
    status: "coming-soon",
    rules: [
      "Birbiriniz için 5 veya 6 harfli Türkçe kelime seçin.",
      "Yeşil: doğru konum. Sarı: başka konum. Gri: bulunmayan veya fazla harf.",
      "Altı hakkınız var. Daha az tahminde bulan kazanır.",
    ],
  },
];
