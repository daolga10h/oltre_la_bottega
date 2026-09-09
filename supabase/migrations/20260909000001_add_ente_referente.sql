-- Ordini da enti/aziende senza un nominativo persona (es. PA, associazioni):
-- is_ente segna l'interruttore "È un ente/azienda" nel form; referente è un
-- campo indipendente e sempre facoltativo per il contatto umano, quando c'è.
-- nome/cognome/azienda non cambiano vincoli né significato.
alter table public.orders
  add column if not exists is_ente boolean not null default false,
  add column if not exists referente text;
