# Materiale in russo per la presentazione

L'app e la demo restano in italiano. In russo ci sono: le didascalie del video, le scritte sulle schermate, la presentazione e **i testi dell'app dentro schermate e video** (menu, titoli, campi, pulsanti, stati, date, nomi dei lavori). Gli script li traducono nella pagina mentre la riprendono, con un dizionario: l'app e il database non cambiano. I nomi delle persone e i numeri restano come sono.

Esegui i comandi dalla cartella del progetto (`D:\Documenti\Projects\oltre_la_bottega`). Video e schermate costruiscono l'app, quindi ci vogliono alcuni minuti. **Non lanciarli insieme** (usano la stessa porta).

| Cosa | Comando | Dove trovi il risultato |
|---|---|---|
| Video con didascalie in russo | `npm run demo:video:ru` | `video\oltre-la-bottega-demo-ru.mp4` |
| Sei schermate con scritte in russo | `npm run demo:screenshots` | cartella `presentazione-img\` |
| PDF della presentazione | `npm run presentazione:pdf` | `docs\presentazione-commerciale-ru.pdf` |

Ordine: prima le schermate, poi il PDF (il PDF le usa). Il video è indipendente. Se il video non parte perché manca `ffmpeg`, scrivi una volta `npm install --no-save ffmpeg-static`.

La presentazione si può anche aprire direttamente: `docs\presentazione-commerciale-ru.html` (frecce o spazio per sfogliare). Mostra le immagini da `presentazione-img\`, quindi servono le schermate generate.

Le sei schermate sono `01-oggi`, `02-nuovo-ordine`, `03-bacheca`, `04-avvisa`, `05-foglio`, `06-cliente`. La presentazione ne usa quattro (01, 02, 04, 06); la Bacheca e il foglio lavoro sono pronti se vuoi aggiungerli alle slide.

Per cambiare un testo russo:
- didascalie del video: `src/lib/demo/videoScenes.ts` (`SCENE_RU`);
- scritte sulle schermate: `src/lib/demo/schermate.ts`;
- testo della presentazione: `docs/presentazione-commerciale-ru.html`;
- testi dell'app (menu, campi, pulsanti, nomi dei lavori della demo): `src/lib/demo/traduzioneRu.ts` (`DIZIONARIO_RU`). Se nel video o in una schermata resta una scritta in italiano, aggiungila lì (a sinistra il testo italiano esatto, a destra il russo).

Poi rilancia il comando corrispondente.

Il numero WhatsApp nell'ultima scritta del video viene da `DEMO_VIDEO_WHATSAPP` in `.env.demo.local`; se il valore è vuoto compare `[numero WhatsApp]`.

Il messaggio WhatsApp che si vede per qualche secondo nel video e in una schermata è mostrato in russo per far capire cosa contiene; quello che l'app invia davvero ai clienti resta in italiano.

Un solo testo non si può tradurre: il segnaposto della data nel modulo del nuovo ordine (`dd.mm.yyyy`) è un controllo del browser.
