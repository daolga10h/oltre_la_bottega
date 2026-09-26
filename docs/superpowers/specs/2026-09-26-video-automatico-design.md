# Video dimostrativo automatico (muto, con didascalie) — design

Data: 2026-09-26
Stato: direzione approvata in conversazione; dettagli scelti dall'assistente, da rileggere insieme al risultato.

## Scopo

Produrre **da solo** un video dimostrativo di circa 2 minuti e mezzo della demo con dati finti (livello base): un browser automatico percorre la scaletta come farebbe una persona, con un cursore ben visibile e scritte in italiano a schermo. **Nessuna voce**: la versione con la voce della titolare resta possibile in seguito (la si aggiunge sopra le riprese, o si registra a parte con la scaletta di `docs/demo/video-scaletta.md`).

È l'alternativa "B" scartata in un primo momento a favore della voce, richiesta di nuovo dalla titolare perché l'assistente possa realizzarlo senza il suo tempo. Vantaggio: si rifà in pochi minuti ogni volta che l'app cambia.

## Decisioni

| Domanda | Scelta |
|---|---|
| Voce e musica | Nessuna. Solo didascalie in italiano dentro il video |
| Formato | MP4 (H.264, senza audio) per WhatsApp e YouTube; resta anche il WebM originale |
| Risoluzione | 1280×720 |
| Durata | circa 2:30 |
| Contatto in chiusura | Numero WhatsApp della titolare (da fornire: nel codice è una costante con segnaposto, sostituita prima del render finale) |
| Dove finisce | cartella `video/` nella radice del progetto, ignorata da git |
| Applicazione ripresa | Build di produzione locale (`next build` + `next start`), così non compare l'indicatore di sviluppo di Next; collegata al progetto **demo** con `NEXT_PUBLIC_PLAN=base` |
| Conversione | `ffmpeg-static`, installato con `npm install --no-save` (non entra nel progetto) |
| Login | Fatto in un contesto senza registrazione, poi la registrazione parte già su Oggi: la schermata del PIN non compare nel video |

## Come funziona

Comando: `npm run demo:video` (`scripts/demo-video/run.ts`, eseguito con `tsx`).

1. **Rinfresco dei dati:** lancia `scripts/demo-reset.ts` (con tutte le sue protezioni: se punta al progetto vero si ferma). Le riprese creano un ordine, quindi i dati si rimettono a posto anche **alla fine**.
2. **Avvio dell'app:** legge `.env.demo.local`, esegue `next build` e `next start -p 3300` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PLAN=base` presi dalla demo (le variabili dell'ambiente vincono sul `.env.local` del progetto vero).
3. **Controllo di sicurezza prima di registrare:** dopo il login, la pagina Oggi deve contenere un cliente della demo (per esempio "Anna Bellini"); altrimenti si ferma senza registrare, per non riprendere dati veri.
4. **Registrazione:** nuovo contesto con `recordVideo` 1280×720 e la sessione salvata. Uno script iniettato in ogni pagina disegna il **cursore** (con un cerchio che si allarga a ogni clic) e la **barra delle didascalie** in basso (fondo espresso `#3b2716`, testo kraft `#f2e4c9`). Il mouse si muove in modo fluido; il testo si digita lettera per lettera.
5. **Conversione:** WebM → MP4 con ffmpeg; stampa percorso, durata e dimensione.
6. **Pulizia:** ferma il server, rilancia il rinfresco dei dati.

## Scene e didascalie (testo definitivo in `src/lib/demo/videoScenes.ts`)

Una scritta alla volta, al massimo circa 90 caratteri, ciascuna visibile abbastanza a lungo da essere letta (circa 15 caratteri al secondo più una pausa).

1. **Apertura, su Oggi:** "Ciao, sono Olga. Ho una bottega e mi sono costruita un'app per non tenere più tutto a mente." → "Ogni mattina apro questa pagina e so cosa devo fare oggi."
2. **Oggi:** scorre sulle sezioni. "Consegne di oggi, lavori pronti da avvisare, promemoria."
3. **Nuovo ordine:** clic su "Nuovo ordine", scrive "Luca", sceglie *Luca Conti* dai suggerimenti (nome, cognome e telefono si compilano), scrive l'articolo ("Targa per condominio"), il prezzo (30) e la data, clic su "Crea ordine". "Un cliente che torna: i dati si compilano da soli." → "Registro un lavoro in meno di un minuto."
4. **Bacheca:** su una scheda *In lavorazione* apre il menu dello stato e sceglie *Pronto*. "La Bacheca è la mia lavagna: ogni colonna è una fase."
5. **Avvisa il cliente:** apre un ordine *Pronto* (Anna Bellini) dalla Bacheca, mostra il riquadro "Avvisa il cliente" e preme **QR** (non WhatsApp né Email, che aprirebbero programmi veri). "Quando è pronto, il messaggio al cliente è già scritto."
6. **Foglio lavoro:** va sul foglio (stessa scheda, senza aprire nuove schede; la finestra di stampa è disattivata) e lo lascia in vista. "Con una stampante normale stampo il foglio da mettere con il lavoro."
7. **Clienti:** apre l'elenco, poi *Luca Conti* con i suoi 4 ordini. "Quando un cliente torna, vedo subito tutto quello che ha già ordinato."
8. **Chiusura, su Oggi:** "Semplice, perché l'ho fatta per chi lavora in bottega." → "Se non rinnovi, l'app continua a funzionare." → "Scrivimi per una dimostrazione dal vivo · WhatsApp {numero}".

## Verifica
1. **Test Jest** (`src/lib/demo/__tests__/videoScenes.test.ts`): ogni didascalia è non vuota e non più lunga di 95 caratteri; la durata pianificata (somma di didascalie e pause) sta tra 120 e 200 secondi; le scene sono nell'ordine previsto; il numero WhatsApp compare solo nell'ultima scritta.
2. **Esecuzione reale** di `npm run demo:video` contro il progetto demo: il file MP4 esiste, dura tra 2:00 e 3:15, pesa meno di 40 MB, non ha traccia audio.
3. **Controllo a occhio:** estrarre fotogrammi a tempi diversi (uno per scena) e guardarli: cursore visibile, didascalie leggibili e non tagliate, nessun cliente vero, nessun indicatore di sviluppo, nessuna finestra di sistema.
4. **Nessun residuo:** server fermati, dati demo rinfrescati, `git status` pulito (la cartella `video/` è ignorata), nessun file `.env*` toccato.

## Fuori scope
- La voce (resta la registrazione manuale con `docs/demo/video-scaletta.md`).
- Sottotitoli separati, montaggio con musica, versioni corte.
- Il pulsante "Guarda come funziona" nel sito vetrina.
- Pubblicare il video su YouTube (lo fa la titolare).
