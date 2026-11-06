# İkimiz — Mini Oyunlar

İki kişinin farklı telefonlardan aynı lobide buluşması için Türkçe, mobil öncelikli bir platform. React, Vite, TypeScript, Tailwind CSS, React Router, Lucide ve Supabase kullanır. Netlify üzerinde statik olarak yayınlanabilir. Ücretli servis veya yapay zekâ API'si kullanmaz; servislerin ücretsiz plan limitleri geçerlidir.

**Bu sürüm:** anonim kimlik, iki kişilik lobi ve **dört oynanabilir oyun**: Açık Artırma, Kelime Zinciri, Sayı Dedektifi ve Kelime Avı. Sunucuda doğrulanan kurallar, gizli cevaplar, bağlantıda duraklama ve iki tarafın onayıyla rövanş içerir. [Açık Artırma](docs/AUCTION.md) · [Üç bulmaca oyunu](docs/PUZZLES.md).

## Yerelde çalıştırma

Node.js 24 LTS ve npm gereklidir.

```powershell
npm install
Copy-Item .env.example .env.local # Yalnız .env.local yoksa; mevcut anahtarın üzerine yazmayın.
npm run dev
```

Terminalde çıkan adresi açın (normalde `http://localhost:5173`). Telefonda yerel önizleme için aynı Wi-Fi ağı üzerinden bilgisayarın yerel IP adresini kullanabilirsiniz. İnternet üzerinden iki farklı cihazın buluşması için Netlify dağıtımı gerekir.

## Ortam değişkenleri

Proje kökündeki `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://silgcikkcixebtuzevgg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=buraya_dashboard_publishable_key
```

Supabase Dashboard → Project Settings → API Keys bölümünden **publishable** anahtarını alın. `service_role`, `secret` anahtarı veya veritabanı şifresi kullanmayın. Vite'ın `VITE_` değişkenleri tarayıcıya gönderilir; publishable anahtarın güvenliği veritabanı RLS ve RPC yetkileriyle sağlanır. Dosya değiştikten sonra geliştirme sunucusunu yeniden başlatın. `.env.local` Git tarafından dışlanır; anahtarı kaynak dosyalarına eklemeyin.

## Supabase SQL Editor'de yapacaklarınız

1. `mini-oyunlar` Supabase projesini açın.
2. Authentication → Sign In / Providers bölümünde **Anonymous Sign-Ins** seçeneğini etkinleştirin. Kullanıcıdan e-posta veya şifre istenmez.
3. SQL Editor → New query açın. Yeni kurulumda `supabase/migrations` içindeki **001 → 002 → 003 → 004 → 005 → 006 → 007** dosyalarının tamamını sırasıyla birer kez çalıştırın. Açık Artırma zaten çalışıyorsa yalnız **005 Zincir, 006 Dedektif ve 007 Kelime Avı** dosyaları gerekir. Başarılı migration'ı ikinci kez çalıştırmayın. [Yeni oyunların kurulum ayrıntıları](docs/PUZZLES.md).
4. `rooms`, `room_players` ve `game_sessions` tablolarında RLS'nin açık olduğunu kontrol edin. Migration'lar bunları `supabase_realtime` publication'ına ekler. Replication/Realtime ayarlarında üçünü de doğrulayın. Supabase'in standart publication'ı yoksa önce panelden etkinleştirin, ardından aşağıdaki komutu yalnız henüz eklenmemiş tablolar için çalıştırın:

   ```sql
   alter publication supabase_realtime add table public.rooms, public.room_players, public.game_sessions;
   ```

5. Authentication → URL Configuration içindeki Site URL'yi Netlify adresinizle ayarlayın. İlk yerel geliştirme için `http://localhost:5173` kullanabilirsiniz. Bu sürüm e-posta yönlendirmesi kullanmaz.
6. Anahtar ve URL'yi `.env.local` içine ekleyin; `npm run dev` ile yeniden başlatın.

**Migration'ı sizin projenizde otomatik çalıştırmadık.** Publishable anahtar DDL çalıştırma yetkisi vermez. Yerel testler uzak Supabase kurulumunu tamamlamaz.

Anonim Auth için Supabase'in yerleşik hız sınırlarını koruyun. Turnstile/CAPTCHA açarsanız istemcide ayrıca CAPTCHA arayüzü ve `captchaToken` entegrasyonu gerekir; bu sürümde bu entegrasyon bulunmuyor. Bot önleme ve otomatik eski oda/anonim hesap temizliği üretim trafiği büyüdüğünde eklenecek işlerdir.

## Kullanım

İsminizi yazıp oda açın. Oluşan altı karakterli kodu arkadaşınıza gönderin. Arkadaşınız farklı bir tarayıcıdan/telefondan kendi ismiyle katılsın. Oda sahibi oyunu, Açık Artırma'da temayı veya Kelime Avı'nda harf modunu seçer. Her oyuncu **Ben hazırım** butonunu kullanır; ardından sahibi **Oyunu başlat** der. Seçim değiştirmek iki hazır durumunu sıfırlar. Maç başlayınca seçim değiştirilemez. Bulmaca oyunlarında herkes kendi gizli cevabını hazırlayıp kilitler; iki hazırlık da tamamlanınca tahmin başlar. Sonuçtan rövanş veya lobiye dönüş seçilebilir.

