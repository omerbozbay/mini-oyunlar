# Doğrulama raporu — 6 Kasım 2026

- `npm run build`: TypeScript kontrolü ve Vite üretim derlemesi başarılı.
- `npm test`: Açık Artırma eklenmesiyle 8 dosyada 57 test başarılı. PostgreSQL migration/RLS/RPC, giriş kuralları, sayfa render durumları, bağlantı yaşam döngüsü, oyun motoru, katalog ve oyun arayüzü kapsanıyor.
- `npm audit --omit=dev`: üretim bağımlılıklarında bilinen açık bildirilmedi.
- Yerel HTTP: `/` ve `/oda/AF1234` adresleri 200 döndü.
- Git kontrolü: `.env.local`, `node_modules`, `dist` ve `.qa` dışlandı. Commit'e giren dosyalarda gerçek anahtarla eşleşme bulunmadı.

## Uzak Supabase

Kullanıcı Dashboard'da Anonymous Sign-Ins ayarını açtı ve migration'ı uyguladığını bildirdi. Sonrasında gerçek Supabase üzerinde anonim giriş ve `current_room` RPC erişimi doğrulandı. Migration bu çalışma tarafından Dashboard/DDL erişimiyle çalıştırılmadı.

Üç geçici anonim test kimliğiyle 17 kontrol başarılı:

1. Ayrı anonim kimlikler oluştu.
2. Altı karakterli oda kodu oluştu.
3. Realtime aboneliği kuruldu.
4. Son boş yere aynı anda katılan iki kimlikten yalnız biri kabul edildi.
5. Üçüncü kimlik `room_full` hatası aldı.
6. Üye olmayan kimlik oda tablosundan odayı okuyamadı.
7. Üye olmayan kimlik oyuncuları okuyamadı.
8. Doğrudan hazır durumu yazması `42501` ile engellendi.
9. Misafir oyun seçimi `host_only` ile engellendi.
10. İki hazır durumu sunucuda görüldü.
11. Eksik oyun motoru `game_not_available` ile engellendi.
12. Yeni oyun seçimi iki hazır durumunu sıfırladı.
13. Aynı anonim kimlikle mevcut oda kurtarıldı.
14. Sahip ayrıldığında sahiplik kalan oyuncuya geçti.
15. Ayrılan oyuncunun okuma yetkisi kalktı.
16. Son oyuncu ayrıldığında eski kodla katılım `room_closed` ile engellendi.
17. Oda güncellemesi gerçek Supabase WebSocket bağlantısından alındı.

İlk denemede Realtime olayı alınamadı. JWT aktarımını `realtime.setAuth()` ile açıkça bekleyen sonraki deneme geçti; istemciye de aynı bekleme eklendi. Son test odası açık ayrılma işlemleriyle kapatıldı. Testlerde üretilen anonim Auth kullanıcıları ve oda geçmişi sunucuda kalır; ilk yarıda kesilen denemeden `İkimiz Test` isimli üyeler içeren boşta bir test lobisi de kalmış olabilir. Bunlar gerçek kullanıcı oturumları değildir; yönetici isterse Dashboard'da inceleyip temizleyebilir.

## Doğrulanmayanlar

Tarayıcı otomasyon sunucusuna erişilemedi. Gerçek iPhone Safari/Android Chrome görselleri, dokunmatik kullanım, yatay taşma, dialog odağı, sayfa yenileme ve arka plan/ağ kesintisi davranışları tarayıcıda doğrulanmadı. Sunucu tarafı render testleri bunların yerine geçmez. [Manuel test planı](TESTING.md) kullanılmalıdır.

Netlify hesabında yayın yapılmadı; yapılandırma hazırlandı. Açık Artırma motoru geliştirildi; diğer üç oyun henüz geliştirilmedi. Aşağıdaki ilk sürüm kayıtlarında geçen `game_not_available` kontrolü o sürüme aittir; yeni sürümde yalnız geliştirilmemiş oyunlar için geçerlidir.

## Bağlantı durumu düzeltmesi

