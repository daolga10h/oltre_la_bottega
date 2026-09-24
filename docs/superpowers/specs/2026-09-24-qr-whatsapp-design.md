# Design: QR WhatsApp per "Avvisa il cliente" e "Invia anteprima"

Data: 2026-09-24

## Motivazione

I link `wa.me` dell'app si aprono sul dispositivo dove si clicca. WhatsApp permette di collegare un solo account a un numero limitato di dispositivi (oggi: telefono principale + 2 PC, uno in magazzino per le anteprime, uno al banco), quindi i tablet in bottega non possono avere WhatsApp collegato: chi lavora da un tablet deve alzarsi e andare a un PC per avvisare un cliente o mandare un'anteprima. Stesso tipo di problema già visto con la stampa (azioni legate a un dispositivo preciso).

Scartata l'API ufficiale WhatsApp Business (verifica Meta, costo a messaggio, e in genere le risposte dei clienti non arriverebbero più nell'app WhatsApp Business dell'utente) — scelta esplicita: "no api". Il telefono principale funziona ovunque senza occupare nessun posto: basta poterlo raggiungere dal tablet con un gesto, cioè inquadrando un QR.

## Cosa cambia

Nei due riquadri della scheda ordine, "Avvisa il cliente" (`status = "pronto"`) e "Invia anteprima" (`status = "bozza_grafica"`, bozza `da_fare`/`modificata`), accanto ai bottoni WhatsApp/Email compare un bottone piccolo **"QR"**, solo se esiste un link WhatsApp valido (telefono presente e `canale !== "mail"`: la stessa condizione per cui compare il bottone WhatsApp).

Il click su "QR" apre, sotto il riquadro, un pannello con:
- il QR del **medesimo** link `wa.me` (stesso messaggio già scritto, nessun testo duplicato),
- una riga di istruzioni ("Inquadralo col telefono: si apre la chat del cliente in WhatsApp"),
- un bottone **"Fatto"**.

Inquadrato dal telefono, il QR apre l'URL `https://wa.me/...` nel browser del telefono, che passa il controllo a WhatsApp (o WhatsApp Business, o chiede quale app usare se sono installate entrambe).

## "Fatto" e segnatura come inviato

L'app non può sapere se il messaggio è stato mandato dopo la scansione. Scelta esplicita dell'utente: **la segnatura avviene solo con "Fatto"**, non all'apertura del QR (un passaggio in più, ma preciso).

"Fatto" esegue esattamente la stessa azione che oggi scatta al click sui link:
- Avvisa il cliente → `markMsgProntoInviato(orderId)` (flag `msg_pronto_inviato`, evento in cronologia),
- Invia anteprima → `updateBozzaGrafica(orderId, "inviata")` (bozza "Inviata", evento "Bozza inviata al cliente"),

poi `router.refresh()`: il riquadro sparisce, come dopo il click sui link. Il bottone si disattiva dopo il primo click per evitare doppie registrazioni in cronologia.

## Componenti

- **Nuovo** `src/components/WhatsAppQr.tsx` (client): props `waLink: string | null`, `onDone: () => void`. Stato locale `open`/`done`. Restituisce `null` se `waLink` è nullo. Riusa `QRCodeSVG` da `qrcode.react` (già dipendenza del progetto, usata dall'etichetta di stampa): nessuna dipendenza nuova. Il QR sta su un fondo bianco con margine (i lettori di QR richiedono contrasto e "quiet zone" anche con tema chiaro/scuro dell'app).
- **`NotifyReadyLinks.tsx` e `SendPreviewLinks.tsx`**: aggiungono `<WhatsAppQr waLink={waLink} onDone={handleClick} />` dopo i due `QuickContactLink`, riusando il `handleClick` che già chiama l'azione giusta e poi `router.refresh()`. Nessuna modifica alle props, nessuna modifica a `page.tsx`.
- Il pannello usa `basis-full` dentro i box `flex flex-wrap` esistenti, così va a capo su una riga propria senza toccare il layout dei riquadri.

## Cosa NON cambia

- I link WhatsApp/Email di oggi continuano a segnare da soli al click, senza "Fatto".
- Il PDF/immagine dell'anteprima resta da allegare a mano nella chat (i link `wa.me` non allegano file, vale anche per il QR).
- Nessuna migration, nessun nuovo server action, nessuna dipendenza nuova.
- Fuori scope: QR anche in "Recensioni"/"Da incassare", QR nella dashboard "Oggi", testi modificabili. Se in futuro serve altrove, il componente è già riusabile.
- Se WhatsApp Business e WhatsApp sono entrambi installati sul telefono, sarà il telefono a chiedere quale usare: comportamento del sistema operativo, non controllabile dall'app.

## Test

Nessuna unità pura testabile con Jest e nessuna infrastruttura di test per componenti in questo codebase (stessa convenzione di `NotifyReadyLinks`/`SendPreviewLinks`). Verifica con script Playwright temporaneo (stesso pattern delle feature precedenti, ordini di prova creati/cancellati via service role sul progetto Supabase reale): bottone "QR" visibile nei due riquadri con link WhatsApp valido; click su "QR" mostra il pannello con un `<svg>`; il QR NON segna nulla da solo (flag/bozza invariati dopo l'apertura); "Fatto" segna e il riquadro sparisce (con la voce in cronologia); "QR" assente con canale "mail" e senza telefono; un secondo click su "Fatto" non registra un doppio evento. La correttezza del contenuto del QR (stesso `waLink` passato ai bottoni) è verificata in code review, non decodificando l'immagine.
