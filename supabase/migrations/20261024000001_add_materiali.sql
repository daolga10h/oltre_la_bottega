-- Listino costi dei materiali: una riga per materiale, con prezzo attuale e
-- prezzo precedente (ciascuno con la data di acquisto). Nessuno storico completo,
-- nessuna tabella acquisti. Si riempie leggendo i documenti dei fornitori o a mano.

create table public.materiali (
  id uuid primary key default gen_random_uuid(),
  fornitore text not null,
  codice text,
  nome text not null,
  unita text,
  prezzo_attuale numeric(12,3) not null check (prezzo_attuale >= 0),
  data_acquisto_attuale date not null,
  prezzo_precedente numeric(12,3) check (prezzo_precedente >= 0),
  data_acquisto_precedente date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un codice è unico per fornitore (confronto senza maiuscole né spazi ai lati).
create unique index materiali_fornitore_codice_key
  on public.materiali (lower(btrim(fornitore)), lower(btrim(codice)))
  where codice is not null and btrim(codice) <> '';

create index materiali_nome_idx on public.materiali (lower(nome));

create trigger materiali_updated_at before update on public.materiali
  for each row execute function public.handle_updated_at();

alter table public.materiali enable row level security;
create policy "auth_all" on public.materiali for all using (auth.uid() is not null);
