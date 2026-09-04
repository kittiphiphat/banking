alter table public.savings drop constraint if exists savings_month_key_check;

alter table public.savings
  add constraint savings_month_key_check
  check (month_key ~ '^[0-9]{4}-[0-9]{2}$');
