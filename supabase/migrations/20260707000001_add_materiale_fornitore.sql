-- Add materiale fornitore sub-status columns
alter table public.orders
  add column if not exists materiale text default 'non_serve',
  add column if not exists materiale_fornitore text,
  add column if not exists materiale_cosa_manca text,
  add column if not exists materiale_data_ordine date;

alter table public.orders drop constraint if exists orders_materiale_check;
alter table public.orders add constraint orders_materiale_check
  check (materiale in ('non_serve','da_ordinare','ordinato','arrivato'));