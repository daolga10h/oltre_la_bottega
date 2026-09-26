# Configurare la demo (una volta sola)

La demo è una copia dell'app con clienti e ordini **inventati**. Serve per registrare il video e per le dimostrazioni dal vivo. Non ha niente a che fare con i dati della tua bottega.

Ti servono due cose: un progetto **Supabase** (il database, l'hai già creato) e un progetto **Vercel** (il sito). Segui i passi in ordine.

> **Regola d'oro:** non incollare mai chiavi o password in una chat. Vanno solo nel file `.env.demo.local` sul tuo computer.

## A. Il database (Supabase)

1. Nella cartella del progetto, apri il terminale e scrivi `npm run demo:schema`. Crea un file `demo-schema.sql`.
2. Apri quel file, seleziona tutto (Ctrl+A) e copia (Ctrl+C).
3. In Supabase apri il **progetto demo** (controlla il nome in alto a sinistra: deve essere quello nuovo, non quello della bottega!). Vai su **SQL Editor** → **New query**, incolla e premi **Run**. Deve comparire "Success". Se compare un errore, copiami il messaggio. Il file controlla da solo che il progetto sia vuoto: se ti dice 'Questo progetto non è vuoto', **non è un errore tuo**, vuol dire che sei nel progetto sbagliato (o in uno già usato): fermati e controlla il nome in alto.
4. Vai su **Project Settings → API** (o **API Keys**). Ti servono tre valori:
   - l'indirizzo del progetto (Project URL);
   - la chiave pubblica (`anon` o `publishable`);
   - la chiave segreta (`service_role` o `secret`).

## B. Il file con le chiavi

1. Nella cartella del progetto copia il file `.env.demo.example` e chiama la copia `.env.demo.local`.
2. Aprilo e sostituisci i valori con i tre del punto A.4. Scegli un **PIN di 6 cifre** (esattamente 6) e un'email a piacere per l'utente demo (va bene quella già scritta).
3. Salva. Questo file **non** viene mai caricato su GitHub: resta solo sul tuo computer.

## C. I dati finti

Lancialo subito dopo aver incollato lo schema: **non creare utenti a mano** nel progetto demo (né con 'Add user' né con un link via email), altrimenti la protezione si rifiuta di partire.

1. Nel terminale scrivi `npm run demo:reset`.
2. Deve rispondere `Demo rinfrescata: 19 ordini ...`. La prima volta crea anche l'utente demo.
3. Se rispondesse con un errore che dice "non tocco niente", **è la protezione che funziona**: leggi il messaggio e dimmelo, non aggiustare niente da sola.

## D. Il sito (Vercel)

1. Su vercel.com: **Add New… → Project**, scegli il repository `oltre_la_bottega` e premi **Import**.
2. Chiama il progetto `oltre-la-bottega-demo`.
3. Apri **Environment Variables** e aggiungi **solo queste tre**:
   - `NEXT_PUBLIC_SUPABASE_URL` = l'indirizzo del progetto demo;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la chiave **pubblica** della demo;
   - `NEXT_PUBLIC_PLAN` = `base`.
   Non aggiungere nient'altro (in particolare niente chiave segreta e niente impostazioni della posta): così la demo non può inviare email.
4. Se la Pull Request del livello base non è ancora stata unita in `main`: dopo l'importazione vai su **Settings → Git → Production Branch** e scrivi `feature/livello-base`. Quando la Pull Request sarà unita, rimetti `main`.
5. Premi **Deploy**. Alla fine copia l'indirizzo che finisce con `.vercel.app`.

## E. Ultimo ritocco in Supabase

Nel progetto demo vai su **Authentication → URL Configuration** e scrivi l'indirizzo della demo in **Site URL**; aggiungi lo stesso indirizzo seguito da `/**` in **Redirect URLs**. Serve solo per il login con il link via email; il login con il PIN funziona anche senza.

## F. Prova

Apri l'indirizzo della demo, scegli la scheda **PIN**, scrivi l'email demo e il PIN. Devi entrare nella pagina **Oggi** e vedere consegne, ordini pronti da avvisare e promemoria.

## Da ricordare

- **Prima di ogni registrazione o dimostrazione**, scrivi `npm run demo:reset`: rimette i dati con le date di oggi.
- Se Supabase mette in pausa la demo (dopo una settimana senza uso), nel pannello premi **Restore project** e aspetta un paio di minuti.
- Il numero del telefono e le email dei clienti della demo sono inventati: non si può contattare nessuno per sbaglio.
- Facoltativo, più avanti: un indirizzo tutto tuo come `demo.oltrelabottega.it` (record DNS dal registrar, come già fatto per `app.`).
