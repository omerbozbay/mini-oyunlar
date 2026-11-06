import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/supabase", () => ({
  configured: false,
  supabase: null,
  ensureIdentity: vi.fn(),
}));
import App from "../src/App";
afterEach(() => vi.unstubAllEnvs());

function page(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("sayfa kabuğu ve kurulum durumları", () => {
  it("ana sayfa beş oyunu ve eksik bağlantı açıklamasını render eder", () => {
    const html = page("/");
    for (const title of [
      "Açık Artırma",
      "Kelime Zinciri",
      "Sayı Dedektifi",
      "Kelime Avı",
      "Tersine Konuş!",
    ])
      expect(html).toContain(title);
    expect(html.match(/soon-tag/g)).toHaveLength(5);
    expect(html).toContain("Oynamaya hazır");
    expect(html).toContain(".env.local");
    expect(html).toContain('id="player-name"');
    expect(html).toContain('disabled=""');
  });
  it("yayında eksik bağlantı için Netlify derleme ayarlarına yönlendirir", () => {
    vi.stubEnv("DEV", false);
    const html = page("/");
    expect(html).toContain("VITE_SUPABASE_URL");
    expect(html).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(html).toContain("Netlify");
    expect(html).not.toContain(".env.local");
    expect(html).toContain('disabled=""');
  });
  it("geçersiz oda kodunda boş ekran yerine kurtarma mesajı gösterir", () => {
    const html = page("/oda/gecersiz");
    expect(html).toContain("Oda kodu geçersiz");
    expect(html).toContain("Ana sayfaya dön");
  });
  it("geçerli oda URL’sinde yükleme durumunu gösterir", () => {
    expect(page("/oda/AF1234")).toContain("Odanı hazırlıyoruz");
  });
});
