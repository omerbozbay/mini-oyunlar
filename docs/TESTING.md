# Gerçek iki cihaz kontrolü

Önce migration'ı çalıştırın, anonim girişleri etkinleştirin ve ortam değişkenlerini ayarlayın. İki farklı telefon veya farklı tarayıcı profili kullanın. Aynı profil içindeki sekmeler aynı anonim oyuncudur.

1. A cihazında `İpek` adıyla oda oluşturun; altı karakterli kodu kaydedin.
2. B cihazında `Çağrı` ve kodla katılın. İki cihazda da aynı isimleri ve 2/2 sayısını görün.
3. C profilinden aynı koda katılın: oda dolu hatası alınmalı. C üzerinden tabloları SELECT eden bir authenticated istek odayı veya oyuncuları görmemeli.
4. İki oyuncu sırayla hazır olsun. Durum diğer cihazda yenilemeden değişmeli.
5. B oyun seçememeli. A başka oyun seçtiğinde her iki hazır durumu sıfırlanmalı.
6. İkisi de hazır olsa oyun düğmesi 'yakında' kalmalı. Sunucu `start_game` çağrısını da reddetmeli.
7. B sayfayı yenilesin: aynı kimlikle aynı odaya dönmeli. Ana sayfadaki mevcut oda bağlantısı da çalışmalı.
8. B'nin ağını kesin; yaklaşık 70–85 saniye içinde A'da bağlantı bekleniyor görünmeli. Üyelik silinmemeli. B yeniden ağa bağlandığında durum toparlanmalı.
9. Oda sahibi A açıkça ayrılsın. B oda sahibi olmalı ve hazır durumu sıfırlanmalı. A'nın aynı odayı doğrudan okuması engellenmeli.
10. B de ayrılsın: oda kapanmalı ve eski kodla katılım reddedilmeli.
11. `/oda/KOD` adresinde tarayıcı yenilemesi Netlify'da 404 üretmemeli.
12. İki farklı profilden son boş yere aynı anda katılmayı deneyin; yalnız biri başarılı olmalı. Aynı kimlikle iki oda oluşturmayı aynı anda deneyin; yalnız bir aktif oda oluşmalı.

Görsel/erişilebilirlik: iPhone Safari ve Android Chrome'da 320, 375, 390, 768 px ve masaüstünde kontrol edin. Yatay taşma, klavye ile odak sırası, dialog Escape/fokus geri dönüşü, hata mesajlarının okunması, isimde Türkçe karakterler ve butonların dokunma hedefleri kontrol edilmelidir. Reduced motion ayarında animasyonlar kapanır. Kopyalama HTTPS gerektirir; desteklenmezse kod elle seçilebilir.

Bu liste manuel entegrasyon planıdır; testlerin tamamlandığına dair bir iddia değildir.
