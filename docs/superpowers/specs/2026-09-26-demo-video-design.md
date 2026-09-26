# Demo privata con dati finti e video dimostrativo — design

Data: 2026-09-26
Stato: approvato in conversazione, da rileggere prima del piano di implementazione.

## Scopo

Poter **mostrare l'app a una bottega senza mostrare clienti veri**: una copia privata dell'app, nel livello base, con clienti e ordini inventati, usata (1) per registrare un video dimostrativo di circa 3 minuti e (2) per le dimostrazioni dal vivo. Il video si manda con un link su WhatsApp e, più avanti, si mette sul sito vetrina.

Nasce dalla discussione sul funnel di distribuzione: le vendite sono assistite e locali (setup a mano, installazione singola per bottega), quindi serve una dimostrazione credibile, non un servizio pubblico da difendere.

## Decisioni prese

| Domanda | Scelta | Motivo |
|---|---|---|
| Demo pubblica o privata? | **Privata**: la apro io, dal vivo o per registrare | Una demo pubblica con accesso libero porta rischi (spam, dati rovinati da estranei) e lavoro che con 3-5 botteghe pilota non rende |
| Video o demo interattiva? | **Video** (più la demo privata dal vivo) | Costa poco, lo si manda su WhatsApp, racconta la storia giusta in pochi minuti; la demo interattiva resta un'idea futura |
| Quanti video? | **Uno solo, circa 3 minuti**; eventuali corti si ritagliano dopo | Più facile da fare bene |
| Chi parla? | **Io, con la mia voce** (storia in prima persona), testo preparato da noi | La storia di chi ha costruito l'app per la propria bottega è la forza rispetto ai concorrenti |
| Livello mostrato | **Base** (`NEXT_PUBLIC_PLAN=base`) | È la versione da vendere |
| Dove vive la copia | Nuovo progetto Supabase gratuito **già creato** (il vecchio progetto in pausa non si può eliminare e si è visto che non impedisce di crearne un altro) + nuovo progetto Vercel | La bottega è un'installazione singola: non si può condividere il database vero |

## Cosa si costruisce

