# Design: campo Azienda su ordini/clienti

Data: 2026-08-29

## Motivazione

Quando il cliente allo sportello è un'associazione o un'azienda (non una persona fisica), oggi non c'è un posto dove annotare la ragione sociale — solo Nome/Cognome, pensati per una persona. Richiesta dell'utente: un campo "Azienda", facoltativo, comodo per riconoscere questi ordini a colpo d'occhio.

## Cosa cambia

### Dati

Nuova colonna `orders.azienda` (`text`, nullable, nessun vincolo) — stesso trattamento di `email_cliente`. Migration `supabase/migrations/<timestamp>_add_azienda.sql`.

### Helper condiviso per il nome visualizzato

Oggi `[nome, cognome].filter(Boolean).join(" ")` è duplicato in 4 punti: `OrderCard.tsx`, `KanbanBoard.tsx`, scheda ordine (`orders/[id]/page.tsx`), `PrintClient.tsx`. Introdotto `buildClientDisplayName(nome, cognome, azienda?)` in `src/lib/utils.ts`, usato ovunque compare il nome cliente:

- Ritorna `"Nome Cognome"` se azienda assente.
- Ritorna `"Nome Cognome — Azienda"` se presente (usato in card ordini, bacheca, scheda ordine).
- L'etichetta di stampa non usa l'helper per il rendering visivo (l'azienda va su una riga propria sotto il nome, non inline, per via dello spazio ridotto a 62mm — vedi sotto) ma riusa la stessa logica di composizione nome/cognome.

### Etichetta di stampa (`PrintClient.tsx`)

Sotto il nome (16px bold), se `azienda` è presente, una riga aggiuntiva in corpo più piccolo (es. 11px) con il nome azienda, prima di telefono/data. Evita che una ragione sociale lunga vada a capo dentro il nome cliente sui 62mm di larghezza.

### Form ordine (`OrderForm.tsx`)

- Nuovo campo "Azienda" (input testo, senza asterisco = facoltativo) nella sezione Cliente, dopo Cognome.
- Stato controllato `aziendaValue`, incluso nel payload (`azienda: aziendaValue.trim() || null`).
- `handleNomeInput`: il filtro suggerimenti include anche il campo azienda dei clienti esistenti (oltre a nome/cognome/telefono).
- `fillCustomer`: precompila anche Azienda dal cliente selezionato.
- Il dropdown suggerimenti mostra l'azienda se presente (stesso trattamento del telefono, come dettaglio secondario nella riga del suggerimento).

### Scheda ordine (`orders/[id]/page.tsx`)

Il titolo (`h1`) usa `buildClientDisplayName`, quindi mostra già "Nome — Azienda" quando presente. Nessuna riga aggiuntiva separata.

### Ricerca

Tre punti toccati, tutti aggiungono `azienda.ilike.<termine>` alla clausola `.or()` esistente:

1. `getOrders` (`src/actions/orders.ts`) — già usa l'escaping anti filter-injection (fix del 2026-07-03); nessun cambiamento a quella logica, solo il nuovo campo nella lista.
2. `getCustomers` (`src/actions/customers.ts`) — **non ha l'escaping**; applicato lo stesso pattern già usato in `getOrders` (backslash e virgolette escapati, valore tra doppi apici) contestualmente all'aggiunta di azienda, perché si sta comunque modificando quella riga.
3. `/api/search/route.ts` (barra di ricerca globale) — stessa cosa: **non ha l'escaping**, applicato lo stesso fix.

Non è una revisione di sicurezza a sé stante: il fix riguarda esclusivamente le righe `.or()` già in modifica per aggiungere il campo azienda.

### Rubrica clienti (`src/actions/customers.ts`, pagine `/customers` e `/customers/profilo`)

- `CustomerSummary` guadagna `azienda: string | null`.
- `getCustomers`: select include `azienda`; la mappa di aggregazione per cliente prende il valore dall'ordine più recente per quel cliente (il primo incontrato, dato l'`order by data_ordine desc`), stesso pattern già usato per `nome`/`cognome`/`telefono`/`email` — se l'ordine più recente non ha azienda valorizzata, mostra vuoto anche se un ordine più vecchio dello stesso cliente ce l'aveva.
- `getOrdersByCustomer`: select include `azienda` (serve per l'header del profilo cliente, tramite `buildClientDisplayName`).
- Card cliente in `/customers` e header del profilo in `/customers/profilo` usano `buildClientDisplayName`.

## Cosa NON cambia

- Nessun vincolo `NOT NULL` o obbligatorietà — coerente con la scelta già fatta per email.
- Nessuna tabella `companies` separata: azienda resta un campo embedded su `orders`, stesso modello di nome/cognome (niente entità cliente separata, vedi CLAUDE.md).
- Nessun impatto sulla logica di aggregazione clienti (chiave per telefono o nome|cognome) — azienda è solo un dato mostrato, non usato come chiave di raggruppamento.

## Test

- `getOrders`: nuovo test che verifica `azienda` nella clausola `.or()` (stesso stile dei test di escaping già presenti).
- `getCustomers`: nuovi test per (a) `azienda` inclusa nella ricerca, (b) escaping dei caratteri speciali nel termine di ricerca (test prima assente), (c) aggregazione porta il valore azienda più recente non nullo.
- `buildClientDisplayName`: nuovo test unitario (nome+cognome, nome+cognome+azienda, solo nome, azienda assente/vuota).

## Fuori scope

- Uso di "azienda" come chiave di deduplica clienti (due persone della stessa azienda restano clienti distinti, come oggi per persone diverse con stesso cognome).
- Validazione formale della ragione sociale (P.IVA, ecc.) — è un campo di testo libero, coerente con l'approccio "soluzione minima" già usato per gli altri campi anagrafici.
