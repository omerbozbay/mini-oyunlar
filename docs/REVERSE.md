# Tersine Konuş!

Beşinci oyun, `reverse`. İki ayrı anonim kimlik aynı odada ve çevrimiçiyken başlar. İlk anlatıcı rastgele seçilir; altı tur boyunca roller değişir. Her oyuncu üç kez anlatıcı olur. Yalnız kayıtların süresi sınırlıdır; tur süresi yoktur.

## Oynama

1. Anlatıcı on kategoriden birini seçer; özel kategorinin adını kendisi yazar. Kendi kelimesini/ismini belirleyip en fazla 10 saniye kaydeder. Kaydını dinleyip göndermeden önce yenileyebilir.
2. **Gönder** kaydı tarayıcıda ters çevirir ve yalnız ters WAV dosyasını yükler. Gizli yazı private tabloda saklanır. Gönderilen kayıt değişmez.
3. Tahminci sesi hazırlar; dosya indirme/çözümleme dinleme hakkını tüketmez. **Tersten Sesi Dinle** kullanıcı etkileşimiyle oynatır. Sunucu başladığını kaydeder, tekrar indirmeyi kapatır. Ses bittiğinde hak kullanılmış olur.
4. Tahminci duyduğunu bir kez kaydeder, **Sesimi Ters Çevir** der. Kendi ters taklidini istediği kadar dinleyip tek tahmin yollar.
5. Anlatıcı **Doğru** veya **Yanlış** seçer. Doğru tahmin tahminciye 1 puan verir. Kelime ve sonuç açıklanır; iki tarafın onayı sonraki turu açar.
6. Altı tur sonunda puanlar, doğru/yanlışlar ve açılabilir sesli tur geçmişi gösterilir. Eşit puan beraberliktir. İki onay rövanş açar; lobiye dönüş üyeliği korur.

## Ses işleme ve telefonlar

`MediaRecorder.isTypeSupported` ile Opus/WebM, AAC/MP4, MP4 ve Ogg seçenekleri çalışma anında denenir; destek bildirilmiyorsa tarayıcının varsayılanı kullanılır. Tek kayıt MIME türü zorlanmaz. Web Audio `decodeAudioData` kaydı PCM örneklerine açar. Her kanalın örnek dizisi ayrı ters çevrilir; kanal sırası ve örnekleme hızı korunur. Sonuç PCM16 WAV olur. Ses dosyasının baytları ters çevrilmez. Codec son paketindeki 10 saniyeyi aşan örnekler kesilir. Sıkıştırılmış orijinalin decode işlemi tarayıcının ses motorunda, dizileri ters çevirme ve WAV üretimi Web Worker'da çalışır; Worker bulunmayan ortamlarda kısa bir görev bırakılarak sınırlı boyut işlenir.

Mikrofon HTTPS veya localhost gerektirir. Telefonla `http://192.168...` adresindeki geliştirme sunucusu mikrofon testi için uygun değildir; HTTPS Netlify adresi kullanın. Oynatma otomatik başlamaz; hazırla/dinle düğmeleri ayrı kullanıcı etkileşimleridir. İzin reddi, mikrofon yokluğu/meşgul olması, bozuk dosya ve desteklenmeyen tarayıcı için Türkçe hata verilir. Kayıtta canlı seviye ve 10 saniyelik otomatik durdurma vardır. Arka plana geçiş veya mikrofonun kesilmesi kaydı iptal edip mikrofonu serbest bırakır.

Güncel iPhone Safari ve Android Chrome için biçim tespiti ve kullanıcı etkileşimiyle AudioContext açma uygulanmıştır. **Fiziksel iPhone/Android, mikrofon kalitesi, Bluetooth, mobil codec çözümlemesi ve gerçek hoparlör çıktısı bu geliştirme ortamında denenmemiştir.** Birim testleri sahte MediaRecorder/AudioContext kullanır; gerçek kayıt donanımı ve işletim sistemi izin ekranlarını doğrulamaz. Tarayıcı otomasyonu erişimi de bu oturumda kullanılamadı.

## Hata kurtarma ve yenileme

