# Materiale in russo per la presentazione — design

Data: 2026-10-11

## Obiettivo

Olga deve presentare Oltre la Bottega in lingua russa. Servono tre cose:
un video dimostrativo con didascalie in russo, schermate dell'app con scritte
in russo, e la presentazione commerciale in russo con quelle schermate dentro.

## Decisione di fondo

**Nessun cambio lingua nell'app.** La demo e la sua interfaccia restano in
italiano; i dati demo restano quelli italiani. In russo vanno solo i materiali
di presentazione (didascalie del video, testo della presentazione, scritte
sopra le schermate).

Motivo: un'interfaccia tradotta richiederebbe un'istanza demo separata (i dati
demo stanno in un solo database) e non c'è più spazio per un altro progetto
gratuito. Il cambio lingua dentro l'app è fuori scope e resta un'idea per
il futuro.

## 1. Video in russo

- `src/lib/demo/videoScenes.ts`: nuova serie `SCENE_RU` con le stesse 8 scene e
  lo stesso numero di didascalie per scena di `SCENE`. `secondiExtra` identico
  (è il tempo dell'azione, non dipende dalla lingua); il tempo di lettura si
  calcola sul testo russo con la funzione esistente.
- La scritta di chiusura usa lo stesso segnaposto `CONTATTO_WHATSAPP`, sostituito
  da `conContatto` con il numero di `.env.demo.local` (mai nel codice).
- `scripts/demo-video/run.ts`: opzione `--lang=ru` (predefinito `it`). Sceglie la
  serie di didascalie e il nome del file: `video/oltre-la-bottega-demo-ru.mp4`
  (e `.webm`). L'app resta in italiano; il contesto Playwright resta `it-IT`.
- Limite noto: il testo del messaggio WhatsApp/email mostrato per qualche
  secondo nella scena "avvisa" viene dall'app vera, quindi resta in italiano.
- Test: `SCENE_RU` ha le stesse scene, nello stesso ordine, con lo stesso numero
  di didascalie e gli stessi `secondiExtra` di `SCENE`; nessun testo vuoto; la
  scritta finale contiene il segnaposto del contatto.

## 2. Schermate con scritte in russo

- Nuovo `npm run demo:screenshots` (`scripts/demo-screenshots/run.ts`), che
  riusa la preparazione del video (reset dati demo, build di produzione con le
  chiavi segrete coperte, login con PIN, controllo "Anna Bellini" visibile).
  Le funzioni comuni di `scripts/demo-video/run.ts` (build, server, login,
  chiavi finte) vengono estratte in un modulo condiviso invece di essere
  copiate.
- Sei schermate a 1280×720 con `deviceScaleFactor: 2` (PNG nitidi): Oggi,
  nuovo ordine (cliente che torna già compilato), Bacheca, avviso al cliente
  (riquadro WhatsApp/Email), foglio lavoro, scheda cliente (profilo di
  Luca Conti).
- Su ogni schermata compare la barra di didascalia già usata dal video
  (`overlay.ts`), con un testo russo breve. I testi russi stanno accanto ai dati
  del video, in un file con test (una didascalia per schermata, nessun
  testo vuoto).
- Output in `presentazione-img/` (cartella ignorata da git, come `video/`), file
  `01-oggi.png`, `02-nuovo-ordine.png`, ecc. Al termine i dati demo vengono
  ripristinati con `demo:reset`, come fa il video.

## 3. Presentazione in russo

- Nuovo `docs/presentazione-commerciale-ru.html`: copia dell'originale con
  `lang="ru"`, i 12 testi tradotti (comprese etichette di navigazione e
  `aria-label`), stessi stili e script. L'originale non si tocca.
- Quattro pagine guadagnano una schermata (`<figure>` con immagine e
  didascalia russa): "Dopo" → Oggi; "Il cliente che hai già dimenticato" →
  scheda cliente; Voce 03 → nuovo ordine; Voce 04 → avviso al cliente. Layout:
  su schermo largo testo e immagine affiancati, su schermo stretto sotto il
  testo; l'immagine non supera il 60% dell'altezza della pagina, così ogni
  pagina resta una schermata intera.
- Le immagini sono incorporate nel file con percorso relativo a
  `presentazione-img/`; il PDF (`docs/presentazione-commerciale-ru.pdf`) si
  genera con Playwright dalla stessa pagina, formato orizzontale, una pagina
  per sezione.
- Testi in russo scritti da me e da rileggere da Olga prima dell'uso.

## Fuori scope

Cambio lingua nell'app; demo con dati in russo; voce registrata; versione
italiana della presentazione con le schermate (le immagini sono riusabili,
ma non fanno parte di questo lavoro).

## Verifica

`npx jest --roots=src` e `npx tsc --noEmit` verdi; video russo e sei PNG
generati davvero e controllati a occhio (cirillico leggibile, nessuna scritta
tagliata); PDF aperto e controllato pagina per pagina.

## Documentazione

Aggiornare `CLAUDE.md` (decisione, nuovi comandi, stato della verifica).
