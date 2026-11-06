# Gerçek iki cihaz kontrolü

Önce migration'ı çalıştırın, anonim girişleri etkinleştirin ve ortam değişkenlerini ayarlayın. İki farklı telefon veya farklı tarayıcı profili kullanın. Aynı profil içindeki sekmeler aynı anonim oyuncudur.

1. A cihazında `İpek` adıyla oda oluşturun; altı karakterli kodu kaydedin.
2. B cihazında `Çağrı` ve kodla katılın. İki cihazda da aynı isimleri ve 2/2 sayısını görün.
3. C profilinden aynı koda katılın: oda dolu hatası alınmalı. C üzerinden tabloları SELECT eden bir authenticated istek odayı veya oyuncuları görmemeli.
4. İki oyuncu sırayla hazır olsun. Durum diğer cihazda yenilemeden değişmeli.
5. B oyun seçememeli. A başka oyun seçtiğinde her iki hazır durumu sıfırlanmalı.
6. İkisi de hazır olsa oyun düğmesi 'yakında' kalmalı. Sunucu `start_game` çağrısını da reddetmeli.
7. B sayfayı yenilesin: aynı kimlikle aynı odaya dönmeli. Ana sayfadaki mevcut oda bağlantısı da çalışmalı.
8. İki oyuncu hazırken B sekmesini kapatın veya B'nin ağını kesin. Son başarılı heartbeat'ten 70 saniye sonra A'da **Çevrimdışı** görünmeli; hazır rozeti kaybolmalı. Son heartbeat kapanıştan önce geldiği için sekmeyi kapattıktan sonra yaklaşık 45–71 saniye sürebilir. A sayfasını yenilemeyin. Üyelik silinmemeli; üçüncü kişi hâlâ oda dolu hatası almalı. Sunucuda `start_game` çağrısı `players_not_ready` ile reddedilmeli. B aynı anonim kimlikle yeniden bağlandığında **Bağlı** görünmeli, yeniden hazır olması istenmeli. B sayfasını yenilemek üyeliği silmemeli. Ağ yokken veri sorguları da başarısız olsa A'daki zaman aşımı ilerlemeli.
9. Oda sahibi A açıkça ayrılsın. B oda sahibi olmalı ve hazır durumu sıfırlanmalı. A'nın aynı odayı doğrudan okuması engellenmeli.
10. B de ayrılsın: oda kapanmalı ve eski kodla katılım reddedilmeli.
11. `/oda/KOD` adresinde tarayıcı yenilemesi Netlify'da 404 üretmemeli.
12. İki farklı profilden son boş yere aynı anda katılmayı deneyin; yalnız biri başarılı olmalı. Aynı kimlikle iki oda oluşturmayı aynı anda deneyin; yalnız bir aktif oda oluşmalı.

Görsel/erişilebilirlik: iPhone Safari ve Android Chrome'da 320, 375, 390, 768 px ve masaüstünde kontrol edin. Yatay taşma, klavye ile odak sırası, dialog Escape/fokus geri dönüşü, hata mesajlarının okunması, isimde Türkçe karakterler ve butonların dokunma hedefleri kontrol edilmelidir. Reduced motion ayarında animasyonlar kapanır. Kopyalama HTTPS gerektirir; desteklenmezse kod elle seçilebilir.

Bu liste manuel entegrasyon planıdır; testlerin tamamlandığına dair bir iddia değildir.

Gizli moddaki bütün pencereler kapatıldığında tarayıcı anonim kimliğin depolamasını da silebilir. Yeni açılan gizli pencere farklı bir oyuncu olur; eski üyeliğe yalnız isim/kod ile geçemez. Yeniden bağlanma testinde aynı kimliği korumak için normal profil, açık kalan ikinci gizli pencere veya ağ kesme yöntemi kullanın.
