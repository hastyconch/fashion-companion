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
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;

  -- Minimal stand-in for Supabase Storage: the tables our policies touch and
  -- storage.foldername(), with RLS on and broad grants like the real thing.
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid default auth.uid()
  );
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects, storage.buckets to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
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
    const temp = "00000000-0000-4000-8000-0000000000ff";
    await db.query("insert into auth.users (id, email) values ($1, 'temp@example.com')", [temp]);
    await db.query("delete from auth.users where id = $1", [temp]);
    const { rows } = await db.query("select id from public.profiles where id = $1", [temp]);
    expect(rows).toEqual([]);
  });
});

const ITEM_A = "11111111-1111-4111-8111-11111111111a";
const ITEM_B = "22222222-2222-4222-8222-22222222222b";
const paths = (user: string, item: string) => [`${user}/${item}/full.jpg`, `${user}/${item}/thumb.jpg`];

function addItem(item: string, [image, thumb]: string[]) {
  return db.query("insert into public.items (id, image_path, thumb_path) values ($1, $2, $3)", [
    item,
    image,
    thumb,
  ]);
}

describe("items", () => {
  beforeAll(async () => {
    await as(ALICE, () => addItem(ITEM_A, paths(ALICE, ITEM_A)));
    await as(BOB, () => addItem(ITEM_B, paths(BOB, ITEM_B)));
  });

  it("assigns new items to the signed-in user", async () => {
    const { rows } = await db.query<{ user_id: string }>(
      "select user_id from public.items where id = $1",
      [ITEM_A],
    );
    expect(rows[0].user_id).toBe(ALICE);
  });

  it("only shows users their own items", async () => {
    const { rows } = await as(ALICE, () => db.query<{ id: string }>("select id from public.items"));
    expect(rows.map((r) => r.id)).toEqual([ITEM_A]);
  });

  it("lets users edit their own tags and status", async () => {
    const result = await as(ALICE, () =>
      db.query(
        "update public.items set category = 'top', colors = '{navy}', status = 'laundry' where id = $1",
        [ITEM_A],
      ),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("silently ignores edits and deletes of someone else's items", async () => {
    const update = await as(ALICE, () =>
      db.query("update public.items set category = 'shoes' where id = $1", [ITEM_B]),
    );
    const remove = await as(ALICE, () => db.query("delete from public.items where id = $1", [ITEM_B]));
    expect(update.affectedRows).toBe(0);
    expect(remove.affectedRows).toBe(0);
  });

  it("won't let a user claim an item for someone else", async () => {
    const item = "33333333-3333-4333-8333-333333333333";
    await expect(
      as(ALICE, () =>
        db.query(
          "insert into public.items (id, user_id, image_path, thumb_path) values ($1, $2, $3, $4)",
          [item, BOB, ...paths(BOB, item)],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("won't let an item point at another user's photos", async () => {
    const item = "44444444-4444-4444-8444-444444444444";
    await expect(as(ALICE, () => addItem(item, paths(BOB, item)))).rejects.toThrow(
      /items_paths_in_owner_folder/,
    );
  });

  it("protects wear stats from direct edits", async () => {
    await expect(
      as(ALICE, () => db.query("update public.items set wear_count = 99 where id = $1", [ITEM_A])),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects tags outside the allowed values", async () => {
    await expect(
      as(ALICE, () =>
        db.query("update public.items set seasons = '{monsoon}' where id = $1", [ITEM_A]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("gives signed-out visitors no access", async () => {
    await expect(as(null, () => db.query("select * from public.items"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("AI usage quota", () => {
  it("allows calls up to the daily limit, then refuses", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const { rows } = await as(ALICE, () =>
        db.query<{ ok: boolean }>("select public.consume_ai_quota('tag_item', 2) as ok"),
      );
      results.push(rows[0].ok);
    }
    expect(results).toEqual([true, true, false]);
  });

  it("counts each user separately", async () => {
    const { rows } = await as(BOB, () =>
      db.query<{ ok: boolean }>("select public.consume_ai_quota('tag_item', 2) as ok"),
    );
    expect(rows[0].ok).toBe(true);
  });

  it("only shows users their own usage, and they can't write to it", async () => {
    const { rows } = await as(ALICE, () =>
      db.query<{ user_id: string }>("select distinct user_id from public.ai_usage"),
    );
    expect(rows).toEqual([{ user_id: ALICE }]);
    await expect(
      as(ALICE, () =>
        db.query("insert into public.ai_usage (user_id, kind) values ($1, 'tag_item')", [ALICE]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(ALICE, () => db.query("delete from public.ai_usage")),
    ).rejects.toThrow(/permission denied/);
  });

  it("is unavailable to signed-out visitors", async () => {
    await expect(
      as(null, () => db.query("select public.consume_ai_quota('tag_item', 100)")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("closet photo storage", () => {
  const upload = (name: string) =>
    db.query("insert into storage.objects (bucket_id, name) values ('closet', $1)", [name]);

  it("creates a private bucket", async () => {
    const { rows } = await db.query<{ public: boolean }>(
      "select public from storage.buckets where id = 'closet'",
    );
    expect(rows).toEqual([{ public: false }]);
  });

  it("lets users upload into their own folder only", async () => {
    await as(ALICE, () => upload(paths(ALICE, ITEM_A)[0]));
    await as(BOB, () => upload(paths(BOB, ITEM_B)[0]));
    await expect(as(ALICE, () => upload(paths(BOB, ITEM_A)[0]))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("only shows users their own photos", async () => {
    const { rows } = await as(ALICE, () =>
      db.query<{ name: string }>("select name from storage.objects"),
    );
    expect(rows.map((r) => r.name)).toEqual([paths(ALICE, ITEM_A)[0]]);
  });

  it("won't let users delete someone else's photos", async () => {
    const result = await as(ALICE, () =>
      db.query("delete from storage.objects where name = $1", [paths(BOB, ITEM_B)[0]]),
    );
    expect(result.affectedRows).toBe(0);
  });
});
