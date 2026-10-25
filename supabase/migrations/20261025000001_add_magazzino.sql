-- Magazzino dei materiali: giacenza = carico_totale + rettifica − venduto (il venduto lo porterà il
-- collegamento con gli ordini). Solo per i materiali con in_magazzino = true.
-- soglia = scorta minima (avviso «Da riordinare» quando la giacenza è uguale o inferiore).
-- ordinato_il = data di «Ho già ordinato» (pausa dell'avviso per 7 giorni).

alter table public.materiali
  add column in_magazzino boolean not null default false,
  add column carico_totale numeric(12,3) not null default 0,
  add column rettifica numeric(12,3) not null default 0,
  add column soglia numeric(12,3) check (soglia >= 0),
  add column ordinato_il date;

-- Impronte dei documenti già caricati: servono solo ad evitare di sommare due volte le quantità.
-- Non contengono nulla di leggibile e non sono mostrate da nessuna parte.
create table public.documenti_caricati (
  id uuid primary key default gen_random_uuid(),
  impronta text not null unique,
  created_at timestamptz not null default now()
);

alter table public.documenti_caricati enable row level security;
create policy "auth_all" on public.documenti_caricati for all using (auth.uid() is not null);
