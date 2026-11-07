# Açık Artırma — serbest koleksiyonlar

Kişi başına 20 TL ile rastgele seçilen 10 ürün için yarışılır. Ürün sayısı sınırı yoktur: 7–3 veya 10–0 gibi dağılımlar mümkündür. Her ürün birine gider. Mevcut oda, kimlik, RLS ve heartbeat sistemi korunur.

## Kurulum

001–008 zaten uygulanmışsa Supabase SQL Editor'de yalnız aşağıdaki iki dosyanın tamamını sırayla birer kez çalıştırın:

1. `supabase/migrations/202611070009_auction_expanded_catalog.sql`
2. `supabase/migrations/202611070010_auction_flexible_collections.sql`
3. `supabase/migrations/202611070011_auction_required_allocation.sql`

009 kataloğu genişletir. 010 beş ürün sınırını ve bütçe rezervini kaldırır, hediye/son onay kurallarını getirir. 011 kullanıcının son düzeltmesini uygular: ürün atlama kapalı; bir bütçe bitince kalanlar ücretsiz dağıtılır. 009/010 uygulanmışsa yalnız 011 gerekir. Eski migration'lar değişmedi; tekrar çalıştırılmaz. Yeni kurulumda 001–011 sırasıyla uygulanır. SQL Editor erişimi bu geliştirme ortamında yoktur; uzak migration'ları kullanıcı uygular. Eski maçta dağıtılmış/atlanmış ürünler geriye dönük değiştirilmez; yeni kuralları yeni maç veya rövanşla deneyin.

## 17 tema ve 312 seçenek

Pizza, hamburger, pasta, kahvaltı, makarna, tatlı, hayvanlar, tatil, ev; ayrıca süper kahramanlar, yemekler, gün tabağı, diziler, hayatta kalma, tarihi komutanlar, ülkeler ve süper güçler. Yeni sekiz temada, pizza ve yenilenen tatlı temasında 20'şer seçenek; kalan yedi temada 16'şar seçenek vardır. Pizza sosis, mısır, yeşil zeytin, jalapeno ve füme hindi içerir.

Her maç havuzdan **rastgele 10 farklı ürün** seçer; hepsi sırayla gösterilir. Aynı ürünü tekrar görmek rövanşta mümkündür, aynı maçta mümkün değildir. İki oyuncu aynı sabit sırayı görür.

## Teklif ve pas

- Açılış en az 1 TL, teklifler tam sayı ve mevcut tekliften büyük olmalıdır.
- Üst sınır yalnız kalan bütçedir. Ürün sayısı sınırı veya sonraki ürünlere zorunlu para ayırma yoktur. İlk ürüne 20 TL verilebilir.
- İlk oyuncu rastgele belirlenir; sonraki ürünlerde açılış sırası dönüşümlüdür. Her hamlede sıra karşıya geçer.
- İlk tekliften önce pas geçilemez; ürün alınmadan geçilmez.
- Teklif varken rakibin pası yalnız mevcut ürünü son teklif sahibine verir. Sonraki ürün otomatik dağıtılmaz. Bütçesi yetmeyen oyuncu Pas düğmesini kullanır.
- Bir oyuncunun bütçesi bittiğinde diğer oyuncu sıradaki ürünü **ücretsiz kendine alır veya ücretsiz arkadaşına verir**. Parası kalandan da para kesilmez. Bütçe rezervi veya 1 TL kesintisi yoktur. Ürünler tek tek gösterilmeye devam eder, toplu otomatik tahsis yapılmaz.
- İki bütçe pozitifken ihaleler sürer. Biri sıfır olduğu anda ücretsiz moda geçildiğinden normal yeni maçta iki bütçenin birden sıfırlanması mümkün değildir. Eski bir maçtan iki sıfır bütçe kalmışsa o ürünün açılış sırasındaki oyuncu ücretsiz dağıtır. Onuncu ürün görülüp birine verilmeden maç oylamaya geçmez.

## Hediye ve son onay

Kendi ürünündeki **Arkadaşına ver** düğmesi onu diğer oyuncuya taşır. Hediye için karşıdan para alınmaz; satın alanın bütçesine iade yapılmaz. Ürünün alış fiyatı ve ilk ödeyen kimlik korunur. İsterse yeni sahibi ürünü geri hediye edebilir. Yalnız sahibi verebilir; aynı ürün iki koleksiyonda bulunamaz.

