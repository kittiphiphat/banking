-- Run this only if the original schema with user_id was already created.
-- This keeps existing rows and converts the tables to the no-login shared wallet.

alter table public.entries drop column if exists user_id;

alter table public.savings drop constraint if exists savings_pkey;
alter table public.savings drop column if exists user_id;
alter table public.savings add primary key (month_key);
alter table public.savings drop constraint if exists savings_month_key_check;
alter table public.savings add constraint savings_month_key_check check (month_key ~ '^[0-9]{4}-[0-9]{2}$');

 drop policy if exists "Users can manage their entries" on public.entries;
 drop policy if exists "Users can manage their savings" on public.savings;
 drop policy if exists "Public app can manage entries" on public.entries;
 drop policy if exists "Public app can manage savings" on public.savings;

alter table public.entries enable row level security;
alter table public.savings enable row level security;

create policy "Public app can manage entries"
  on public.entries for all
  using (true)
  with check (true);

create policy "Public app can manage savings"
  on public.savings for all
  using (true)
  with check (true);

alter table public.entries replica identity full;
alter table public.savings replica identity full;
