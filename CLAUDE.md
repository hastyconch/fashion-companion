@AGENTS.md

# Fashion Companion

Product plan and milestones: `docs/PLAN.md`. Setup: `README.md`.

## Commands

- `npm test`: unit tests + RLS tests (PGlite, no Docker)
- `npm run typecheck`, `npm run lint`, `npm run build`

## Rules for this codebase

- **Every user-owned table:** `user_id`, RLS enabled, policies scoped to `(select auth.uid())`,
  explicit minimal grants to `authenticated` and nothing to `anon`. Add a block to
  `supabase/tests/rls.test.ts` proving user A can't read or change user B's rows.
- **Secrets stay on the server.** Only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may reach the browser. AI calls run in server
  code only.
- **Deployed on Cloudflare Workers** via `@opennextjs/cloudflare`. Before relying on a
  Next.js feature, check it works there: `npm run preview` runs the real Workers
  runtime locally. Cache Components is off because it hangs on Workers.
- Anything that reads the session goes through `createClient()` in
  `src/lib/supabase/server.ts` (which calls `connection()`) and renders inside a
  `<Suspense>` boundary.
- **AI calls** live in `src/lib/ai/` (server-only). Every paid call first goes through
  the `consume_ai_quota` database function, which enforces the daily cap and logs usage.
- **Photos never pass through the Worker** (10 ms CPU limit): the browser uploads straight
  to Supabase Storage (`closet/{user_id}/{item_id}/…`), and Claude reads a short-lived
  signed URL.
- The tag vocabulary in `src/lib/items/vocabulary.ts` is mirrored by CHECK constraints in
  the items migration. Change both together.
- **Never trust IDs from the model.** Validate AI output with Zod and check that every
  item ID exists and belongs to the user.
- Mobile first: 44px touch targets, `text-base` inputs (stops iOS zoom), and safe-area
  padding on fixed bars.
