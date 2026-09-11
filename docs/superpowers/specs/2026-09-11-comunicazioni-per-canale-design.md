# Design: comunicazioni che seguono il canale d'arrivo dell'ordine

Data: 2026-09-11

## Motivazione

Alcuni ordini arrivano per email (`canale: "mail"`) — quando succede, l'utente vuole che *tutte* le comunicazioni verso quel cliente restino via email, anche se il cliente ha anche un numero di telefono salvato. Per tutti gli altri canali d'arrivo (negozio, WhatsApp, telefono, sito, altro) non c'è nessun vincolo: WhatsApp resta l'opzione naturale quando disponibile, esattamente come oggi.

Questo va in tensione solo apparente con una decisione precedente ("Riquadro 'Avvisa il cliente' ... mostra sempre entrambi i link ... indipendentemente dal canale d'origine"): quella decisione riguardava il caso generico "un canale diverso può comunque avere un WhatsApp valido" (es. un ordine preso per telefono). Qui la regola è più specifica e ristretta: solo per `canale === "mail"`, e va nella direzione opposta (restringere, non ampliare) perché è una richiesta esplicita dell'utente per questo caso preciso, non una generalizzazione.

## Regola

```
se order.canale === "mail":
    usa solo email in ogni azione di contatto rapido
    (mai WhatsApp, anche se telefono è presente)
altrimenti:
    nessun cambiamento — comportamento identico a oggi
```

## Punti toccati

### 1. "Avvisa il cliente" (scheda ordine, quando `status === "pronto"`)

File: `src/app/(dashboard)/orders/[id]/page.tsx`, righe 134-145 circa.

Oggi: mostra sempre sia il link WhatsApp (`buildWhatsAppLink(order.telefono, ...)`) sia il link Email (`buildMailtoLink(order.email_cliente, ...)`), quando i rispettivi dati sono presenti.

Nuovo comportamento: se `order.canale === "mail"`, il link WhatsApp non viene calcolato/mostrato — resta solo l'Email (se `email_cliente` presente). Per ogni altro canale, nessun cambiamento.

### 2. "Chiedi su WhatsApp" in Recensioni

File: `src/app/(dashboard)/recensioni/page.tsx`.

Oggi: unico bottone, sempre WhatsApp (`buildWhatsAppLink(o.telefono, ...)`), nessuna alternativa email.

Nuovo comportamento: se `o.canale === "mail"`, il bottone diventa "Chiedi via email" — un link `mailto:` costruito con `buildMailtoLink(o.email_cliente, "La tua opinione conta per noi", <stesso testo del messaggio WhatsApp>)`. Se `email_cliente` è assente, nessun bottone (stesso fallback già usato oggi per l'assenza di telefono). Per ogni altro canale, nessun cambiamento — resta il bottone WhatsApp di oggi.

### 3. "Chiedi su WhatsApp" in Da incassare

File: `src/app/(dashboard)/pagamenti/page.tsx`.

Stessa sostituzione del punto 2: se `o.canale === "mail"`, il bottone diventa un link `mailto:` con oggetto "Saldo in sospeso — {shopName}" e lo stesso testo del messaggio WhatsApp esistente (`buildMailtoLink(o.email_cliente, ...)`). Se `email_cliente` è assente, nessun bottone. Per ogni altro canale, nessun cambiamento.

## Caso limite: canale "mail" senza email salvata

Se un ordine ha `canale: "mail"` ma `email_cliente` è vuoto (dato mancante, es. errore di inserimento), non compare nessun bottone di contatto rapido in nessuno dei tre punti — **nessun ripiego automatico su WhatsApp**, anche se il telefono è presente. La regola dell'utente ("chi arriva per mail, riceve tutto per mail") viene applicata in modo rigoroso: se manca il dato per rispettarla, meglio non offrire nessuna scorciatoia che la violerebbe silenziosamente. Il contatto resta possibile manualmente (es. aprendo il client di posta a mano), semplicemente non c'è un bottone precompilato in app.

## Cosa NON cambia

- **Nessuna migration**: `canale` esiste già su `orders` dal 2026 (schema v2).
- **Nessun nuovo helper**: `buildMailtoLink` e `buildWhatsAppLink` esistono già in `src/lib/utils.ts`, riusati senza modifiche alla loro firma.
- **Nessun cambiamento per gli altri canali**: negozio, WhatsApp, telefono, sito, altro restano esattamente come oggi in tutti e tre i punti.
- **La pagina `/customers` e il resto dell'app**: nessun altro punto di contatto rapido esiste oggi da modificare.

## Fuori scope

- **Raccolta sistematica dell'email per ogni cliente** (indipendentemente dal canale d'arrivo, per usi di marketing/newsletter legata al consenso): tema distinto, segnalato dall'utente nella stessa conversazione ma con un problema diverso (dati da raccogliere, non comunicazioni da instradare) — da affrontare con un brainstorming a parte.
- **Notifiche automatiche/webhook**: resta tutto manuale (l'utente clicca il bottone), nessuna automazione introdotta.

## Test

Nessuna infrastruttura di test per pagine/componenti in questo codebase (stessa convenzione già seguita per le feature precedenti) — verificato manualmente: un ordine con `canale: "mail"` e sia telefono che email salvati mostra solo il bottone/link email nei tre punti; un ordine con `canale: "mail"` senza email salvata non mostra nessun bottone in nessuno dei tre punti; un ordine con un canale diverso da "mail" (es. "telefono") continua a mostrare WhatsApp come oggi, e in "Avvisa il cliente" continua a mostrare entrambi i link se disponibili.
