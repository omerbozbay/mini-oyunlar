# Açık Artırma — oynanabilir sürüm

## Kurulum

Çalışan oda ve heartbeat migration'larını tekrar uygulamayın. Supabase SQL Editor'de sırasıyla aşağıdaki yeni dosyaların **tamamını** birer kez çalıştırın:

1. `supabase/migrations/202611060003_auction_catalog.sql`
2. `supabase/migrations/202611060004_auction_engine.sql`

İlki dokuz temanın sunucu ürün havuzunu, ikincisi maç tablolarını, RPC'leri ve RLS'yi oluşturur. SQL Editor erişimi bu geliştirme ortamında yoktur; migration'ları kullanıcı uygular. İkinci migration `game_sessions` tablosunu `supabase_realtime` publication'ına ekler. Panelde publication yoksa önce Realtime kurulumu tamamlanmalıdır. Mevcut `rooms` ve `room_players` publication üyelikleri korunur.

`npm run dev` ile uygulamayı açın. İki ayrı tarayıcı profili/telefon aynı odaya katılsın. Oda sahibi Açık Artırma'yı ve temayı seçsin. İki kişi de hazır olunca oda sahibi başlatsın. Sayfayı yenilemek güncel oyun görüntüsünü aynı oda URL'sinden geri yükler.

## Dokuz tema

Pizza, hamburger, pasta, kahvaltı sofrası, makarna, tatlı tabağı, hayvan ordusu, tatil ve ev. Her havuzda **16 seçenek**, toplam **144 ürün** ve 144 yerel SVG bulunur. Sunucu her maçta 10 farklı ürünü rastgele sıraya koyar ve bu sırayı maç kaydında sabitler. Rövanşta yeniden örnekleme yapılır; rastgele seçim önceki maçla bazı ürünleri paylaşabilir.

## Kesinleşen kurallar

- Kişi başına 20 TL, beş ürün; maç başına toplam on ürün.
- Açılış en az 1 TL; teklif tamsayı ve mevcut tekliften en az 1 TL büyük olmalı.
- İlk tekliften önce pas yasak. Sonrasında pas ürünü son teklif sahibine verir ve ihale kapanır; pas geçen aynı ihaleye geri dönemez.
- Maksimum teklif: `bütçe - (5 - mevcut ürün sayısı - 1)`. Böylece kalan her ürün için 1 TL korunur. Başlangıçta üst sınır 16 TL'dir.
- İlk açılış oyuncusu rastgele; sonraki ürünlerin açılışı dönüşümlü. Bir ihale içinde her tekliften sonra sıra karşıya geçer.
- Rakip mevcut teklifi bütçe rezervini koruyarak artıramıyorsa sunucu otomatik pas uygulayıp ürünü son teklif sahibine verir. Boşa sıra beklenmez.
- Bir oyuncu beş ürüne ulaştığında kalan bütün ürünler diğer oyuncuya ürün başına 1 TL'den otomatik tahsis edilir. İki oyuncu da tam beş ürünle bitirir.
- İki oyuncu çevrimiçi değilse yeni teklif/pas/oy/rövanş kabul edilmez. Mevcut 70 saniyelik heartbeat lease'i kullanılır; sekme kapanması anında bilinemeyebilir. Yeniden bağlantıda aynı maç ve sıra devam eder; oyun için yeniden lobi hazır onayı gerekmez.
- Açık “Odadan ayrıl” devam eden maçı terk edilmiş yapar, kalan oyuncuyu lobiye döndürür. Ağ kaybı bu işlemi yapmaz.

## Oylama ve rövanş

Beşer ürünün görsel koleksiyonları yan yana gösterilir. “Ben kazandım” çağıranın UUID'sine, “Rakibim kazandı” diğer UUID'ye, “Beraberlik” null'a çevrilir. Sunucu yalnız bu iki oyuncuyu kabul eder. Oy değiştirme yoktur. Tercihler `private.auction_votes` tablosunda saklanır; diğer oyuncunun seçimi ikinci oy gelene kadar public state'e veya Realtime'a girmez. Yalnız kimin oy kullandığı gösterilir.

İki oy aynı oyuncunun gerçek kimliğinde birleşirse o kazanır. Diğer bütün durumlar (iki beraberlik dahil) beraberliktir. Sonuç ekranı harcanan/kalan bütçeyi ve iki koleksiyonu gösterir. Rövanş iki oyuncunun onayıyla aynı temada yeni maç açar; bütçeler sıfırlanır, ürünler yeniden rastgele seçilir. Sonuçtan “Oyun lobisine dön” ortak odayı lobiye alır ve hazır durumlarını sıfırlar. Oda üyeliği korunur.

## Veri ve yetkilendirme

`public.game_sessions` yalnız aktif oda üyelerine SELECT verir. Yazma grant'i/politikası yoktur. Katalog, oylar ve idempotency kayıtları private şemada, RLS açık ve istemci erişimi kapalı tutulur. Gizli oylar publication'a eklenmez. `get_room_snapshot` mevcut RLS'yi kullanarak mevcut maçı da döndürür.

`start_game`, `select_auction_theme` ve `auction_action` JWT'den oyuncu kimliğini alır. İstemciden bütçe, ürün, kazanan veya sıra kabul edilmez. Mutasyonlar önce oda, sonra maç satırını kilitler. Teklif/pas için beklenen maç sürümü doğrulanır; aynı eski sürümle yarışan iki hamleden yalnız biri uygulanabilir. Oylar ve rövanş onayları birbirinden bağımsız olduğundan eşzamanlı iki oyuncunun onayları sürüm çakışmasıyla kaybolmaz.

Her eylem bir UUID taşır. Aynı kullanıcı/maç/UUID ve aynı içerikle tekrar çağrı etkisiz başarılı sonuç verir; farklı içerik aynı UUID'yi kullanamaz. Ağ sonucu belirsiz olduğunda arayüz aynı UUID ile yeniden deneme sunar. Sunucunun açık SQL reddinde durum yenilenir. Böylece kayıp cevap bütçeyi iki kez düşürmez.

Oyun/tema değiştirme maç açıkken DB trigger'ıyla engellenir. Oda kapasitesi ve tek aktif oda kısıtları değiştirilmemiştir. Bağlantı göstergesi güvenlik otoritesi değildir; RPC'ler server `last_seen` değerlerini ayrıca doğrular.

## Kaynaklar

- `src/games/auction/catalog.json`: düzenlenebilir tema/ürün kaynağı.
- `scripts/build-auction-assets.mjs`: yerel SVG'leri, istemci `themes.json` dosyasını ve 003 katalog migration'ını üretir. `npm run assets:auction` ile çalıştırılır. Uygulanmış migration değiştirilerek uzak veritabanı güncellenmez; gelecek katalog değişiklikleri için yeni migration gerekir.
- `src/games/auction/Auction.tsx`, `auction.css`: tema seçici, ürün, teklifler, sonuç, oy ve rövanş arayüzü.
- `tests/auction.*`: PostgreSQL, katalog/varlık ve React DOM testleri.
- [Görsel kaynak ve lisans bilgisi](ASSETS.md).

Tarayıcı otomasyon sunucusu kullanılamazsa Happy DOM etkileşim testleri gerçek iPhone/Android görsel testi yerine geçmiş sayılmaz. Netlify yayını ayrı dağıtım adımıdır.
