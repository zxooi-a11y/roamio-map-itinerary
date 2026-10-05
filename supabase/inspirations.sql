-- Saved places for future travels (the Inspiration page). One row per place; the place is a JSON document.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → paste → Run).
create table if not exists public.inspirations (
  id         text        primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  constraint inspirations_data_size check (pg_column_size(data) < 200000) -- one place can't be huge
);

alter table public.inspirations enable row level security;

-- No accounts: the site uses the public (anon) key, like the trips table.
-- Anyone who has the site can read and change the saved places.
drop policy if exists "Open access to inspirations" on public.inspirations;
create policy "Open access to inspirations"
  on public.inspirations for all to anon, authenticated
  using (true) with check (true);