- Dinlemeden önce indirme/decode hatası rezervasyonu iptal eder; hak kullanılmaz. Rezervasyon 90 saniye geçerlidir.
- Oynatma başladıktan sonra hata/arka plana geçiş sunucuda `failed` olur. Anlatıcı **Yeniden dinleme izni ver** diyebilir. Böylece tek dinleme kuralı korunurken teknik hata iki kişi tarafından çözülebilir.
- Yenileme `started` durumunu ve özel tokenı geri getirir; sesi tekrar indirmez. Ses zaten tamamlandıysa **Dinlemeyi tamamladım**, kesildiyse hata bildirimi kullanılabilir. Sunucu kayıt süresi geçmeden tamamlamayı kabul etmez.
- Taklit için normal yeniden kaydet düğmesi yoktur. Mikrofon, işleme veya yerel dosya kaybında **Teknik kurtarma** yalnız henüz gönderilmemiş kaydı iptal edip yeni bilet verir. Gönderilmiş taklit değişmez.
- Oda, maç, tur, puanlar ve gönderilmiş sesler sunucudan yüklenir. Gönderilmemiş metin ve özgün sesler yalnız bellektedir; yenilemede kaybolur. Tur sonundaki özgün ses oynatma yalnız kaydı alan cihazın belleğinde mevcutsa gösterilir.
- Mevcut 25 saniye heartbeat / 70 saniye çevrimdışı eşiği korunur. İki oyuncu çevrimiçi olmadan yeni oyun eylemi kabul edilmez. Geri dönünce aynı maç sürer. **Odadan ayrıl** maçı terk edilmiş olarak kapatır; sekme kapanması üyeliği silmez.

## Supabase ve güvenlik

Mevcut 001–007 kurulumuna yalnız `supabase/migrations/202611060008_reverse_audio.sql` bir kez uygulanır. Bu çalışma sırasında kullanıcı uyguladığını bildirdi; gerçek Storage/RPC/Realtime entegrasyonu ardından doğrulandı. Önceki migration'lar tekrar çalıştırılmaz.

`reverse-audio` bucket private, en fazla 2.000.000 bayt, `audio/wav` / `audio/x-wav` kabul eder. Dosya yolu maç/tur/kimlik/bilet içerir. Yalnız sunucunun verdiği bilete sahip kullanıcı yükleyebilir; overwrite politikası yoktur. Commit, sahibi, MIME, süre/kanal/örnekleme sınırları ve kanonik WAV bayt sayısını doğrular. Dosya gövdesini SQL ile decode etmez; kötü niyetli istemcinin bozuk ama eş boyutlu dosyası karşı tarafta decode hatası/kurtarma ile ele alınır.

Gizli kelime, dinleme tokenı ve biletler `private` şemada; doğrudan istemci tablo yetkileri ve Realtime yayını yoktur. `reverse_context` yalnız kişinin kendi gizli verisini ve o anda erişebildiği dosyaları döndürür. Ortak `game_sessions.state` yalnız aşama, puan ve izinli bilgileri taşır; kelime karar verilince açılır. Mevcut üye bazlı RLS korunur. RPC oda→maç kilidi, rol/tur/aşama, mevcut maç, çevrimiçi durum ve UUID istek özeti doğrular. Tek tahmin/karar sürüm kontrolüne tabidir; tekrar aynı isteğin sonucunu döndürür, ikinci kez puan yazmaz.

İstemci imzalı/public URL üretmez; JWT ile `Storage.download` ve RLS kullanır. Her indirmede yeni `cacheNonce` ve `cache: no-store` kullanılarak normal uygulama isteklerinde eski izinli CDN/tarayıcı yanıtı kullanılmaz. Tahminci anlatıcının ters dosyasını yalnız 90 saniyelik rezervasyonda indirebilir; oynatma başladıktan sonra güncel RLS yeni indirmeyi reddeder. Sonuçta ters dosyalar o maçın iki katılımcısına açılır. Taklit öncesinde diğer oyuncuya açılmaz. Orijinal ses **hiç yüklenmez**.

