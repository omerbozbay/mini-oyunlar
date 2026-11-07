# Mimari ve güvenlik sınırları

## İlk sürüm

React Router ana sayfayı ve `/oda/:code` lobisini açar. `features/rooms/api.ts` yalnız PostgreSQL RPC'lerini çağırır; durum değişiklikleri SQL tarafında doğrulanır. Realtime oda ve oyuncu değişikliklerini dinler. Üyelik RLS ile doğrulanır; kanal adını bilmek erişim sağlamaz. Oda revizyonu katılma/ayrılma/hazır olma/seçim işlemlerinin ardından değişir. Heartbeat yalnız oyuncu kaydını günceller. Ağ kesintilerinde 15 saniyelik tekrar sorgulama durumu kurtarır.

Supabase SDK anonim kimliği yerel tarayıcı deposunda saklar. İsim ve oda kodu kullanıcı kimliği değildir. Her RPC `auth.uid()` kullanır; istemciden değiştirilebilir oyuncu ID'si almaz. İsim sadece arayüz etiketidir. Aynı tarayıcı profili aynı oyuncudur. Tarayıcı verisi silinen kimliğe isim/kod ile geri dönülmez.

`rooms` ve `room_players` üzerinde RLS açık, authenticated'a yalnız SELECT verilmiştir. Üyeler yalnız kendi aktif odalarını ve o odanın aktif üyelerini okuyabilir. Yazma/DELETE grant veya politikası yoktur. `SECURITY DEFINER` RPC'ler boş `search_path` ve tam şema adları kullanır. Varsayılan PUBLIC execute izinleri kapalıdır. İstemci kendi `ready` alanını bile doğrudan yazamaz; kontrollü RPC kullanır.

Odaya katılma, çıkma, seçim, hazır olma ve başlatma fonksiyonları aynı oda satırında `FOR UPDATE` kilidi alır. İki katılımcı aynı anda başvurursa doluluk kontrolü sırayla yapılır. `create_room`/`join_room` kimlik başına transaction advisory lock ve tek aktif oda unique index'i kullanır. Üçüncü kişi giremez; kod çakışmasında kod yeniden üretilir. İstek tekrarı aynı kimliğe üçüncü üyelik açmaz.

Odalar bağlantı koptu diye silinmez. Açık ayrılmada üyelik `active=false` olur. Bu, Realtime DELETE olaylarında RLS sınırlamalarına dayanma ihtiyacını da kaldırır. Kalan oyuncuya sahiplik devredilir. Son ayrılmada oda kapanır. Kalıcı olarak terk edilmiş odaların ve Auth hesaplarının süreli temizliği bu sürümde yapılmaz; gelecekte saklama politikasına göre sunucuda planlanmalıdır.

`202611060002_presence_lease.sql` bağlantı lease'ini güçlendirir. `get_room_snapshot` SECURITY INVOKER RPC'si mevcut RLS ile tek görüntü ve sunucu zamanı döndürür. İstemci bu zamanı `performance.now()` ile ilerletir ve saniyede bir çevrimiçi/hazır durumunu yeniden hesaplar; `Date.now()` ile telefon saatine güvenmez. 25 saniyelik heartbeat durduğunda son başarılı sinyalden 70 saniye sonra oyuncu çevrimdışı sayılır. Ayrı Presence kanalına veya istemcinin iddia ettiği kullanıcı/online alanlarına güvenilmez. Zaman aşımı üyelik ve kapasiteyi değiştirmez.

Heartbeat aynı oda satırını kilitler, süresi dolmuş üyelerin yalnız hazır bayrağını temizler ve çağıranın JWT kimliğine ait `last_seen` değerini yeniler. UPDATE'ler mevcut RLS korumalı Realtime aboneliğiyle yayılır. Süresi dolmuş bir kayda tekrar yazıldığında BEFORE UPDATE trigger'ı eski hazır durumunu geri taşımaz; böylece `join_room` tekrar katılma yolu da güvenlidir. `set_ready(true)` güncel heartbeat ister; başlatma iki güncel ve hazır üyeyi ayrıca sunucuda doğrular. İstemci hesaplaması yetkilendirme yerine geçmez.

