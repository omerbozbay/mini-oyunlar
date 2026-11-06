import type { PGlite } from "@electric-sql/pglite";
// Gerçek Storage HTTP/S3 yerine yalnız RLS şemasını taklit eder. Ağ testinin yerine geçmez.
export async function installStorageSchema(db: PGlite) {
  await db.exec(`
 create role service_role bypassrls;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated,anon,service_role;
 grant select,insert,delete on storage.objects to authenticated;
 grant all on storage.objects,storage.buckets to service_role;
 `);
}
