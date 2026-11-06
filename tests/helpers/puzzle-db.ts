import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {installStorageSchema} from './storage-db';
import type { PuzzleSession, PuzzleId } from "../../src/games/puzzles/types";
export const users = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];
export class PuzzleDb {
  db = new PGlite();
  code = "";
  room = "";
  async init() {
    await this.db
      .exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
    await installStorageSchema(this.db);
    for (const id of users)
      await this.db.query("insert into auth.users values($1)", [id]);
    const dir = new URL("../../supabase/migrations/", import.meta.url);
    for (const f of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await this.db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  async user(i: number) {
    await this.db.exec("reset role");
    await this.db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      users[i],
    ]);
    await this.db.exec("set role authenticated");
  }
  async scalar<T>(sql: string, args: unknown[] = []): Promise<T> {
    const r = await this.db.query<Record<string, T>>(sql, args);
    return Object.values(r.rows[0])[0];
  }
  async start(game: PuzzleId, length = 5) {
    await this.db.exec("reset role;truncate public.rooms cascade");
    await this.user(0);
    this.code = await this.scalar("select create_room('İpek')");
    this.room = await this.scalar("select id from rooms");
    await this.db.query("select select_game($1,$2)", [this.room, game]);
    if (game === "wordhunt")
      await this.db.query("select select_word_length($1,$2)", [
        this.room,
        length,
      ]);
    await this.user(1);
    await this.db.query("select join_room($1,'Çağrı')", [this.code]);
    await this.db.query("select set_ready($1,true)", [this.room]);
    await this.user(0);
    await this.db.query("select set_ready($1,true)", [this.room]);
    await this.db.query("select start_game($1)", [this.room]);
    return this.game();
  }
  async game() {
    await this.user(0);
    return this.scalar<PuzzleSession>("select get_room_snapshot($1)->'game'", [
      this.code,
    ]);
  }
  async action(
    actor: number,
    action: string,
    payload: unknown = null,
    game?: PuzzleSession,
    request = randomUUID(),
  ) {
    const g = game ?? (await this.game());
    await this.user(actor);
    await this.db.query("select puzzle_action($1,$2,$3,$4,$5,$6)", [
      g.id,
      g.version,
      g.state.players[actor]?.revision ?? 0,
      request,
      action,
      JSON.stringify(payload),
    ]);
    return g;
  }
  async stale(actor: number) {
    await this.db.exec("reset role");
    await this.db.query(
      "update room_players set last_seen=now()-interval '80 seconds' where user_id=$1",
      [users[actor]],
    );
  }
  async beat(actor: number) {
    await this.user(actor);
    await this.db.query("select heartbeat($1)", [this.room]);
  }
  async close() {
    await this.db.close();
  }
}
