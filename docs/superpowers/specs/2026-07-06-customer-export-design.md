# Backup mensile della rubrica clienti — design

**Data**: 2026-07-06
**Stato**: approvato, in attesa di piano di implementazione

## Problema

L'app è single-tenant: tutti i dati clienti vivono nella tabella `orders` di un
unico progetto Supabase, senza un backup indipendente scelto dall'utente.
L'utente vuole una copia mensile della rubrica clienti, cosicché in caso di
problemi esterni (es. incidente sul progetto Supabase) si perda al massimo
qualche settimana di dati, non l'intera base clienti.

Design già discusso in una sessione precedente (2026-07-02, vedi memoria
`project-post-mvp-customer-export`) e ora ripreso e confermato.

## Cosa NON facciamo (scope esplicitamente escluso)

- Nessun invio automatico via email del file.
- Nessun salvataggio del file lato server (Vercel non ha storage persistente;
  Supabase Storage non viene introdotto per questo).
- Nessuna vera pipeline di backup/disaster-recovery — è un export manuale con
  un promemoria che lo ricorda, non un sistema automatico.
- Nessuna versione "storico ordini completo" per ora — solo la rubrica
  riassuntiva (nome, cognome, telefono, email, consenso, totale ordini,
  ultimo ordine). Una variante più completa (con lo storico ordini per
  cliente) è un'estensione naturale futura, non nello scope attuale.

## Architettura

Due componenti indipendenti, nessuna nuova infrastruttura (niente cron
esterni, niente nuove tabelle):

### 1. Promemoria mensile automatico ("lazy", non cron)

- Nuova funzione `ensureMonthlyExportReminder()` in `src/actions/reminders.ts`.
- Invocata all'inizio del render della Dashboard (`/dashboard`) — pagina che
  l'utente apre quasi ogni giorno per prima.
- Logica: cerca un reminder con titolo esatto `"Esportare i clienti"` e
  `due_at` all'interno del mese corrente. Se non lo trova, lo crea con
  `due_at` = primo giorno del mese corrente, `status: "attivo"`.
- Da quel momento il comportamento è quello già esistente per i reminder:
  resta visibile in Agenda (finché non lo si completa) e nella lista
  reminder della Dashboard "Oggi" (che già include ogni reminder attivo con
  `due_at <= oggi`) — nessun meccanismo di "urgenza" nuovo da costruire,
  il comportamento attuale di `getActiveReminders`/`dashboard/today` copre
  già "resta visibile finché non lo segni fatto".
- Fallita silenziosamente (try/catch, log ma non blocca il rendering della
  dashboard) — è un side-effect "nice to have", non deve mai rompere la
  pagina principale dell'app.

### 2. Bottone "Esporta clienti" (CSV on-demand)

- Nuovo route handler `GET /api/customers/export` in
  `src/app/api/customers/export/route.ts`.
- Riusa `getCustomers()` (già esistente in `src/actions/customers.ts`, senza
  filtro di ricerca → tutta la rubrica).
- Genera CSV in memoria (nessuna libreria nuova: costruzione manuale di
  stringhe con escaping di virgole/virgolette/newline) con colonne: Nome,
  Cognome, Telefono, Email, Consenso marketing, Totale ordini, Ultimo
  ordine.
- Risponde con `Content-Type: text/csv` e
  `Content-Disposition: attachment; filename="clienti-YYYY-MM-DD.csv"`.
- Bottone "Esporta clienti" nella pagina `/customers`, semplice `<a href="/api/customers/export">` — nessun JS lato client necessario, il browser gestisce il download.

## Error handling

- `ensureMonthlyExportReminder()`: errori loggati via `logError`, mai
  propagati alla pagina (try/catch silenzioso, come già fatto altrove per
  side-effect non critici).
- Route di export: se `getCustomers()` lancia un errore, risponde 500 con
  messaggio generico (pattern already usato in altre API route del
  progetto, es. `dashboard/today`).

## Testing

- Test unitario per `ensureMonthlyExportReminder()`: non crea un duplicato
  se il reminder del mese esiste già; lo crea se manca o se l'unico
  esistente è di un mese precedente.
- Test unitario per la generazione CSV (funzione pura, es.
  `buildCustomersCsv(customers: CustomerSummary[]): string`) — verifica
  header, escaping di valori con virgole/virgolette, e riga vuota quando
  non ci sono clienti.
- Nessun nuovo test E2E dedicato: il bottone di export è un link semplice,
  coperto a sufficienza dal test unitario della generazione CSV.

## Nota collaterale (fuori scope, da sistemare separatamente)

`getCustomers()` in `src/actions/customers.ts` (riga ~40) ha lo stesso
problema di filter-injection PostgREST già corretto in `getOrders` il
2026-07-03 (ricerca clienti non sanificata in `.or()`). Va corretto con lo
stesso pattern di escaping, ma è un fix indipendente da questa feature.
