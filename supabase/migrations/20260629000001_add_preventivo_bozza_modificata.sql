-- Add preventivo sub-status column
alter table public.orders
  add column if not exists preventivo text default 'da_inviare';

-- Update bozza_grafica constraint to include 'modificata'
alter table public.orders drop constraint if exists orders_bozza_check;
alter table public.orders add constraint orders_bozza_check
  check (bozza_grafica in ('non_serve','da_fare','inviata','modificata','approvata'));
