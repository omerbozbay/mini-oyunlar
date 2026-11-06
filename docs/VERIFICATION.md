# Doğrulama raporu — 6 Kasım 2026

- `npm run build`: TypeScript kontrolü ve Vite üretim derlemesi başarılı.
- `npm test`: Dört oyunla birlikte **14 dosyada 103 test** başarılı. PostgreSQL migration/RLS/RPC, giriş kuralları, sayfa render durumları, bağlantı yaşam döngüsü, dört oyun motoru, katalog ve oyun arayüzleri kapsanıyor.
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

Netlify hesabında yayın yapılmadı; yapılandırma hazırlandı. Dört oyun motoru geliştirildi. İlk sürüm kayıtlarında geçen `game_not_available` kontrolleri o sürümlerin tarihsel sonuçlarıdır; güncel dört oyun da başlatılabilir.

## Bağlantı durumu düzeltmesi

İlk mekanizma son görülmeyi telefonun `Date.now()` saatiyle karşılaştırıyor ve hazır rozetini bu sonuca göre kapatmıyordu. Artık oda görüntüsü sunucu zamanıyla alınır, monoton istemci sayacıyla saniyede bir ilerletilir. Görünüm/CSS korunmuş, çevrimdışı etiket ve hazır hesaplaması düzeltilmiştir.

Kullanıcı `202611060002_presence_lease.sql` dosyasını SQL Editor'de çalıştırdı ve başarı bildirdi. Ardından yeni RPC gerçek Supabase üzerinde doğrulandı. Bu migration bu çalışma tarafından uzaktan DDL erişimiyle çalıştırılmadı.

Yeni 12 otomatik regresyon testi: 70 saniye sınırı, yerel saat farkı, bozuk/eksik zaman, tüm ağ istekleri başarısızken sürenin dolması, WebSocket sonrası geri dönüş, timer/abonelik temizliği, online olayında hemen heartbeat, snapshot RLS, eski hazır bayrağı temizliği, kapasite korunması, çevrimdışı hazır olma engeli ve aynı kimlikle tekrar katılma. Hook testleri Happy DOM ve sahte zamanlayıcıyla React üzerinde çalışır; gerçek telefon tarayıcısının yerine geçmez.

Gerçek Supabase üzerinde ek 14 kontrol geçti. Bir test oyuncusunun heartbeat'i 72 saniye durduruldu; diğer oyuncu heartbeat göndermeye devam etti. Süresi dolan oyuncu üye kaldı, hazır olma ve oyun başlatma reddedildi, eski hazır bayrağı temizlendi ve UPDATE gerçek WebSocket'ten alındı. Üçüncü kimlik oda dolu hatası aldı. Aynı kimlik yeniden heartbeat gönderince çevrimiçi/hazır değil durumuna döndü, açıkça yeniden hazır olabildi. `current_room` üyeliği korudu; açık ayrılma oyuncuyu çıkardı. Sonunda test üyelikleri kapatıldı. Anonim test hesapları ve kapalı oda geçmişi sunucuda kalabilir.

## Açık Artırma eklenmesi

57 otomatik test geçti. Dokuz temanın her biri yerel PostgreSQL'de farklı teklif stratejileriyle oynatıldı; bütçe rezervi, sıra, otomatik pas, beşer ürün, on benzersiz ürün ve pozitif bütçeler doğrulandı. Aynı istek kimliğiyle tekrar, eski sürüm, sıra dışı işlem, ilk pas, bütçe aşımı, maçta tema değişimi, gizli oylar, gerçek kazanan kimliği, beraberlik, iki onaylı rövanş, lobiye dönüş, açık ayrılma ve RLS retleri test edildi. Hook testinde mevcut sorgu sürerken gelen Realtime olayının sonradan yeniden sorgulandığı da doğrulandı. HTTP yerel ağ önizlemesinde `crypto.randomUUID` bulunmadığında güvenli UUID yedeği test edildi.

React DOM testlerinde teklif/+5 kontrolü, maksimum fiyat, sırası olmayanın ve çevrimdışı oyuncunun butonları, aynı UUID ile ağ hatası tekrarı, oy kimliği, rövanş/lobi butonları, dokuz tema ve görsel hata yedeği geçti. 144 yerel SVG dosyasının varlığı, dokuz havuzun boyutu ve sunucu/istemci katalog eşitliği test edildi. SVG'ler yerel olarak kontrol sayfalarına rasterize edilip incelendi; hayvan ve deneyim çizimleri ayırt edilebilir olacak şekilde düzeltildi. Bu varlık incelemesi web sayfasının tarayıcıda görsel doğrulaması değildir.

Kullanıcı 003/004 migration'larını SQL Editor'de uyguladığını bildirdi. Ardından `npm run test:auction:live` gerçek Supabase üzerinde **19 kontrolle başarılı** tamamlandı. Üç ayrı anonim test kimliği kullanıldı; iki oyuncu iki tam maç oynadı. Tema senkronizasyonu, on benzersiz ürün, üçüncü kişinin RLS ile engellenmesi, doğrudan durum yazma reddi, aynı sürümle eşzamanlı tekliflerden yalnız geçerli olanın kabulü ve istek tekrarının etkisizliği doğrulandı. Teklif olayı gerçek WebSocket üzerinden alındı. Aynı Auth oturumu yeni bir istemciye yüklendiğinde mevcut maç geri geldi.

