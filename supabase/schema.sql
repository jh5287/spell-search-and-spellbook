-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Each signed-in person gets one row holding their whole spell book, slot tracker and settings.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  -- bumped on every save; the app only saves if it still matches, so two devices can't overwrite each other
  revision   integer not null default 1,
  updated_at timestamptz not null default now(),
  -- a real spell book is a few hundred KB at most; this stops a runaway client filling the database
  constraint user_data_size check (octet_length(data::text) <= 2000000)
);

-- Lets signed-in users reach the table through the API at all. Some Supabase projects don't do this automatically
-- for new tables; without it saving fails with "permission denied". The policies below still limit each person
-- to their own row.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

-- Row-level security is what keeps people out of each other's data. The anon key in the browser is public,
-- so without these policies anyone could read every row.
alter table public.user_data enable row level security;

drop policy if exists "read own data" on public.user_data;
create policy "read own data" on public.user_data
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "create own data" on public.user_data;
create policy "create own data" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own data" on public.user_data;
create policy "update own data" on public.user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own data" on public.user_data;
create policy "delete own data" on public.user_data
  for delete to authenticated using (auth.uid() = user_id);
