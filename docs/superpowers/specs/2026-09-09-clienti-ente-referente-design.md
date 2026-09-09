# Design: clienti ente/azienda con referente

Data: 2026-09-09

## Motivazione

Alcuni ordini arrivano non da una persona privata ma da un'azienda o da una Pubblica Amministrazione (es. un Comune) — non c'è un "nome e cognome" della persona da inserire, ma la ragione sociale dell'ente. Oggi `nome` e `cognome` sono entrambi obbligatori nel form (vincolo di database su `nome`, solo di form su `cognome`), quindi questi ordini non hanno un modo corretto di essere registrati: si finisce a scrivere il nome dell'ente nel campo "Nome" e a lasciare "Cognome" vuoto forzando la validazione, oppure a inventare un cognome fittizio.

A volte questi ordini hanno anche un referente umano (una persona con cui si è effettivamente parlato), che però può cambiare da un ordine all'altro dello stesso ente — mentre l'ente resta lo stesso. I due dati vanno tenuti distinti: l'ente è l'identità stabile e ricorrente del cliente, il referente è un dettaglio di contatto che varia.

**Vincolo scoperto in fase di design**: usare il campo esistente `azienda` per il referente (o viceversa) crea un'ambiguità di visualizzazione che non si può risolvere a posteriori — lo stesso dato ("Mario Rossi" + "Comune di X") potrebbe legittimamente significare "una persona privata che lavora per un'azienda" (ordine di sempre, va mostrato "Mario Rossi — Comune di X") oppure "un ente con un referente" (questo caso, va mostrato con l'ente davanti). Serve un segnale esplicito salvato con l'ordine per distinguere i due casi in modo affidabile in tutti i punti dell'app che mostrano il nome cliente.

## Cosa cambia

### Dati

Migration `supabase/migrations/<timestamp>_add_ente_referente.sql`:
- `orders.is_ente` — booleano, `not null default false`. Stato dell'interruttore "È un ente/azienda", salvato con l'ordine.
- `orders.referente` — testo, nullable, nessun vincolo. Sempre facoltativo, indipendente da tutto il resto — non viene mai unito/concatenato con `nome` o `azienda` in un solo campo.

`nome` resta `not null` come oggi, senza modifiche al vincolo: quando `is_ente` è true, `nome` contiene il nome dell'ente (es. "Comune di X") invece del nome della persona — soddisfa il vincolo esistente senza bisogno di rilassarlo.

