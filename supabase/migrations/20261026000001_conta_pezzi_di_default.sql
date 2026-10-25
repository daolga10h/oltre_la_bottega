-- Si contano i pezzi di tutti i materiali: chi non serve lo esclude l'utente da «Modifica».
alter table public.materiali alter column in_magazzino set default true;
update public.materiali set in_magazzino = true;
