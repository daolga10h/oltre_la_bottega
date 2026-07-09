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
│   │   └── layout.tsx
│   ├── (print)/                     # Layout minimale (no sidebar) per stampa
│   │   └── orders/[id]/print/       # Pagina etichetta stampabile con QR code
│   ├── (auth)/login/page.tsx
│   ├── icon.tsx                     # Favicon generato dinamicamente (ImageResponse, marchio "OB")
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
- Lavorazione: `cosa_ordinato`*, `testo_da_scrivere`, `tipo_lavorazione`, `dettagli_grafici`, `quantita`, `bozza_grafica`, `foto_oggetto`, `file_cliente`, `note`
- Date: `data_ordine` (default today), `data_consegna`, `data_consegnato`
- Stato principale: `status` (preventivo → bozza_grafica → da_fare → in_lavorazione → pronto → consegnato)
- Sottostato preventivo: `preventivo` (da_inviare → inviato → approvato)
- Sottostato bozza: `bozza_grafica` (non_serve | da_fare | inviata | modificata | approvata)
- Sottostato materiale: `materiale` (non_serve | da_ordinare | ordinato | arrivato), `materiale_fornitore`, `materiale_cosa_manca`, `materiale_data_ordine`
- Pagamento: `prezzo`, `acconto`, `saldo` (calcolato)
- Flag: `msg_pronto_inviato`, `chiedere_recensione`, `recensione_richiesta`, `recensione_ricevuta`, `consenso_marketing`

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

**Regola guida di prodotto**: massimo 3–4 passi per ogni azione frequente. Se un flusso richiede più passaggi, va semplificato prima di essere implementato.

---

## Testing

**Stato al 2026-07-07**: test unitari e correzione bug completati sull'ultima modifica (avanzamento automatico dello stato ordine su approvazione bozza/preventivo), verificata anche manualmente in produzione dall'utente.
- **Test unitari**: 6 suite / 47 test (Jest) su `src/actions/orders.ts`, `src/actions/customers.ts`, `src/actions/reminders.ts`, `src/app/api/dashboard/today`, `src/lib/orderConstants.ts` — tutti verdi; `npx tsc --noEmit` pulito.
- **Bug fix (2026-07-07)**: `updateBozzaGrafica` e `updatePreventivo` non facevano avanzare lo `status` principale dell'ordine dopo l'approvazione del sottostato — vedere riga corrispondente in Decisioni chiave. Corretto con TDD (test scritti per primi, poi fix minimo); 5 nuovi test coprono entrambe le funzioni.
- **Code review (2026-07-03)**: nessun bug di correttezza aggiuntivo individuato sul diff (`getOrders` — ricerca ordini).
- **Security review (2026-07-03)**: individuata e corretta una vulnerabilità di filter-injection PostgREST nel campo di ricerca ordini — `filters.search` veniva interpolato senza escaping in `.or()`, permettendo a un utente autenticato di alterare la sintassi del filtro tramite `,`/`()`/`"`. Corretto in `getOrders` (`src/actions/orders.ts`) escapando backslash e virgolette e racchiudendo il valore tra doppi apici (sintassi di quoting valori di PostgREST). Nessun segreto esposto nel repo o nella cronologia Git; RLS e controllo accessi invariati.
- **Hardening pre-deploy (2026-07-07)**: aggiunto `.env.example` (nomi variabili, nessun valore) ed `engines.node` in `package.json`; rafforzato `.gitignore` per impedire il tracking di `.claude/settings.local.json`, che conteneva temporaneamente un service role key incollato in una regola di permesso locale — mai pubblicato su GitHub (repo pubblico, verificato sull'intera history), ma la chiave è stata comunque ruotata per precauzione (nuova chiave attiva in produzione su Vercel). Rimosso anche l'endpoint orfano `/api/auth/setup`, residuo del flusso di autenticazione a PIN abbandonato in favore del solo magic link.
- **Feature (2026-07-07)**: tracciamento materiale da ordinare al fornitore (`materiale`/`materiale_fornitore`/`materiale_cosa_manca`/`materiale_data_ordine` su `orders`). Nuova server action `updateMaterialeFornitore` con 6 nuovi test unitari (data automatica, avanzamento condizionale a `in_lavorazione`, log eventi). Dashboard "Oggi" estesa con due sezioni ("Materiale da ordinare", "Materiale ordinato oggi") e relativi test sulla route `/api/dashboard/today`. Design in `docs/superpowers/specs/2026-07-07-materiale-fornitore-design.md`.

**Flussi E2E da testare (Playwright o simile):**
- Flusso A: apertura dashboard → lettura priorità (< 60 s) — implementato (`e2e/flusso-a-dashboard.spec.ts`)
- Flusso B: creazione nuovo ordine (< 2 min) — implementato (`e2e/flusso-b-nuovo-ordine.spec.ts`)
- Flusso C: aggiornamento stato ordine esistente (< 30 s) — implementato (`e2e/flusso-c-aggiorna-ordine.spec.ts`)
- Flusso D: consegna + aggiornamento pagamento + follow-up — implementato (`e2e/flusso-d-consegna.spec.ts`)

**Autenticazione nei test E2E** (`e2e/helpers/auth.ts`): l'app usa solo magic link, quindi non esiste una password di test. Flusso D si autentica generando una sessione reale via Supabase Admin API (`generateLink` + `verifyOtp`) per un utente dedicato `e2e-test@oltrelabottega.local`, e inietta i cookie di sessione nel browser context di Playwright — nessuna email da intercettare. Richiede `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. **Il test gira contro lo stesso progetto Supabase dell'app (anche produzione)**: l'ordine creato durante il test viene sempre cancellato in `afterEach` (bypassando l'app via service role), indipendentemente dall'esito — verificato che non lasci dati residui. L'utente di test invece resta (creazione idempotente), come un normale account di servizio.

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
- La pagina `src/app/(auth)/setup-pin/page.tsx` è un residuo del flusso di autenticazione a PIN: la UI di login è stata rimossa nel commit `acfd743` ("remove PIN auth, keep magic link only"), ma questa pagina è rimasta raggiungibile e funzionante (imposta una password sull'account tramite client Supabase direttamente, senza passare dall'endpoint API già rimosso). Contraddice la decisione "solo magic link, niente PIN" — da valutare se rimuovere.
- Vecchia Supabase secret key (`sb_secret_piwm1...`) ancora da revocare su Dashboard: Supabase blocca la cancellazione delle chiavi usate nelle 24h precedenti, e questa era ancora la chiave di produzione fino alla rotazione dello stesso giorno. Da revocare non appena il cooldown è scaduto — link: Project Settings → API Keys.

~~Flusso E2E D (consegna + aggiornamento pagamento + follow-up) non ancora scritto~~ — implementato il 2026-07-03 (vedere Testing). Il test crea un utente Supabase dedicato via Admin API la prima volta che gira (persiste, come un account di servizio) e ripulisce sempre l'ordine di prova a fine test.
