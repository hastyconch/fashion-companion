-- M3: style profile. Quiz answers, the AI-written style summary, and an
-- optional location for weather. All on the user's own profiles row, which
-- RLS already restricts to its owner.

alter table public.profiles
  -- Quiz answers. Validated by the app (src/lib/profile/preferences.ts);
  -- the database only guarantees it's a small JSON object.
  add column preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 8192),

  -- The stylist's brief: written by AI from the answers, editable by the user.
  add column style_memo text check (char_length(style_memo) <= 800),
  add column style_keywords text[] not null default '{}'
    check (cardinality(style_keywords) <= 6),
  add column style_memo_updated_at timestamptz,
  add column style_completed_at timestamptz,

  -- Location for weather. Coordinates are rounded to ~1 km by the app.
  add column city text check (char_length(city) <= 120),
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column timezone text check (char_length(timezone) <= 64),
  add constraint profiles_location_pair check ((latitude is null) = (longitude is null));

grant update (
  preferences, style_memo, style_keywords, style_memo_updated_at, style_completed_at,
  city, latitude, longitude, timezone
) on public.profiles to authenticated;
