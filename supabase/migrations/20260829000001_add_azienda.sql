-- Add azienda column (ragione sociale facoltativa, per clienti che sono associazioni/aziende)
alter table public.orders
  add column if not exists azienda text;
