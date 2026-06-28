alter table public.orders
  add column if not exists consenso_marketing boolean default false;
