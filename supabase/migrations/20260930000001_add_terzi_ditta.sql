-- Lavorazione affidata a una ditta/artigiano esterno ("Terzi" nella lista
-- Tipo lavorazione, testo libero in OrderForm.tsx): terzi_ditta annota a chi
-- è stata affidata. Nessuno stato/sottostato associato (a differenza di
-- materiale_fornitore), facoltativo, nessun vincolo NOT NULL.
alter table public.orders
  add column if not exists terzi_ditta text;