**Güvenlik sınırı:** İndirilen sesin kopyalanmasını, tekrar oynatılmasını veya tekrar ters çevrilerek anlaşılmasını tarayıcıda kesin olarak engellemek mümkün değildir. Bir kullanıcı izinli SELECT sırasında Storage API ile imzalı URL de üretebilir; oluşturulmuş URL süresi boyunca RLS değişikliklerinden bağımsız erişim sağlayabilir. Ayrıca önceki izinli isteğin CDN önbelleği JWT süresi dolana kadar erişim sağlayabilir. Bu davranış canlı testin tekrarında görüldü; cacheNonce/no-store uygulamanın normal yolunu düzeltir, kötü niyetli isteği geri çekme garantisi vermez. [Supabase'in önbellek açıklaması](https://supabase.com/kb/troubleshooting/storage-private-bucket-files-still-accessible-after-remove-access-or-logout). Uygulama imzalı URL üretmez. Tek dinleme, taklit ve teknik hata beyanlarının fiziksel doğruluğu kanıtlanamaz; sunucu yalnız hak/aşama ve tek gönderim garantisi verir. Kaydedilmiş veya belleğe alınmış dosyayı geri çekme garantisi yoktur. Bu, iki kişinin birlikte oynadığı bir oyun için bilinçli sınırdır.

## Saklama ve fiziksel temizlik

Maç bitince/terk edilince ters dosyalar için 24 saatlik son erişim tarihi yazılır; sonra normal JWT/RLS erişimi kapanır. Aktif maçta tur zaman aşımı yoktur. Yedi gündür hiçbir aktif üyesi heartbeat göndermeyen yarım maç dosyaları temizliğe aday olur. Teknik kurtarmayla iptal edilmiş dosyalar hemen adaydır. Bu tarihler fiziksel nesneyi kendiliğinden silmez.

Ücretsiz plan için yerel bilgisayarda Windows Görev Zamanlayıcı veya güvendiğiniz bir sunucuda günlük cron ile şu yönetici aracını çalıştırın:

```powershell
Copy-Item cleanup.env.example .env.cleanup.local # Dosya yoksa
# .env.cleanup.local içine proje URL'sini ve service_role anahtarını yerelde yazın.
npm run cleanup:audio                         # Yalnız uygun ilk 100 dosyanın sayısı
npm run cleanup:audio -- --delete             # Süresi dolmuş dosyaları siler
```

Anahtar `SUPABASE_SERVICE_ROLE_KEY` olarak yalnız yönetici ortamındadır; `VITE_` alanına, tarayıcıya, repo'ya veya sohbete yazmayın. `.env.cleanup.local` zaten Git tarafından dışlanır. `cleanup.env.example` yalnız yer tutucu içerir. Temizlik RPC'leri yalnız `service_role` için açıktır. Araç 100'lük gruplarla en fazla 10.000 dosya çalıştırır; daha fazlası varsa sonraki görev tamamlar. Önce Storage API `.remove` fiziksel nesneyi siler, ardından private metadata onaylanır. **Doğrudan SQL ile `storage.objects` silmeyin**; depolanan dosyayı yetim bırakabilir. Hata durumunda metadata korunur ve sonraki çalıştırma tekrar dener. Bu oturumda yönetici anahtarı alınmadı, fiziksel temizlik/zamanlanmış görev kurulmadı.

## Testler

`npm test` mevcut dört oyunun testleriyle birlikte PCM, kayıt izin/hata/10 saniye/arka plan, tek oynatma/kurtarma, arayüz, PostgreSQL rol/aşama/puan/altı tur/beraberlik/rövanş ve Storage RLS/retention testlerini çalıştırır. Yerel Storage şeması platformun metadata/RLS davranışını taklit eder; gerçek HTTP nesne deposu değildir.

`npm run test:reverse:live` gerçek Supabase'de üç anonim kimlik, Storage yükle/indir, yetkisiz erişim, Realtime gizlilik, yenileme/dinleme hakkı, 72 saniye bağlantı kesintisi, altı tur/puan/rol ve rövanş kontrolü yapar. Kaynak ses sentetik PCM'dir; mikrofondan kayıt değildir. Test bitince üyelikler kapatılır; küçük ters WAV dosyaları normal retention/temizlik sürecine bırakılır. Gerçek telefon test adımları [TESTING.md](TESTING.md) içindedir.

Kaynaklar: [MediaRecorder biçim tespiti](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [getUserMedia güvenli bağlam](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [özel dosya indirme](https://supabase.com/docs/guides/storage/serving/downloads).
