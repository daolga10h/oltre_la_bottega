# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Descrizione del progetto

**Oltre la Bottega** è una dashboard operativa con mini CRM per botteghe artigiane e micro-attività (1–5 persone). L'obiettivo è dare una vista unica, semplice e azionabile di ciò che serve oggi per gestire la bottega, riducendo il caos operativo quotidiano.

Il prodotto NON è un CRM generico né un gestionale aziendale. È una "cabina di comando" operativa centrata sulla domanda: **"Cosa devo fare oggi?"**. L'AI, se introdotta, è un acceleratore secondario, non il centro dell'esperienza.

**Stato attuale**: MVP in produzione su Vercel. Fase 0+1+2 completate e deployate su `main`. In uso attivo con bug fixing continuo e affinamento UI (design system "Runway" applicato a tutta l'interfaccia, vedere `DESIGN.md`). Fase 3 parzialmente avviata (etichetta di stampa implementata). Il file `mini_crm_freelancer_single_html.html` è il prototipo HTML di riferimento per la UI.

---

## Struttura del progetto

```
oltre_la_bottega/
├── CLAUDE.md
├── DESIGN.md                        # Design system "Runway" — colori, tipografia, componenti
├── specifica_tecnica_agente_ai.md   # Spec tecnica completa
├── idea.md                          # Concept e progettazione (storico)
├── research.md                      # Ricerca su UX, design, stack (storico)
├── critiche.md                      # Analisi critica e rischi (storico)
├── mini_crm_freelancer_single_html.html  # Prototipo UI di riferimento
├── supabase/migrations/             # Migration SQL da applicare in ordine
└── src/                             # App Next.js
```

**Struttura Next.js reale:**
```
src/
├── app/
│   ├── (dashboard)/                 # Layout con sidebar + bottom nav
│   │   ├── dashboard/page.tsx       # Vista "Oggi"
│   │   ├── orders/                  # Lista ordini + nuovo + dettaglio + modifica
│   │   ├── kanban/page.tsx          # Bacheca kanban
│   │   ├── agenda/page.tsx          # Promemoria
│   │   ├── recensioni/page.tsx
│   │   ├── customers/               # Redirect a /orders
│   │   ├── impostazioni/page.tsx    # PIN, elenco operatori (solo sidebar desktop)
│   │   └── layout.tsx
│   ├── (print)/                     # Layout minimale (no sidebar) per stampa
│   │   └── orders/[id]/print/       # Pagina etichetta stampabile con QR code
│   ├── (auth)/login/page.tsx        # Tab "Link via email" + "PIN"
│   ├── (auth)/setup-pin/page.tsx    # Crea/cambia PIN, collegata da Impostazioni
│   ├── icon.tsx                     # Favicon generato dinamicamente (ImageResponse, marchio "OB")
│   ├── apple-icon.tsx               # Icona 180x180 per "Aggiungi a schermata Home" su iOS
│   ├── manifest.ts                  # Web manifest (display standalone) per installazione su tablet
│   └── layout.tsx                   # Root layout
├── actions/                         # Server actions
│   ├── orders.ts
│   ├── reminders.ts
│   └── customers.ts
├── components/
│   ├── OrderForm.tsx
│   ├── OrderCard.tsx
│   ├── KanbanBoard.tsx
│   ├── ReminderList.tsx
│   ├── ReminderForm.tsx             # Client component con useActionState
│   ├── TodayBoard.tsx
│   └── nav/
└── lib/
    ├── supabase/server.ts
    └── errors.ts
```

---

## Tech Stack

| Layer         | Tecnologia              | Motivazione                                      |
|---------------|-------------------------|--------------------------------------------------|
| Frontend      | Next.js + TypeScript    | App Router, server actions, tipi sicuri          |
| Styling       | Tailwind CSS            | Design rapido, responsivo, coerente              |
| UI Components | shadcn/ui               | Componenti puliti senza overhead                 |
| Database      | Supabase (PostgreSQL)   | CRUD semplice, zero infrastruttura               |
| Auth          | Supabase Auth           | Sessioni sicure per accesso singola bottega      |
| Storage       | Supabase Storage        | Allegati foto/PDF a ordini                       |
| Hosting       | Vercel                  | Deploy automatico da main                        |

---

## Architettura

```
Utente (browser / mobile)
        │
        ▼
Presentation Layer  →  Next.js Pages (App Router)
        │
        ▼
Application Layer   →  Server Actions / Route Handlers
        │
        ▼
Data Access Layer   →  Repository functions (Supabase client)
        │
        ▼
Persistence Layer   →  PostgreSQL (Supabase) + Storage
```

**Modello single-tenant**: ogni installazione serve una sola bottega. Niente `shop_id`, niente RLS multi-tenant. Chi compra il prodotto riceve la propria istanza Supabase + Vercel separata e la gestisce in autonomia (modello simile a Danea).

**API interne minime:**
- `POST /api/orders` · `PATCH /api/orders/:id` · `GET /api/orders`
- `GET /api/customers` · `POST /api/reminders`
- `GET /api/dashboard/today` · `GET /api/dashboard/week`

---

## Modello dati (v1)

Tabelle principali in PostgreSQL (schema v2, vedere `supabase/migrations/`):

**`orders`** — tabella centrale, dati cliente embedded (no entità customer separata):
- Anagrafica cliente: `nome`*, `cognome`, `telefono`*, `email_cliente`, `canale`, `consenso_marketing`
- Chi ha preso l'ordine: `operatore` (impostato solo alla creazione, non modificabile in seguito)
- Lavorazione: `cosa_ordinato`* (calcolato da `order_items`, vedi sotto), `tipo_lavorazione`, `dettagli_grafici`, `bozza_grafica`, `foto_oggetto`, `file_cliente`, `note` — `testo_da_scrivere` e `quantita` restano in schema ma non più usati dal form (spostati a livello di riga in `order_items`)
- Date: `data_ordine` (default today), `data_consegna`, `data_consegnato`
- Stato principale: `status` (preventivo → bozza_grafica → da_fare → in_lavorazione → pronto → consegnato)
- Sottostato preventivo: `preventivo` (da_inviare → inviato → approvato)
- Sottostato bozza: `bozza_grafica` (non_serve | da_fare | inviata | modificata | approvata)
- Sottostato materiale: `materiale` (non_serve | da_ordinare | ordinato | arrivato), `materiale_fornitore`, `materiale_cosa_manca`, `materiale_data_ordine`
- Pagamento: `prezzo` (calcolato da `order_items`, vedi sotto), `acconto`, `saldo` (calcolato)
- Flag: `msg_pronto_inviato`, `chiedere_recensione`, `recensione_richiesta`, `recensione_ricevuta`, `consenso_marketing`

**`order_items`** — righe articolo di un ordine (`cosa_ordinato`, `testo_da_scrivere`, `quantita`, `prezzo_unitario`, `posizione`), tabella figlia di `orders` (2026-08-30, vedere Decisioni). `orders.cosa_ordinato`/`orders.prezzo` sono calcolati automaticamente da queste righe (`computeOrderSummary` in `src/lib/orderItems.ts`) a ogni salvataggio — ogni ordine ha sempre almeno una riga.

**`order_events`** — timeline audit log per ordine

**`reminders`** — promemoria liberi (`title`, `due_at`, `status`: attivo/completato, `completed_at`)

**`inventory_items`** — materiali base (tabella presente nello schema, ma senza UI: la pagina `/inventory` è stata rimossa il 2026-07-04 perché non collegata al menu e prematura rispetto allo scope MVP — vedere Roadmap)

Migrations da applicare in ordine:
1. `20260626000001_order_schema_v2.sql` — schema principale (drop + recreate)
2. `20260628000001_add_consenso_marketing.sql`
3. `20260628000002_add_dettagli_grafici.sql`
4. `20260629000001_add_preventivo_bozza_modificata.sql` — colonna preventivo + aggiorna constraint bozza
5. `20260702000001_add_reminder_completed_at.sql` — colonna `completed_at` su `reminders`
6. `20260702000002_add_da_fare_status.sql` — aggiunge `da_fare` al constraint `orders_status_check`
7. `20260707000001_add_materiale_fornitore.sql` — colonne materiale fornitore su `orders`
8. `20260714000001_add_operatore.sql` — colonna `operatore` su `orders`
9. `20260829000001_add_azienda.sql` — colonna `azienda` su `orders` (applicata il 2026-08-29)
10. `20260829000002_add_order_items.sql` — tabella `order_items` per ordini multi-riga, con backfill (applicata il 2026-08-30)
11. `20260909000001_add_ente_referente.sql` — colonne `is_ente`/`referente` su `orders` per clienti ente/azienda (applicata il 2026-09-10)

Vincoli critici:
- Niente `shop_id` — installazione dedicata per bottega
- Indici su `data_consegna`, `status`, `nome/cognome`
- RLS abilitata: `auth.uid() is not null` su tutte le tabelle

---

## Decisioni chiave e motivazioni

| Decisione | Motivazione |
|---|---|
| Next.js Server Actions per mutation | Evita un layer API separato nell'MVP |
| Supabase invece di backend custom | Zero infrastruttura da gestire, auth inclusa |
| Single-tenant (un'istanza per bottega) | Nessuna complessità multi-tenant; modello Danea — chi compra gestisce la propria istanza in autonomia |
| shadcn/ui invece di libreria full | Componenti copiabili e personalizzabili, nessun lock-in |
| Scope MVP stretto (ordini + clienti + dashboard + reminder) | Il rischio principale è lo scope creep; funzioni come parsing PDF e WhatsApp sono post-MVP |
| Layout card-based con colori di stato | Gli utenti devono leggere le priorità in meno di 30 secondi |
| Navigazione: Oggi · Ordini · Agenda · Recensioni · Clienti | Bacheca integrata in Ordini come vista alternativa (lista/kanban); Clienti in fondo |
| Ordini mostra solo attivi (preventivo, in_lavorazione, pronto) | Consegnati spariscono dalla vista principale — evita confusione tra nuovo e vecchio |
| Consegnato → se chiedere_recensione=true va in Recensioni, altrimenti si nasconde | Pipeline naturale: Ordini è sempre pulito e azionabile |
| Storico ordini visibile solo dal profilo cliente | Non serve una pagina archivio separata; la storia è accessibile per cliente |
| "Oggi" = nome dashboard (ex "Dashboard") | Risponde direttamente alla domanda "cosa devo fare oggi?" |
| "Bacheca" = kanban stati lavori (ex "Kanban") | Richiama lavagna fisica in bottega, non confonde con "Oggi" |
| Agenda = todo libera + scadenze fornitori (senza link ordini) | Gli ordini gestiscono da soli consegne e follow-up; l'agenda è per tutto il resto |
| Auth = solo magic link via email, niente PIN | Per uso su tablet dedicato con blocco schermo, il PIN app è ridondante e incompleto |
| PIN aggiunto come metodo di accesso alternativo al magic link (2026-07-13) | I 2 tablet + PC in bottega non hanno la posta configurata e non deve servire aprirla, nemmeno una volta — il magic link da solo non è praticabile per l'uso quotidiano sui tablet. Non è una revisione della motivazione originale (il PIN non serve a rinforzare il blocco schermo del tablet, quel ragionamento resta valido) ma risolve un vincolo diverso, emerso solo con l'uso reale. Il PIN è la password Supabase dell'account esistente (`updateUser({password: pin})`, minimo 6 caratteri già configurato) — non un sistema di autenticazione separato. Un solo PIN condiviso per tutta la bottega, coerente col modello single-tenant (un account, non un utente per persona). Impostabile/modificabile da "Impostazioni" (solo desktop) → `/setup-pin`; il magic link resta il metodo di recupero se il PIN viene dimenticato |
| Campo "Operatore" obbligatorio in creazione ordine, elenco configurabile da Impostazioni (2026-07-14) | Con il login PIN condiviso si perde il segnale "chi ha preso l'ordine" che oggi si legge dalla calligrafia sulla carta. `orders.operatore` (nullable) si imposta solo alla creazione — non compare nel form di modifica, è un dato di fatto non revisionabile a posteriori. L'elenco dei nomi selezionabili vive in `user_metadata.operatori` (stesso posto di `shop_name`), gestito da una nuova card in Impostazioni; nessuna tabella dipendenti/utenti, coerente col modello single-tenant. Se l'elenco è vuoto il salvataggio dell'ordine resta bloccato finché non si aggiunge almeno un operatore. L'ultimo operatore scelto viene ricordato per dispositivo (`localStorage`), stesso meccanismo già usato per l'email nel login PIN |
| Allegati = campo testo libero (no Supabase Storage) | Si scrive nome file / link Drive / riferimento WhatsApp — evita complessità di storage |
| Campo `consenso_marketing` in orders | GDPR: serve consenso esplicito per recensioni e comunicazioni commerciali |
| Stato ordine calcolato automaticamente alla creazione | Regola: inviare preventivo → "preventivo"; no preventivo + bozza → "bozza_grafica"; no preventivo + no bozza → "da_fare" (non "in_lavorazione": l'ordine va programmato prima di essere messo in lavorazione) |
| Stato ordine avanza automaticamente anche dopo la creazione, quando bozza/preventivo vengono approvati | Bug corretto il 2026-07-07: `updateBozzaGrafica`/`updatePreventivo` scrivevano solo il sottostato, lasciando l'ordine bloccato su "bozza_grafica"/"preventivo" anche dopo l'approvazione (richiedeva un cambio di stato manuale). Ora bozza "approvata" → status "da_fare"; preventivo "approvato" → "bozza_grafica" (se serve ancora una bozza) o "da_fare", stessa regola già usata in `computeOrderStatus` applicata anche in questi due punti |
| Bottoni rapidi nella pagina dettaglio per sottostati | Preventivo (da_inviare/inviato/approvato) e Bozza (da_fare/inviata/modificata/approvata) senza entrare in modifica |
| Log attività con testo descrittivo in italiano | Niente "Stato: X" — messaggi leggibili tipo "Bozza approvata", "Consegnato al cliente" |
| RLS abilitata su tutte le tabelle con `auth.uid() is not null` | Sicurezza base; single-tenant, nessuna separazione per utente |
| Dopo crea/modifica ordine → redirect a scheda ordine (non lista) | Permette di stampare etichetta immediatamente dopo la creazione |
| Bacheca = grid 5 colonne (non flex scroll) | Tutte le colonne visibili senza scrollare orizzontalmente |
| Card ordine (lista e bacheca) = solo nome · cosa · data | Tipo lavorazione e saldo rimossi dalle card — info di dettaglio, non di scansione rapida |
| Etichetta stampabile = pagina separata `(print)/orders/[id]/print` | Layout senza sidebar, auto-stampa, QR code verso la scheda ordine; dimensioni da configurare per stampante termica |
| `ReminderForm` = client component con `useActionState` + `router.refresh()` | Form action + `revalidatePath` non aggiornava il server component montato; serve `router.refresh()` esplicito |
| Tutti i menu a tendina usano `@/components/ui/select` (mai `<select>` nativo) | Il popup nativo del browser ignora il font della pagina su alcune combinazioni OS/browser (mostra un font di sistema invece di Inter) — bug non risolvibile via CSS |
| Scheda ordine: nome cliente come titolo, "cosa ordinato" sotto (non il contrario) | Al banco si cerca il cliente, non l'oggetto — il nome cliente è l'informazione con cui si scansiona più spesso |
| Data consegna prevista accanto al nome cliente in testata; canale e tipo lavorazione nascosti dalla vista principale | Riduce il rumore visivo nella scheda; i due campi restano modificabili da "Modifica", non sono spariti dal dato |
| Se manca la data di consegna, link "Aggiungi data consegna" al posto dello spazio vuoto | Evita che l'assenza del dato sembri un errore grafico |
| Riquadro pagamento con Prezzo, Acconto, Saldo in box separati, sempre 2 decimali | Leggibilità a colpo d'occhio; formato numerico coerente ovunque (card, scheda, bacheca) tramite `formatEUR()` |
| Dashboard: "Consegne di oggi" → "Da consegnare oggi" + nuova scheda "Consegnati oggi" | Distingue ciò che resta da fare da ciò che è già stato completato in giornata — vedere i lavori consegnati è gratificante per chi lavora in bottega |
| Verde salvia (`sage`) come unica eccezione al divieto di verde/viola in interfaccia | Sostituisce il viola (wisteria) per "bozza grafica" e stati di completamento (approvato, consegnato) su richiesta esplicita: il viola non si sposava con la palette calda |
| Vista Clienti = rubrica derivata da `orders` (no tabella customers separata) | `/customers` aggrega ordini per telefono/nome; `/customers/profilo?nome=&tel=` mostra storico completo inclusi consegnati + totale speso. Caso d'uso: cliente torna al banco, si cerca il nome, si vede la storia in 5 secondi |
| Autocomplete nel form ordine sul campo Nome | Carica clienti esistenti al mount, filtra mentre si digita (min 2 char), click auto-riempie nome/cognome/telefono/email — evita di inserire dati già presenti |
| Nome bottega in `user_metadata` Supabase Auth | Chiesto al primo login via `/auth/setup-shop`; letto con `getShopName(user)` da `lib/shop-name.ts`; mostrato nel sidebar e nell'etichetta di stampa al posto di "OB"/"OLTRE LA BOTTEGA" |
| Agenda: promemoria completati restano visibili (spuntati, barrati) fino a fine giornata, poi spariscono | `reminders.completed_at` traccia il momento del completamento; `getActiveReminders` include `status=attivo` OR (`status=completato` AND `completed_at` di oggi). Evita che un promemoria "spunta e sparisce" subito — dà conferma visiva del lavoro fatto durante la giornata. Rimosso anche il `confirm()` al click: è un'azione leggera e reversibile in UI |
| Pagina Inventario rimossa (2026-07-04) | Esisteva già una pagina `/inventory` con relativa server action, ma non era collegata al menu — un tentativo precedente mai completato. Rimossa per evitare confusione, coerente con la regola "il rischio principale è lo scope creep": si riprenderà solo dopo aver usato il nucleo (ordini/dashboard/agenda) con clienti veri. La tabella `inventory_items` resta nello schema, senza UI |
| Bottone "Chiedi su WhatsApp" nella pagina Recensioni, invece di un'integrazione WhatsApp vera | `buildWhatsAppLink()` in `lib/utils.ts` genera un link `wa.me` con messaggio precompilato (nome cliente + nome bottega), senza API/costi/configurazione. Nasce da un'esigenza reale: senza un modo comodo per chiedere la recensione, l'utente ammette di non farlo mai. Non è ancora un'integrazione (nessun webhook, nessuna automazione) — coerente con l'approccio "soluzione minima" già usato per gli allegati |
| Riquadro "Avvisa il cliente" (WhatsApp + Email) nella scheda ordine quando status = "pronto" | Stessa logica del bottone recensioni: mostra sempre entrambi i link se telefono/email sono presenti, indipendentemente dal `canale` d'origine dell'ordine (un ordine arrivato per telefono può comunque avere un numero WhatsApp valido) — scelta esplicita dell'utente per evitare falsi negativi. Sparisce quando `msg_pronto_inviato` è già true; il flag va comunque marcato a mano da "Modifica" dopo l'invio, nessuna automazione |
| Telefono cliente obbligatorio nel form ordine | Senza numero salvato il riquadro "Avvisa il cliente" non ha nulla a cui collegarsi e resta invisibile (successo in produzione con l'ordine di Alfonso, privo di telefono). Validazione solo lato form (attributo `required`, come già per `nome`/`cosa_ordinato`), nessun vincolo `NOT NULL` a livello di database — gli ordini già esistenti senza telefono restano validi finché non vengono modificati |
| Cognome e data consegna obbligatori nel form ordine | Senza questi dati la lista ordini perde valore come base dati consultabile (ricerca cliente, storico, programmazione consegne). Stesso pattern già usato per il telefono: validazione solo lato form (attributo `required`), nessun vincolo `NOT NULL` a livello di database — gli ordini già esistenti senza questi dati restano validi finché non vengono modificati |
| Materiale fornitore = sottostato indipendente da `status` (come preventivo/bozza) | Situazione ricorrente (ordini che richiedono materiale dal fornitore prima di essere lavorati), quasi sempre nota alla creazione ma a volte scoperta durante la lavorazione. Non blocca il cambio di stato manuale — il lavoro può procedere in parte (es. bozze grafiche) anche senza materiale, coerente con l'assenza di blocchi rigidi nel resto dell'app |
| Materiale "arrivato" + status "da_fare" → avanza automaticamente a "in_lavorazione" | Evita un passaggio manuale quando l'unico motivo per cui l'ordine era fermo era il materiale mancante. Non scatta se lo status è ancora "preventivo"/"bozza_grafica" (in attesa del cliente), perché "da_fare" si raggiunge solo dopo che questi passaggi sono già risolti |
| Dashboard "Oggi": schede "Materiale da ordinare" / "Materiale ordinato oggi" | Stessa logica di "Consegnati oggi": la seconda scheda resta visibile solo fino a fine giornata (filtrata su `materiale_data_ordine = oggi`), dà conferma visiva del lavoro amministrativo fatto |
| Voce "Qtà" rimossa dal riquadro pagamento (form e scheda ordine) | Il Saldo non la moltiplicava mai (resta sempre `prezzo - acconto`), quindi "4 pz a 6€" non portava il totale a 24€ come ci si aspetterebbe — confondeva più che aiutare. Colonna `quantita` lasciata intatta nel database, nessuna migration, stesso trattamento già riservato a `inventory_items`. L'idea di ordini multi-riga (più oggetti diversi con prezzi diversi nello stesso ordine, caso frequente emerso in discussione) resta da valutare come progetto a sé in futuro |
| `TodayBoard.tsx`: le 4 sezioni "oggi" (da consegnare/consegnati/materiale da ordinare/materiale ordinato) condivise tramite `DashboardListCard` | Con l'aggiunta delle due sezioni materiale, il file aveva 4 blocchi `<Card>` quasi identici (~27 righe ciascuno); estratto un componente condiviso con props `title`/`items`/`badgeClassName`/`icon`/`chevron` per eliminare la duplicazione, nessun cambiamento visivo |
| Calcolatrice al volo: bottone flottante in basso a sinistra su tutte le pagine dashboard | Serve per calcoli veloci (somme, sconti) senza uscire dall'app. Logica pura (`applyOperator`) testata in `src/lib/calculator.ts`; calcolo sequenziale senza precedenza tra operatori, come una calcolatrice tascabile. Nessun collegamento ai campi del form — solo icona, nessuna cronologia salvata |
| Sidebar: rimosso il quadratino con le iniziali e il nome bottega personalizzato, resta solo "Oltre la Bottega" | Semplificazione visiva su richiesta esplicita; il nome bottega personalizzato resta comunque usato altrove (messaggi WhatsApp/email, etichetta di stampa) tramite `getShopName()` |
| Colori per stadio su preventivo/bozza grafica/materiale fornitore (bottoni scheda ordine + badge lista/bacheca) | Prima un solo colore fisso per l'intero sottostato rendeva indistinguibili "appena iniziato" e "completato". Ora terracotta/honey/sage in base al valore esatto, riusando colori già nel design system con lo stesso significato semantico (terracotta = urgenza, honey = attivo, sage = completato). Funzioni pure `preventivoStage`/`bozzaStage`/`materialeStage` in `src/lib/orderConstants.ts`, testate. Badge di lista/bacheca senza icone (solo testo colorato) su richiesta esplicita |
| Pillola macro-stato "Bozza grafica" (lista/bacheca) resa neutra (`bg-linen`, come già "Preventivo"), non più verde salvia fissa (2026-07-19) | Bug segnalato dall'utente: un ordine con sottostato "da fare" mostrava la pillola grande verde accanto al chip piccolo rosso corretto — il verde comunicava "completato" nello stesso istante in cui il rosso diceva "urgente". Causa: il verde salvia era stato scelto in precedenza solo per sostituire il viola (vedere riga sopra su `sage`), senza tener conto del sistema di colori per stadio introdotto dopo. "Bozza grafica" non ha mai davvero un sottostato "completato" da mostrare in lista (l'ordine avanza automaticamente fuori da questo stato non appena la bozza è approvata), quindi la pillola macro-stato non deve avere un colore di stadio proprio — stesso trattamento già usato per "Preventivo". Corretto in `STATUS_COLORS`/`STATUS_BADGE_COLORS` (`OrderCard.tsx`, `KanbanBoard.tsx`); il chip piccolo resta l'unico segnale colorato |
| `src/app/icon.tsx` (favicon dinamica, marchio "OB") ripristinato il 2026-07-10 | Era stato cancellato per errore l'8 luglio 2026 dentro un commit non correlato (`2ad7ce7`, pagina clienti/autocomplete) e non se n'era accorto nessuno finché non si è preparata l'installazione su tablet — la favicon mancava in produzione da oltre una settimana. Testo "OB" in kraft (`#f2e4c9`, non più ambra) su sfondo espresso (`#3b2716`), grassetto vero (Inter 800). Il colore ambra e il peso 700 dichiarato non davano un risultato leggibile alla dimensione reale dell'icona — vedi riga successiva sul motivo tecnico del peso |
| Font caricato esplicitamente (Inter 800 da Google Fonts) in `icon.tsx`/`apple-icon.tsx`, invece di affidarsi al `fontWeight` CSS | Satori (il motore dietro `next/og`/`ImageResponse`) ignora silenziosamente `fontWeight` se non gli viene passato un vero file font per quel peso — senza questo fix il testo risultava sempre sottile a prescindere dal valore richiesto. Il file `.ttf` (Inter Black, ~320KB) viene scaricato da un URL statico di Google Fonts al momento della generazione (build, non per-richiesta, perché queste route senza parametri dinamici sono statiche) invece di essere incluso nel repo, per non aggiungere una dipendenza npm solo per un'icona |
| `manifest.ts` + `apple-icon.tsx` per "Aggiungi a schermata Home" su tablet/PC | In preparazione all'uso reale su 2 tablet + PC in bottega: senza manifest, "Aggiungi a Home" produceva uno screenshot generico invece del marchio e apriva ancora con la barra del browser. Aggiunto `manifest.ts` (`display: "standalone"`, icona 180×180 riusata da `apple-icon.tsx`) e `appleWebApp`/`viewport.themeColor` in `layout.tsx` per la modalità a schermo intero su iOS. Il matcher del middleware (`src/middleware.ts`) escludeva già `icon`/`apple-icon` dal redirect di autenticazione ma non `manifest.webmanifest`: senza l'esclusione il manifest veniva reindirizzato a `/login`, rendendolo illeggibile dal browser — aggiunta l'esclusione. Non è una PWA completa (nessun service worker, nessuna funzionalità offline), solo l'icona e la modalità a schermo intero |
| Account Supabase e Vercel dell'istanza cliente intestati e pagati dal cliente stesso, non inclusi nel prodotto (2026-08-12) | Esplicita, per il modello single-tenant già in uso ("chi compra riceve la propria istanza e la gestisce in autonomia"), chi sostiene il costo di hosting: ognuno paga per sé. Il piano gratuito di entrambi copre l'uso di una bottega a costo zero (nessun file caricato su Supabase Storage, dato che gli allegati restano testo libero; traffico di un singolo negozio ben sotto i limiti Vercel). Unica accortezza segnalata al cliente: il piano gratuito Vercel (Hobby) è dichiarato per uso "non commerciale" nei suoi termini di servizio — rischio pratico di enforcement basso vista la bassissima visibilità/traffico di un'app da negozio singolo, ma resta una violazione tecnica dei termini; il cliente può passare al piano Pro (~20€/mese) in qualsiasi momento se preferisce essere formalmente in regola. Riportato anche nella checklist "cosa serve" data ai futuri clienti |
| Backup giornaliero via email (CSV di tutti gli ordini) come rete di sicurezza contro la perdita dati (2026-08-14, passato da settimanale a giornaliero il 2026-09-10) | Nato da un confronto con Danea Easyfatt: a differenza del vecchio desktop (dati sempre consultabili sul PC anche a zero rinnovi), la nostra architettura è tutta cloud — se un'istanza resta inattiva a lungo (malattia, ferie) o viene persa, non c'è fallback locale. Un Vercel Cron (`vercel.json`) chiama `/api/cron/daily-backup` ogni giorno alle 20:00 UTC (21:00 inverno / 22:00 estate — Vercel programma i cron solo in UTC, orario di sera scelto esplicitamente dall'utente per essere dopo la chiusura della bottega, accettando l'oscillazione di un'ora tra le stagioni), che genera un CSV leggibile di tutti gli ordini e lo invia via Resend all'email della bottega. **Passato da settimanale a giornaliero il 2026-09-10** su richiesta esplicita dell'utente ("così sono più sicura") — rinominata anche la route da `weekly-backup` a `daily-backup` (percorso, log, test) per coerenza col nome; nessun costo aggiuntivo, il piano gratuito Resend copre ampiamente 1 email/giorno. Design originale in `docs/superpowers/specs/2026-08-14-continuita-dati-backup-design.md`, piano in `docs/superpowers/plans/2026-08-14-continuita-dati-backup-plan.md`; design del passaggio a giornaliero in `docs/superpowers/specs/2026-09-10-backup-giornaliero-design.md`. **Scoperta durante la verifica reale**: l'account Resend va registrato con l'email della bottega stessa (non quella dello sviluppatore) — il mittente di prova gratuito (`onboarding@resend.dev`) può inviare solo all'indirizzo con cui ci si è registrati su Resend, quindi se l'account è a nome dello sviluppatore l'email non arriva al cliente. Registrare l'account Resend a nome del cliente evita del tutto la verifica di un dominio proprio (alternativa più semplice, scelta esplicitamente per questo). **SimpleBackups** (backup tecnico giornaliero + effetto collaterale di impedire la pausa Supabase per inattività) configurato e verificato funzionante il 2026-08-24 (setup manuale/operativo, fuori dallo scope del piano di codice): job PostgreSQL → Google Drive, schedulato ogni notte alle 3 UTC con retention 7 giorni. **Problema incontrato**: il caricamento su Drive falliva ripetutamente (`ACCESS_TOKEN_SCOPE_INSUFFICIENT`, poi genericamente `ES933`) perché il token OAuth salvato non aveva affatto accesso a Drive — un semplice revoke/reconnect dal lato Google (myaccount.google.com/permissions) non bastava a risolverlo. Il fix è stato dentro SimpleBackups stesso: pagina **Storages** (raggiungibile dal menu account in alto a destra, non da "Storage Sync" nel menu principale che è una funzione diversa e non collegata) → menu "..." sulla connessione → **Refresh Authentication**, senza bisogno di eliminare e ricreare la connessione |
| Campo "Azienda" facoltativo su `orders`, mostrato sempre accanto al nome cliente (card, bacheca, scheda ordine, etichetta di stampa, rubrica clienti, profilo, dashboard "Oggi" e barra di ricerca globale) (2026-08-29) | Alcuni clienti sono associazioni o aziende, non persone fisiche — il solo nome/cognome non basta a riconoscerli al banco. Campo libero, mai obbligatorio: `buildClientDisplayName()` in `src/lib/utils.ts` lo accoda al nome con un em dash solo quando presente, nessun residuo per gli ordini senza azienda. Migration `supabase/migrations/20260829000001_add_azienda.sql` applicata manualmente da SQL Editor del Supabase Dashboard (CLI non collegata in ambiente di sviluppo) il 2026-08-29 |
| Ordini multi-riga: nuova tabella `order_items`, `orders.cosa_ordinato`/`orders.prezzo` diventano calcolati automaticamente (progettato 2026-08-29, mergiato e verificato in produzione il 2026-08-30) | Un ordine contiene spesso più articoli diversi con prezzo e testo diversi (es. 2 targhe + 1 timbro) — il modello a singolo `cosa_ordinato`/`prezzo` non lo rappresentava, gap già annotato il 2026-07-09 alla rimozione del vecchio campo "Qtà" e rimandato apposta. `orders.cosa_ordinato`/`orders.prezzo` restano sulla tabella `orders` ma vengono scritti in automatico (`computeOrderSummary` in `src/lib/orderItems.ts`) invece che a mano — per questo liste, bacheca, dashboard, ricerca e backup CSV non hanno richiesto nessuna modifica di codice. Stato ordine resta un unico valore per l'intero ordine, invariato. Discussa e volutamente rimandata a un secondo progetto la richiesta di fasi (preventivo/bozza/materiale/lavorazione) per singolo articolo — troppo grande per essere affrontata insieme alla base multi-riga; vedere `docs/superpowers/specs/2026-08-29-ordini-multi-riga-design.md` per il dettaglio, incluso lo spunto emerso in conversazione per quel design futuro (gli articoli avanzano quasi sempre insieme — il vero bisogno è segnalare le eccezioni, non tracciare ogni riga sempre separatamente). Costruito su branch separato (`worktree-ordini-multi-riga`) via `superpowers:subagent-driven-development`, mergiato su `main` il 2026-08-30 con un solo conflitto banale (una parola nel design doc). Migration `20260829000002_add_order_items.sql` applicata manualmente da SQL Editor del Supabase Dashboard il 2026-08-30, stesso processo già usato per le migration precedenti. **Bug reale trovato e corretto in fase di verifica manuale**: `src/actions/orders.ts` ri-esportava `export type { OrderItemInput }` da un file `"use server"` — il commento immediatamente sopra quella riga documentava già il vincolo violato ("non si possono ri-esportare valori non-async da un file use server"), ma il tipo era comunque passato inosservato sia a `tsc` (erasure dei tipi) sia alla suite Jest (mocka il modulo), e crashava solo aprendo davvero `/orders/new` nel browser con `ReferenceError: OrderItemInput is not defined` — nessun consumer lo importava comunque da lì (`OrderForm.tsx` importa già direttamente da `@/lib/orderItems`), quindi rimosso. Individuato con uno script Playwright temporaneo (stesso pattern già usato per login-PIN/operatore-ordine: crea un ordine con 2 articoli, verifica il totale calcolato, modifica, controlla lista/bacheca), cancellato a verifica completata — non fa parte della suite E2E permanente. Nello stesso giro corretto anche `e2e/flusso-d-consegna.spec.ts`, rimasto rotto due volte in cascata: prima i campi "Cosa ordinato"/"Prezzo €" rimossi dal form, poi un bug preesistente e scoperto solo ora — `getByLabel("Nome *")` risolveva ambiguo perché "Cognome" contiene "nome" come sottostringa — Flusso D ora passa per la prima volta end-to-end dall'introduzione di quel bug |

| Clienti ente/azienda con referente: nuove colonne `orders.is_ente`/`orders.referente` (2026-09-09, migration applicata e verificata in produzione il 2026-09-10) | Alcuni ordini arrivano da aziende/PA, non da una persona — il modello nome/cognome obbligatori non li rappresentava. Interruttore "È un ente/azienda" nel form: relabela "Nome" a "Nome ente/azienda" (resta obbligatorio, nessuna modifica al vincolo NOT NULL esistente), nasconde Cognome/Azienda, mostra "Referente" (sempre facoltativo, indipendente — mai concatenato con nome/azienda in una stringa unica, mostrato sempre su una riga separata ovunque compare il nome cliente: card ordini, bacheca, scheda ordine, etichetta di stampa, rubrica clienti, profilo cliente, dashboard "Oggi", ricerca globale). `is_ente` è un flag esplicito salvato con l'ordine perché lo stesso dato (nome+azienda) sarebbe altrimenti ambiguo tra "persona che lavora per un'azienda" (ordine esistente, azienda dopo il nome) ed "ente con referente" (ordine davanti, referente dopo) — non deducibile a posteriori. `buildClientDisplayName` non ha richiesto modifiche: in modalità ente cognome/azienda restano sempre null, quindi la funzione esistente produce già da sola solo il nome dell'ente. Costruito su worktree separato (`worktree-clienti-ente-referente`) via `superpowers:subagent-driven-development`, 13 task implementati e revisionati (conformità spec + qualità codice) — due bug reali intercettati e corretti in fase di revisione: un test di aggregazione `getCustomers` che non distingueva davvero "vince l'ordine più recente" per `is_ente` (entrambe le righe del fixture avevano lo stesso valore), e la tabella rubrica clienti che perdeva l'allineamento verticale delle righe quando la cella nome cresceva a due righe (mancava `align-top` sui `<td>`). Vedere `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md` |
| Niente pipeline recensione per gli ordini ente (2026-09-10) | Un ente/azienda non lascia una recensione Google personale come farebbe un cliente privato — i tre toggle "Chiedere recensione"/"Recensione richiesta"/"Recensione ricevuta" (sezione Note del form, solo in modifica) non compaiono quando `is_ente` è true, e i tre campi corrispondenti vengono forzati a `false` al salvataggio indipendentemente dallo state React residuo — stesso meccanismo già usato per azzerare Cognome/Azienda quando si attiva "È un ente" (vedere riga "Clienti ente/azienda con referente"). Nessuna migration: la pagina Recensioni e i pallini riepilogativi in scheda ordine restano invariati, dato che un campo sempre `false` non vi compare mai, senza bisogno di un filtro `is_ente` separato. "Msg PRONTO inviato" e il consenso marketing (GDPR) restano invariati e disponibili per qualunque cliente, ente incluso — non fanno parte della pipeline recensione |
| Pagina dedicata "Da incassare" (`/pagamenti`) per gli ordini consegnati con saldo residuo (2026-09-10/11) | Alcuni ordini non si chiudono davvero con la consegna — restano da incassare, ma oggi un ordine "consegnato" sparisce da Ordini/Bacheca senza lasciare traccia del saldo pendente da nessuna parte. Nessuna migration: un ordine è "da incassare" quando `status === "consegnato"` e `saldo > 0` (campi già esistenti), derivato al volo e mai salvato — sparisce da solo quando il saldo torna a zero. Stessa struttura già rodata di `/recensioni` (tabella, bottone "Chiedi su WhatsApp" con messaggio precompilato, link "Scheda"), ordinata dai consegnati più vecchi. Prima idea scartata: una sesta colonna nella Bacheca — avrebbe reso le colonne più strette e avrebbe richiesto anche un redesign della navigazione (menu laterale spostato in alto) solo per far spazio, cambiamento grande rimandato a un ipotetico progetto separato in backlog. Nuova voce di menu "Da incassare" (icona Euro) sia in sidebar sia in bottom nav (7 voci), senza contatore — si consulta quando serve, non richiama l'attenzione ogni volta. Design in `docs/superpowers/specs/2026-09-10-pagamenti-in-sospeso-design.md`, piano in `docs/superpowers/plans/2026-09-10-pagamenti-in-sospeso-plan.md` |

**Regola guida di prodotto**: massimo 3–4 passi per ogni azione frequente. Se un flusso richiede più passaggi, va semplificato prima di essere implementato.

---

## Testing

**Stato al 2026-09-09**: 16 suite / 134 test (Jest) tutti verdi (`npx jest --roots=src`); `npx tsc --noEmit` pulito. Nota: `npm test`/`npx jest` senza scoping raccoglie anche gli spec Playwright sotto `e2e/` (e qualunque worktree annidato sotto `.claude/worktrees/`), che falliscono a livello di suite per un problema di configurazione pre-esistente e non correlato (Playwright va invocato solo via `npx playwright test`) — usare sempre `npx jest --roots=src` per il conteggio delle unità.
- **Test unitari**: copertura su `src/actions/orders.ts`, `src/actions/customers.ts`, `src/actions/reminders.ts`, `src/app/api/dashboard/today`, `src/lib/orderConstants.ts`, `src/lib/shop-name.ts`, `src/lib/operators.ts`.
- **Bug fix (2026-07-07)**: `updateBozzaGrafica` e `updatePreventivo` non facevano avanzare lo `status` principale dell'ordine dopo l'approvazione del sottostato — vedere riga corrispondente in Decisioni chiave. Corretto con TDD (test scritti per primi, poi fix minimo); 5 nuovi test coprono entrambe le funzioni.
- **Code review (2026-07-03)**: nessun bug di correttezza aggiuntivo individuato sul diff (`getOrders` — ricerca ordini).
- **Security review (2026-07-03)**: individuata e corretta una vulnerabilità di filter-injection PostgREST nel campo di ricerca ordini — `filters.search` veniva interpolato senza escaping in `.or()`, permettendo a un utente autenticato di alterare la sintassi del filtro tramite `,`/`()`/`"`. Corretto in `getOrders` (`src/actions/orders.ts`) escapando backslash e virgolette e racchiudendo il valore tra doppi apici (sintassi di quoting valori di PostgREST). Nessun segreto esposto nel repo o nella cronologia Git; RLS e controllo accessi invariati.
- **Hardening pre-deploy (2026-07-07)**: aggiunto `.env.example` (nomi variabili, nessun valore) ed `engines.node` in `package.json`; rafforzato `.gitignore` per impedire il tracking di `.claude/settings.local.json`, che conteneva temporaneamente un service role key incollato in una regola di permesso locale — mai pubblicato su GitHub (repo pubblico, verificato sull'intera history), ma la chiave è stata comunque ruotata per precauzione (nuova chiave attiva in produzione su Vercel). Rimosso anche l'endpoint orfano `/api/auth/setup`, residuo del flusso di autenticazione a PIN abbandonato in favore del solo magic link.
- **Feature (2026-07-07)**: tracciamento materiale da ordinare al fornitore (`materiale`/`materiale_fornitore`/`materiale_cosa_manca`/`materiale_data_ordine` su `orders`). Nuova server action `updateMaterialeFornitore` con 6 nuovi test unitari (data automatica, avanzamento condizionale a `in_lavorazione`, log eventi). Dashboard "Oggi" estesa con due sezioni ("Materiale da ordinare", "Materiale ordinato oggi") e relativi test sulla route `/api/dashboard/today`. Design in `docs/superpowers/specs/2026-07-07-materiale-fornitore-design.md`.
- **Feature (2026-07-09)**: sidebar semplificato (solo testo "Oltre la Bottega", niente quadratino/nome bottega) e colori per stadio su preventivo/bozza grafica/materiale fornitore (terracotta/honey/sage in base al valore esatto, non più un colore fisso per l'intero sottostato) — vedere riga corrispondente in Decisioni chiave. Funzioni pure `preventivoStage`/`bozzaStage`/`materialeStage` in `src/lib/orderConstants.ts` con 12 nuovi test TDD; componente `StageBadge` condiviso (senza icone) riusato in scheda ordine, lista ordini e bacheca. Piano in `docs/superpowers/plans/2026-07-09-sidebar-e-colori-stadio-plan.md`.
- **Feature (2026-07-13/14)**: login con PIN come metodo di accesso alternativo al magic link — vedere riga corrispondente in Decisioni chiave. Nuovo helper `getPostLoginRedirect` in `src/lib/shop-name.ts` (3 test TDD), `src/lib/device-email.ts` per l'email ricordata sul dispositivo, tab "PIN" in `/login`, pagina `/setup-pin` collegata da una nuova pagina "Impostazioni" (`/impostazioni`, solo sidebar desktop). Implementato in un worktree separato (`worktree-login-pin`), mergiato su `main` il 2026-07-14 dopo verifica manuale end-to-end (script Playwright temporaneo con utente di test autenticato via Supabase Admin API — stesso pattern di Flusso D): 11/12 controlli superati, l'unico non superato è l'invio email del magic link bloccato dal rate limit Supabase sull'ambiente di test, non un difetto del codice. Design in `docs/superpowers/specs/2026-07-13-login-pin-design.md`, piano in `docs/superpowers/plans/2026-07-13-login-pin-plan.md`.
- **Feature (2026-07-14/15)**: campo "Operatore" obbligatorio in creazione ordine — vedere riga corrispondente in Decisioni chiave. Nuova colonna `orders.operatore` (migration `20260714000001_add_operatore.sql`), helper puri `getOperatorNames`/`addOperatorName`/`removeOperatorName` in `src/lib/operators.ts` (10 test TDD), `src/lib/device-operator.ts` per l'ultimo operatore ricordato sul dispositivo, nuovo componente `OperatoriSettings.tsx` in Impostazioni per gestire l'elenco. Implementato in un worktree separato (`feature/operatore-ordine`) con `superpowers:subagent-driven-development` (ogni task revisionato due volte, conformità alla spec e qualità del codice — un bug reale intercettato e corretto in corso d'opera, vedere commit `3b6b53d`), mergiato su `main` il 2026-07-15 dopo verifica manuale end-to-end (stesso pattern Playwright del login PIN): 15/15 controlli superati. ~~Flusso D (Playwright) continua a fallire per il bug pre-esistente e non correlato `getByLabel('Nome *')` ambiguo, non per questo lavoro.~~ — risolto il 2026-08-30, vedere bullet "ordini multi-riga" sotto. Design in `docs/superpowers/specs/2026-07-14-operatore-ordine-design.md`, piano in `docs/superpowers/plans/2026-07-14-operatore-ordine-plan.md`.
- **Feature (2026-08-14)**: backup settimanale via email — vedere riga corrispondente in Decisioni chiave. Nuova funzione pura `ordersToCsv` (`src/lib/csv.ts`, 6 test TDD), client Supabase con service role `src/lib/supabase/admin.ts` (per contesti senza sessione utente, deliberatamente non tipizzato con `Database` perché `src/types/supabase.ts` è più vecchio dello schema reale — stesso problema già aggirato in `src/actions/orders.ts`), `sendBackupEmail` via Resend (`src/lib/email/sendBackupEmail.ts`, no-op se `RESEND_API_KEY` non configurata, propaga gli errori di invio invece di inghiottirli silenziosamente), route `/api/cron/weekly-backup` (esclusa dal redirect di autenticazione del middleware, richiede esattamente un utente bottega escludendo gli account `@oltrelabottega.local`), `vercel.json` per lo scheduling settimanale. Implementato con `superpowers:subagent-driven-development` in una worktree separata (`worktree-continuita-dati-backup`), ogni task revisionato due volte (conformità alla spec + qualità del codice): la revisione finale d'insieme ha intercettato un bug reale — il controllo "esattamente un utente" sarebbe stato defeated dall'account di servizio E2E permanente nello stesso progetto Supabase, corretto filtrando gli account `@oltrelabottega.local` prima del conteggio (commit `01b625f`). Mergiato su `main` il 2026-08-14, verificato end-to-end in produzione lo stesso giorno: durante la verifica sono emersi e risolti anche due problemi non di codice — variabili d'ambiente che richiedono un redeploy per essere applicate, e utenti Supabase Auth di test/sviluppo accumulati nel progetto che violavano l'invariante "un solo utente bottega" (ripuliti manualmente). Design in `docs/superpowers/specs/2026-08-14-continuita-dati-backup-design.md`, piano in `docs/superpowers/plans/2026-08-14-continuita-dati-backup-plan.md`.
- **Feature (2026-08-29)**: campo "Azienda" facoltativo sui clienti — vedere riga corrispondente in Decisioni chiave. Nuova colonna `orders.azienda` (migration `20260829000001_add_azienda.sql`), helper condivisi `buildSearchOrClause` (estratto in `src/lib/search.ts`, riusato ora da `getOrders`, `getCustomers` e `/api/search`) e `buildClientDisplayName` (`src/lib/utils.ts`, compone "Nome Cognome — Azienda" solo quando l'azienda è presente) con 14 nuovi test TDD complessivi tra `src/lib/__tests__/utils.test.ts`, `src/lib/__tests__/search.test.ts`, `src/app/api/search/__tests__/route.test.ts` e le suite esistenti di `customers.test.ts`/`orders.test.ts`. Effetto collaterale utile: estendere la ricerca clienti/globale ad `azienda` ha richiesto di far passare anche `getCustomers` e `/api/search` da `buildSearchOrClause`, chiudendo su entrambi lo stesso gap di filter-injection PostgREST già corretto su `getOrders` il 2026-07-03 (query `.or()` con termine interpolato senza escaping). Implementato con `superpowers:subagent-driven-development` in una worktree separata (`.worktrees/campo-azienda`), ogni task revisionato due volte (conformità alla spec + qualità del codice) più una revisione finale d'insieme — due bug reali intercettati e corretti in corso d'opera: un test di aggregazione azienda che non distingueva "ordine più recente" da "primo valore non nullo" (commit `7ccdcd2`), e un gap nella documentazione sullo stato non ancora applicato della migration (poi risolto). Mergiato su `main` il 2026-08-29. In un secondo passaggio lo stesso giorno, esteso `buildClientDisplayName` anche a `TodayBoard.tsx` (dashboard "Oggi") e `SearchBar.tsx` (ricerca globale) — inizialmente lasciati fuori scope nel piano originale, poi richiesti esplicitamente — con relativi test su `/api/dashboard/today` e `/api/search` (23 suite / 191 test complessivi). Design in `docs/superpowers/specs/2026-08-29-campo-azienda-design.md`, piano in `docs/superpowers/plans/2026-08-29-campo-azienda-plan.md`.
- **Feature (2026-08-29/30)**: ordini multi-riga (Progetto 1) — vedere riga corrispondente in Decisioni chiave. Nuova tabella `order_items` (migration `20260829000002_add_order_items.sql`, con backfill di un articolo per ogni ordine esistente), funzione pura `computeOrderSummary` (`src/lib/orderItems.ts`, 4 test TDD), `createOrder`/`updateOrder` ora accettano un array `items` invece dei singoli campi `cosa_ordinato`/`testo_da_scrivere`/`prezzo` (nuovi test in `src/actions/__tests__/orders.test.ts`), `getOrder` restituisce anche `items`. `OrderForm.tsx` sostituisce i vecchi campi con una sezione "Articoli" (righe aggiungibili/rimovibili, totale calcolato dal vivo); scheda ordine mostra l'elenco articoli al posto del vecchio "Testo da scrivere". Costruito su worktree separato con `superpowers:subagent-driven-development` il 2026-08-29, mergiato su `main` e migration applicata il 2026-08-30. **Verifica manuale post-merge** (script Playwright temporaneo, stesso pattern del login PIN/operatore-ordine, cancellato a verifica completata) ha trovato e fatto correggere un bug reale: `export type { OrderItemInput }` in `src/actions/orders.ts` (file `"use server"`) crashava il bundler dei server actions a runtime (`ReferenceError: OrderItemInput is not defined` aprendo `/orders/new`) — invisibile a `tsc` (tipo, erased) e a Jest (mocka il modulo), rimosso perché comunque inutilizzato (`OrderForm.tsx` importa già da `@/lib/orderItems` direttamente). La stessa verifica ha anche aggiornato `e2e/flusso-d-consegna.spec.ts` ai nuovi campi Articoli e corretto il bug storico `getByLabel('Nome *')` ambiguo (risolveva anche `#cognome`, perché "Cognome" contiene "nome" come sottostringa) — Flusso D passa ora end-to-end per la prima volta. Design in `docs/superpowers/specs/2026-08-29-ordini-multi-riga-design.md`, piano in `docs/superpowers/plans/2026-08-29-ordini-multi-riga-plan.md`. Fasi per singolo articolo (Progetto 2) volutamente fuori scope, da riprendere a parte.
- **Feature (2026-09-09/10)**: clienti ente/azienda con referente — vedere riga corrispondente in Decisioni chiave. Nuove colonne `orders.is_ente`/`orders.referente` (migration `20260909000001_add_ente_referente.sql`, applicata manualmente da SQL Editor del Supabase Dashboard il 2026-09-10). `getOrders`/`getCustomers`/`/api/search` includono `referente` nella ricerca (nuovi test); `getCustomers`/`getOrdersByCustomer` includono `is_ente`/`referente` nella select e nell'aggregazione clienti (nuovi test). `OrderForm.tsx` guadagna l'interruttore "È un ente/azienda" (Nome→"Nome ente/azienda", Cognome/Azienda nascosti, campo "Referente" facoltativo); `fillCustomer`/autocomplete adattati. Referente mostrato su una riga separata in card ordini, bacheca, scheda ordine, etichetta di stampa, rubrica clienti, profilo cliente, dashboard "Oggi" e ricerca globale — mai unito al nome in una sola stringa. Costruito su worktree separato (`worktree-clienti-ente-referente`) con `superpowers:subagent-driven-development`, 13 task ciascuno revisionato due volte (conformità alla spec + qualità del codice) — due bug reali intercettati e corretti in corso d'opera: un test di aggregazione `getCustomers` che non distingueva davvero "vince l'ordine più recente" per `is_ente` (entrambe le righe del fixture avevano lo stesso valore, quindi un'implementazione sbagliata sarebbe passata comunque), e la tabella rubrica clienti (`/customers`) che perdeva l'allineamento verticale delle righe quando la cella del nome cresceva a due righe (aggiunto `align-top` sui `<td>`). **Verificato end-to-end in produzione il 2026-09-10** (script Playwright temporaneo, stesso pattern già usato per multi-riga/login-PIN/operatore-ordine, cancellato a verifica completata): creazione ordine ente con referente, visibilità su riga separata in scheda/lista/bacheca/rubrica/ricerca/etichetta, precompilazione corretta in modifica, toggle disattivabile con ripristino di Cognome/Azienda, nessuna regressione su un ordine privato normale — tutto superato al primo tentativo, nessun bug trovato in questo giro. Design in `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md`, piano in `docs/superpowers/plans/2026-09-09-clienti-ente-referente-plan.md`.
- **Feature (2026-09-10)**: niente pipeline recensione per gli ordini ente — vedere riga corrispondente in Decisioni chiave. Modifica di una riga in `OrderForm.tsx`: i tre toggle "Chiedere recensione"/"Recensione richiesta"/"Recensione ricevuta" (sezione Note, solo in modifica) sono esclusi dalla lista quando `isEnte` è true, e i tre campi corrispondenti nel payload di salvataggio sono forzati a `false` quando `isEnte` è true. Nessuna migration, nessun nuovo test automatico (nessuna infrastruttura di test per componenti in questo codebase) — verificato manualmente con script Playwright temporaneo (stesso pattern delle feature precedenti, cancellato a verifica completata): toggle assenti in modifica di un ordine ente, comportamento invariato per un ordine privato, e un ordine privato con "Chiedere recensione" già attivo convertito in ente durante la modifica salva correttamente `false` — tutti i casi superati al primo tentativo. Design in `docs/superpowers/specs/2026-09-10-niente-recensione-enti-design.md`, piano in `docs/superpowers/plans/2026-09-10-niente-recensione-enti-plan.md`.
- **Feature (2026-09-10)**: backup email da settimanale a giornaliero — vedere riga corrispondente in Decisioni chiave. Rinominata la route `src/app/api/cron/weekly-backup/` in `src/app/api/cron/daily-backup/` (percorso, log interni, test), cambiato lo schedule in `vercel.json` da `"0 6 * * 1"` a `"0 20 * * *"`, aggiornato il testo dell'email in `sendBackupEmail.ts` ("giornaliera" invece di "settimanale") e il commento di riferimento in `middleware.ts`. Nessuna modifica alla logica di selezione ordini o al formato CSV — stessi test esistenti, spostati e aggiornati solo nei riferimenti al percorso. Design in `docs/superpowers/specs/2026-09-10-backup-giornaliero-design.md`, piano in `docs/superpowers/plans/2026-09-10-backup-giornaliero-plan.md`.
- **Feature (2026-09-10/11)**: pagina "Da incassare" per gli ordini in attesa di pagamento — vedere riga corrispondente in Decisioni chiave. Nuova pagina `src/app/(dashboard)/pagamenti/page.tsx` (query `getOrders({ status: "consegnato" })` filtrata in memoria su `saldo > 0`, ordinata per `data_consegnato` crescente), nuova voce di menu in `Sidebar.tsx`/`BottomNav.tsx`. Nessuna migration, nessun nuovo server action, nessuna infrastruttura di test per pagine in questo codebase (stessa convenzione di `/recensioni`) — verificato con script Playwright temporaneo (stesso pattern delle feature precedenti, autenticato via `e2e/helpers/auth.ts`, cancellato a verifica completata): ordine consegnato con saldo residuo compare nell'elenco con dati corretti, link WhatsApp precompilato, sparisce dopo aver azzerato il saldo, ordinamento per data di consegna effettiva, ordine ente mostra la riga "Ref.". Design in `docs/superpowers/specs/2026-09-10-pagamenti-in-sospeso-design.md`, piano in `docs/superpowers/plans/2026-09-10-pagamenti-in-sospeso-plan.md`.

**Flussi E2E da testare (Playwright o simile):**
- Flusso A: apertura dashboard → lettura priorità (< 60 s) — implementato (`e2e/flusso-a-dashboard.spec.ts`)
- Flusso B: creazione nuovo ordine (< 2 min) — implementato (`e2e/flusso-b-nuovo-ordine.spec.ts`)
- Flusso C: aggiornamento stato ordine esistente (< 30 s) — implementato (`e2e/flusso-c-aggiorna-ordine.spec.ts`)
- Flusso D: consegna + aggiornamento pagamento + follow-up — implementato (`e2e/flusso-d-consegna.spec.ts`)

**Autenticazione nei test E2E** (`e2e/helpers/auth.ts`): l'app usa solo magic link, quindi non esiste una password di test. Flusso D si autentica generando una sessione reale via Supabase Admin API (`generateLink` + `verifyOtp`) per un utente dedicato `e2e-test@oltrelabottega.local`, e inietta i cookie di sessione nel browser context di Playwright — nessuna email da intercettare. Richiede `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. **Il test gira contro lo stesso progetto Supabase dell'app (anche produzione)**: l'ordine creato durante il test viene sempre cancellato in `afterEach` (bypassando l'app via service role), indipendentemente dall'esito — verificato che non lasci dati residui. L'utente di test invece resta (creazione idempotente), come un normale account di servizio — la route `/api/cron/daily-backup` (vedere Feature 2026-08-14, rinominata da weekly-backup il 2026-09-10) lo esclude esplicitamente dal conteggio "utenti bottega" per questo stesso motivo.

**Checklist di verifica prima di ogni release:**
- [ ] Dashboard mostra KPI corretti (ordini aperti, urgenti, in ritardo, consegne oggi)
- [ ] Creazione ordine funziona su mobile (bottom nav visibile)
- [ ] Filtri e ricerca restituiscono risultati corretti
- [ ] Tempo risposta UI < 300 ms per operazioni locali
- [ ] Query liste principali < 1 secondo

---

## Comandi principali

> Da configurare dopo lo scaffold del progetto Next.js. Riferimento atteso:

```bash
# Setup iniziale
npm install
cp .env.local.example .env.local   # inserire credenziali Supabase

# Sviluppo locale
npm run dev

# Build produzione
npm run build
npm run start

# Lint e type check
npm run lint
npx tsc --noEmit

# Test E2E
npx playwright test
npx playwright test --grep "Flusso B"  # singolo flusso

# Deploy (automatico via Vercel su push a main)
git push origin main
```

**Schema SQL**: applicare via Supabase Dashboard o CLI:
```bash
supabase db push        # applica migrations
supabase gen types typescript --local > src/types/supabase.ts
```

---

## Sistema di auto-aggiornamento dei file

| File | Responsabilità | Aggiornamento |
|---|---|---|
| `CLAUDE.md` | Orientamento rapido per Claude, stato del progetto | Aggiornare a ogni cambio di stack, decisione architetturale o completamento di fase |
| `DESIGN.md` | Design system "Runway" — colori, tipografia, componenti UI | Aggiornare a ogni nuovo token colore, componente o convenzione visiva |
| `specifica_tecnica_agente_ai.md` | Spec funzionale e tecnica di riferimento (v2.0) | Aggiornare solo per cambi di scope o modello dati significativi |
| `idea.md` | Concept originale e progettazione | Non modificare — documento storico |
| `research.md` | Ricerca UX e stack | Non modificare — documento storico |
| `critiche.md` | Analisi rischi | Non modificare — documento storico |

**Regola**: quando viene presa una decisione che cambia quanto scritto in `specifica_tecnica_agente_ai.md` o `CLAUDE.md`, aggiornare entrambi nello stesso commit. Il file `CLAUDE.md` deve sempre riflettere lo stato reale del progetto, non lo stato pianificato.

---

## Piano di rilascio

- **Fase 0** ✅: scaffold Next.js, Supabase project, schema SQL v2, auth magic link
- **Fase 1** ✅: dashboard oggi/7 giorni, CRUD ordini, agenda, bacheca kanban, ricerca/filtri
- **Fase 2** ✅: timeline ordini, pagamento (prezzo/acconto/saldo), UX mobile, recensioni
- **Fase 3** 🔄 in corso: etichetta stampabile con QR code (fatto); link rapidi WhatsApp/Email per richiesta recensione e avviso ordine pronto (fatto, senza integrazione API); template messaggi per altri casi d'uso — es. ordine in ritardo, promemoria pagamento (da fare); integrazioni canali vere con API (post-MVP)
- **Fase 4** (opzionale): Supabase Realtime — aggiornamenti automatici tra più tablet senza ricaricare la pagina

**Osservazioni emerse dalla review del 2026-07-03, rimandate a una fase successiva:**
- Vulnerabilità moderata in `postcss` (XSS su output CSS stringify), rilevata da `npm audit`, portata transitivamente da `next` — il fix richiede un aggiornamento major di `next` (breaking change): rimandato, non rientra nello scope della modifica corrente.
- Nessuna pipeline CI automatica: test, lint, typecheck e security review vengono eseguiti manualmente prima del push, non ad ogni commit/PR.

**Osservazioni emerse dalla preparazione al deploy del 2026-07-07, rimandate a una fase successiva:**
- ~~La pagina `src/app/(auth)/setup-pin/page.tsx` è un residuo del flusso di autenticazione a PIN: la UI di login è stata rimossa nel commit `acfd743` ("remove PIN auth, keep magic link only"), ma questa pagina è rimasta raggiungibile e funzionante (imposta una password sull'account tramite client Supabase direttamente, senza passare dall'endpoint API già rimosso). Contraddice la decisione "solo magic link, niente PIN" — da valutare se rimuovere.~~ — risolto il 2026-07-13: `setup-pin` è ora collegato da "Impostazioni" ed è parte integrante del login con PIN (vedere riga corrispondente in Decisioni chiave e motivazioni).
- Vecchia Supabase secret key (`sb_secret_piwm1...`) ancora da revocare su Dashboard: Supabase blocca la cancellazione delle chiavi usate nelle 24h precedenti, e questa era ancora la chiave di produzione fino alla rotazione dello stesso giorno. Da revocare non appena il cooldown è scaduto — link: Project Settings → API Keys.

~~Flusso E2E D (consegna + aggiornamento pagamento + follow-up) non ancora scritto~~ — implementato il 2026-07-03 (vedere Testing). Il test crea un utente Supabase dedicato via Admin API la prima volta che gira (persiste, come un account di servizio) e ripulisce sempre l'ordine di prova a fine test.

**Osservazioni emerse dalla verifica reale del backup settimanale (2026-08-14), rimandate a un prossimo passo:**
- ~~SimpleBackups (backup tecnico giornaliero + anti-pausa Supabase) non ancora configurato~~ — configurato e verificato funzionante il 2026-08-24, vedere riga "Backup giornaliero via email" in Decisioni chiave per il dettaglio del fix (problema di scope OAuth Google Drive, risolto con "Refresh Authentication" dentro SimpleBackups).
- ~~La checklist pubblica "Cosa serve per usare Oltre la Bottega" non è ancora stata aggiornata con la voce sull'account Resend/backup email~~ — creata il 2026-08-22 in `docs/checklist-cliente-nuovo.md` (indispensabile/facoltativo), include già la voce Resend. Voce SimpleBackups aggiornata il 2026-08-24 per riflettere la configurazione ora verificata funzionante.
