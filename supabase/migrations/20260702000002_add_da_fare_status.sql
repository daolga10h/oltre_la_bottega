-- Add 'da_fare' to orders status constraint
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('preventivo','bozza_grafica','da_fare','in_lavorazione','pronto','consegnato'));