`start_game` RPC'si üyelik, sahiplik, iki hazır ve yakın zamanda bağlı oyuncuyu doğrular ve seçilen beş oyundan birini başlatır. `rooms.current_game_id` mevcut maçı işaret eder; oda durumunu değiştirmeden mevcut heartbeat ve oturum kurtarma akışı korunur. Açık Artırma bidding, bulmacalar preparing, sesli oyun playing/alt aşama preparing evresinde açılır. [Açık Artırma](AUCTION.md) · [Üç gizli cevap motoru](PUZZLES.md) · [Sesli oyun](REVERSE.md).

## Oyun modülü ekleme sözleşmesi

`src/games/registry.ts` oyun kataloğudur; her kayıtta kimlik, Türkçe metinler, özet kurallar, renk ve yayın durumu bulunur. `types.ts` ortak oyun ve sonuç tiplerini tutar. Bir motor eklendiğinde `src/games/<game-id>/` altında `components/`, `types.ts`, `rules.ts` ve davranış testleri tutulabilir. Ortak lobi ve oyuncu yönetimi yeniden kullanılır.

Bir oyunu available yapmak tek başına yeterli değildir. Yeni migration, sunucu eylem doğrulaması, oyun görünümü ve entegrasyon testleri birlikte eklenmelidir. İstemci registry'si güvenlik otoritesi değildir; sunucu kendi izin verilen oyun listesini doğrular.

## Oyun verileri ve gelecekte genişletme

- `game_sessions` Açık Artırma için oluşturulmuştur: oda FK'si, tema, evre, sürüm, görünür JSON durumu ve sunucunun hesapladığı sonuç. Üyelere yalnız SELECT; durum değişiklikleri RPC ile. `private.auction_requests` idempotency, `private.auction_votes` gizli tercih, `private.auction_catalog` sunucu ürün havuzudur. Tümünde RLS açık ve private tablolarda istemci grant'i yoktur.
- `game_actions`: oturum FK'si, oyuncu FK'si, artan sıra/sürüm, benzersiz istemci istek kimliği ve **yalnız yayınlanması güvenli** eylem/sonuç. Tekrarlanan ağ isteklerine idempotency sağlar. Kullanıcının girdiği gizli sayı veya kelime bu açık günlüğe yazılmaz.
- `private.puzzle_secrets`: oturum + sahip kimliği + gizli JSON cevap. Üç bulmaca için oluşturulmuştur. API'ye expose edilmez; RLS açık ve istemci grant/policy'si yoktur. Yalnız `my_game_secret` kendi cevabını döndürür; diğer oyuncu için kimlik parametresi yoktur. Kelimeleri yalnız hashlemek yeterli değildir; küçük kelime/sayı uzayı tahmin edilebilir. `private.puzzle_requests` güvenli idempotency kaydını tutar.

`submit_action(session_id, expected_version, request_id, action)` RPC'si JWT kimliğini alır, oturumu kilitler, üyeliği/sırayı/oyun evresini/girdi biçimini doğrular. `expected_version` eskiyse reddeder; tekrarlanan request_id aynı sonucu döndürür. Bakiyeyi, ürünü, ilerlemeyi, tahmin değerlendirmesini ve kazananı aynı transaction'da sunucu hesaplar. İstemciden skor/kazanan/sıra/bakiye kabul edilmez. Gizli veri hata metinlerine veya loglara konmaz.

Gizli hazırlık değerleri yalnız kontrollü RPC ile gönderilir. Rakibe ilk harf/uzunluk veya tahmin geri bildirimi gibi izinli projeksiyonlar gönderilir. Gizli tablolar Realtime publication'ına alınmaz. Reveal yalnız oyun kuralları izin verdiğinde gerçekleşir.

