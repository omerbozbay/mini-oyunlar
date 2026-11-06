# Üç gizli cevap oyunu

Kelime Zinciri, Sayı Dedektifi ve Kelime Avı mevcut iki kişilik odayı, anonim kimliği, hazır olmayı, Realtime'ı ve heartbeat sistemini kullanır. Açık Artırma motoru korunur. Yapay zekâ veya sözlük API'si yoktur.

## Kurulum

001–004 migration'ları çalışan projede SQL Editor'de aşağıdaki dosyaların tamamını sırasıyla birer kez çalıştırın:

1. `202611060005_chain.sql`: ortak gizli cevap altyapısı ve Kelime Zinciri.
2. `202611060006_detective.sql`: Sayı Dedektifi.
3. `202611060007_wordhunt.sql`: Kelime Avı ve 5/6 harf modu.

Önceki başarılı migration'ları tekrar çalıştırmayın. Bu geliştirme oturumunda bu üç dosyayı kullanıcı SQL Editor üzerinden uyguladı; ardından gerçek Supabase testleri yapıldı. Kod tarafından Dashboard/DDL erişimiyle otomatik uygulama yapılmadı. Mevcut `game_sessions` publication'ı bütün oyunları taşır; yeni bir public tablo veya Realtime ayarı gerekmez.

## Oynama

Oda sahibi beş oyundan birini seçer. Kelime Avı'nda ayrıca 5 veya 6 harf modunu seçer; seçim değiştirilirse iki lobi hazır durumu da sıfırlanır. İki oyuncu hazır ve çevrimiçiyken oda sahibi başlatır. Bulmaca oyunları önce ayrı bir gizli hazırlık aşamasına geçer. Herkes kendi cevabını kilitler; ikinci hazırlık tamamlandığında tahmin başlar.

### Kelime Zinciri

Her oyuncu beş kelime girer. Her kelime 2–40 Türkçe harften oluşur. Anlamsal bağlantıların doğruluğu oyunculara aittir. Rakibin ilk kelimesi tamamen, diğerlerinin yalnız ilk harfi ve uzunluğu görünür. İkinci kelimeden itibaren sırayla çözülür. İki kişi bağımsız olarak aynı anda tahmin edebilir. Yanlış hak ve süre sınırı yoktur. Yanlış tahminde cevap açılmaz. Görünür geçmiş yalnız son 50 tahmini tutar; toplam sayaç ve tahmin hakkı sınırsızdır.

Rakibinin dört gizli kelimesini sunucuda ilk tamamlayan kazanır. Aynı anda son kelime gönderildiğinde oda/maç kilidini alıp ilk geçerli tamamlamayı yapan işlem kazanır; ikinci istek bitmiş maçı değiştiremez. Oyun sonunda iki zincir tamamen açılır.

### Sayı Dedektifi

Tam dört ASCII rakam; ilk rakam 1–9, bütün rakamlar farklı. Başlangıç oyuncusu rastgeledir ve oyuncular sırayla tahmin eder. Sistem yalnız sayı içinde bulunan rakam adedini gösterir; konum bilgisi verilmez. `1234` hedefinde `4321` dört doğru rakam verir ama kazandırmaz; tam eşitlik gerekir.

Her turda iki oyuncuya birer tahmin düşer. Turun ilk oyuncusu bulursa ikinci oyuncunun o turdaki son tahmini beklenir. İki doğru aynı turdaysa beraberlik, yalnız biri doğruysa o oyuncu kazanır. İkinci oyuncunun bulduğu turda zaten ilk oyuncu hakkını kullanmıştır; sonuç hemen kesinleşir. Tahmin/süre sınırı yoktur, bütün tahmin geçmişi saklanır. Oyun sonunda iki gizli sayı açılır.

### Kelime Avı

İki oyuncu aynı uzunlukta, 5 veya 6 Türkçe harfli birer kelime seçer. Harf/uzunluk kontrolü yapılır; anlam/sözlük kontrolü yoktur. İki oyuncu bağımsız olarak altışar tahmin yapabilir. Harfler önce doğru konumlar (yeşil), sonra kalan hedef harf sayıları (sarı) tüketilerek değerlendirilir. Kalan eşleşmeyen veya fazla harfler gridir. Tekrarlanan harfler birden fazla sarıya dönüşemez.

