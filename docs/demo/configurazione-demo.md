# Configurare la demo (una volta sola)

La demo è una copia dell'app con clienti e ordini **inventati**. Serve per registrare il video e per le dimostrazioni dal vivo. Non ha niente a che fare con i dati della tua bottega.

Ti servono due cose: un progetto **Supabase** (il database, l'hai già creato) e un progetto **Vercel** (il sito). Segui i passi in ordine.

> **Regola d'oro:** non incollare mai chiavi o password in una chat. Vanno solo nel file `.env.demo.local` sul tuo computer.

## Prima di cominciare

Apri in Esplora file la cartella `D:\Documenti\Projects\oltre_la_bottega\.claude\worktrees\demo-video`: è la cartella di lavoro della demo. Finché il lavoro non sarà unito al resto del progetto, i comandi di questa guida esistono solo lì (la cartella principale del progetto è sul ramo del sito e non li ha). Clicca sulla barra dell'indirizzo, scrivi `powershell` e premi Invio: si apre il terminale già nella cartella giusta. Scrivi `git branch --show-current`: deve rispondere `feature/demo-video`; se risponde altro, fermati e chiedimi. In questa cartella le dipendenze sono già installate e il file `.env.local` (quello di sempre, serve alla protezione per riconoscere il progetto vero) c'è già. Ogni volta che riapri il terminale, riparti da qui. Dopo l'unione in `main` potrai usare la cartella principale del progetto (in quel caso, la prima volta, scrivi `npm install` e aspetta la fine).

## A. Il database (Supabase)

1. Nella cartella del progetto, apri il terminale e scrivi `npm run demo:schema`. Crea un file `demo-schema.sql`.
2. Scrivi `notepad demo-schema.sql`, premi Ctrl+A e Ctrl+C, poi chiudi.
3. In Supabase apri il **progetto demo** (controlla il nome in alto a sinistra: deve essere quello nuovo, non quello della bottega!). Vai su **SQL Editor** → **New query**, incolla e premi **Run**. Deve comparire "Success". Se compare un errore, copiami il messaggio. Il file controlla da solo che il progetto sia vuoto: se ti dice 'Questo progetto non è vuoto', **non è un errore tuo**, vuol dire che sei nel progetto sbagliato (o in uno già usato): fermati e controlla il nome in alto. Supabase ti mostrerà un avviso giallo su operazioni che cancellano dati: è normale (lo schema ricrea le tabelle). Premi conferma **solo se il nome in alto è il progetto demo**.
4. Vai su **Project Settings → Data API** (oppure il bottone **Connect**) per l'indirizzo, e su **Settings → API Keys** per le chiavi. Ti servono tre valori:
   - l'indirizzo del progetto (Project URL);
   - la chiave pubblica (`anon` o `publishable`);
   - la chiave segreta (`service_role` o `secret`).

   Se vedi due schede di chiavi ('nuove' e 'legacy'), va bene una qualunque coppia purché sia dello **stesso progetto demo**.

## B. Il file con le chiavi

1. Nel terminale scrivi `copy .env.demo.example .env.demo.local`, poi `notepad .env.demo.local`.
2. Sostituisci i valori con i tre del punto A.4. Scegli un **PIN di 6 cifre** (esattamente 6) e un'email a piacere per l'utente demo (va bene quella già scritta). **Attenzione: copia questi valori solo dal progetto demo, controlla il nome del progetto in alto a sinistra. Quelli della bottega vera non vanno mai in questo file né in Vercel.**
3. Salva con Ctrl+S e chiudi. Controlla che il nome del file non finisca con `.txt`. Questo file **non** viene mai caricato su GitHub: resta solo sul tuo computer.

## C. I dati finti

Esegui questo passo subito dopo aver incollato lo schema (e aver compilato il file del punto B). **Non creare utenti a mano** nel progetto demo (né con 'Add user' né con un link via email), altrimenti la protezione si rifiuta di partire.

1. Nel terminale scrivi `npm run demo:reset`.
2. Deve rispondere `Demo rinfrescata: 19 ordini ...`. La prima volta crea anche l'utente demo.
3. Se rispondesse con un errore che dice "non tocco niente", **è la protezione che funziona**: leggi il messaggio e dimmelo, non aggiustare niente da sola.

## D. Il sito (Vercel)

1. Su vercel.com: **Add New… → Project** (o **New Project**), scegli il repository `oltre_la_bottega` e premi **Import**.
2. Chiama il progetto `oltre-la-bottega-demo`.
3. Apri **Environment Variables** e aggiungi **solo queste tre**:
   - `NEXT_PUBLIC_SUPABASE_URL` = l'indirizzo **completo** del progetto demo, che inizia con `https://` e finisce con `.supabase.co`;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la chiave **pubblica** della demo;
   - `NEXT_PUBLIC_PLAN` = `base`.

   Copia i valori solo dal progetto demo: quelli della bottega vera non vanno mai in Vercel. Non aggiungere nient'altro (in particolare niente chiave segreta e niente impostazioni della posta): così la demo non può inviare email. Inserisci le variabili **prima** di premere Deploy: i valori `NEXT_PUBLIC_` vengono fissati durante la pubblicazione; se le cambi dopo, devi fare **Redeploy**.
4. Premi **Deploy**. Se la Pull Request del livello base non è ancora unita in `main`, questo primo sito sarà la versione completa: va bene, si corregge subito.
5. Solo se la Pull Request non è ancora unita: nel progetto Vercel vai su **Settings → Environments → Production → Branch Tracking**, scrivi `feature/livello-base` e premi **Save**. Poi vai su **Deployments**, apri i tre puntini sull'ultimo deploy e scegli **Redeploy**. Quando la Pull Request sarà unita in `main`, rimetti `main`.
6. Alla fine copia l'indirizzo che finisce con `.vercel.app`.

## E. Ultimo ritocco in Supabase

Nel progetto demo vai su **Authentication → URL Configuration** e scrivi l'indirizzo della demo in **Site URL**; aggiungi lo stesso indirizzo seguito da `/**` in **Redirect URLs** (premi **Add URL** poi **Save**). Serve solo per il login con il link via email; il login con il PIN funziona anche senza.

## F. Prova

Apri l'indirizzo della demo, scegli la scheda **PIN**, scrivi l'email demo e il PIN. Devi entrare nella pagina **Oggi** e vedere consegne, ordini pronti da avvisare e promemoria.

Controlla due cose:

- Nel menu a sinistra NON devono comparire *Ordini*, *Da incassare*, *Riepilogo* (versione base). Se compaiono, il passo D.5 non è stato fatto.
- Nella pagina Oggi devi vedere clienti come *Giulia Ferri*, *Anna Bellini* e *Marco Neri* (*Luca Conti* lo trovi nella pagina **Clienti**). Se vedi i tuoi clienti veri, **fermati**: hai usato le chiavi sbagliate.

## Da ricordare

- **Prima di ogni registrazione o dimostrazione**, scrivi `npm run demo:reset`: rimette i dati con le date di oggi.
- Se Supabase mette in pausa la demo (dopo una settimana senza uso), nel pannello premi **Restore project** e aspetta un paio di minuti.
- Se la demo era in pausa: dopo **Restore project** aspetta che il pannello la mostri attiva, poi lancia `npm run demo:reset` (con il progetto in pausa lo script fallisce).
- Non lanciare `npm run demo:reset` tra mezzanotte e le 2 di notte: le date verrebbero calcolate sul giorno prima.
- Se PowerShell dice che "l'esecuzione di script è disabilitata", apri il terminale scrivendo `cmd` (al posto di `powershell`) nella barra dell'indirizzo di Esplora file.
- Il numero del telefono e le email dei clienti della demo sono inventati: non si può contattare nessuno per sbaglio.
- Facoltativo, più avanti: un indirizzo tutto tuo come `demo.oltrelabottega.it` (record DNS dal registrar, come già fatto per `app.`).

## Rifare il video automatico

Un video muto di circa 2 minuti e mezzo, con le scritte in italiano, si rifà da solo con un comando: un browser automatico percorre la demo come farebbe una persona.

1. Solo la prima volta, nel terminale: `npm install --no-save ffmpeg-static` (il programma che converte il video; non entra nel progetto).
2. Il numero WhatsApp che compare nell'ultima scritta si scrive nel file `.env.demo.local`, su una riga `DEMO_VIDEO_WHATSAPP=333 111 2222` (con il tuo numero al posto di questo d'esempio). Sta solo lì, mai nel codice: il progetto su GitHub è pubblico.
3. Nel terminale: `npm run demo:video`. Ci vogliono alcuni minuti: rinfresca i dati demo, prepara l'app, registra e converte. Non serve toccare niente mentre lavora.
4. Il video finisce nella cartella `video` del progetto: `oltre-la-bottega-demo.mp4` (per WhatsApp e YouTube) e `oltre-la-bottega-demo.webm` (l'originale).

Il comando si ferma senza registrare se l'app non mostra i clienti della demo (per esempio con chiavi sbagliate in `.env.demo.local`), e alla fine rimette a posto i dati demo da solo. Se l'app cambia in modo visibile, basta rilanciarlo.