İlk mekanizma son görülmeyi telefonun `Date.now()` saatiyle karşılaştırıyor ve hazır rozetini bu sonuca göre kapatmıyordu. Artık oda görüntüsü sunucu zamanıyla alınır, monoton istemci sayacıyla saniyede bir ilerletilir. Görünüm/CSS korunmuş, çevrimdışı etiket ve hazır hesaplaması düzeltilmiştir.

Kullanıcı `202611060002_presence_lease.sql` dosyasını SQL Editor'de çalıştırdı ve başarı bildirdi. Ardından yeni RPC gerçek Supabase üzerinde doğrulandı. Bu migration bu çalışma tarafından uzaktan DDL erişimiyle çalıştırılmadı.

Yeni 12 otomatik regresyon testi: 70 saniye sınırı, yerel saat farkı, bozuk/eksik zaman, tüm ağ istekleri başarısızken sürenin dolması, WebSocket sonrası geri dönüş, timer/abonelik temizliği, online olayında hemen heartbeat, snapshot RLS, eski hazır bayrağı temizliği, kapasite korunması, çevrimdışı hazır olma engeli ve aynı kimlikle tekrar katılma. Hook testleri Happy DOM ve sahte zamanlayıcıyla React üzerinde çalışır; gerçek telefon tarayıcısının yerine geçmez.

Gerçek Supabase üzerinde ek 14 kontrol geçti. Bir test oyuncusunun heartbeat'i 72 saniye durduruldu; diğer oyuncu heartbeat göndermeye devam etti. Süresi dolan oyuncu üye kaldı, hazır olma ve oyun başlatma reddedildi, eski hazır bayrağı temizlendi ve UPDATE gerçek WebSocket'ten alındı. Üçüncü kimlik oda dolu hatası aldı. Aynı kimlik yeniden heartbeat gönderince çevrimiçi/hazır değil durumuna döndü, açıkça yeniden hazır olabildi. `current_room` üyeliği korudu; açık ayrılma oyuncuyu çıkardı. Sonunda test üyelikleri kapatıldı. Anonim test hesapları ve kapalı oda geçmişi sunucuda kalabilir.

## Açık Artırma eklenmesi

57 otomatik test geçti. Dokuz temanın her biri yerel PostgreSQL'de farklı teklif stratejileriyle oynatıldı; bütçe rezervi, sıra, otomatik pas, beşer ürün, on benzersiz ürün ve pozitif bütçeler doğrulandı. Aynı istek kimliğiyle tekrar, eski sürüm, sıra dışı işlem, ilk pas, bütçe aşımı, maçta tema değişimi, gizli oylar, gerçek kazanan kimliği, beraberlik, iki onaylı rövanş, lobiye dönüş, açık ayrılma ve RLS retleri test edildi. Hook testinde mevcut sorgu sürerken gelen Realtime olayının sonradan yeniden sorgulandığı da doğrulandı. HTTP yerel ağ önizlemesinde `crypto.randomUUID` bulunmadığında güvenli UUID yedeği test edildi.

React DOM testlerinde teklif/+5 kontrolü, maksimum fiyat, sırası olmayanın ve çevrimdışı oyuncunun butonları, aynı UUID ile ağ hatası tekrarı, oy kimliği, rövanş/lobi butonları, dokuz tema ve görsel hata yedeği geçti. 144 yerel SVG dosyasının varlığı, dokuz havuzun boyutu ve sunucu/istemci katalog eşitliği test edildi. SVG'ler yerel olarak kontrol sayfalarına rasterize edilip incelendi; hayvan ve deneyim çizimleri ayırt edilebilir olacak şekilde düzeltildi. Bu varlık incelemesi web sayfasının tarayıcıda görsel doğrulaması değildir.

Yeni 003/004 migration'ları uzak Supabase'de henüz doğrulanmadı: son kontrolde `select_auction_theme` RPC'si `PGRST202` (fonksiyon henüz bulunamadı) döndürdü. Bu nedenle Açık Artırma'nın uzak sunucuda tam maç testi bu raporda başarılı olarak işaretlenmez. Migration'lar SQL Editor'de uygulandıktan sonra `npm run test:auction:live` gerçek eşzamanlı teklif, WebSocket, 72 saniyelik duraklama, aynı kimlikle geri yükleme, gizli oy, rövanş ve lobiye dönüş testlerini çalıştırır.
