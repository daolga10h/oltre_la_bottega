-- Add operatore column (who took the order)
alter table public.orders
  add column if not exists operatore text;
