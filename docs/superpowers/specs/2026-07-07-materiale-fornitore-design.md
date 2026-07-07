# Materiale da ordinare dal fornitore — design

**Data**: 2026-07-07
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Alcuni ordini richiedono materiale che va prima ordinato a un fornitore
esterno, prima di poter essere lavorati. Oggi questo passaggio non è tracciato
da nessuna parte nell'app — è nella testa dell'utente. È una situazione
ricorrente (non un caso raro da gestire con una nota libera), quasi sempre
nota già alla creazione dell'ordine, ma a volte scoperta dopo (il materiale
finisce mentre l'ordine è già in lavorazione).

## Cosa NON facciamo (scope esplicitamente escluso)

- Nessuna gestione inventario/magazzino — non stiamo resuscitando la vecchia
  pagina `/inventory` rimossa il 2026-07-04. Questo è un tracciamento per
  singolo ordine, non un sistema di stock.
- Nessun blocco reale sul cambio di stato: l'utente può sempre spostare
  manualmente un ordine a "In lavorazione" anche se il materiale non è
  ancora arrivato (es. può comunque procedere con bozze grafiche o altra
  preparazione). Solo avviso visivo, coerente con l'assenza di blocchi
  rigidi nel resto dell'app.
- Nessuna nuova colonna in bacheca: il sottostato materiale non è un valore
  di `status`, quindi la bacheca resta a 5 colonne.
- Nessun campo "data prevista arrivo" — non richiesto dall'utente, si
  aggiungerà solo se emerge un bisogno reale in uso.
- Nessuna integrazione con fornitori (email/API) — solo campi di testo
  libero.

## Modello dati

Nuove colonne su `orders` (stesso pattern già usato per `preventivo` e
`bozza_grafica`: sottostato indipendente dallo `status` principale, nessuna
nuova tabella):

- `materiale` — testo, default `'non_serve'`, check constraint
  `in ('non_serve', 'da_ordinare', 'ordinato', 'arrivato')`
- `materiale_fornitore` — testo libero, nullable (nome fornitore)
- `materiale_cosa_manca` — testo libero, nullable (cosa manca)
- `materiale_data_ordine` — data, nullable (quando è stato ordinato al
  fornitore)

Migration: `supabase/migrations/20260707000001_add_materiale_fornitore.sql`
(prossima in ordine dopo `20260702000002_add_da_fare_status.sql`).

## Comportamento

### Materiale arrivato → avanzamento automatico in un caso specifico

