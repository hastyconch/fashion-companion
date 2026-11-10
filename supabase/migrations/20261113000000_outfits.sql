-- M4: daily outfit suggestions, feedback and wear tracking.

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  for_date date not null,
  occasion text not null check (occasion in ('everyday', 'work', 'evening', 'date', 'active', 'travel')),
  position smallint not null default 0 check (position between 0 and 9),
  title text not null check (char_length(title) <= 80),
  reason text check (char_length(reason) <= 400),
  tip text check (char_length(tip) <= 200),
  -- Snapshot of the forecast the outfit was planned for.
  weather jsonb check (weather is null or pg_column_size(weather) <= 2048),
  -- Latest reaction: suggested -> liked / disliked, or worn.
  status text not null default 'suggested' check (status in ('suggested', 'liked', 'disliked', 'worn')),
  feedback_reason text check (char_length(feedback_reason) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outfits_user_date_idx on public.outfits (user_id, for_date desc, occasion);

create table public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null default 0,
  primary key (outfit_id, item_id)
);

create index outfit_items_item_idx on public.outfit_items (item_id);

alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

create policy "Users can read their own outfits"
  on public.outfits for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own outfits"
  on public.outfits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own outfits"
  on public.outfits for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own outfits"
  on public.outfits for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their own outfit pieces"
  on public.outfit_items for select to authenticated using ((select auth.uid()) = user_id);
-- Both the outfit and the item must belong to the user.
create policy "Users can add their own pieces to their own outfits"
  on public.outfit_items for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
    and exists (select 1 from public.items i where i.id = item_id and i.user_id = (select auth.uid()))
  );
create policy "Users can remove pieces from their own outfits"
  on public.outfit_items for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.outfits, public.outfit_items from anon, authenticated;
grant select, delete on public.outfits to authenticated;
-- id is client-generated so an outfit and its pieces can be linked exactly.
grant insert (id, for_date, occasion, position, title, reason, tip, weather) on public.outfits to authenticated;
grant update (status, feedback_reason) on public.outfits to authenticated;
grant select, delete on public.outfit_items to authenticated;
grant insert (outfit_id, item_id, position) on public.outfit_items to authenticated;

create trigger outfits_set_updated_at
  before update on public.outfits
  for each row execute function public.set_updated_at();

-- Marks an outfit as worn and bumps each piece's wear count, once per outfit.
-- Security definer because users can't edit wear stats directly.
create function public.record_outfit_worn(p_outfit_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select status into v_status from public.outfits
  where id = p_outfit_id and user_id = v_user
  for update;

  if not found then
    return false;
  end if;
  if v_status = 'worn' then
    return true; -- already counted
  end if;

  update public.items i
  set wear_count = i.wear_count + 1, last_worn_at = now()
  from public.outfit_items oi
  where oi.outfit_id = p_outfit_id and oi.item_id = i.id and i.user_id = v_user;

  update public.outfits set status = 'worn', feedback_reason = null where id = p_outfit_id;
  return true;
end;
$$;

revoke execute on function public.record_outfit_worn(uuid) from public, anon;
grant execute on function public.record_outfit_worn(uuid) to authenticated;
