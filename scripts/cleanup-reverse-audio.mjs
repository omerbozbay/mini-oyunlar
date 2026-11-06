import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

// Storage API fiziksel nesneyi de kaldırır. storage.objects tablosundan SQL DELETE yapmayın.
export async function cleanupReverseAudio(
  client,
  remove = false,
  log = console.log,
) {
  let deleted = 0;
  for (let batch = 0; batch < 100; batch++) {
    const { data: paths, error } = await client.rpc("expired_reverse_audio", {
      p_limit: 100,
    });
    if (error) throw error;
    if (!paths?.length) break;
    if (!remove) {
      log(
        JSON.stringify({
          mode: "dry-run",
          eligible: paths.length,
          batchLimit: 100,
        }),
      );
      return 0;
    }
    const result = await client.storage.from("reverse-audio").remove(paths);
    if (result.error) throw result.error;
    const confirmed = await client.rpc("confirm_audio_cleanup", {
      p_paths: paths,
    });
    if (confirmed.error) throw confirmed.error;
    deleted += paths.length;
  }
  log(JSON.stringify({ mode: remove ? "delete" : "dry-run", deleted }));
  return deleted;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw Error(
        "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY yerel yönetici ortamında gerekli. docs/REVERSE.md dosyasına bakın.",
      );
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== "--delete"))
      throw Error(
        "Desteklenen seçenek: --delete. Seçeneksiz çalışma yalnız sayım yapar.",
      );
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await cleanupReverseAudio(client, args.includes("--delete"));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Ses temizliği tamamlanamadı.",
    );
    process.exitCode = 1;
  }
}
