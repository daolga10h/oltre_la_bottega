# Design: ordini multi-riga (Progetto 1 — righe articolo)

Data: 2026-08-29

## Motivazione

Capita spesso (confermato dall'utente, non un caso raro) che uno stesso ordine contenga più articoli diversi, con prezzo e testo diversi — es. 2 targhe a 6€ l'una + 1 timbro a 10€. Il modello dati attuale assume un solo `cosa_ordinato` + un solo `prezzo` per ordine e non riesce a rappresentare questo caso. È lo stesso gap già annotato il 2026-07-09 in occasione della rimozione del campo "Qtà" dal riquadro pagamento (non moltiplicava mai nel Saldo) e volutamente rimandato a un progetto a sé.

Discusso con l'utente anche uno scenario più ambizioso — ogni articolo con le proprie fasi (preventivo/bozza/materiale/lavorazione), stato ordine calcolato in automatico dall'insieme degli articoli — ma è stato deliberatamente **spezzato in un secondo progetto** (vedi "Fuori scope"), perché duplicherebbe l'intera macchina di sottostati già costruita a livello ordine e tocca troppe parti dell'app per essere affrontato insieme alla base multi-riga. Questo documento copre solo la base: più righe per ordine, ciascuna con articolo/testo/quantità/prezzo, prezzo totale calcolato automaticamente. Lo stato dell'ordine (preventivo → bozza → da fare → in lavorazione → pronto → consegnato) resta un unico valore per l'intero ordine, gestito esattamente come oggi.

## Cosa cambia

### Dati

Nuova tabella `order_items` (stesso pattern di `order_events`, tabella figlia di `orders`):

```sql
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
```

`posizione` mantiene l'ordine di visualizzazione delle righe (0, 1, 2... nell'ordine in cui sono state inserite nel form) — nessun drag & drop, solo per far comparire le righe sempre nello stesso ordine in cui l'utente le ha scritte.

**Ogni ordine ha sempre almeno una riga** — anche gli ordini con un solo articolo, nessun caso speciale "ordine senza righe" da gestire nell'app.

`orders.cosa_ordinato` e `orders.prezzo` restano sulla tabella `orders` (nessuna colonna rimossa) ma diventano **calcolati automaticamente** dal server ad ogni salvataggio, non più inseriti a mano:
- `cosa_ordinato` = elenco degli articoli separati da virgola (es. "Targa, Timbro")
- `prezzo` = somma di (quantità × prezzo unitario) su tutte le righe

Questo è il motivo per cui liste, bacheca, dashboard, ricerca e backup CSV **non richiedono nessuna modifica di codice**: leggono sempre quei due campi su `orders`, che ora vengono semplicemente scritti in automatico invece che a mano.

Le colonne `orders.quantita` e `orders.testo_da_scrivere` restano nello schema ma diventano inutilizzate dal form in poi — stesso trattamento già riservato a `quantita` quando fu tolto dal riquadro pagamento il 2026-07-09. `orders.tipo_lavorazione` e `orders.dettagli_grafici` restano invece **attivi**, a livello ordine, invariati (vedi "Fuori scope").

Migration di popolamento per gli ordini esistenti, nello stesso file: un `insert into order_items` che copia ogni ordine esistente in una riga sola (`cosa_ordinato`, `testo_da_scrivere`, `coalesce(quantita, 1)`, `prezzo` → `prezzo_unitario`). Poiché quei valori sono già gli stessi oggi presenti su `orders.cosa_ordinato`/`orders.prezzo`, nessun ordine cambia aspetto dopo l'aggiornamento.

### Helper condiviso per il calcolo

Nuovo file `src/lib/orderItems.ts`, funzione pura `computeOrderSummary(items)`:
- `cosaOrdinato`: `items.map(i => i.cosa_ordinato).join(", ")`
- `prezzo`: somma di `quantita * prezzo_unitario` su tutte le righe, arrotondata a 2 decimali

Usata sia in `createOrder` che in `updateOrder` (`src/actions/orders.ts`), che ora accettano un array `items: OrderItemInput[]` invece dei campi singoli `cosa_ordinato`/`testo_da_scrivere`/`prezzo`:
1. Calcolano `cosa_ordinato`/`prezzo` con `computeOrderSummary`
2. Scrivono/aggiornano la riga `orders`
3. `updateOrder` cancella le righe `order_items` esistenti per quell'ordine e le reinserisce da zero con i valori inviati (stesso approccio "sovrascrivi tutto" già usato per gli altri campi dell'ordine in modifica — niente logica di confronto riga per riga)

Un array vuoto viene rifiutato con `AppError` prima di toccare il database (guardia difensiva — il form non permette comunque di scendere sotto 1 riga).

### Form ordine (`OrderForm.tsx`)

