# İkimiz — Mini Oyunlar

İki kişinin farklı telefonlardan aynı lobide buluşması için Türkçe, mobil öncelikli bir platform. React, Vite, TypeScript, Tailwind CSS, React Router, Lucide ve Supabase kullanır. Netlify üzerinde statik olarak yayınlanabilir. Ücretli servis veya yapay zekâ API'si kullanmaz; servislerin ücretsiz plan limitleri geçerlidir.

**Bu sürüm:** anonim kimlik, oda oluşturma/katılma, iki kişilik lobi, hazır olma, oyun seçimi, bağlantı durumu ve oturum kurtarma. Dört oyun geliştirme aşamasındadır; kartlarda açıkça **Yakında** yazar. Oyun başlatma sunucuda da engellenir.

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
3. SQL Editor → New query açın. Yeni kurulumda önce [oda migration'ının](supabase/migrations/202611060001_room_foundation.sql), sonra [bağlantı migration'ının](supabase/migrations/202611060002_presence_lease.sql) **tamamını** sırasıyla birer kez çalıştırın. İlk dosyayı daha önce uyguladıysanız yalnız `202611060002_presence_lease.sql` dosyasını çalıştırın. Transaction hatada geri alınır; başarılı migration'ı ikinci kez çalıştırmayın.
4. `rooms` ve `room_players` tablolarında RLS'nin açık olduğunu kontrol edin. Migration her ikisini `supabase_realtime` publication'ına ekler. Replication/Realtime ayarlarında iki tabloyu da doğrulayın. Supabase'in standart publication'ı yoksa önce panelden etkinleştirin, ardından aşağıdaki komutu yalnız henüz eklenmemiş tablolar için çalıştırın:

   ```sql
   alter publication supabase_realtime add table public.rooms, public.room_players;
   ```

5. Authentication → URL Configuration içindeki Site URL'yi Netlify adresinizle ayarlayın. İlk yerel geliştirme için `http://localhost:5173` kullanabilirsiniz. Bu sürüm e-posta yönlendirmesi kullanmaz.
6. Anahtar ve URL'yi `.env.local` içine ekleyin; `npm run dev` ile yeniden başlatın.

**Migration'ı sizin projenizde otomatik çalıştırmadık.** Publishable anahtar DDL çalıştırma yetkisi vermez. Yerel testler uzak Supabase kurulumunu tamamlamaz.

Anonim Auth için Supabase'in yerleşik hız sınırlarını koruyun. Turnstile/CAPTCHA açarsanız istemcide ayrıca CAPTCHA arayüzü ve `captchaToken` entegrasyonu gerekir; bu sürümde bu entegrasyon bulunmuyor. Bot önleme ve otomatik eski oda/anonim hesap temizliği üretim trafiği büyüdüğünde eklenecek işlerdir.

## Kullanım

İsminizi yazıp oda açın. Oluşan altı karakterli kodu arkadaşınıza gönderin. Arkadaşınız farklı bir tarayıcıdan/telefondan kendi ismiyle katılsın. Her oyuncu kendi **Ben hazırım** butonunu kullanır. Oyun seçimini oda sahibi yapar; değişiklik iki oyuncunun hazır durumunu sıfırlar. Oyunlar henüz başlatılamaz.

Sayfayı yenilemek üyeliği silmez; URL'den aynı odaya dönülebilir. Ana sayfada **Mevcut odana dön** bağlantısı da çıkar. Tarayıcı depolaması silinir veya farklı tarayıcı kullanılırsa eski anonim kimlik geri alınamaz. Aynı tarayıcı profili içindeki sekmeler aynı oyuncuyu temsil eder; iki kişilik test için iki ayrı profil/gizli pencere kullanın.

Bağlantı kesildiğinde veya sekme kapandığında üyelik korunur. 25 saniyelik heartbeat ve son heartbeat'ten itibaren 70 saniyelik zaman aşımı kullanılır. Gösterge sunucunun saatine göre hesaplanır ve veri gelmese bile saniyede bir yenilenir; telefonun tarih/saat ayarına bağlı değildir. Süresi dolan oyuncu **Çevrimdışı** ve hazır değil sayılır. Aktif oyuncuların heartbeat'i sunucuda eski hazır bayraklarını temizler; yeniden bağlanan oyuncu yeniden hazır olmalıdır. `set_ready` ve `start_game` de sunucudaki süreyi doğrular.

Realtime güncellemeleri iki tarayıcıya aktarılır; kesintide 15 saniyelik sorgu yedeği çalışır. Ağ geri geldiğinde ve görünür sekmeye dönüldüğünde hemen heartbeat denenir. Sekme kapanışında güvenilmez unload isteğiyle üyelik silinmez. Arka planda telefon tarayıcısı zamanlayıcıları durdurabildiğinden çevrimiçi göstergesi yaklaşık bilgidir. Çevrimdışı üye iki kişilik kapasitede yer tutmaya devam eder. Odadan ayrılmak açık bir işlemdir; sahip ayrılırsa kalan oyuncu sahip olur, son oyuncu ayrılırsa oda kapanır.

## Kontroller

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

Testler PGlite içinde gerçek PostgreSQL SQL/RLS/RPC kodunu ve giriş doğrulamasını çalıştırır. Supabase WebSocket ağı, gerçek Auth JWT doğrulaması, çok bağlantılı eşzamanlı kilit yarışları ve iPhone/Android tarayıcıları yerel birim testleriyle doğrulanmış sayılmaz. [İki cihaz kontrol listesi](docs/TESTING.md) dağıtımdan sonra uygulanmalıdır.

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

Yeni oyun ekleme ve güvenlik sınırları için [mimari belgesini](docs/ARCHITECTURE.md) okuyun. Gelecek oyunlar için gereksiz boş tablolar oluşturulmamıştır; ilk migration yalnız `rooms` ve `room_players` içerir.

Supabase resmi kaynakları: [Anonim giriş](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
