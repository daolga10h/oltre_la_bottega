-- Order line items: one order can now contain multiple articles
-- (articolo/testo/quantità/prezzo), instead of a single cosa_ordinato/prezzo.
-- orders.cosa_ordinato and orders.prezzo remain on the orders table but
-- become server-computed summaries (see src/lib/orderItems.ts) — nothing
-- reading those two columns needs to change.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  cosa_ordinato text not null,
  testo_da_scrivere text,
  quantita integer not null default 1,
  prezzo_unitario numeric(10,2) not null default 0,
  posizione integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;
create policy "auth_all" on public.order_items for all using (auth.uid() is not null);

-- Backfill: every existing order becomes a single line item with the same
-- values it already has today, so no order changes appearance after this
-- migration runs.
insert into public.order_items (order_id, cosa_ordinato, testo_da_scrivere, quantita, prezzo_unitario, posizione)
select id, cosa_ordinato, testo_da_scrivere, coalesce(quantita, 1), coalesce(prezzo, 0), 0
from public.orders;