I campi "Cosa ordinato *" e "Testo da scrivere" vengono sostituiti da una sezione "Articoli":
- Stato React: array di righe `{ cosaOrdinato, testoDaScrivere, quantita, prezzoUnitario }`, inizializzato con 1 riga vuota (nuovo ordine) o con le righe esistenti caricate da `order.items` (modifica)
- Ogni riga: Articolo* (testo), Testo da scrivere (facoltativo), Quantità (numero, default 1), Prezzo unitario (numero, default 0,00), bottone "Rimuovi" (disabilitato quando è rimasta 1 sola riga)
- Bottone "+ Aggiungi articolo" sotto l'ultima riga
- Totale calcolato in tempo reale mentre si digita, mostrato sotto le righe

Il resto del form (Cliente, Operatore, Canale, Data consegna, Materiale fornitore, Note, allegati) resta identico a oggi.

Il riquadro "Pagamento" perde il campo "Prezzo €" modificabile: al suo posto una casella di sola lettura col totale calcolato (stesso trattamento visivo già usato oggi per "Saldo €"). "Acconto €" resta un campo libero come oggi; "Saldo" resta `computeSaldo(prezzo_calcolato, acconto)`, invariato.

### Scheda ordine (`orders/[id]/page.tsx`)

`getOrder` (`src/actions/orders.ts`) estende la query con il join `order_items(...)`, ordinato per `posizione` (stesso pattern già usato per `order_events`). `OrderDetail` guadagna `items: OrderItemRow[]`.

Sotto l'intestazione cliente, nuova sezione "Articoli": elenco righe (articolo × quantità — testo — prezzo riga). Il riquadro pagamento mostra "Prezzo" come valore calcolato in sola lettura (etichetta "calcolato"), Acconto resta modificabile da "Modifica" come oggi.

## Cosa NON cambia

- **Stato ordine**: resta un unico valore per l'intero ordine, stessa logica (`computeOrderStatus`, bottoni rapidi preventivo/bozza/materiale) — il numero di articoli non influisce in alcun modo sullo stato.
- **Liste, bacheca, dashboard "Oggi", ricerca globale, backup CSV**: nessuna modifica di codice — leggono `orders.cosa_ordinato`/`orders.prezzo`, ora calcolati invece che manuali.
- **Etichetta di stampa** (`PrintClient.tsx`): nessuna modifica — oggi stampa solo cliente/azienda/telefono/data/saldo/QR code, non elenca già `cosa_ordinato` né `testo_da_scrivere`, quindi non c'è nulla da estendere per gli articoli multipli.
- **Tipo lavorazione, dettagli grafici, preventivo, bozza grafica, materiale fornitore**: restano campi a livello ordine, invariati — vedi "Fuori scope".

## Test

- `computeOrderSummary`: nuovi test unitari (1 riga, più righe, quantità diverse da 1, arrotondamento a 2 decimali).
- `createOrder`/`updateOrder`: nuovi test che verificano il calcolo di `cosa_ordinato`/`prezzo` a partire da `items`, l'inserimento delle righe `order_items`, la sostituzione completa delle righe in `updateOrder`, e il rifiuto di un array `items` vuoto.
- `getOrder`: test aggiornato per includere `items` nel risultato.

## Fuori scope (Progetto 2, da progettare a parte in futuro)

- Fasi per singolo articolo (preventivo/bozza/materiale/lavorazione propri di ogni riga), con stato ordine calcolato dall'aggregato delle righe ("pronto" solo quando il 100% degli articoli è pronto) — richiesta reale emersa in questa stessa conversazione, ma di dimensione paragonabile a tutto il lavoro fatto finora sui sottostati ordine. Da riprendere con un proprio giro di brainstorming quando la base multi-riga di questo documento sarà rodata in uso reale. **Nota emersa in conversazione, da tenere presente per quel design**: nella maggior parte dei casi gli articoli di uno stesso ordine avanzano tutti insieme (stato unico "di fatto" già oggi) — il bisogno reale è più per le **eccezioni**, cioè segnalare che un singolo articolo è fermo (in attesa di materiale, o di una lavorazione più lunga) mentre gli altri procedono. Il design del Progetto 2 dovrebbe partire da questo: non "ogni riga gestita sempre separatamente", ma "le righe avanzano insieme di default, con la possibilità di scostare una singola riga quando serve".
- Spostare `tipo_lavorazione`/`dettagli_grafici` a livello di singola riga — naturale da valutare insieme al Progetto 2, non prima.
- Riordino manuale delle righe (drag & drop) — `posizione` oggi riflette solo l'ordine di inserimento.
- Dettaglio articoli nel backup CSV settimanale (oggi esporta solo il riepilogo `cosa_ordinato`) — possibile miglioramento futuro, non richiesto ora.
