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
- **Never trust IDs from the model.** Validate AI output with Zod and check that every
  item ID exists and belongs to the user.
- Mobile first: 44px touch targets, `text-base` inputs (stops iOS zoom), and safe-area
  padding on fixed bars.
