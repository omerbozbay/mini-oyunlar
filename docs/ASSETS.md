# Açık Artırma görselleri

144 ürünün görseli `public/auction/` altında yerel SVG olarak bulunur. Dış görsel URL'si, stok fotoğraf servisi, ücretli servis veya yapay zekâ API'si kullanılmadı. Bunlar bu proje için basit vektör şekilleriyle sıfırdan hazırlanmış, pastel arayüzle uyumlu **temsili illüstrasyonlardır**; ürün fotoğrafı değildir.

Kaynak: `scripts/build-auction-assets.mjs`; ad ve açıklamalar `src/games/auction/catalog.json`. SVG'ler 256×256 viewBox, yerel renkler ve vektör çizgiler içerir. Paket içinde font, harici bitmap veya uzak bağlantı yoktur. Yeniden üretmek için `npm run assets:auction` kullanılır. Aynı malzeme türleri (örneğin peynir) tutarlı ortak çizim kullanır. Hayvanlar ve deneyimler stilize temsillerdir.

Bu çalışma kapsamında oluşturulan SVG varlıkları **CC0-1.0** kapsamında kullanılabilir: https://creativecommons.org/publicdomain/zero/1.0/ . Üçüncü taraf görsel alınmadığı için üçüncü taraf atıf şartı yoktur. Bu izin yalnız bu SVG varlıkları içindir; bağımlılıkların kendi lisanslarını değiştirmez.

Pizza, hamburger ve pasta sonuçları satın alınan beş ürünün yerel görsel kartlarından oluşturulan bir kompozisyonla gösterilir. Birbirine uymayan şeffaf katmanlar veya her kombinasyona ayrı resim kullanılmaz. Görsel yükleme hatasında yerel ikon yedeği gösterilir; teklif/oy işlemleri görsel yüklenmesini beklemez.
