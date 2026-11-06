# Oyun Kuralları

Dört oyun da oynanabilir olarak geliştirilmiştir. Kurulum ve ayrıntılı kurallar: [Açık Artırma](AUCTION.md) · [Kelime Zinciri, Sayı Dedektifi ve Kelime Avı](PUZZLES.md).

### OYUN 1 — AÇIK ARTIRMA

İki oyuncuya 20 TL verilir.

Toplam 10 ürün sırayla açık artırmaya çıkar.

Her oyuncu 5 ürün toplar.

Teklifler sıra tabanlıdır. Aynı anda iki oyuncu teklif veremez.

Sırası gelen oyuncu en az 1 TL artırır veya pas geçer.

Pas geçen oyuncu mevcut ürünün açık artırmasına geri dönemez.

Ürün son geçerli teklif sahibine verilir.

Her oyuncunun kalan ürünleri satın alabilmek için yeterli bütçesi korunur.

Her oyuncu beş ürün toplamalıdır.

Yeni ürünün açılış hakkı oyuncular arasında dönüşümlü verilir.

İki oyuncu da ürünlerini tamamlayınca kombinasyonlar yan yana gösterilir.

Kazananı oyuncular belirler. Aynı kişiye oy verirlerse o kazanır, anlaşamazlarsa beraberlik olur.

Oyun temaları:

- En iyi pizza
- En iyi hamburger
- En güzel pasta
- En iyi kahvaltı sofrası
- En iyi makarna
- En güzel tatlı tabağı
- En güçlü hayvan ordusu
- Hayalindeki tatil
- Hayalindeki ev

Her temanın kendine özgü ürünleri, açıklamaları ve kaliteli görselleri olacak.

Oynanabilir sürümde dokuz havuzun her birinde 16 ürün vardır. Sunucu her maçta bunlardan 10 farklı ürün seçip sırasını sabitler. Açılış 1 TL'dir; ilk teklif öncesi pas geçilemez. Üst sınır `bütçe - (4 - alınan ürün sayısı)` olarak hesaplanır. Rakip mevcut teklifi artıramıyorsa ürün otomatik olarak son teklif sahibine verilir. Beş ürünü tamamlayan oyuncu sonraki ürünlere girmez; kalanlar diğer oyuncuya 1'er TL'den otomatik tahsis edilir.

İlk açılış oyuncusu rastgele, sonraki ürünlerde dönüşümlüdür. İki oyuncu çevrimiçi değilse oyun durur; aynı kimlikle geri gelindiğinde aynı maç devam eder. On ürün dağıtıldığında oylar gizli olarak alınır. İki oyuncu aynı gerçek kazanan kimliğini seçerse o kazanır; diğer bütün durumlar beraberliktir. Rövanş iki tarafın onayıyla aynı temada yeni ürün seçimiyle başlar. Tema maç ortasında değiştirilemez.

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
