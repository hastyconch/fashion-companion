# Fashion Companion: Product & Build Plan

## Context

`hastyconch/fashion-companion` is empty (only `# fashion-companion` in README.md). Goal: a personal wardrobe app that
catalogs your clothes from photos, spots duplicates, and has an AI stylist suggest outfits from your closet, your
style, current trends and the weather. It should work on desktop and mobile, start as a personal tool, and later open
to anyone.

Decisions made: **installable web app (Next.js PWA)**, **Supabase**, **Claude builds, you guide and review**, **under $20/mo**.

### Mentor notes: the three things that decide whether this succeeds

1. **Cataloging friction kills wardrobe apps.** People quit after adding 15 items. The add flow is the most important
   screen in the product: snap, auto-tag, next, in under 10 seconds per item, with a batch "closet session" mode.
   Prioritize this over AI suggestions.
2. **"Fashion-forward AI" mostly comes from personal signal, not trend data.** An LLM's built-in trend knowledge is
   stale and generic, and trend articles are noisy. Suggestions get good through your feedback (👍/👎 + why, what you
   actually wore). Trends should be seasoning: a weekly researched brief plus a "trend appetite" slider, not the engine.
3. **Scope creep is the main risk.** v1 = fast cataloging + one great daily suggestion. Live with it for 2 weeks
   before building anything in "Later". Use it yourself first; that tells you what matters.

---

## Product: features by phase

**v1 (personal, the 7 milestones below)**
- Add items: in-app camera or upload, auto-tagged by AI (category, colors, pattern, material, formality, warmth,
  seasons, style tags), editable. Batch "closet session" for the initial load.
- Duplicate check on add: "Looks like you already own this → Same item / Similar, keep both / Different".
- Closet: image grid, filters (category, color, season, status), search, item detail with wear count / last worn.
- Laundry/unavailable status, so suggestions skip items in the wash.
- Onboarding style profile: lifestyle and typical week, fit preferences, colors loved/avoided, style references,
  location, trend appetite.
- **Today**: local weather + 1–3 outfit suggestions with a short "why" and styling tip; swap one piece; 👍/👎 with
  reason; "Wearing this" logs it.
- Occasion mode: "work / date / interview / travel day" changes the suggestion.
- Weekly trend brief (AI web research from reputable fashion sources), visible in the app and fed to the stylist.

**Later (v2, once v1 has been used daily)**
- **Shopping check**: photo of an item in a store → "you own 2 similar" + "this would make 6 new outfits". This reuses
  duplicate detection and is a strong differentiator.
- Closet gaps ("one camel coat would unlock 14 outfits"), rarely-worn insights, cost-per-wear.
- Manual outfit builder, saved looks/lookbook, plan-the-week calendar.
- Trip packing list from destination weather + dates.
- Background removal / flat-lay outfit visuals. ⚠ Check licenses: popular in-browser libraries are AGPL.
- Add items from a mirror selfie (extract several items from one photo).

**Public launch (v3)**: per-user AI quotas and rate limits, billing, privacy policy, account deletion and export,
image moderation, and commercial plans. Open-Meteo's free tier is **non-commercial only** (Cloudflare's free plan allows commercial use), and the
Supabase free tier pauses after a week of inactivity.

---

## Design direction

- **Feel:** editorial and image-forward. Lots of whitespace, a neutral palette with one accent, serif display headings
  (magazine feel) and a clean sans-serif for the UI. Clothes are the color; the chrome stays quiet.
- **Mobile:** bottom tab bar: Today · Closet · **＋ (center, add)** · Looks · Me. Thumb-reachable primary actions.
- **Desktop:** left nav, denser closet grid, Today shows outfits side by side.
- **Consistency:** square item cards, uniform crop and background, skeleton loaders while AI works (never a blank
  spinner), friendly empty states that teach ("Add 10 items to get your first outfit").
- **Speed perception:** optimistic UI. The photo appears in the closet instantly and tags fill in a few seconds later.
- **Accessibility:** shadcn/ui (Radix) components, real labels, 44px touch targets, dark mode from day one.

---

## Architecture

