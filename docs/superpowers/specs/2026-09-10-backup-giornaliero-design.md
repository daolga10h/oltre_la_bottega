# Design: backup email da settimanale a giornaliero

Data: 2026-09-10

## Motivazione

Il backup via email (vedere `docs/superpowers/specs/2026-08-14-continuita-dati-backup-design.md`) gira oggi ogni lunedì alle 6:00 UTC. L'utente ha chiesto una cadenza giornaliera "così sono più sicura" — vuole ricevere il CSV di tutti gli ordini ogni giorno, non solo una volta a settimana, come rete di sicurezza aggiuntiva.

## Cosa cambia

### Orario del cron

`vercel.json`: lo schedule passa da `"0 6 * * 1"` (lunedì 6:00 UTC) a `"0 20 * * *"` (ogni giorno alle 20:00 UTC).

Vercel programma i cron solo in UTC, senza supporto ai fusi orari — un orario fisso in UTC scivola di un'ora tra inverno e estate (ora legale). 20:00 UTC corrisponde a 21:00 in inverno (CET) e 22:00 in estate (CEST), scelto esplicitamente dall'utente come orario di sera, dopo la chiusura della bottega, accettando l'oscillazione di un'ora tra le stagioni.

### Rinomina

Il codice attuale chiama tutto "weekly-backup" — con la cadenza giornaliera il nome è fuorviante. Rinominato ovunque in "daily-backup":

- `src/app/api/cron/weekly-backup/route.ts` → `src/app/api/cron/daily-backup/route.ts`
- `src/app/api/cron/weekly-backup/__tests__/route.test.ts` → `src/app/api/cron/daily-backup/__tests__/route.test.ts`
- `vercel.json`: percorso `"path": "/api/cron/weekly-backup"` → `"/api/cron/daily-backup"`
- Dentro `route.ts`: i context string passati a `logInfo`/`logError` (`"cron/weekly-backup"`) e il messaggio di log (`"Backup settimanale inviato"`) diventano `"cron/daily-backup"` e `"Backup giornaliero inviato"`

### Testo dell'email

`src/lib/email/sendBackupEmail.ts`, riga 19: "la copia settimanale di tutti gli ordini" → "la copia giornaliera di tutti gli ordini".

### Documentazione

`CLAUDE.md`: la riga "Decisioni chiave" sul backup via email viene aggiornata per riflettere la cadenza giornaliera e il motivo del cambio (richiesta esplicita dell'utente per maggiore sicurezza, 2026-09-10), mantenendo la storia già scritta sulla verifica del 2026-08-14 e sul fix Resend/mittente. Aggiunta anche una riga alla sezione Testing.

## Cosa NON cambia

- **Logica di invio**: stessa select ordini, stesso CSV (`ordersToCsv`), stessa esclusione dell'utente di test (`@oltrelabottega.local`), stesso controllo "esattamente un utente bottega".
- **Costi**: nessun costo aggiuntivo. Il piano gratuito Resend copre ampiamente 1 email/giorno (ben sotto qualunque soglia gratuita mensile).
- **SimpleBackups** (backup tecnico giornaliero su Google Drive, già configurato il 2026-08-24): resta un sistema indipendente, non toccato da questo cambiamento — questa è solo la copia leggibile via email.
- **`CRON_SECRET`** e la protezione della route: invariati.

## Test

Nessuna infrastruttura di test nuova necessaria — la suite esistente (`route.test.ts`) si sposta con la cartella rinominata, stessi casi (utente bottega assente/ambiguo, invio riuscito, errore Supabase). Verifica manuale post-merge: trigger a mano della route con `Authorization: Bearer <CRON_SECRET>` (curl o browser con header), controllo che l'email arrivi con il testo "giornaliera" e l'allegato CSV corretto.

## Fuori scope

- Nessuna modifica alla logica di selezione ordini o al formato del CSV.
- Nessuna modifica a SimpleBackups.
- Nessun cambiamento all'orario in base a stagione (l'oscillazione di un'ora tra CET/CEST è stata accettata esplicitamente).