`azienda` e `cognome` non cambiano significato: restano quello che sono oggi per i clienti privati (rispettivamente l'azienda per cui lavorano, e il cognome). Quando `is_ente` è true, entrambi restano vuoti (non usati) — evita di sovraccaricare un campo esistente con un secondo significato legato al valore di `is_ente`, che sarebbe più difficile da leggere/mantenere in futuro.

### Form ordine (`OrderForm.tsx`)

- Nuovo interruttore "È un ente/azienda (non una persona)" nella sezione Cliente, sopra il campo Nome. Stato `isEnte` (React state).
- **Spento** (default, anche per tutti gli ordini esistenti): comportamento identico a oggi — Nome\*, Cognome\*, Azienda (facoltativa) tutti visibili, nessun cambiamento.
- **Acceso**:
  - Label "Nome" → "Nome ente/azienda \*" (resta obbligatorio, stesso campo `nome`).
  - Cognome e Azienda si nascondono (non inviati, restano `null`).
  - Compare "Referente" (input testo, senza asterisco, mappato su `referente`).
- In modifica di un ordine esistente, lo stato iniziale dell'interruttore è `order.is_ente` — nessuna deduzione euristica da altri campi.
- `handleNomeInput`/suggerimenti autocomplete: il filtro sui clienti esistenti include già `nome` — nessun cambiamento necessario per far comparire un ente già visto (digitando "Comune" compaiono le sue righe precedenti, come oggi per una persona).
- `fillCustomer`: se il cliente selezionato dal suggerimento ha `is_ente` true, l'interruttore si accende automaticamente e si precompilano Nome ente + Referente (invece di Nome/Cognome/Azienda).

### Visualizzazione ovunque compare il nome cliente

`buildClientDisplayName` (`src/lib/utils.ts`) guadagna i parametri `isEnte`/`referente` e, quando `isEnte` è true, ritorna solo il nome dell'ente (mai concatenato col referente in una stringa unica — la richiesta esplicita è che i due dati restino visivamente separati). Il referente, quando presente, viene reso in un elemento **separato**, sempre su una riga propria sotto il nome:

```
Comune di X
Ref. Mario Rossi        ← solo se referente presente
```

Punti toccati (stessa entità di lavoro della feature "Azienda" del 2026-08-29):

1. **`OrderCard.tsx`** (card lista/bacheca) — nuova riga `<p>` secondaria sotto il nome cliente, stessa posizione occupata oggi da "cosa ordinato", visibile solo se `referente` è presente.
2. **`KanbanBoard.tsx`** — stessa riga secondaria, stesso trattamento di `OrderCard.tsx`.
3. **Scheda ordine** (`orders/[id]/page.tsx`) — riga secondaria sotto l'`h1` col nome cliente.
4. **Etichetta di stampa** (`PrintClient.tsx`) — riga aggiuntiva sotto il nome, stesso pattern già usato lì per `azienda` (corpo più piccolo, sopra telefono/data).
5. **Rubrica clienti** (`/customers`) e **profilo cliente** (`/customers/profilo`) — riga secondaria nella card cliente e nell'header del profilo.
6. **Dashboard "Oggi"** (`TodayBoard.tsx`) — riga secondaria nelle sezioni che elencano ordini per nome cliente.
7. **Ricerca globale** (`SearchBar.tsx` + `/api/search/route.ts`) — la route aggiunge `is_ente, referente` alla select e a `buildSearchOrClause` (ricercabile anche per nome del referente); `SearchBar.tsx` mostra la riga secondaria nei risultati.
8. **Rubrica/ricerca clienti** (`getCustomers` in `src/actions/customers.ts`) — `CustomerSummary` guadagna `is_ente`/`referente`; aggregazione per cliente segue lo stesso pattern già in uso per `azienda` (valore dall'ordine più recente).

## Cosa NON cambia

- **Backup CSV settimanale** (`src/lib/csv.ts`): non tocca `is_ente`/`referente` — coerente con l'assenza già oggi di `azienda` in quell'export (mai stato aggiunto quando è stata introdotta la feature Azienda). Se in futuro si vuole arricchire il CSV, è un miglioramento a parte.
- Nessuna tabella `clienti` separata: `is_ente`/`referente` restano campi embedded su `orders`, stesso modello di `nome`/`cognome`/`azienda`.
- Nessun impatto sulla chiave di aggregazione clienti (telefono, o `nome|cognome` come fallback) — un ente con più ordini si aggrega comunque per telefono come oggi.
- P.IVA/codice fiscale dell'ente, o una tabella enti riutilizzabile fra clienti diversi — resta tutto testo libero sull'ordine, coerente con l'approccio già in uso per gli altri campi anagrafici.

## Test

- `buildClientDisplayName`: nuovi test (ente senza referente, ente con referente, persona privata invariata — nessuna regressione sui casi esistenti).
- `createOrder`/`updateOrder` (`src/actions/orders.ts`): nuovi test che verificano `is_ente`/`referente` nel payload salvato.
- `getCustomers`: nuovo test sull'aggregazione di `is_ente`/`referente` (stesso pattern "valore più recente non nullo" già testato per `azienda`).
- `/api/search/route.ts`: nuovo test che verifica `referente` nella clausola di ricerca.
- Verifica manuale nel browser (nessuna infrastruttura di test per componenti in questo codebase): creare un ordine ente con e senza referente, controllare le due righe separate in card/bacheca/scheda/etichetta/ricerca/rubrica, poi un ordine privato per confermare che nulla è cambiato.

## Fuori scope

- Editing di massa: cambiare un referente su tutti gli ordini futuri di uno stesso ente in un colpo solo — resta un campo per-ordine, si ripete la digitazione a ogni nuovo ordine (mitigato dall'autocomplete su "Nome ente").
- Backup CSV: aggiungere le due colonne è un miglioramento separato, non richiesto ora.