### 1. La copia demo (infrastruttura)
- **Progetto Supabase "demo"** (creato dall'utente). Lo schema si crea una volta sola incollando nel SQL Editor un file unico ottenuto concatenando le migration in ordine, **dalla `20260626000001_order_schema_v2.sql` in poi** (la `20260625000001_initial_schema.sql` è superata: la v2 cancella e ricrea tutto, come già fatto per la bottega vera). Lo script `scripts/demo-schema.mjs` produce il file `demo-schema.sql` (ignorato da git).
- **Progetto Vercel "demo"**, collegato allo stesso repository, con solo queste variabili: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` del progetto demo e `NEXT_PUBLIC_PLAN=base`. **Non** si impostano `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `BACKUP_EMAIL_*`: senza `CRON_SECRET` la route del backup risponde 401 e non invia niente (il `vercel.json` con il cron viene comunque eseguito dal nuovo progetto, ma è innocuo).
- **Indirizzo:** quello provvisorio di Vercel, oppure `demo.oltrelabottega.it` se si vuole (record DNS presso il registrar, come per `app.`). Decisione rimandata all'esecuzione.
- **Impostazioni di Supabase Auth** del progetto demo: Site URL e Redirect URLs con l'indirizzo della demo (evita il problema già visto del magic link verso `localhost`).
- **Un solo utente**, con email e PIN: l'accesso è quello a PIN già presente nell'app (`signInWithPassword`). Metadati: `shop_name` = "Bottega di esempio", `pin_set` = true, e un marcatore `demo: true` usato dalle protezioni (vedi sotto).
- **Dipendenza:** la demo usa il livello base, che arriva con la Pull Request #1: va unita in `main` prima di pubblicare la demo (oppure il progetto Vercel della demo punta al ramo).

### 2. I dati finti (`npm run demo:reset`)
Un comando che **svuota la demo e la riempie di nuovo**, con date calcolate rispetto al giorno in cui parte, così la pagina Oggi è sempre viva.

- La costruzione dei dati è una **funzione pura** `buildDemoData(oggi: Date)` in `src/lib/demo/demoData.ts`, testata con Jest; lo script (`scripts/demo-reset.ts`, eseguito con `tsx`, nuova dipendenza di sviluppo) la usa e scrive nel database con il client `service role` della demo.
- Contenuto: 15 clienti e 19 ordini con nomi e numeri di telefono inventati (numeri con sequenza di zeri, mai usati per inviare), lavori credibili per una bottega di personalizzazione (targhe, timbri, portachiavi incisi, coppe, magliette), tre clienti ente/azienda con referente (4 ordini).
- Una giornata "viva": 2 lavori da consegnare oggi e 1 consegnato oggi; 3 ordini pronti da avvisare (`status = pronto`, `msg_pronto_inviato = false`); 2 in ritardo; alcuni preventivi (da inviare e inviati); ordini in lavorazione e da fare; un cliente con più ordini passati (storico); 4 promemoria in Agenda (3 attivi e 1 completato oggi); almeno una recensione da chiedere. Ogni ordine ha almeno una riga in `order_items` e `orders.cosa_ordinato`/`prezzo` coerenti con `computeOrderSummary`.
- Il file con le chiavi della demo è **separato** (`.env.demo.local`, ignorato da git, con un modello `.env.demo.example`): `DEMO_SUPABASE_URL`, `DEMO_SERVICE_ROLE_KEY`, `DEMO_USER_EMAIL`, `DEMO_PIN`.

### 3. Protezioni contro lo svuotamento del database vero
Lo script **si rifiuta di partire** se:
1. `DEMO_SUPABASE_URL` manca, o è uguale a `NEXT_PUBLIC_SUPABASE_URL` del file `.env.local` (il progetto vero);
2. il database contiene ordini **o utenti** ma non l'utente marcato `demo: true`;
3. non si conosce l'indirizzo del progetto vero (manca `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`): non si può escludere che sia lui.
La verifica è una funzione pura `assertSafeTarget(...)` con test Jest (progetto vero → rifiuto; indirizzo vero sconosciuto → rifiuto; database con ordini o utenti e senza marcatore → rifiuto; database vuoto o con marcatore → ok).

### 4. Il video
- **Un video di circa 3 minuti**, registrato dall'utente sul computer (programma gratuito, per esempio OBS o Win+G) sulla demo con dati finti, in italiano, con la sua voce.
- **Scaletta** (deliverable `docs/demo/video-scaletta.md`, con testo da adattare a parole sue e lista di controlli prima di registrare): apertura con la storia in due frasi; 1) Oggi, "cosa devo fare oggi"; 2) Nuovo ordine per un cliente che torna (i dati si compilano); 3) Bacheca, spostare un lavoro in "Pronto"; 4) "Avvisa il cliente" con il messaggio già scritto (si mostra, non si invia); 5) foglio lavoro con il QR; 6) storico del cliente; 7) chiusura: "se non rinnovi, l'app continua a funzionare" e il contatto.
- **Dove metterlo:** YouTube come video "non in elenco" (gratis); link su WhatsApp e, più avanti, incorporato nel sito.

## Verifica
1. **Test Jest:** `buildDemoData` (conteggi della giornata viva, coerenza prezzo/saldo/righe, nessun numero di telefono reale, date relative al giorno dato) e `assertSafeTarget` (i tre casi). La suite esistente resta verde.
2. **Prova reale:** eseguire `npm run demo:reset` sul progetto demo, poi accedere alla demo con il PIN (Playwright, script temporaneo) e controllare che Oggi mostri le sezioni previste e che la Bacheca abbia le colonne del livello base; screenshot per un controllo a occhio.
3. **Ripetibilità:** lanciare il comando due volte di seguito produce lo stesso risultato (nessun dato duplicato).
4. **Sicurezza:** provare a lanciare lo script con le chiavi del progetto vero deve fallire con un messaggio chiaro, senza toccare niente (prova fatta con la sola funzione di controllo, mai contro il database vero).

## Fuori scope
- Demo pubblica interattiva sul sito.
- Il pulsante "Guarda come funziona" sul sito vetrina (ramo `feature/sito-vetrina`): si aggiunge quando il video esiste.
- Sottotitoli e montaggio del video, versioni corte.
- Automatizzare il rinfresco (per ora si lancia a mano prima di ogni registrazione o dimostrazione).
- La configurazione di Vercel e di Supabase Auth della demo è un passo manuale guidato, non codice.
