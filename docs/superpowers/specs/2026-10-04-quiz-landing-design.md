# Pagina di atterraggio "Quiz + modulo in regalo" — design

Data: 2026-10-04

## Obiettivo

Una pagina di atterraggio pensata per chi arriva da un annuncio sui social (o da un link condiviso a mano): un quiz breve fa riconoscere il problema "tengo tutto in testa", poi si riceve in regalo un modulo di presa ordine da stampare, e solo dopo c'è un invito leggero a scrivere su WhatsApp. Serve a far **assaggiare** il valore a chi ancora non conosce Oltre la Bottega, senza chiedere dati.

## Come nasce

- PEP del target (`PEP - Oltre la bottega.pdf`): il quiz parla con le frasi di "controllo del lavoro", "difficoltà a staccare", "recensioni mai richieste".
- Vendite locali e assistite, nessun cliente ancora mostrato a nessuno: serve una porta d'ingresso che non dipenda da conversazioni personali (due conoscenti al momento non disponibili).
- Scartate durante la discussione: PDF di psicologia/gestione del tempo ("non siamo dal dottore": troppo generico), tre regali diversi per profilo, richiesta del risultato su WhatsApp come primo passo ("potrebbe spaventare").

## Decisioni prese

| Tema | Decisione | Motivo |
|---|---|---|
| Natura della pagina | Pagina di atterraggio **separata dal sito vetrina**, non collegata dal menu | Chi arriva da un annuncio deve fare una cosa sola |
| Indirizzo | `oltrelabottega.it/quiz`, stesso progetto Vercel del sito (`site/`) | Nessun nuovo progetto o dominio da gestire (opzione A) |
| Struttura | Senza menu né collegamenti al resto del sito; unica uscita: l'invito finale | Un solo obiettivo, regola delle pagine di atterraggio |
| Quiz | 7 domande, 3 risposte ciascuna (0/1/2 punti): 4 situazioni brevi + 3 sensazioni | Richiesta esplicita: entrambe, con le situazioni brevi |
| Risultati | 3 profili con nome umano e 2-3 consigli **brevi e pratici**, senza lunghi testi | Lo scarto dei PDF lunghi di psicologia |
| Regalo | **Un solo** regalo uguale per tutti: modulo di presa ordine A4 | Si usa subito al banco, vale per qualunque mestiere |
| Dati richiesti | Nessuno per scaricare il regalo | Meno diffidenza, coerente con il sito senza tracciamento |
| Invito finale | Link WhatsApp con messaggio preimpostato, mai "mandami il risultato" | Non spaventare chi ha appena fatto un quiz |
| Pubblicità | Pagina pronta per gli annunci, ma **decisione se farli e dove (zona o tutta Italia) ancora aperta** | Non decisa; la pagina funziona anche condivisa a mano |
| Tracciamento | Nessun pixel né cookie | Coerente con il sito (nessun banner cookie) |

## Il quiz

Le tre risposte di ogni domanda valgono 0, 1, 2 punti nell'ordine scritto.

