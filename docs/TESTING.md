# Gerçek iki cihaz kontrolü

Önce migration'ı çalıştırın, anonim girişleri etkinleştirin ve ortam değişkenlerini ayarlayın. İki farklı telefon veya farklı tarayıcı profili kullanın. Aynı profil içindeki sekmeler aynı anonim oyuncudur.

1. A cihazında `İpek` adıyla oda oluşturun; altı karakterli kodu kaydedin.
2. B cihazında `Çağrı` ve kodla katılın. İki cihazda da aynı isimleri ve 2/2 sayısını görün.
3. C profilinden aynı koda katılın: oda dolu hatası alınmalı. C üzerinden tabloları SELECT eden bir authenticated istek odayı veya oyuncuları görmemeli.
4. İki oyuncu sırayla hazır olsun. Durum diğer cihazda yenilemeden değişmeli.
5. B oyun seçememeli. A başka oyun seçtiğinde her iki hazır durumu sıfırlanmalı.
6. Dört oyunun her birini seçip ikisini de hazır yapın. Yalnız oda sahibi oyunu başlatabilmeli. Açık Artırma'da tema, Kelime Avı'nda 5/6 harf modu seçimi iki hazır durumunu sıfırlamalı.
7. B sayfayı yenilesin: aynı kimlikle aynı odaya dönmeli. Ana sayfadaki mevcut oda bağlantısı da çalışmalı.
8. İki oyuncu hazırken B sekmesini kapatın veya B'nin ağını kesin. Son başarılı heartbeat'ten 70 saniye sonra A'da **Çevrimdışı** görünmeli; hazır rozeti kaybolmalı. Son heartbeat kapanıştan önce geldiği için sekmeyi kapattıktan sonra yaklaşık 45–71 saniye sürebilir. A sayfasını yenilemeyin. Üyelik silinmemeli; üçüncü kişi hâlâ oda dolu hatası almalı. Sunucuda `start_game` çağrısı `players_not_ready` ile reddedilmeli. B aynı anonim kimlikle yeniden bağlandığında **Bağlı** görünmeli, yeniden hazır olması istenmeli. B sayfasını yenilemek üyeliği silmemeli. Ağ yokken veri sorguları da başarısız olsa A'daki zaman aşımı ilerlemeli.
9. Oda sahibi A açıkça ayrılsın. B oda sahibi olmalı ve hazır durumu sıfırlanmalı. A'nın aynı odayı doğrudan okuması engellenmeli.
10. B de ayrılsın: oda kapanmalı ve eski kodla katılım reddedilmeli.
11. `/oda/KOD` adresinde tarayıcı yenilemesi Netlify'da 404 üretmemeli.
12. İki farklı profilden son boş yere aynı anda katılmayı deneyin; yalnız biri başarılı olmalı. Aynı kimlikle iki oda oluşturmayı aynı anda deneyin; yalnız bir aktif oda oluşmalı.

Görsel/erişilebilirlik: iPhone Safari ve Android Chrome'da 320, 375, 390, 768 px ve masaüstünde kontrol edin. Yatay taşma, klavye ile odak sırası, dialog Escape/fokus geri dönüşü, hata mesajlarının okunması, isimde Türkçe karakterler ve butonların dokunma hedefleri kontrol edilmelidir. Reduced motion ayarında animasyonlar kapanır. Kopyalama HTTPS gerektirir; desteklenmezse kod elle seçilebilir.

Bu liste manuel entegrasyon planıdır; testlerin tamamlandığına dair bir iddia değildir.

Gizli moddaki bütün pencereler kapatıldığında tarayıcı anonim kimliğin depolamasını da silebilir. Yeni açılan gizli pencere farklı bir oyuncu olur; eski üyeliğe yalnız isim/kod ile geçemez. Yeniden bağlanma testinde aynı kimliği korumak için normal profil, açık kalan ikinci gizli pencere veya ağ kesme yöntemi kullanın.

## Açık Artırma

003 ve 004 migration'larından sonra `npm run test:auction:live` sunucu entegrasyonunu test eder. Gerçek tarayıcılarda ayrıca tema değişimini, diğer oyuncuda aynı ürün/sıranın görünmesini, +1/+2/+5 ve miktar girişini, ilk pasın kapalı olmasını, her teklifte diğer oyuncunun kontrollerinin açılmasını kontrol edin. Maksimum teklifler ve beşer ürüne otomatik dağıtım sonrası her iki bütçe eşit görünmelidir. Sayfayı maçın ortasında yenileyin; ürün, fiyat ve sıra korunmalı. Ağ kesintisi 70 saniyelik heartbeat süresi dolunca iki tarafta hamleleri durdurmalı, aynı kimlikle dönünce devam etmeli. Sonuçta oyları ayrı ayrı verin; ilk oy açık edilmemeli. Rövanş için tek onay yetmemeli; ikinci onaydan sonra aynı temada yeni maç açılmalı. Lobiye dönüş oda üyeliğini korumalı. 320 px ekranda teklif kontrollerini, koleksiyonları ve görsel yükleme hatası yedeğini kontrol edin.

## Üç bulmaca

005–007 uygulandıktan sonra `npm run test:puzzles:live` gerçek sunucuda üç oyunu ve gizliliği test eder. Gerçek telefonlarda ayrıca:

1. Zincirde beş kelime girin; kilitledikten sonra değişmesin. Diğer oyuncuda gizli kelimeler yalnız ilk harf/uzunluk olarak görünsün. Doğru kelime sıradakini açsın. Yanlış tahminde cevap görünmesin. Türkçe I/İ ve Ç/Ğ/Ö/Ş/Ü deneyin.
2. Sayı Dedektifi'nde geçersiz/tekrarlı/sıfır başlayan sayıları deneyin. Sıra dışı buton pasif olsun. Dört doğru rakam farklı sırada olduğunda yalnız eşleşme sayısı gösterilsin. İlk oyuncu bulduğunda ikinci oyuncunun aynı tur hakkı kapanmasın.
3. Kelime Avı'nda 5 ve 6 harf modlarını deneyin. Dokunmatik ve fiziksel klavye, Sil ve Enter çalışsın. Tekrar harfler doğru renklensin; simgeler ve ekran okuyucu etiketleri renkleri açıklasın. Bir oyuncu bitirince diğerinin girişi açık, bitireninki kapalı kalsın. Altıdan fazla tahmin yapılamasın.
4. Her oyunda hazırlık ve tahmin ortasında sayfa yenileyin. Aynı anonim kimlikle maç, kilitli kendi cevap ve ilerleme geri gelsin. Ağ kesilince yeni hamleler dursun. Sonuçtan rövanş temiz hazırlık açsın, lobiye dönüş üyelikleri korusun.
5. 320/375/390 px genişliklerde kelime kutuları ve klavye yatay taşmasın; uzun zincir kelimeleri satıra yayılsın. Mobil klavyenin açılması formu kullanılmaz hale getirmesin. Reduced motion ayarında animasyonlar kapanmalı.

Gizli cevap kontrolü yalnız DOM'a bakılarak yapılmaz: Network RPC yanıtı ve WebSocket mesajı da incelenmelidir. Kendi cevabını döndüren `my_game_secret` yanıtı doğal olarak yalnız kendi cihazında bulunur. Rakibin henüz çözülmeyen cevabı public `game_sessions` veya `get_room_snapshot` içinde görünmemelidir.
