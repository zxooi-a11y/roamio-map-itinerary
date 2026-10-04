-- The trips table. One row per trip; the whole trip (days, stops, ...) is a JSON document.
-- Run this in the Supabase SQL editor (or as a migration) on a new project.
create table if not exists public.trips (
  id         text        primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  constraint trips_data_size check (pg_column_size(data) < 2000000) -- one trip can't be huge
);

alter table public.trips enable row level security;

-- No accounts: the site uses the public (anon) key, so the anon role gets full access.
-- Anyone who has the site can read and change the trips.
drop policy if exists "Open access to trips" on public.trips;
create policy "Open access to trips"
  on public.trips for all to anon, authenticated
  using (true) with check (true);