**Situazioni**
1. Un cliente ti chiede se il suo ordine è pronto. Tu… (rispondi subito, sai dov'è / controlli tra fogli e messaggi / dici "ti richiamo" e speri)
2. Hai promesso una consegna per giovedì. Come te la ricordi? (è segnata in un posto solo / è su un foglio, forse in un messaggio / la ricordo io)
3. Torna un cliente. Sai cosa aveva ordinato l'ultima volta? (lo vedo in pochi secondi / devo cercare tra quaderni e messaggi / glielo chiedo di nuovo)
4. Le recensioni: (le chiedo di solito / ogni tanto / nel momento giusto non mi viene mai in mente)

**Sensazioni**
5. A fine giornata riesci a staccare? (sì, so cosa resta per domani / quasi, ripasso qualcosa a mente / no, mi giro tutto in testa)
6. Quando arrivano le urgenze, i lavori già iniziati… (restano sempre in vista / a volte spariscono / spesso li perdo di vista)
7. Se domani non ci fossi tu, chi ti sostituisce capirebbe a che punto sono i lavori? (sì, da solo / con qualche spiegazione / no, è tutto nella mia testa)

**Risultati** (punteggio da 0 a 14, soglie da rivedere)
- **0-4 · Il banco in ordine**: hai già un metodo che regge. Consigli: scrivi la data di consegna nel momento in cui la prometti; chiedi la recensione prima che il cliente esca.
- **5-9 · Il banco con qualche buco**: funziona, ma ti salva la memoria. Consigli: un foglio solo per tutti gli ordini aperti; ogni sera tre domande (cosa consegno domani, cosa devo ordinare o richiamare, da chi aspetto una risposta).
- **10-14 · Tutto sulle tue spalle**: il lavoro funziona perché lo tieni tutto in testa. Consigli: scrivi oggi su un foglio ogni lavoro aperto con la sua data, senza sistemarlo; se non hai tempo, solo le tre cose che temi di dimenticare.

Il tono è "tu", italiano semplice, senza promesse scientifiche o mediche. I testi lunghi scritti in discussione (Svuota la testa / Un foglio solo / Dal lavoro fatto ai clienti che tornano) **non** fanno parte di questo progetto: possono servire in futuro per un contenuto sul sito o sui social.

## Il regalo: modulo di presa ordine

Una pagina A4 da stampare e compilare a mano, valida per qualunque mestiere (la parte specifica sta nello spazio libero "cosa ha ordinato / dettagli"). Campi:

- Cliente: nome, cognome, telefono, email
- Cosa ha ordinato, con spazio per i dettagli (testo da scrivere, misure, materiale)
- Data dell'ordine e data di consegna promessa
- Prezzo, acconto e saldo
- Note

Esclusi per scelta esplicita: caselle da spuntare (preventivo/bozza approvati) e il campo "chi ha preso l'ordine".

## Invito finale

Dopo il regalo, un invito leggero a scrivere su WhatsApp ("se vuoi che invece di scriverlo a mano lo faccia un'app, ti faccio vedere come") con messaggio preimpostato tipo "Buongiorno, ho fatto il quiz e scaricato il modulo. Vorrei vedere come funziona Oltre la Bottega." Quando esisterà la demo online si aggiunge la seconda scelta "Guarda come funziona".

## Tecnica

- Cartella `site/` esistente (sito statico, `cleanUrls: true`, nessuna build). Nuovi file: `site/quiz.html` (→ `/quiz`), `site/quiz.js`, stile riusato da `style.css` più poche regole dedicate, modulo come pagina stampabile `site/modulo.html` (→ `/modulo`, con pulsante "Stampa" e stile di stampa A4).
- **Vincolo CSP** (`site/vercel.json`): `default-src 'self'` blocca script e stili *inline*; il quiz va quindi in file esterni (`quiz.js`, CSS esterno), nessun `onclick` inline.
- Testi e contatti letti da `site/config.js` (aggiungere un messaggio WhatsApp dedicato al quiz); nome e contatti restano in un solo punto.
- Pagine di atterraggio **non indicizzate** (`noindex`), fuori da `sitemap.xml`, non collegate dal menu del sito.
- Mobile first. Nessun cookie, nessun tracciamento, nessun dato salvato: il punteggio si calcola nel browser.
- Logica del punteggio in una funzione pura, testabile con un controllo rapido (come `site/check.mjs` già presente).

## Fuori scope

- Pubblicità a pagamento e scelta dell'area (zona/Italia).
- Pixel, statistiche, raccolta email, corso via email.
- Un modulo diverso per ogni mestiere.
- I tre PDF lunghi scritti in discussione.
- Demo online e video (progetti separati già in lista).

## Punti aperti

1. **Soglie del punteggio** (0-4 / 5-9 / 10-14) e nomi dei tre profili: da validare.
2. **Titolo e frase di apertura** della pagina: dipendono dall'annuncio, se ci sarà.
3. **Come misurare** quante persone arrivano senza pixel: valutare in futuro uno strumento senza cookie, oppure contare solo i messaggi WhatsApp ricevuti.
4. **Formato del modulo**: pagina stampabile (scelta di partenza) oppure anche un PDF da scaricare.
5. **Aggiornare la privacy** (`site/privacy.html`) se il quiz o il modulo cambiano il trattamento dei dati (oggi non raccolgono nulla).
6. Validare quiz e modulo con almeno una titolare vera prima di spendere in annunci.
