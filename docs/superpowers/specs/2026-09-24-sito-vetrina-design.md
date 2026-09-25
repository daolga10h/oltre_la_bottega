# Sito vetrina di Oltre la Bottega — design

Data: 2026-09-24

## Obiettivo

Un sito che racconta l'app a titolari di botteghe artigiane e micro-attività (1–5 persone) e li porta a una cosa sola: **prenotare una dimostrazione**. Il dominio `oltrelabottega.it` è libero (l'app vive su `app.oltrelabottega.it`).

La forza del sito è la storia vera di Olga: l'app è nata dalla sua esigenza in una bottega reale, non da un elenco di funzionalità. Il sito deve far sentire questo prima di mostrare qualsiasi schermata.

## Decisioni prese

| Tema | Decisione | Motivo |
|---|---|---|
| Direzione visiva | Campione **C · La storia**, con lo stile e i colori dell'app (DESIGN.md, Inter, logo ufficiale) | La storia in prima persona è ciò che i concorrenti non possono copiare. I campioni sono in `https://claude.ai/artifact/5XouK82MET9DRVFhwJSH7N` |
| Pulsante principale | "Prenota una dimostrazione" (WhatsApp o email) | Nessun lavoro tecnico, tocco personale. Diventa "Prova la demo" quando la demo esisterà |
| Demo online con dati finti | **Secondo progetto separato**, fuori da questo spec | Solleva questioni sue: accesso senza login, reset dei dati, nessun collegamento ai dati veri, invii disattivati |
| Prezzi | Solo la formula, senza cifre: "attivazione una tantum + canone annuale; se non rinnovi l'app continua a funzionare" | Trasparente sul modello, ma le cifre (ipotizzate il 2026-09-13, non validate con clienti veri) restano libere di cambiare |
| Prove sociali | Solo la storia di Olga e le foto reali del negozio | Nessuna testimonianza, cifra o statistica inventata |
| Struttura | Una sola pagina lunga | Il sito è breve; una pagina si legge da telefono senza perdersi |
| Tecnologia | Sito statico (HTML + CSS, JS minimo) in `site/`, secondo progetto Vercel | Senza build né dipendenze, veloce, separato dall'app |

## Struttura della pagina

1. **Barra**: logo e pulsante "Prenota una dimostrazione".
2. **Hero**: "Cosa devo fare oggi?", con la foto del banco pieno di fogli e la frase "Ogni mattina la stessa domanda".
3. **La mia storia**: Olga in prima persona, con la foto sua e del marito in negozio. Apertura con l'episodio che le ha fatto dire "serve un programma".
4. **L'app**: la schermata "Oggi" con dati di esempio, poi 4–5 funzioni con schermata: Bacheca, scheda ordine, WhatsApp già pronto, etichetta QR.
5. **Come si parte**: tre passi (dimostrazione, configurazione della bottega, uso dal primo giorno) e la formula dei prezzi.
6. **Dubbi frequenti**: dove sono i dati, cosa succede se smetto di pagare, serve un PC.
7. **Contatti**: pulsanti WhatsApp ed email.
8. **Piè di pagina**: dati legali e privacy (vedere punti aperti).

## Contenuti

- Il testo parte da `docs/proposta-commerciale.md`, riscritto in prima persona nella sezione storia.
- **Nome e descrizione del negozio in un solo blocco** all'inizio del file (per esempio variabili in testa alla pagina), perché Olga sta facendo un rebranding e il nome può cambiare. Fino ad allora: "Centro Laser Viterbese, articoli personalizzati con incisione, targhe e timbri".
- Le funzioni si descrivono con quello che l'utente fa ("chiedi la recensione con un click"), non con come è costruita l'app.
- Tono: diretto, senza gergo da software, italiano semplice.

## Immagini

- **Foto**: le fornisce Olga in una cartella; le ottimizzo per il web (dimensioni e peso). Foto previste: il banco pieno di fogli, Olga e il marito in negozio, il negozio.
- **Privacy delle foto**: nel banco con i fogli non devono leggersi nomi, telefoni o dati di clienti. Se si leggono, si sfocano o si ritagliano, oppure si rifà la foto con fogli qualsiasi. Il marito deve essere d'accordo a comparire.
- **Schermate dell'app**: nella prima versione sono **riproduzioni fedeli in HTML/CSS** con dati inventati, con la didascalia "Schermata di esempio". Motivo: l'app gira sullo stesso database di produzione, quindi uno screenshot vero mostrerebbe ordini di clienti reali accanto ai dati di prova. Quando esisterà la demo con istanza isolata si sostituiscono con screenshot veri.

## Tecnica

- Cartella `site/` con `index.html`, CSS, immagini ottimizzate. Nessun framework, nessun tracciamento.
- Secondo progetto Vercel con root directory `site/`, collegato a `oltrelabottega.it` (e `www` con redirect). I record DNS vanno impostati presso il registrar, come già avvenuto per `app.`.
- Nessun cookie e nessuno strumento di statistica, quindi nessun banner cookie. Se in futuro si aggiungono statistiche, si rivaluta.
- Contatto con link `wa.me` (messaggio precompilato "Vorrei una dimostrazione di Oltre la Bottega") ed email, senza modulo né backend.
- Base per la condivisione: `<title>`, descrizione e anteprima social (immagine 1200×630), favicon dall'icona ufficiale già presente.
- Responsive: si legge bene da telefono, dove la maggior parte dei titolari aprirà il link.
- Il sito non tocca l'app: nessuna modifica a `src/`. Da verificare in fase di piano che `npx eslint .` non dia problemi nuovi per i file in `site/` (in caso, escluderli come già fatto per i worktree).

## Fuori scope

- La demo online (secondo progetto).
- Blog, pagine multiple, area clienti, modulo di contatto con backend, chat, statistiche.
- Etichette e materiale per stampa.
- Una versione in altre lingue.

## Punti aperti (da completare prima di pubblicare)

1. **Numero WhatsApp e email di contatto** da mostrare pubblicamente.
2. **Dati legali** nel piè di pagina (ragione sociale, P.IVA, eventuale PEC) e testo di privacy. Verificare cosa serve per legge per un sito con un contatto e senza tracciamento.
3. **Foto** (banco, Olga e marito, negozio) e conferma sulla privacy di quanto si vede.
4. **L'episodio** che ha fatto nascere l'idea, con parole di Olga (due righe), per la sezione storia.
5. **Nome definitivo del negozio** dopo il rebranding, e con quale titolo Olga vuole firmarsi (titolare).
6. **Firma e frase di apertura** della storia: le scrive o approva Olga.

## Verifica

Prima della pubblicazione: controllo su telefono e desktop, tutti i link, anteprima quando la si condivide su WhatsApp, foto senza dati di clienti, testi rivisti da Olga. Nessun test automatico: è una pagina statica senza logica.
