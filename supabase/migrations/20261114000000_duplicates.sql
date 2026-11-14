-- M2: possible duplicates. After tagging, the server compares a new item with
-- similar ones in the closet. A likely match is recorded here until the user
-- answers: same item (the new one is deleted), similar (keep both) or different.

-- Lets duplicate_of reference (owner, item) pairs, so a match can only ever
-- point at one of the same user's own items.
alter table public.items add constraint items_user_id_id_key unique (user_id, id);

alter table public.items
  add column duplicate_of uuid,
  add column duplicate_status text check (duplicate_status in ('pending', 'similar', 'different')),
  add column duplicate_reason text check (char_length(duplicate_reason) <= 200),
  add constraint items_duplicate_not_self check (duplicate_of <> id),
  add constraint items_duplicate_of_fkey foreign key (user_id, duplicate_of)
    references public.items (user_id, id) on delete set null (duplicate_of);

-- Deleting an item looks up rows that point at it.
create index items_duplicate_of_idx on public.items (user_id, duplicate_of)
  where duplicate_of is not null;

grant update (duplicate_of, duplicate_status, duplicate_reason) on public.items to authenticated;
