# Oyun Kuralları

Beş oyun da oynanabilir olarak geliştirilmiştir. Kurulum ve ayrıntılı kurallar: [Açık Artırma](AUCTION.md) · [Kelime Zinciri, Sayı Dedektifi ve Kelime Avı](PUZZLES.md) · [Tersine Konuş!](REVERSE.md).

### OYUN 1 — AÇIK ARTIRMA

Kişi başına 20 TL ile temadan rastgele seçilmiş 10 ürün sırayla açık artırmaya çıkar. Ürün sayısı sınırı yoktur; 7–3 veya 10–0 olabilir. İki bütçe de pozitifken sıra tabanlı teklif verilir; üst sınır kalan bütçedir, teklif en az 1 TL artırılır. İlk tekliften önce pas yoktur. Teklif varken pas ürünü son teklif sahibine verir. Sonraki ürünler otomatik tahsis edilmez; on ürünün tamamı gösterilir.

Bir oyuncunun bütçesi sıfıra düşerse normal ihale biter. Parası kalan oyuncu sıradaki her ürünü **ücretsiz kendine alır veya ücretsiz arkadaşına verir**; hiçbir bütçeden para kesilmez. Her ürün bir koleksiyona gider, ürün alınmadan geçilmez. Eski bir maçtan iki bütçenin de sıfır olduğu bir durum kalmışsa o ürünün açılış sırasındaki oyuncu ücretsiz dağıtımı seçer.

Oyuncu kendi ürünlerini açık artırma ve son düzenleme aşamasında hediye edebilir; bütçe iadesi yoktur. On ürün bittikten sonra iki oyuncu koleksiyonunu onaylar. Hediye onayları sıfırlar. İki onaydan sonra koleksiyonlar kilitlenip gizli oylama açılır; aynı kazananı seçerlerse o kazanır, anlaşamazlarsa beraberliktir. Rövanş iki onay ister.

17 tema, 312 seçenek: pizza, hamburger, pasta, kahvaltı, makarna, tatlı, hayvan, tatil, ev, süper kahraman, yemek, gün tabağı, dizi, hayatta kalma, tarihî komutan, ülke ve süper güç. [Kurulum ve ayrıntılar](AUCTION.md).

### OYUN 2 — KELİME ZİNCİRİ

Her oyuncu beş kelimelik zincir hazırlar.

Örnek:
Elma → Ağacı → Yaprağı → Sarması → Tatlısı

İlk kelime tamamen görünür.

Diğer kelimelerin ilk harfi ve harf sayısı görünür.

Oyuncular birbirlerinin zincirlerini tahmin eder.

Kelimeler sırayla çözülür.

Yanlış tahmin hakkı sınırsızdır.

Süre sınırı yoktur.

İlk tamamlayan kazanır.

İki zincir kilitlenmeden tahmin başlayamaz. Her kelime 2–40 Türkçe harftir; anlam kontrolü oyunculara aittir. Büyük/küçük harf, Türkçe I/İ, NFC ve kenar boşlukları normalleştirilir. Aynı anda son kelime bulunursa sunucunun kabul ettiği ilk tamamlanma kazanır. İki zincir yalnız oyun sonunda tamamen açılır. Haklar sınırsızdır; görünür geçmiş son 50 kaydı ve toplam sayacı tutar.

### OYUN 3 — SAYI DEDEKTİFİ

İki oyuncu dört haneli gizli sayı belirler.

Rakamlar tekrarlanmaz.

İlk rakam sıfır olamaz.

Oyuncular sırayla rakibinin sayısını tahmin eder.

Sistem doğru rakam sayısını gösterir.

Tahminler kayıt altında tutulur.

İlk bulan kazanır.

İki oyuncu aynı turda bulursa beraberlik olur.

Dört doğru rakam, sayı farklı sıradaysa kazandırmaz; tam eşitlik gerekir. Konum ipucu verilmez. Başlangıç oyuncusu rastgeledir. Turun ilk oyuncusu doğru bulursa rakibinin aynı turdaki son tahmini beklenir. İki gizli sayı ancak tur sonucu kesinleşince açılır. Tahmin ve süre sınırı yoktur; geçmişin tamamı korunur.

### OYUN 4 — KELİME AVI

Wordle benzeri Türkçe kelime tahmin oyunu.

Oyuncular birbirleri için 5 veya 6 harfli kelime belirler.

Her oyuncunun altı tahmin hakkı vardır.

Yeşil: doğru harf, doğru konum.

Sarı: doğru harf, yanlış konum.

Gri: kelimede bulunmayan veya fazla kullanılan harf.

Türkçe karakterler doğru işlenir.

Tekrarlanan harfler Wordle mantığıyla değerlendirilir.

Daha az tahminde bulan kazanır.

Eşit sayıda tahminle bulan oyuncular berabere kalır.

Harf modunu oda sahibi maç başlamadan seçer. İki hazırlık tamamlanmadan tahmin yapılamaz. Tekrarlı harflerde önce yeşiller, ardından kalan harf sayıları tüketilerek sarılar hesaplanır. Sözlük API'si yoktur; yalnız uzunluk ve Türkçe harf doğrulanır. Bir oyuncu bulduğunda veya altı hakkı bittiğinde diğer oyuncunun sonucu beklenir. Yalnız biri bulursa o kazanır, ikisi de bulamazsa beraberliktir. Cevaplar iki oyuncu da bitirince açılır. Türkçe ekran ve fiziksel klavye desteklenir.

Üç oyunda da iki oyuncu çevrimiçi değilse ilerleme durur; aynı kimlikle geri dönüldüğünde aynı maç devam eder. Rövanş iki tarafın onayıyla temiz hazırlık açar. Lobiye dönüş üyelikleri koruyup lobi hazır durumlarını sıfırlar. Yeni maç eski isteklerden etkilenmez.

## Tersine Konuş!

Altı turda roller sırayla değişir; herkes üç kez anlatıcı olur. Anlatıcı kategorisini ve kelimesini kendi seçer, en fazla 10 saniye kaydeder. Yalnız ters ses paylaşılır. Tahminci bir kez dinleyip tek taklit kaydı yapar; ters çevrilmiş kendi taklidini sınırsız dinleyip tek tahmin gönderir. Anlatıcı doğru derse tahminci 1 puan alır. Tur sonunda kelime açıklanır; iki onay sonraki turu açar. Altı tur sonunda yüksek puan kazanır; eşitlik beraberliktir. Teknik ses hataları için kurtarma, sonuçtan rövanş ve lobi vardır. [Tüm akış ve sınırlar](REVERSE.md).
