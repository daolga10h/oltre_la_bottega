-- Drop old schema
drop table if exists public.reviews cascade;
drop table if exists public.order_events cascade;
drop table if exists public.reminders cascade;
drop table if exists public.inventory_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.customers cascade;
drop type if exists public.order_status cascade;
drop type if exists public.order_priority cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.reminder_status cascade;

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text,
  telefono text,
  email_cliente text,
  canale text default 'negozio',
  data_ordine date default current_date,
  data_consegna date,
  data_consegnato date,
  cosa_ordinato text not null,
  testo_da_scrivere text,
  tipo_lavorazione text,
  quantita integer default 1,
  bozza_grafica text default 'non_serve',
  foto_oggetto text,
  file_cliente text,
  note text,
  status text not null default 'preventivo',
  prezzo numeric(10,2) default 0,
  acconto numeric(10,2) default 0,
  saldo numeric(10,2) default 0,
  chiedere_recensione boolean default false,
  recensione_richiesta boolean default false,
  recensione_ricevuta boolean default false,
  msg_pronto_inviato boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (status in ('preventivo','bozza_grafica','in_lavorazione','pronto','consegnato')),
  constraint orders_bozza_check check (bozza_grafica in ('non_serve','da_fare','inviata','approvata'))
);

-- ORDER EVENTS
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);

-- REMINDERS
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'attivo',
  created_at timestamptz not null default now()
);

-- INVENTORY
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text default 'pz',
  quantity_available numeric(10,2) not null default 0,
  reorder_threshold numeric(10,2) default 0,
  updated_at timestamptz not null default now()
);

-- Indexes
create index on public.orders (data_consegna);
create index on public.orders (status);
create index on public.orders (nome, cognome);

-- Triggers
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger orders_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();
create trigger inventory_updated_at before update on public.inventory_items
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.reminders enable row level security;
alter table public.inventory_items enable row level security;

create policy "auth_all" on public.orders for all using (auth.uid() is not null);
create policy "auth_all" on public.order_events for all using (auth.uid() is not null);
create policy "auth_all" on public.reminders for all using (auth.uid() is not null);
create policy "auth_all" on public.inventory_items for all using (auth.uid() is not null);
