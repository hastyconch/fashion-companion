# Fashion Companion

Photograph your clothes, and an AI stylist suggests outfits from your own closet,
your style, the weather and current trends. It's an installable web app that
works on phone and desktop.

The product plan and milestones are in [`docs/PLAN.md`](docs/PLAN.md).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Radix/shadcn-style
components · Supabase (Postgres + RLS, Auth, Storage) · Cloudflare Workers (via
[OpenNext](https://opennext.js.org/cloudflare)).

## First-time setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Run the migration.** Either paste `supabase/migrations/*.sql` into the SQL editor
   (in filename order), or use the CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Email templates** (Authentication → Emails): replace the **Magic link** and
   **Confirm signup** templates with `supabase/templates/magic_link.html`. The sign-in
   code (`{{ .Token }}`) is what makes login work inside the installed iPhone app.
4. **URL configuration** (Authentication → URL Configuration): set the Site URL to your
   Cloudflare URL (`https://fashion-companion.<your-subdomain>.workers.dev`), and add
   `http://localhost:3000` and your Cloudflare URL to Redirect URLs.
5. **Sign up, then lock the door.** Sign in once to create your account, then turn off
   *Allow new users to sign up* (Authentication → Sign In / Providers) until the app is
   ready for other people. Otherwise anyone who finds the URL can create an account and
   spend your AI budget.
6. **Email sending:** Supabase's built-in email sender only allows a few emails per hour.
   That's fine for you alone; set up custom SMTP (e.g. Resend) before inviting anyone.

### 2. Local development

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from
Project Settings → API Keys. Never put the service-role/secret key in a `NEXT_PUBLIC_`
variable.

```bash
npm install
```

```bash
npm run dev
```

### 3. Deploy (Cloudflare Workers)

Connect the repo once and every push to `main` deploys automatically:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** →
   pick `fashion-companion`.
2. **Build command:** `npx opennextjs-cloudflare build`
   **Deploy command:** `npx opennextjs-cloudflare deploy`
3. Add **build variables** `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They're baked in at build time, so they must
   be *build* variables, not only runtime ones.
4. Open `https://fashion-companion.<your-subdomain>.workers.dev` on your phone:
   **Share → Add to Home Screen** on iPhone, **Install app** on Android.

To deploy from your own machine instead: `npx wrangler login`, then `npm run deploy`.

**Free-plan limits to know about:** each request gets 10 ms of CPU time and the Worker
must stay under 3 MB compressed (currently ~1.7 MB). If you ever see error 1102
("Worker exceeded resource limits"), the Workers Paid plan ($5/month) raises both
limits.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Next.js production build |
| `npm run preview` | Build for Cloudflare and run it locally in the real Workers runtime |
| `npm run deploy` | Build and deploy to Cloudflare (needs `wrangler login`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types, then `tsc --noEmit` |
| `npm test` | Unit tests + row-level security tests (Postgres in WebAssembly, no Docker) |
| `node scripts/generate-icons.mjs` | Regenerates app icons |

## Project layout

```
src/
  app/
    (app)/          signed-in app: Today, Closet, Add, Looks, Me
    login/          email-code sign-in (server action + form)
    auth/confirm/   email-link fallback
    auth/signout/   POST-only sign-out
    manifest.ts     PWA manifest
  components/       app shell + ui/ primitives
  lib/supabase/     browser, server and proxy clients
  proxy.ts          refreshes the session, redirects signed-out visitors
supabase/
  migrations/       schema + RLS (source of truth)
  tests/            RLS tests run by `npm test`
  templates/        auth email templates
```
