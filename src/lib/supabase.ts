import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && /^https:\/\//.test(url));
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

let signingIn: Promise<string> | null = null;
export function ensureIdentity(): Promise<string> {
  // Eşzamanlı istekler tek anonim kimlik oluşturur; kimlik SDK tarafından saklanır.
  signingIn ??= (async () => {
    if (!supabase)
      throw new Error("Supabase bağlantısı için .env.local dosyasını doldur.");
    const { data: existing, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (existing.session) return existing.session.user.id;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error("Anonim kimlik oluşturulamadı.");
    return data.user.id;
  })().finally(() => {
    signingIn = null;
  });
  return signingIn;
}
