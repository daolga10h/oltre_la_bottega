# Design: lavorazione "Terzi" + campo "Affidato a"

Data: 2026-09-30

## Motivazione

Alcune lavorazioni vengono affidate a una ditta/artigiano esterno (es. una lavorazione che richiede una macchina che la bottega non ha). Oggi il campo "Tipo lavorazione" (lista fissa in `OrderForm.tsx`) non ha una voce per questo caso, e non c'è modo di annotare a chi è stata affidata.

## Tipo lavorazione: nuova voce "Terzi"

`tipo_lavorazione` è testo libero lato database (nessun constraint), la lista `TIPI_LAVORAZIONE` in [`OrderForm.tsx:23`](../../../src/components/OrderForm.tsx#L23) è solo un elenco di opzioni suggerite nel form. Si aggiunge `"Terzi"` all'array, nessuna migration necessaria per questa parte.

## Nuovo campo "Affidato a"

Testo libero, facoltativo, nessun sottostato/stato (a differenza di "Materiale fornitore", che ha bottoni rapidi Da ordinare/Ordinato/Arrivato — qui non servono, confermato dall'utente).

- **Nuova colonna** `orders.terzi_ditta` (`text`, nullable, nessun default, nessun vincolo `NOT NULL`) — migration `supabase/migrations/20260930000001_add_terzi_ditta.sql`, applicata manualmente da SQL Editor del Supabase Dashboard come le precedenti.
- **`OrderRow`** (`src/actions/orders.ts`) guadagna `terzi_ditta: string | null`. `createOrder`/`updateOrder` non richiedono altre modifiche: entrambi passano `...rest` direttamente all'insert/update senza whitelist di campi.
- **`OrderForm.tsx`**: nuovo state `terziDitta` (stesso pattern di `materialeFornitore`, riga 124), campo `<Input>` con etichetta **"Affidato a"** mostrato solo quando `tipoLavorazione === "Terzi"` (stesso `{condizione && (...)}` già usato per il blocco Fornitore/Cosa manca del materiale, righe 540-549). Se l'utente cambia Tipo lavorazione e il campo sparisce, il valore resta in state e viene comunque inviato — stesso comportamento già esistente per `materiale_fornitore` quando Materiale torna a "non serve" (nessun reset forzato).

## Dove compare

- **Form** (creazione e modifica): come sopra, condizionato a Tipo lavorazione = "Terzi".
- **Scheda ordine** (`src/app/(dashboard)/orders/[id]/page.tsx`): "Tipo lavorazione" di per sé non è mai mostrato in questa pagina (nascosto dalla vista principale, decisione esistente — modificabile solo da "Modifica"). "Affidato a" fa eccezione su richiesta esplicita dell'utente ("lo vorrei vedere, anche per seguire l'ordine"): nuovo blocco informativo, visibile solo se `order.terzi_ditta` è valorizzato, stesso stile della card "Files" esistente (card mostrata solo se c'è contenuto, righe 263-271) — una riga `Affidato a: {order.terzi_ditta}`, posizionata subito dopo la card "Articoli" e prima della card "Files".
- **Non compare** in lista ordini, bacheca, etichetta di stampa, rubrica clienti, ricerca globale, CSV di backup — resta un dettaglio operativo interno, non un'informazione cliente. Nessuna modifica a `buildSearchOrClause`/`ordersToCsv`.

## Cosa NON cambia

- Nessun sottostato/stato per "Terzi" (a differenza di Materiale/Bozza/Preventivo).
- Nessun vincolo di obbligatorietà: il campo resta facoltativo anche quando Tipo lavorazione = "Terzi".
- Nessuna modifica a ricerca, CSV, RLS, etichetta di stampa.

## Test

Nessuna logica di business da testare (campo passthrough, nessun calcolo/side-effect come invece accade per `materiale_fornitore` con l'avanzamento automatico di stato). La visibilità del blocco in scheda ordine dipende solo da `order.terzi_ditta` (truthy), non da `tipo_lavorazione` — stessa logica content-based della card "Files". Verifica manuale dopo l'implementazione: creazione ordine con Tipo lavorazione = "Terzi" e "Affidato a" compilato → salvataggio corretto, campo visibile in scheda ordine; ordine senza "Affidato a" compilato (Tipo lavorazione diverso da "Terzi", o "Terzi" ma campo lasciato vuoto) → nessun blocco in scheda ordine; modifica di un ordine esistente che cambia Tipo lavorazione da "Terzi" a un altro valore senza svuotare "Affidato a" → il blocco resta visibile in scheda ordine (il valore non viene azzerato automaticamente, coerente con "Cosa NON cambia").