## Kurallardaki uygulama kararları

Açık Artırma'da minimum açılış 1 TL ve ilk teklif öncesi pas yasağı vardır. 009–011 ile ürün sayısı sınırı/otomatik tahsis/bütçe rezervi kaldırılmıştır. Bir bütçe sıfırlandığında parası kalan oyuncu sıradaki ürünü ücretsiz kendine veya karşıya verir; para kesilmez, her ürün ayrı onaylanır. Hediye yalnız kendi ürününü aktarır ve son koleksiyon onaylarını sıfırlar. İki koleksiyon onayından sonra oylama başlar; tercihler iki oy gelene kadar gizlidir. Mutasyonlar oda→maç kilidi, UUID tekrar ve gerektiğinde global sürüm kontrolü kullanır. Rövanş iki oyuncunun onayını ister.

Sayı Dedektifi'nde ilk oyuncunun bulduğu turda ikinci oyuncuya eşit tahmin hakkı verilir; sonuç tur tamamlanana kadar kesinleştirilmez. Doğru rakam sayısı konumdan bağımsızdır; yalnız sayı tam eşitse çözülür.

Kelime Avı'nda 5/6 harf modu iki oyuncu için eşittir. İki oyuncu da altı hakta bulamazsa beraberliktir. Harici sözlük doğrulaması yoktur; anlamlı kelime seçimi hazırlayan kişiye aittir. Türkçe normalizasyon istemcide NFC + `toLocaleUpperCase('tr-TR')`, sunucuda NFC + açık Türkçe harf dönüşüm tablosuyla yapılır; DB locale'ine güvenilmez. Tekrar harfler önce yeşil, sonra kalan sayıya göre sarı olarak sunucuda değerlendirilir.

`puzzle_action` ortak kimlik, kilit, üyelik, evre, çevrimiçi durum ve UUID tekrar doğrulamasını yapar; hazırlık/tahmin/sonuç hesapları oyun bazlı private fonksiyonlara yönlendirilir. Zincir ve Kelime Avı'nda oyuncu başına revizyon bağımsız hamlelere izin verir. Dedektif'te ek maç sürümü ve sıra kontrolü vardır. Public state hiçbir hamlede gizli cevabı erken içermez. Sonuç kesinleştiğinde iki cevap public `reveals` alanına taşınır. Açık Artırma yalnız kendi türünü kabul eden bir sarmalayıcıyla korunmuştur.

## Kontrol sınırı

Yerel PostgreSQL testleri migration'ı ve RLS'yi çalıştırır. PGlite tek bağlantılı olduğundan gerçek yarış koşulları, Supabase Realtime sunucusu ve JWT ağı için iki cihaz entegrasyon testi gerekir. Ücretsiz planın kotası, uykuya alınması ve Auth hız limitleri dış hizmet davranışıdır. Bot önleme ve per-user RPC rate limiting trafik artmadan değerlendirilmelidir.

## Beşinci oyun: sesli maç

008 migration `reverse` oyununu ekler. Mevcut oda/heartbeat/Realtime/RLS altyapısı korunur. `reverse_action` oda→maç kilidi, rol/tur/aşama/UUID, çevrimiçi durum ve mevcut maç kontrolü yapar. Gizli kelime ve medya biletleri private tablolarda, ortak aşama/puan public game state içindedir. Web Audio PCM çözümleme ve Worker üzerinden her kanalın ters çevrilmesi/WAV üretimi sonrası yalnız ters dosya Storage'a gider. Storage RLS bilet bazlı yükleme ve süreli dinleme erişimini doğrular. İndirme istekleri yeni cacheNonce ve no-store kullanır. Oynatmanın fiziksel olarak bir kez gerçekleştiği tarayıcıdan kanıtlanamaz. Süreli RLS erişimi ve Storage API ile yönetici temizliği ayrı süreçlerdir; [REVERSE.md](REVERSE.md) güvenlik sınırlarını ve saklama yöntemini açıklar.
