-- Leftovers: cloud sync tables.
-- Run once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Everything is prefixed leftovers_ so it can live alongside another app in the same project.
--
-- Each row belongs to the signed-in user (user_id = auth.uid()), and row-level security
-- means a session can only ever read or write its own rows. The public "anon" key in the
-- website can't see anything without a signed-in session.

-- Food items. The whole item is stored as JSON, so new fields in the app need no migration.
create table if not exists public.leftovers_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  deleted boolean not null default false,          -- tombstone, so deletes reach your other devices
  updated_at timestamptz not null default now()
);
create index if not exists leftovers_items_user_updated on public.leftovers_items (user_id, updated_at);

-- One row of settings (name, fridge paint, magnets...) per user.
create table if not exists public.leftovers_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- The server stamps every write, so devices with different clocks still sync in order.
create or replace function public.leftovers_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leftovers_items_touch on public.leftovers_items;
create trigger leftovers_items_touch before insert or update on public.leftovers_items
  for each row execute function public.leftovers_touch_updated_at();

drop trigger if exists leftovers_settings_touch on public.leftovers_settings;
create trigger leftovers_settings_touch before insert or update on public.leftovers_settings
  for each row execute function public.leftovers_touch_updated_at();

-- Row-level security: only your own rows.
alter table public.leftovers_items enable row level security;
alter table public.leftovers_settings enable row level security;

drop policy if exists "leftovers own items" on public.leftovers_items;
create policy "leftovers own items" on public.leftovers_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "leftovers own settings" on public.leftovers_settings;
create policy "leftovers own settings" on public.leftovers_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