Quando `materiale` passa ad `"arrivato"`, se lo `status` attuale
dell'ordine è `"da_fare"`, lo status avanza automaticamente a
`"in_lavorazione"` (stesso meccanismo già usato per bozza/preventivo
approvati in `updateBozzaGrafica`/`updatePreventivo`). Non scatta se lo
status è `"preventivo"` o `"bozza_grafica"` (ancora in attesa
dell'approvazione del cliente) — dato che `"da_fare"` si raggiunge solo
dopo che questi passaggi sono già risolti, quindi la condizione
`status === "da_fare"` copre esattamente il caso "pronto per partire,
manca solo il materiale". Nessun cambiamento se lo status è già
`"in_lavorazione"`, `"pronto"` o `"consegnato"`.

Per tutti gli altri passaggi (`non_serve → da_ordinare → ordinato`), il
sottostato materiale non tocca lo `status` principale: è puramente
informativo/di promemoria, perché il lavoro può comunque procedere in
parte (es. bozze grafiche, preparazione) anche senza materiale.

### Form ordine (creazione e modifica)

Nuova select "Materiale fornitore" nella sezione Ordine di `OrderForm.tsx`,
accanto a Tipo lavorazione / Bozza grafica / Preventivo (nuova riga, dato che
la riga attuale è già a 3 colonne). Opzioni: Non serve / Da ordinare /
Ordinato / Arrivato. Quando il valore è diverso da "Non serve" compaiono i
due campi di testo libero: Fornitore e Cosa manca.

### Scheda ordine (dettaglio)

Bottoni rapidi per passare `da_ordinare → ordinato → arrivato` senza entrare
in modifica, stesso pattern già esistente per bozza/preventivo
(`updateBozzaGrafica`/`updatePreventivo` in `src/actions/orders.ts`). Nuova
server action `updateMaterialeFornitore(id, value)`:

- Quando `value === "ordinato"`, imposta anche
  `materiale_data_ordine = oggi` lato server (nessun input manuale).
- Quando `value === "arrivato"` e lo `status` corrente è `"da_fare"`,
  imposta anche `status = "in_lavorazione"`.
- Inserisce una riga in `order_events` con testo descrittivo italiano:
  "Materiale da ordinare" / "Materiale ordinato al fornitore" / "Materiale
  arrivato" (stessa convenzione già usata per bozza/preventivo/status).

`materiale_fornitore` e `materiale_cosa_manca` restano modificabili solo
dal form di modifica completo, non dai bottoni rapidi.

### Badge su lista e bacheca

Quando `materiale` è `da_ordinare` o `ordinato`, la card ordine (in
`OrderCard.tsx` e `KanbanBoard.tsx`) mostra un badge visivo (icona +
etichetta breve, es. "materiale"), sullo stesso stile del badge "attesa" già
esistente per preventivo/bozza inviati. Nessun badge per `non_serve` o
`arrivato`.

### Dashboard "Oggi"

Due nuove schede, stesso pattern già in uso per "Da consegnare oggi" /
"Consegnati oggi":

- **"Materiale da ordinare"** — ordini con `materiale = 'da_ordinare'`.
  Azione concreta da fare oggi (chiamare/ordinare dal fornitore).
- **"Materiale ordinato oggi"** — ordini con `materiale = 'ordinato'` e
  `materiale_data_ordine = oggi`. Visibile solo fino a fine giornata (stesso
  meccanismo già usato per "Consegnati oggi" e per i promemoria completati:
  la query filtra su data odierna, quindi il giorno dopo la scheda si
  svuota naturalmente senza bisogno di un job di pulizia). Dà conferma
  visiva del lavoro amministrativo fatto in giornata.

Entrambe le schede si aggiungono a `GET /api/dashboard/today` e al relativo
componente `TodayBoard.tsx`.

## Error handling

Stesso pattern già in uso in `src/actions/orders.ts`: errori loggati via
`logError` e propagati come `Error(USER_MESSAGES.saveFailed)` verso la UI.
Nessun caso nuovo da gestire — è lo stesso schema di
`updateBozzaGrafica`/`updatePreventivo`.

## Testing

- Test unitari per `updateMaterialeFornitore`: imposta correttamente
  `materiale`; compila `materiale_data_ordine` solo quando il valore è
  "ordinato"; fa avanzare `status` a "in_lavorazione" solo quando il
  valore è "arrivato" **e** lo status era "da_fare" (non quando era
  "preventivo"/"bozza_grafica"/altro); scrive l'evento con il testo
  giusto per ciascun valore.
- Aggiornare i test esistenti di `getOrders`/`dashboard/today` se
  necessario per includere i nuovi campi nelle query.
- Test unitario per le due nuove query dashboard ("Materiale da ordinare",
  "Materiale ordinato oggi") — verificano il filtro corretto su
  `materiale` e su `materiale_data_ordine = oggi`.
- Verifica manuale: creare un ordine con materiale da ordinare → badge
  visibile in lista/bacheca e scheda visibile in dashboard "Oggi" → segnare
  "ordinato" → sparisce da "Materiale da ordinare", compare in "Materiale
  ordinato oggi" con data automatica → segnare "arrivato" con status
  "da_fare" → status passa a "in_lavorazione" automaticamente, badge
  sparisce, nessuna delle due schede dashboard lo mostra più.