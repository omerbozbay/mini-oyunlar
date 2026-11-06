import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const users = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];
let db: PGlite;
async function asUser(index: number) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    users[index],
  ]);
  await db.exec("set role authenticated");
}
async function scalar<T>(sql: string, args: unknown[] = []) {
  const result = await db.query<Record<string, T>>(sql, args);
  return Object.values(result.rows[0])[0];
}
async function room() {
  await asUser(0);
  const code = await scalar<string>("select public.create_room('İpek')");
  const id = await scalar<string>("select id from public.rooms");
  return { code, id };
}

beforeAll(async () => {
  // Gerçek PostgreSQL motorunda migration, fonksiyon izinleri ve RLS çalıştırılır.
  // PGlite ağ/WebSocket ve çok bağlantılı kilit yarışlarını simüle etmez.
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  for (const user of users)
    await db.query("insert into auth.users values($1)", [user]);
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202611060001_room_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
}, 30000);

beforeEach(async () => {
  await db.exec("reset role; truncate public.rooms cascade;");
});
afterAll(async () => {
  await db?.close();
});

describe("oda RPC ve RLS güvenliği", () => {
  it("altı karakterli kod üretir, aynı kimliğe ikinci oda açtırmaz", async () => {
    const { code } = await room();
    expect(code).toMatch(/^[A-F0-9]{6}$/);
    expect(await scalar("select public.current_room()")).toBe(code);
    await expect(scalar("select public.create_room('Başka')")).rejects.toThrow(
      "already_in_room",
    );
  });
  it("ikinci oyuncuyu alır, üçüncüyü reddeder ve üyeliği taklit ettirmez", async () => {
    const { code } = await room();
    await asUser(1);
    await scalar("select public.join_room($1,'Ömer')", [code.toLowerCase()]);
    await scalar("select public.join_room($1,'Ömer')", [code]);
    expect(await scalar("select count(*)::int from public.room_players")).toBe(
      2,
    );
    await asUser(2);
    expect(await scalar("select count(*)::int from public.rooms")).toBe(0);
    expect(await scalar("select count(*)::int from public.room_players")).toBe(
      0,
    );
    await expect(
      scalar("select public.join_room($1,'Üçüncü')", [code]),
    ).rejects.toThrow("room_full");
  });
  it("tablolara doğrudan yazmayı ve anonim rolün RPC erişimini engeller", async () => {
    const { id } = await room();
    await expect(
      db.query("update public.room_players set ready = true"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("update public.rooms set host_id = $1", [users[1]]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "insert into public.room_players(room_id,user_id,name) values($1,$2,'Sahte')",
        [id, users[2]],
      ),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role; set role anon");
    await expect(scalar("select public.create_room('Sahte')")).rejects.toThrow(
      "permission denied",
    );
    await expect(scalar("select * from public.rooms")).rejects.toThrow(
      "permission denied",
    );
  });
  it("yalnız kendi hazır durumunu değiştirir; oyun seçimi yalnız sahiptedir", async () => {
    const { id, code } = await room();
    await db.query("select public.set_ready($1,true)", [id]);
    await asUser(1);
    await scalar("select public.join_room($1,'Ömer')", [code]);
    expect(
      await scalar("select count(*)::int from public.room_players where ready"),
    ).toBe(0);
    await db.query("select public.set_ready($1,true)", [id]);
    expect(
      await scalar("select user_id from public.room_players where ready"),
    ).toBe(users[1]);
    await expect(
      db.query("select public.select_game($1,'chain')", [id]),
    ).rejects.toThrow("host_only");
    await asUser(0);
    await db.query("select public.set_ready($1,true)", [id]);
    await db.query("select public.select_game($1,'chain')", [id]);
    expect(
      await scalar("select count(*)::int from public.room_players where ready"),
    ).toBe(0);
  });
  it("başlatmayı sahip ve iki hazır kişiyle sınırlar; eksik motoru başlatmaz", async () => {
    const { id, code } = await room();
    await expect(
      db.query("select public.start_game($1)", [id]),
    ).rejects.toThrow("players_not_ready");
    await db.query("select public.set_ready($1,true)", [id]);
    await asUser(1);
    await scalar("select public.join_room($1,'Ömer')", [code]);
    await db.query("select public.set_ready($1,true)", [id]);
    await expect(
      db.query("select public.start_game($1)", [id]),
    ).rejects.toThrow("host_only");
    await asUser(0);
    await db.query("select public.set_ready($1,true)", [id]);
    await expect(
      db.query("select public.start_game($1)", [id]),
    ).rejects.toThrow("game_not_available");
    await db.exec("reset role");
    await db.query(
      "update public.room_players set last_seen=now()-interval '80 seconds' where user_id=$1",
      [users[1]],
    );
    await asUser(0);
    await expect(
      db.query("select public.start_game($1)", [id]),
    ).rejects.toThrow("players_not_ready");
  });
  it("ayrılırken sahipliği aktarır, hazır durumlarını sıfırlar ve son çıkışta kapatır", async () => {
    const { id, code } = await room();
    await asUser(1);
    await scalar("select public.join_room($1,'Ömer')", [code]);
    await db.query("select public.set_ready($1,true)", [id]);
    await asUser(0);
    await db.query("select public.leave_room($1)", [id]);
    expect(await scalar("select count(*)::int from public.rooms")).toBe(0);
    await asUser(1);
    expect(await scalar("select host_id from public.rooms")).toBe(users[1]);
    expect(await scalar("select ready from public.room_players")).toBe(false);
    await db.query("select public.leave_room($1)", [id]);
    await asUser(2);
    await expect(
      scalar("select public.join_room($1,'Yeni')", [code]),
    ).rejects.toThrow("room_closed");
  });
  it("üye olmayan kullanıcının odaya müdahalesini engeller", async () => {
    const { id } = await room();
    await asUser(2);
    for (const sql of [
      "select public.set_ready($1,true)",
      "select public.select_game($1,'auction')",
      "select public.heartbeat($1)",
      "select public.leave_room($1)",
      "select public.start_game($1)",
    ]) {
      await expect(db.query(sql, [id])).rejects.toThrow("not_a_member");
    }
  });
  it("SQL seviyesinde geçersiz isimleri reddeder", async () => {
    await asUser(0);
    for (const name of ["A", "", "A".repeat(25), "İp\u200bek"]) {
      await expect(
        scalar("select public.create_room($1)", [name]),
      ).rejects.toThrow("invalid_name");
    }
  });
});
