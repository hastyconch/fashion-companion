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
  `src/lib/supabase/server.ts` (which calls `connection()`).
- **Speed rules (measured, see PR "Make the app snappier"):**
  - No `<Suspense>` fallbacks or `loading.tsx` around page content: on Workers they delayed
    the real content by ~0.5 s. Tap feedback comes from `useLinkStatus` in `AppNav`.
  - Nav links use `prefetch={false}`: background prefetches of these dynamic pages cost
    server renders and database calls without making navigation faster.
  - Load related rows in one query with embedded selects (see `src/lib/outfits/queries.ts`),
    and run independent queries with `Promise.all`.
- **AI calls** live in `src/lib/ai/` (server-only). Every paid call first goes through
  the `consume_ai_quota` database function, which enforces the daily cap and logs usage.
- **Photos:** the browser uploads straight to Supabase Storage (`closet/{user_id}/{item_id}/…`),
  and Claude reads a short-lived signed URL. Pages show photos via `photoUrl()` →
  `/photos/...`: a stable URL the browser caches for a year, fetched with the user's own token
  so Storage RLS still applies. Never put signed URLs in pages: each render gets a new token,
  so the browser re-downloads every photo.
- The tag vocabulary in `src/lib/items/vocabulary.ts` is mirrored by CHECK constraints in
  the items migration. Change both together.
- Style quiz answers live in `profiles.preferences` and are validated by `PreferencesSchema`
  (`src/lib/profile/preferences.ts`). The AI-written brief is `profiles.style_memo`; M4's outfit
  suggestions should read both.
- **Duplicates** (`src/lib/items/duplicate-flow.ts`) run after tagging in the same request and never fail it.
  `items.duplicate_of` is a same-owner foreign key `(user_id, duplicate_of)`, so it can't point at another
  user's item.
- **Never trust IDs from the model.** Give it short refs (`closetForAi` in `src/lib/outfits/closet.ts`),
  map them back server-side, and run every outfit through `checkOutfit` (`src/lib/outfits/validate.ts`).
- Mobile first: 44px touch targets, `text-base` inputs (stops iOS zoom), and safe-area
  padding on fixed bars.