```
Browser/PWA (Next.js App Router, React, Tailwind, shadcn/ui; service worker in M6)
   │  camera → canvas resize (≤1600px WebP + 400px thumb; re-encoding strips EXIF GPS)
   ▼
Next.js route handlers / server actions (Cloudflare Workers via OpenNext)  ── Anthropic SDK (server only, key never in browser)
   │                                              ── Open-Meteo (weather)
   ▼
Supabase: Postgres (+RLS) · Auth (email code) · Storage (private bucket, signed URLs) · Cloudflare Cron Trigger → weekly trend job
```

**Build it multi-user from day one** (`user_id` on every row + row-level security on all user tables), even with one
user. That makes "anyone can use it" a launch task, not a rewrite.

### Data model (Supabase migrations, `supabase/migrations/`)
- `profiles`: id (= auth user), display_name, city/lat/lon, `style_memo` (AI-maintained text summary of your taste),
  `preferences` jsonb (quiz answers), `trend_appetite` 0–100, onboarding_done
- `items`: id, user_id, image_path, thumb_path, `phash`, category, subcategory, colors text[], pattern, material,
  formality 1–5, warmth 1–5, seasons text[], style_tags text[], description, brand, status (active/laundry/archived),
  wear_count, last_worn_at, created_at
- `outfits` + `outfit_items`: source (ai/manual), occasion, weather_snapshot jsonb, reasoning, styling_tip
- `outfit_events`: outfit_id, kind (liked/disliked/worn), reason, on_date
- `trend_briefs`: week_of, region, brief_markdown, sources jsonb. Global and read-only to users.

