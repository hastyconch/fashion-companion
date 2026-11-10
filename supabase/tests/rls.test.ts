/**
 * Row-level security tests. They run every migration in supabase/migrations
 * against PGlite (Postgres compiled to WebAssembly, so no Docker needed) with a
 * minimal stand-in for Supabase's `auth` schema and roles.
 *
 * Add a block here for every new user-owned table: "user A can't see or touch
 * user B's rows" is the most important guarantee this app makes.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const ALICE = "00000000-0000-4000-8000-00000000a11c";
const BOB = "00000000-0000-4000-8000-000000000b0b";

// Mirrors what Supabase provides before our migrations run, including its
// default of granting new public tables to anon/authenticated, so the tests
// prove our explicit revokes work.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

let db: PGlite;

async function as<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);

  const dir = path.join(__dirname, "..", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }

  await db.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [
    ALICE,
    "alice@example.com",
    BOB,
    "bob@example.com",
  ]);
});

describe("profiles", () => {
  it("creates a profile for each new user", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.profiles");
    expect(rows.map((r) => r.id).sort()).toEqual([ALICE, BOB].sort());
  });

  it("only shows users their own profile", async () => {
    const { rows } = await as(ALICE, () => db.query("select id from public.profiles"));
    expect(rows).toEqual([{ id: ALICE }]);
  });

  it("lets users rename themselves", async () => {
    await as(ALICE, () =>
      db.query("update public.profiles set display_name = 'Alice' where id = $1", [ALICE]),
    );
    const { rows } = await db.query<{ display_name: string }>(
      "select display_name from public.profiles where id = $1",
      [ALICE],
    );
    expect(rows[0].display_name).toBe("Alice");
  });

  it("silently ignores updates to someone else's profile", async () => {
    const result = await as(ALICE, () =>
      db.query("update public.profiles set display_name = 'hacked' where id = $1", [BOB]),
    );
    expect(result.affectedRows).toBe(0);
    const { rows } = await db.query<{ display_name: string | null }>(
      "select display_name from public.profiles where id = $1",
      [BOB],
    );
    expect(rows[0].display_name).toBeNull();
  });

  it("blocks changes to columns other than display_name", async () => {
    await expect(
      as(ALICE, () =>
        db.query("update public.profiles set created_at = now() - interval '1 year' where id = $1", [
          ALICE,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("blocks inserting or deleting profiles directly", async () => {
    await expect(
      as(ALICE, () => db.query("insert into public.profiles (id) values (gen_random_uuid())")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(ALICE, () => db.query("delete from public.profiles where id = $1", [ALICE])),
    ).rejects.toThrow(/permission denied/);
  });

  it("gives signed-out visitors no access", async () => {
    await expect(as(null, () => db.query("select * from public.profiles"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("removes the profile when the account is deleted", async () => {
    await db.query("delete from auth.users where id = $1", [BOB]);
    const { rows } = await db.query("select id from public.profiles where id = $1", [BOB]);
    expect(rows).toEqual([]);
  });
});