Sayfayı yenilemek üyeliği silmez; URL'den aynı odaya dönülebilir. Ana sayfada **Mevcut odana dön** bağlantısı da çıkar. Tarayıcı depolaması silinir veya farklı tarayıcı kullanılırsa eski anonim kimlik geri alınamaz. Aynı tarayıcı profili içindeki sekmeler aynı oyuncuyu temsil eder; iki kişilik test için iki ayrı profil/gizli pencere kullanın.

Bağlantı kesildiğinde veya sekme kapandığında üyelik korunur. 25 saniyelik heartbeat ve son heartbeat'ten itibaren 70 saniyelik zaman aşımı kullanılır. Gösterge sunucunun saatine göre hesaplanır ve veri gelmese bile saniyede bir yenilenir; telefonun tarih/saat ayarına bağlı değildir. Süresi dolan oyuncu **Çevrimdışı** ve hazır değil sayılır. Aktif oyuncuların heartbeat'i sunucuda eski hazır bayraklarını temizler; lobide yeniden bağlanan oyuncu yeniden hazır olmalıdır. Başlamış maçta ise bağlantı geri geldiğinde aynı durum ve sıra üzerinden devam edilir. `set_ready` ve `start_game` de sunucudaki süreyi doğrular.

Realtime güncellemeleri iki tarayıcıya aktarılır; kesintide 15 saniyelik sorgu yedeği çalışır. Ağ geri geldiğinde ve görünür sekmeye dönüldüğünde hemen heartbeat denenir. Sekme kapanışında güvenilmez unload isteğiyle üyelik silinmez. Arka planda telefon tarayıcısı zamanlayıcıları durdurabildiğinden çevrimiçi göstergesi yaklaşık bilgidir. Çevrimdışı üye iki kişilik kapasitede yer tutmaya devam eder. Odadan ayrılmak açık bir işlemdir; sahip ayrılırsa kalan oyuncu sahip olur, son oyuncu ayrılırsa oda kapanır.

## Kontroller

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

Testler PGlite içinde gerçek PostgreSQL SQL/RLS/RPC kodunu ve giriş doğrulamasını çalıştırır. Supabase WebSocket ağı, gerçek Auth JWT doğrulaması, çok bağlantılı eşzamanlı kilit yarışları ve iPhone/Android tarayıcıları yerel birim testleriyle doğrulanmış sayılmaz. [İki cihaz kontrol listesi](docs/TESTING.md) dağıtımdan sonra uygulanmalıdır.

Migration'lar uygulandıktan sonra `npm run test:auction:live` gerçek Supabase üzerinde ayrı anonim test kimlikleriyle tam maç, aynı anda teklif, idempotency, WebSocket, 72 saniyelik kopma/dönüş, gizli oy, rövanş ve lobiye dönüş kontrolü yapar. En az yaklaşık iki dakika sürer. Test sonunda üyelikler kapatılır; anonim test hesapları ve oda geçmişi kalabilir. Kimlik tokenları dosyaya/çıktıya yazılmaz.

`npm run test:puzzles:live` üç yeni oyun için gizli cevap/Realtime, iki oyunculu tahmin, aynı anda son kelime, tur adaleti, tekrar harfler, 5/6 harf modları, altı hak sınırı, oturum geri yükleme, 72 saniyelik bağlantı kesintisi, rövanş ve lobiye dönüş kontrollerini çalıştırır. Bu da gerçek Supabase'e bağlanır ve anonim test verisi oluşturur.

## Netlify

Repository: `https://github.com/omerbozbay/mini-oyunlar`, branch: `main`.

Netlify'da **Import an existing project** ile repository'yi seçin. Build command `npm run build`, publish directory `dist`. `netlify.toml` bu değerleri ve SPA yönlendirmesini içerir. Ortam değişkenlerine `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` ekleyip yeniden deploy edin. Anahtar kaynak repo'ya yüklenmez; tarayıcı paketinde publishable anahtarın bulunması normaldir. Yetkilendirme RLS ile yapılır.

Netlify adresini iki telefonda açın. `/oda/ABC123` gibi adresleri yenilemek SPA yönlendirmesi sayesinde 404 üretmez. Bu çalışma Netlify hesabına otomatik dağıtım yapmaz.

## Dosya yapısı

```text
src/
  App.tsx                 Ana sayfa, lobi, yönlendirme
  styles.css              Mobil arayüz, çizimler ve animasyonlar
  components/             Oyun çizimleri ve erişilebilir native dialog
  features/rooms/         Oda tipleri, RPC API, Realtime yaşam döngüsü
  games/                  Oyun kayıt defteri ve ortak tipler
  lib/                    Supabase istemcisi, kimlik ve doğrulama
supabase/migrations/      RLS ve sunucu doğrulamalı oda işlemleri
tests/                    PostgreSQL güvenlik ve giriş testleri
docs/GAME_RULES.md        Dört oyunun tam kuralları
docs/ARCHITECTURE.md      Gelecek oyunlar, gizli durum ve eşzamanlılık
docs/TESTING.md           Gerçek iki cihaz için test adımları
```

Yeni oyun ekleme ve güvenlik sınırları için [mimari belgesini](docs/ARCHITECTURE.md) okuyun. İlk iki migration oda altyapısıdır; 003/004 Açık Artırma kataloğunu ve maç motorunu ekler. [Yerel görsellerin kaynak/lisans bilgisi](docs/ASSETS.md).

Supabase resmi kaynakları: [Anonim giriş](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