Bir oyuncu bulduğunda veya altı hakkını tamamladığında diğerinin bitirmesi beklenir; cevaplar henüz açılmaz. İkisi bulursa az tahmin kazandırır; eşit tahmin beraberliktir. Bir kişi bulursa o kazanır, ikisi de bulamazsa beraberliktir. Sonuçta iki kelime ve iki tahmin tablosu açılır.

Ekran klavyesinde 29 Türkçe harf, Sil ve Enter vardır. Fiziksel klavye de çalışır. `I` ve `İ` ayrıdır. Durumlar yalnız renkle anlatılmaz: kutularda ✓ / ↔ / − işaretleri, metin açıklaması ve ekran okuyucu etiketleri bulunur. Harf renklerinde beyaz metinle yüksek kontrast kullanılır. Küçük ekranlarda tuşlar daha fazla satıra geçer; harfler küçültülerek yatay taşma oluşturulmaz.

## Ortak devam ve rövanş

70 saniyelik heartbeat lease'i dolan oyuncu çevrimdışı sayılır; yeni hazırlık/tahmin/rövanş işlemi iki kişi de çevrimiçi olana kadar reddedilir. Üyelik ve maç silinmez. Aynı anonim kimlikle sayfa yenilemek maçı geri getirir; kilitlenmiş kendi cevabı yalnız kendisine özel RPC'den yüklenir. Bütün gizli pencereler kapanınca kimliğin silinebileceği tarayıcı kısıtlaması devam eder.

Sonuçtan rövanş iki oyuncunun onayını ister, aynı oyunda yeni hazırlık açar ve Kelime Avı'nın harf modunu korur. Önceki cevabı veya geçmişi yeni maça kopyalamaz. Lobiye dönüş üyeliği korur ve lobi hazır durumlarını sıfırlar. Hazırlık veya tahmin ortasında açık “Odadan ayrıl” maçı terk edilmiş yapar; ağ kopması bunu yapmaz.

## Güvenlik ve senkronizasyon

- `public.game_sessions.state` yalnız oyuncu bilgileri, hazırlık işaretleri, izinli ipuçları, tahminler ve değerlendirmeler içerir. `reveals` yalnız sonuç kesinleşince eklenir. Kullanıcının girdiği kendi tahmininin doğru çıkması doğal olarak kendisine geri bildirilir; henüz çözülmeyen cevap public kayda girmez.
- `private.puzzle_secrets` ve `private.puzzle_requests` üzerinde RLS açık, istemci grant'i yoktur; bu tablolar Realtime'a dahil değildir. `my_game_secret(session_id)` yalnız JWT'deki oyuncunun kendi kaydını döndürür. Rakip oyuncu kimliği parametresi almaz. İstemci, başka birisinin cevabını SELECT veya RPC ile isteyemez.
- `puzzle_action` kimlik, üyelik, maç katılımcılığı, güncel maç kimliği, evre ve çevrimiçi durumu sunucuda doğrular. Her işlem önce oda, sonra maç satırını kilitler.
- Bağımsız kelime tahminlerinde oyuncu başına `revision`, Sayı Dedektifi'nde buna ek olarak maç `version` ve sıra doğrulanır. Böylece aynı anda iki kişinin bağımsız hamlesi kabul edilirken aynı kişinin çakışan iki hamlesi kabul edilmez.
- UUID ve istek özeti tekrarları tek işleme indirir. Ağ sonucu belirsizse arayüz aynı UUID'yle tekrar dener. Eski maç kimliğiyle yeni maça müdahale edilemez.
- Açık Artırma'nın mevcut uygulaması korunur; dışarıdaki `auction_action` sarmalayıcısı yalnız auction türünü kabul eder. Eski uygulama fonksiyonuna doğrudan istemci execute izni verilmez.
- Bütün oyunlar mevcut RLS korumalı `game_sessions` Realtime aboneliği ve 15 saniyelik sorgu yedeğini kullanır. Kanal açılışında gerçek PostgreSQL aboneliği onayı beklenir.

## Test etme

```powershell
npm test
npm run build
npm run test:puzzles:live
npm run test:auction:live
```

Canlı testler ayrı anonim test hesapları ve yeni test odaları oluşturur; yalnız bu oturumları kullanır. En az 72 saniyelik gerçek zaman aşımı bekler. Test üyelikleri sonunda kapatılır; Auth test hesapları ve kapanmış oda/maç geçmişi kalabilir. Tokenlar dosyaya veya çıktıya yazılmaz. Gerçek iPhone/Android tarayıcı görüntüsü ve dokunmatik kullanımı için ayrıca [manuel plan](TESTING.md) uygulanmalıdır.
