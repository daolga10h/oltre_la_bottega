# Materiale in russo per la presentazione

L'app e la demo restano in italiano. In russo ci sono solo: le didascalie del video, le scritte sulle schermate e la presentazione.

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
- testo della presentazione: `docs/presentazione-commerciale-ru.html`.

Poi rilancia il comando corrispondente.

Il numero WhatsApp nell'ultima scritta del video viene da `DEMO_VIDEO_WHATSAPP` in `.env.demo.local`; se il valore è vuoto compare `[numero WhatsApp]`.

Il messaggio WhatsApp/email che si vede per qualche secondo nel video e in una schermata è il testo vero dell'app, quindi resta in italiano.
