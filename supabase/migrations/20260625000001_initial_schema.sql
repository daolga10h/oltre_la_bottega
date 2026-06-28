-- Enable UUID generation
create extension if not exists "pgcrypto";

-- CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  tags text[] default '{}',
  notes text,
  created_at timestamptz not null default now()
);

-- ENUMS
create type public.order_status as enum (
  'nuovo', 'in_lavorazione', 'pronto', 'consegnato', 'annullato'
);
create type public.order_priority as enum ('normale', 'alta', 'urgente');
create type public.payment_status as enum ('non_pagato', 'acconto', 'saldato');

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  status public.order_status not null default 'nuovo',
  priority public.order_priority not null default 'normale',
  due_date date,
  amount_estimated numeric(10,2),
  payment_status public.payment_status not null default 'non_pagato',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ORDER EVENTS (timeline / audit log)
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);

-- REMINDERS
create type public.reminder_status as enum ('attivo', 'completato', 'saltato');

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status public.reminder_status not null default 'attivo',
  created_at timestamptz not null default now()
);

-- INVENTORY
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text default 'pz',
  quantity_available numeric(10,2) not null default 0,
  reorder_threshold numeric(10,2) default 0,
  updated_at timestamptz not null default now()
);

-- INDEXES
create index on public.orders (due_date);
create index on public.orders (status);
create index on public.orders (priority);
create index on public.orders (customer_id);
create index on public.reminders (due_at) where status = 'attivo';

-- AUTO-UPDATE updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger orders_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();
create trigger inventory_updated_at before update on public.inventory_items
  for each row execute function public.handle_updated_at();

-- ROW LEVEL SECURITY (single-tenant: require authenticated user only)
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.reminders enable row level security;
alter table public.inventory_items enable row level security;

create policy "authenticated_all" on public.customers
  for all using (auth.uid() is not null);
create policy "authenticated_all" on public.orders
  for all using (auth.uid() is not null);
create policy "authenticated_all" on public.order_events
  for all using (auth.uid() is not null);
create policy "authenticated_all" on public.reminders
  for all using (auth.uid() is not null);
create policy "authenticated_all" on public.inventory_items
  for all using (auth.uid() is not null);
