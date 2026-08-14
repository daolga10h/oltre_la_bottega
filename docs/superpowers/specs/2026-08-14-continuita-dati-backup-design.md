# Continuità e sicurezza dei dati per l'istanza cliente — backup e anti-pausa

**Data**: 2026-08-14
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Il modello single-tenant prevede che ogni cliente riceva la propria istanza
Supabase + Vercel, intestata e pagata da lui ("ognuno paga per sé" — vedere
CLAUDE.md, riga "Account Supabase e Vercel dell'istanza cliente..."). A
differenza del vecchio Danea Easyfatt desktop — dove i dati restano sul PC
del cliente e restano consultabili anche a zero rinnovi — la nostra
architettura è interamente cloud: se l'operatore di negozio è assente a
lungo (malattia, ferie) o l'istanza viene abbandonata, non esiste alcuna
copia locale di riserva.

Rischio concreto identificato: un progetto Supabase sul piano gratuito va
in pausa dopo 7 giorni senza alcuna richiesta (nessuna azione umana
necessaria per innescarlo — basta che nessuno apra l'app per una
settimana). Dopo 90 giorni di pausa il ripristino "a un click" si
disattiva; oltre un periodo più lungo il progetto viene rimosso insieme ai
dati.

Serve una rete di sicurezza che non dipenda dal fatto che qualcuno se ne
ricordi.

## Cosa NON facciamo

- Non centralizziamo l'invio email sotto un unico account nostro condiviso
  fra tutti i clienti — ogni cliente ha il proprio account Resend, per non
  far transitare i dati personali di clienti diversi attraverso lo stesso
  account terzo (motivo di privacy/GDPR, non solo di coerenza con "ognuno
  paga per sé").
- Non costruiamo un bottone di "ripristino automatico" dai backup — sia il
  dump di SimpleBackups sia il CSV settimanale servono per consultazione o
  recupero manuale in un caso estremo, non per un restore automatizzato.
- Non tocchiamo l'idea, già annotata in precedenza e indipendente da questo
  lavoro, di un'esportazione manuale su richiesta con promemoria mensile —
  resta un progetto a sé, con uno scopo diverso (comodità, non continuità).
- Non costruiamo un endpoint di keep-alive dedicato — il collegamento
  giornaliero di SimpleBackups per eseguire il backup dovrebbe di per sé
  impedire la pausa per inattività di Supabase (assunzione da verificare al
  primo utilizzo reale, vedere "Testing").
- Non usiamo lo storage gratuito incluso in SimpleBackups come destinazione
  di default — si preferisce lo storage del cliente (es. il suo Google
  Drive) per evitare che un'azienda terza detenga stabilmente una copia dei
  dati personali dei clienti.

## Decisione

Due meccanismi automatici, indipendenti da qualunque azione umana:

### 1. SimpleBackups — backup tecnico giornaliero

Servizio esterno (piano gratuito Basic, €0/mese), configurato una tantum
durante l'attivazione del cliente:

- Collegato al progetto Supabase del cliente
- Backup giornaliero dell'intero database Postgres
- Destinazione: lo storage del cliente (consigliato Google Drive, quasi
  sempre già posseduto — nessun account nuovo da creare per il cliente),
  non lo storage proprio di SimpleBackups
- Notifica via email in caso di fallimento di un backup

### 2. Email settimanale con CSV leggibile

Codice nostro, dentro il repository esistente:

- Un Vercel Cron Job (`vercel.json`), entro il limite gratuito Hobby (max 2
  cron, al massimo una volta al giorno — un cron settimanale rientra
  comodamente), schedulato ogni lunedì mattina
- La route interroga tutti gli ordini (storico completo, non solo attivi)
- Genera un CSV in memoria con intestazioni in italiano leggibili (non i
  nomi dei campi del database)
- Recupera l'email della bottega dall'utente Supabase Auth esistente
  dell'istanza (la stessa email del login — nessun nuovo campo da
  aggiungere)
- Invia l'email con allegato CSV tramite Resend, usando l'account del
  cliente (API key propria, letta da variabile d'ambiente nel suo progetto
  Vercel)