İkinci oyuncunun heartbeat'i 72 saniye durdurulduğunda sunucu teklifleri `players_offline` ile reddetti. Heartbeat geri geldiğinde aynı maç sürdü. On ürün beşer dağıtıldı; bütçe toplamları doğru kaldı. İlk oy gizli kaldı, iki aynı UUID aynı kazananı üretti. Tek rövanş onayı yetmedi; ikinci onaydan sonra aynı temada yeni bütçe ve rastgele ürünlerle maç açıldı. İkinci maçta iki farklı kazanan tercihi beraberlik oldu. Lobiye dönüş iki üyeliği korudu ve hazır durumlarını sıfırladı. Test sonunda üyelikler açık ayrılmayla kapatıldı; anonim Auth test hesapları ve kapalı maç/oda geçmişi kalabilir.

İlk canlı deneme kanal açıldıktan hemen sonra yapılan teklifin WebSocket olayını alamadı. SDK'nın `SUBSCRIBED` bildirimi varsayılan olarak PostgreSQL değişiklik aboneliğinden önce gelebiliyor. Uygulamaya ve canlı teste `postgres_changes_options.wait: true` eklendi; gerçek abonelik onayını bekleyen sonraki tam test geçti. Bu istemci düzeltmesi ek SQL gerektirmiyor. Düzeltmeden sonra 57 otomatik test, TypeScript ve üretim derlemesi yeniden geçti. Gerçek iPhone/Android görsel kontrolleri hâlâ ayrıca yapılmalıdır.

## Üç bulmaca oyununun eklenmesi

İstenen sırayla Kelime Zinciri geliştirilip 7 sunucu + 4 arayüz kontrolüyle doğrulandı. Ardından Sayı Dedektifi eklendi; ilk iki oyun ve arayüzler birlikte 21 testten geçti. Son olarak Kelime Avı, Türkçe klavye ve ortak lobi bağlantısı tamamlandı. Son tam koşuda **103 otomatik test**, TypeScript kontrolü ve üretim derlemesi başarılı; üretim bağımlılığı denetimi bilinen açık bildirmedi.

Kullanıcı 005, 006 ve 007 migration'larını SQL Editor'de uyguladığını bildirdi. Yeni RPC'ler gerçek Supabase üzerinde doğrulandı; bu çalışma uzaktan DDL yetkisi kullanarak migration uygulamadı. `npm run test:puzzles:live` **31 kontrolle** başarılı tamamlandı:

- Gizli cevaplar tek hazırlıkta, ortak maç görüntüsünde ve erken WebSocket mesajlarında açılmadı. Kendi cevap RPC'si çalıştı; rakip ve üçüncü kimlik bu cevabı okuyamadı. Public maç RLS'si üçüncü kimliği dışladı.
- Yanlış zincir tahmini ipucu açmadı. İki oyuncunun aynı eski global sürümde bağımsız tahminleri kabul edildi; aynı UUID tekrarında ilerleme yinelenmedi. Aynı kimliği yeni istemciye yüklemek maç ve ilerlemeyi korudu.
- İkinci oyuncunun heartbeat'i 72 saniye durduruldu; ilerleme sunucuda reddedildi. Geri dönüşte aynı maç sürdü.
- Zincir sonunda cevaplar açıldı, rövanş temiz hazırlık başlattı. Eski maç isteği yeni maçı etkileyemedi. İki oyuncunun son cevabı aynı anda gönderdiği gerçek yarışta yalnız ilk kabul edilen tamamlanma kazandı. Lobiye dönüş iki üyeliği korudu.
- Sayı Dedektifi'nde `4321`/`1234` gibi dört rakam eşleşmesi tam sayı farklıyken kazandırmadı; sıra dışı hamle reddedildi. İlk bulan diğer oyuncunun aynı turdaki son hakkını korudu; aynı turda iki bulma beraberlik verdi. Rövanş temiz sayı hazırlığı açtı.
- Kelime Avı'nda 5/6 modları, YORGAN/KALECİ değerlendirmesi, tekrar harfler, ilk bitirenin diğerini beklemesi ve az tahminle kazanma doğrulandı. İki oyuncu altı hakta bulamayınca beraberlik oluştu; yedinci tahmin reddedildi. Rövanş modu koruyup geçmişi sildi.

Ardından `npm run test:auction:live` **19 kontrolle tekrar geçti**: yeni migration'lar sonrasında mevcut Açık Artırma'nın eşzamanlı teklif, idempotency, WebSocket, 72 saniyelik duraklama/dönüş, gizli oy, iki tam maç, rövanş ve lobiye dönüş davranışı korundu. Böylece son doğrulamada toplam **50 gerçek Supabase kontrolü** geçti.

React DOM testleri Türkçe ekran ve fiziksel klavyeyi, Sil/Enter, 29 harfi, altı harf sayacını, renkli harf kutularının erişilebilir etiketlerini, bekleme/çevrimdışı durumlarını, aynı UUID ile ağ hatası tekrarını ve dört oyunun lobi üzerinden doğru bileşene yönlenmesini doğruladı. Yerel testler 55 yanlış zincir tahmini ve altıdan fazla sayı tahminiyle bu iki oyunun sınırsız hakkını da doğruladı.

Tarayıcı otomasyon sunucusu yine erişilemez durumdaydı. Happy DOM ve sunucu tarafı render testleri gerçek iPhone/Android görüntüsü, dokunmatik kullanım veya yatay taşma kontrolünün yerine geçmez. Bu görsel QA ve Netlify yayını ayrıca yapılmalıdır. Canlı testler yalnız kendi yeni test odalarını kullandı, sonunda üyelikleri kapattı; anonim test kullanıcıları ve kapanmış maç geçmişi kalabilir. Tokenlar Git'e veya test çıktısına yazılmadı.