Hediyeler açık artırma sırasında veya on ürün sonrasındaki **Koleksiyonlara son dokunuş** aşamasında verilebilir. Bu aşamada iki oyuncu **Koleksiyonum hazır** demelidir. Bir hediye daha verilirse iki onay da sıfırlanır. Böylece oylanan koleksiyon değişemez. Oylama ve sonuç aşamasında hediye kapalıdır. Koleksiyon boş kalabilir; oylama yine iki onayla açılır.

## Oylama ve rövanş

Oylar private tabloda tutulur; yalnız kimin oy verdiği görünür. İkinci oy gelene kadar seçimler public maç görüntüsüne veya Realtime'a girmez. İki oyuncu aynı kazananı seçerse o kazanır, diğer sonuçlar beraberliktir. İki onay rövanşı aynı temada yeni 20 TL bütçe ve rastgele ürünlerle başlatır. Lobiye dönüş üyelikleri korur.

İki oyuncu çevrimiçi değilse teklif, pas, hediye, onay, oy ve rövanş durur. 70 saniyelik mevcut heartbeat eşiği geçerlidir. Aynı kimlikle geri dönmek maçı, sırayı ve koleksiyonları geri getirir. Sayfa yenilemek üyeliği silmez; açık Odadan ayrıl maçı terk edilmiş yapar.

## Yetki ve tekrar güvenliği

Sunucu JWT kimliği, oda üyeliği, maç türü, mevcut maç, aşama, sıra ve bütçeyi doğrular. Oda→maç kilit sırası korunur. Teklif/pas/hediye/son onay sürüm kontrolü kullanır; eski ekran yeni koleksiyonu değiştiremez. Aynı kimlik/maç/UUID ve aynı içerik bir kez uygulanır, farklı içerik aynı UUID ile reddedilir. Ağ sonucu belirsizse aynı istek kimliğiyle tekrar düğmesi sunulur. Hediye de aynı private istek deposunu kullanır. Doğrudan tablo yazma izni veya yeni RLS açığı eklenmez.

## Görseller ve kaynaklar

Yeni temalarda, pizza ve tatlıda 200 kart için 10 yerel WebP atlası kullanılır. Her atlas 4×5 hücrelidir; inline SVG yalnız seçilen hücreyi gösterir. Fotoğraf hissi veren görseller üretildi; gerçek dizi afişi, oyuncu fotoğrafı veya tarihî arşiv belgesi değildir. Dizi görselleri sembolik sahnelerdir; tarihî portreler temsili yorumlardır. Diğer 112 etkin kartın pastel SVG'leri korunur. Ayrıntılar ve kullanılan tarifler [ASSETS.md](ASSETS.md) içindedir.

- `catalog.json`: eski dokuz havuzun kaynağı; `scripts/auction-expansion-data.mjs`: yeni seçenekler.
- `npm run assets:auction`: `themes.json`, 009 katalog migration'ı ve `docs/auction-image-prompts.json` üretir. Eski 003 migration'ını değiştirmez, yeniden ücretli görsel çağrısı yapmaz.
- `private.auction_max`, `private.auction_settle`, `auction_action_impl`, `auction_gift`: sunucu kuralları.
- `npm test`: bütçe, 7–3/10–0, ilk pas yasağı, bir bütçe bitince ücretsiz kendine/karşıya dağıtım, hediye yetkisi/tekrar/sürüm, onay sıfırlama, gizli oy ve diğer oyunların regresyonları.
- `npm run test:auction:live`: uygulanmış 009/010/011 sonrası gerçek Supabase Realtime, iki oyuncu, 72 saniye bağlantı kopması, yediye üç, ücretsiz dağıtım, hediye ve rövanş testi.

GitHub main'e push, bağlı Netlify projesinde otomatik deploy tetikleyebilir. Netlify build ayarları `npm run build` / `dist`; VITE bağlantı değişkenleri korunmalıdır. Gerçek deploy durumu görülmeden yayın tamamlandı sayılmaz.