- Se `RESEND_API_KEY` non è configurata, il job termina senza errore e
  senza inviare nulla — funzione opzionale, non blocca il resto dell'app

## Setup una tantum

Entrambi i servizi vengono creati e collegati dal venditore/sviluppatore
insieme al cliente, nella stessa sessione in cui si configurano già
Supabase e Vercel — non è il cliente a doverli capire o attivare da solo:

- Account SimpleBackups a nome del cliente → collegamento a Supabase →
  destinazione impostata sul Google Drive del cliente
- Account Resend a nome del cliente → API key generata → inserita come
  variabile d'ambiente nel progetto Vercel del cliente

Da quel momento entrambi restano invisibili nell'uso quotidiano, come già
Supabase e Vercel.

## Sicurezza e GDPR

- SimpleBackups ha un DPA (accordo sul trattamento dati) conforme GDPR con
  clausole contrattuali standard UE, e si impegna a cancellare ogni copia
  dei dati entro 10 giorni lavorativi dalla cessazione del servizio.
- Usando lo storage del cliente come destinazione, SimpleBackups tratta i
  dati solo in transito (non li conserva stabilmente sui propri server) —
  riduce ulteriormente l'esposizione rispetto a usare il loro storage
  incluso.
- L'email settimanale con CSV finisce nella casella di posta della
  bottega: la sicurezza di quel canale dipende dalla password/protezione
  di quella casella, fuori dal controllo tecnico dell'app — da segnalare
  al cliente in fase di attivazione (usare una password robusta
  sull'email che riceve i backup).
- Nessuno dei due backup espone dati diversi o più concentrati di quelli
  già visibili nell'app stessa (es. la pagina "Clienti", rubrica derivata
  da `orders`): entrambi i meccanismi leggono la stessa tabella `orders`
  già esistente, nessuna nuova categoria di dato viene raccolta o
  duplicata per questo lavoro.

## Intervento di codice (minimo)

- Nuova route `/api/cron/weekly-backup`, protetta da header segreto
  (`CRON_SECRET`, pattern standard Vercel Cron)
- Funzione pura che trasforma la lista ordini in righe CSV con intestazioni
  italiane — testabile in isolamento, stesso pattern già usato nel
  progetto per la logica di dominio (es. `orderConstants.ts`,
  `calculator.ts`)
- Invio email via SDK/API di Resend con il CSV in allegato
- Una voce in `vercel.json` per lo scheduling settimanale del cron
- Nessuna modifica allo schema del database

## Testing

Nessun test E2E automatico sull'invio email reale o sul funzionamento di
SimpleBackups (dipendenze esterne) — stesso trattamento già riservato ad
altre funzionalità con dipendenze esterne nel progetto (stampante,
WhatsApp). Copertura prevista:

- Test unitari sulla funzione pura ordini → righe CSV (intestazioni
  corrette, valori formattati, nessun dato mancante)
- Verifica manuale alla prima attivazione su un cliente reale:
  1. Configurare SimpleBackups e confermare che il backup giornaliero
     arrivi davvero sul Google Drive del cliente
  2. Confermare che il collegamento giornaliero di SimpleBackups impedisca
     davvero la pausa per inattività di Supabase (assunzione da
     verificare sul campo, non solo sulla documentazione)
  3. Attendere il primo lunedì e confermare che l'email settimanale arrivi
     con il CSV corretto, apribile senza problemi in Excel/Fogli Google

## Nota per l'implementazione

Quando implementato e verificato su un cliente reale:

- Aggiungere una riga in "Decisioni chiave e motivazioni" di CLAUDE.md
  (continuità dati: SimpleBackups + email CSV settimanale, motivazione:
  nessun fallback locale come nel vecchio Danea Easyfatt desktop, dato che
  l'architettura è interamente cloud)
- Aggiornare la checklist pubblica "Cosa serve per usare Oltre la
  Bottega", aggiungendo SimpleBackups/Google Drive come voce consigliata
  (non obbligatoria — l'app resta utilizzabile anche senza)
- Aggiornare la sezione Roadmap/Fase 3 se pertinente