### AI engine: four server functions in `lib/ai/`
All use `@anthropic-ai/sdk` with **`claude-opus-5-5`** and structured output via
`client.messages.parse({ output_config: { format: zodOutputFormat(Schema), effort } })`
(`zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`). One shared `lib/ai/client.ts` wrapper:
- always checks `stop_reason` (`refusal`, `max_tokens`) before reading content
- enables server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`).
  Unlikely to trigger for clothing, but it's cheap insurance.
- Opus 5.5 rules: thinking can't be turned off (control it with `effort`, default `medium`), no assistant prefill,
  no forced `tool_choice`.

| Function | Input | Effort | Notes |
|---|---|---|---|
| `tagItem` | 1 image (base64 thumb ~800px) | low | Returns `ItemTags` (Zod). User can edit everything. |
| `checkDuplicate` | new image + ≤4 candidate thumbs | low | Candidates come from SQL first (same category + overlapping colors + pHash distance). Claude only judges "same item?" on that shortlist. No embeddings vendor needed at personal scale; add pgvector later if recall suffers. |
| `suggestOutfits` | profile + style_memo, compact closet list, weather, occasion, last 7 days worn, latest trend brief | medium | Prompt order for caching: static instructions → trend brief → closet → *then* weather/occasion. **Validate every returned item_id exists and is active**, then reject/retry invalid outfits. Never trust IDs from the model. |
| `refreshStyleMemo` | current memo + recent feedback | medium | Runs after every ~10 feedback events. Keeps personalization compact instead of sending raw history. |
| `weeklyTrendBrief` (cron) | none | high | `web_search_20260209` with `allowed_domains` limited to curated sources (e.g. Vogue, WWD, BoF, Harper's Bazaar, GQ, Who What Wear). Outputs a cited markdown brief stored in `trend_briefs`. Plain markdown is enough, since the stylist reads it as text. Streaming. |

### Cost estimate at personal scale (Opus 5.5: $4 / $20 per M tokens, cache reads $0.20)
- Tagging: ~$0.02/item → 150-item initial closet ≈ **$3 one-time**
- Suggestions: ~$0.04–0.08 each with a cached closet → 3/day ≈ **$4–7/mo**
- Trend brief: ~$0.30/week + web search fees ≈ **$1.5/mo**
- Cloudflare Workers free + Supabase free + Open-Meteo free = $0 → **~$6–10/mo total, within budget.**
  If server rendering hits the free plan's 10 ms CPU limit, Workers Paid is $5/mo (still within budget).

If you open it to other people, per-user cost is the number to watch. Moving `tagItem`/`checkDuplicate` to a cheaper
model is your decision to make then, based on measured quality.

---

## Milestones (Claude builds, you review each one)

Each milestone ends with a PR for you to review and test on your phone.

- **M0 Foundations** ✅ built: Next.js 16 (TS, Tailwind 4, App Router), shadcn-style UI on Radix, Cloudflare Workers deploy,
  Supabase auth with **6-digit email codes** (magic links open in Safari, not the installed iPhone app, so codes are
  primary and the link is a fallback), `profiles` migration with RLS + PGlite RLS tests, manifest + icons, app shell.
  *Done when:* you install it to your phone's home screen and log in. (Needs your Supabase project + Cloudflare deploy.)
- **M1 Capture & closet** ✅ built (awaiting your 20-item phone test): `<input type="file" accept="image/*" capture="environment">` first (opens the native
  camera reliably on iOS/Android; build a custom `getUserMedia` camera with a framing guide later). Client resize →
  upload to private bucket → `tagItem` → editable tags. Closet grid + filters + item detail. Batch session mode.
  *Done when:* you can add 20 real items in under 10 minutes.
- **M2 Duplicates**: compute pHash client-side, SQL candidate query, `checkDuplicate`, 3-choice UX.
  *Done when:* re-photographing an owned item is flagged, and a different shirt of the same color is not.
- **M3 Profile & onboarding**: style quiz (visual choices, not long forms), location, trend appetite.
- **M4 Today**: Open-Meteo forecast, `suggestOutfits`, swap-one-piece, feedback, wear log, laundry status,
  `refreshStyleMemo`. *Done when:* you'd actually follow a suggestion on 3 of 5 mornings.
- **M5 Trend brief**: Cloudflare Cron Trigger (weekly) → route handler protected by `CRON_SECRET` → `weeklyTrendBrief`;
  Trends page. The same trigger can run a daily query that stops the Supabase free tier pausing after 7 idle days.
- **M6 Polish**: design pass, skeletons, empty states, desktop layout, offline shell (service worker via Serwist: moved
  here from M0, since installing only needs the manifest + HTTPS), Lighthouse PWA audit.

---

## Cloud environment (the original request, proposed after M0)

Once M0 lands a `package.json` and lockfile, I'll propose a personal **`fashion-companion`** environment and ask you
before saving:
- **Setup script:** `if [ -d fashion-companion ]; then (cd fashion-companion && npm ci); fi`, plus anything else I've
  verified actually runs in this container.
- **Network hosts:** `<your-project>.supabase.co`, `api.open-meteo.com` (blocked today), `ui.shadcn.com` (blocked today;
  needed to add shadcn components with its CLI). npm and `api.anthropic.com` are already reachable.
- **Secrets (network secrets, never env vars):** Anthropic API key on `api.anthropic.com`. The app gets a dummy
  `ANTHROPIC_API_KEY` that the proxy replaces.
- **Variables (non-secret):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public by design).
  The Supabase service-role key stays out of the dev environment entirely.

---

## Verification

- **Per milestone:** Playwright smoke test at an iPhone viewport (log in → add item → item appears in closet → get a
  suggestion), plus a manual check on your real phone (camera permissions and PWA install can't be emulated).
- **AI guardrails as unit tests (Vitest):** Zod schemas reject malformed output, the suggestion validator drops
  unknown or archived item IDs, and the weather rule rejects shorts below ~10°C.
- **Small stylist eval (before M4 is "done"):** 10 fixed scenarios (cold rain/work, hot weekend, date night…) against a
  fixture closet. Check deterministically for valid IDs, weather fit, no repeat of yesterday, and one top + one
  bottom (or one dress) + shoes. Rerun it whenever prompts change.
- **RLS tests (`supabase/tests/rls.test.ts`)** run every migration in PGlite and check one user can't read or change
  another's rows. Every new table gets a block there.
- **Security check before any public use:** RLS policies tested with a second account (it must see nothing of yours),
  storage bucket private, API key only on the server.
