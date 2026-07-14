# Nome dell'operatore che inserisce l'ordine — design

**Data**: 2026-07-14
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Oggi, con gli ordini su carta, si capisce "chi ha preso l'ordine" dalla
calligrafia. Con l'introduzione del login con PIN condiviso (un solo
account Supabase per tutta la bottega, [[2026-07-13-login-pin-design]])
questo segnale sparisce: non c'è più modo di distinguere chi ha inserito
un ordine specifico. Serve un modo esplicito di tracciarlo.

## Cosa NON facciamo (scope esplicitamente escluso)

- Nessuna tabella "dipendenti"/"utenti" — resta il modello single-tenant
  (un solo account Supabase per bottega, nessuna autenticazione per
  persona). L'elenco operatori è solo un elenco di nomi, non un sistema di
  permessi.
- Nessuna modifica al campo dopo la creazione dell'ordine — non compare nel
  form di modifica. È un dato di fatto ("chi ha preso l'ordine"), non una
  proprietà editabile.
- Nessuna visibilità in lista/bacheca ordini né sull'etichetta di stampa —
  solo nella scheda ordine (dettaglio), come già canale/tipo lavorazione.
- Nessuno storico di chi modifica un ordine dopo la creazione — fuori
  scope, sarebbe un audit log per-campo molto più ampio di questa
  richiesta.

## Modello dati

- Nuova colonna `orders.operatore` — testo, nullable (nessun vincolo
  `NOT NULL`: stesso pattern già usato per `telefono`/`cognome`/
  `data_consegna`, obbligatorio solo lato form, gli ordini esistenti
  restano validi senza modifiche).
  Migration: `supabase/migrations/20260714000001_add_operatore.sql`
  (prossima in ordine dopo `20260707000001_add_materiale_fornitore.sql`).
- Elenco dei nomi operatori in `user_metadata.operatori` (array di
  stringhe) — stesso posto dove già vive `shop_name`
  ([[2026-07-13-login-pin-design]]). Nessuna tabella nuova, nessuna
  migration per l'elenco: si legge/scrive con
  `supabase.auth.getUser()`/`updateUser({ data: { operatori: [...] } })`.

## Comportamento

### Gestione elenco operatori (Impostazioni)

Nuova card "Operatori" in `/impostazioni`, sotto quella del PIN. Campo
testo + pulsante "Aggiungi"; ogni nome ha una X per rimuoverlo.
Salvataggio immediato ad ogni aggiunta/rimozione (nessun pulsante "Salva"
separato — stesso stile leggero già usato per i promemoria, senza
`confirm()`).

Validazione minima lato client: nome non vuoto dopo trim, niente
duplicati (confronto case-insensitive). Rimuovere un nome dall'elenco non
tocca gli ordini già salvati con quel valore in `operatore` — è un campo
testo, non una chiave esterna, quindi il nome resta leggibile sugli ordini
passati anche se non più selezionabile per i nuovi.

### Form nuovo ordine

Nuovo menu a tendina "Operatore *" (obbligatorio) nella sezione Ordine di
`OrderForm.tsx`, popolato dall'elenco in `user_metadata.operatori`. Solo
nel form di **creazione** (`isEdit === false`) — il campo non compare nel
form di modifica.

Preseleziona l'ultimo operatore scelto su quel dispositivo, tramite un
nuovo modulo `src/lib/device-operator.ts` (`getRememberedOperator`/
`setRememberedOperator`), stesso pattern di `device-email.ts` usato per il
login con PIN. Resta comunque modificabile dal menu prima di salvare.

**Elenco vuoto** (bottega appena configurata, nessun operatore ancora
aggiunto): il menu non ha opzioni da mostrare. Al suo posto compare un
messaggio con link a "Impostazioni" per aggiungere il primo operatore, e
il pulsante di salvataggio dell'ordine resta disabilitato — l'utente deve
prima aggiungere almeno un nome. Stesso principio già seguito per gli
altri campi obbligatori (telefono/cognome/data consegna): il dato è
importante abbastanza da bloccare, non da lasciare vuoto silenziosamente.

### Scheda ordine (dettaglio)

Il nome operatore compare nel blocco "Key info" già esistente (dove oggi
si vede "Consegnato il"), come informazione di dettaglio — non un dato di
scansione rapida.

## Error handling

Stesso pattern già in uso in `src/actions/orders.ts`: errori loggati via
`logError` e propagati come `Error(USER_MESSAGES.saveFailed)` verso la UI.
Per l'aggiornamento dell'elenco operatori in Impostazioni, eventuali
errori di `updateUser` mostrano un messaggio inline nella card, senza
bloccare il resto della pagina.

## Testing

- Test unitari per `device-operator.ts` (wrapper minimi su
  `localStorage`, stesso trattamento già riservato a `device-email.ts` —
  copertura reale dalla verifica manuale, non testabile in modo
  significativo con `testEnvironment: "node"`).
- Test unitario per la funzione di validazione/dedupe usata
  dall'elenco operatori in Impostazioni (trim, rifiuto vuoto, rifiuto
  duplicato case-insensitive).
- Aggiornare i test esistenti di `createOrder`/`getOrders` se necessario
  per includere `operatore` nelle query e nel payload di creazione.
- Verifica manuale: elenco operatori vuoto → form nuovo ordine mostra il
  link a Impostazioni invece del menu, salvataggio bloccato → aggiungere
  un operatore da Impostazioni → tornare al form → menu popolato,
  operatore preselezionato dopo il primo utilizzo su quel dispositivo →
  scheda ordine mostra il nome salvato → form di modifica non mostra il
  campo.