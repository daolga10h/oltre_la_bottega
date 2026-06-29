# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Descrizione del progetto

**Oltre la Bottega** è una dashboard operativa con mini CRM per botteghe artigiane e micro-attività (1–5 persone). L'obiettivo è dare una vista unica, semplice e azionabile di ciò che serve oggi per gestire la bottega, riducendo il caos operativo quotidiano.

Il prodotto NON è un CRM generico né un gestionale aziendale. È una "cabina di comando" operativa centrata sulla domanda: **"Cosa devo fare oggi?"**. L'AI, se introdotta, è un acceleratore secondario, non il centro dell'esperienza.

**Stato attuale**: MVP in produzione su Vercel. Fase 0+1+2 completate e deployate su `main`. In uso attivo con bug fixing continuo. Fase 3 parzialmente avviata (etichetta di stampa implementata). Il file `mini_crm_freelancer_single_html.html` è il prototipo HTML di riferimento per la UI.

---

## Struttura del progetto

```
oltre_la_bottega/
├── CLAUDE.md
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
│   └── layout.tsx                   # Root layout
├── actions/                         # Server actions
│   ├── orders.ts
│   ├── reminders.ts
│   ├── customers.ts
│   └── inventory.ts
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
- Anagrafica cliente: `nome`*, `cognome`, `telefono`, `email_cliente`, `canale`, `consenso_marketing`
- Lavorazione: `cosa_ordinato`*, `testo_da_scrivere`, `tipo_lavorazione`, `dettagli_grafici`, `quantita`, `bozza_grafica`, `foto_oggetto`, `file_cliente`, `note`
- Date: `data_ordine` (default today), `data_consegna`, `data_consegnato`
- Stato principale: `status` (preventivo → bozza_grafica → da_fare → in_lavorazione → pronto → consegnato)
- Sottostato preventivo: `preventivo` (da_inviare → inviato → approvato)
- Sottostato bozza: `bozza_grafica` (non_serve | da_fare | inviata | modificata | approvata)
- Pagamento: `prezzo`, `acconto`, `saldo` (calcolato)
- Flag: `msg_pronto_inviato`, `chiedere_recensione`, `recensione_richiesta`, `recensione_ricevuta`, `consenso_marketing`

**`order_events`** — timeline audit log per ordine

**`reminders`** — promemoria liberi (`title`, `due_at`, `status`: attivo/completato)

**`inventory_items`** — materiali base

Migrations da applicare in ordine:
1. `20260626000001_order_schema_v2.sql` — schema principale (drop + recreate)
2. `20260628000001_add_consenso_marketing.sql`
3. `20260628000002_add_dettagli_grafici.sql`
4. `20260629000001_add_preventivo_bozza_modificata.sql` — colonna preventivo + aggiorna constraint bozza

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
| Stato ordine calcolato automaticamente alla creazione | Regola: inviare preventivo → "preventivo"; no preventivo + bozza → "bozza_grafica"; no preventivo + no bozza → "in_lavorazione" |
| Bottoni rapidi nella pagina dettaglio per sottostati | Preventivo (da_inviare/inviato/approvato) e Bozza (da_fare/inviata/modificata/approvata) senza entrare in modifica |
| Log attività con testo descrittivo in italiano | Niente "Stato: X" — messaggi leggibili tipo "Bozza approvata", "Consegnato al cliente" |
| RLS abilitata su tutte le tabelle con `auth.uid() is not null` | Sicurezza base; single-tenant, nessuna separazione per utente |
| Dopo crea/modifica ordine → redirect a scheda ordine (non lista) | Permette di stampare etichetta immediatamente dopo la creazione |
| Bacheca = grid 5 colonne (non flex scroll) | Tutte le colonne visibili senza scrollare orizzontalmente |
| Card ordine (lista e bacheca) = solo nome · cosa · data | Tipo lavorazione e saldo rimossi dalle card — info di dettaglio, non di scansione rapida |
| Etichetta stampabile = pagina separata `(print)/orders/[id]/print` | Layout senza sidebar, auto-stampa, QR code verso la scheda ordine; dimensioni da configurare per stampante termica |
| `ReminderForm` = client component con `useActionState` + `router.refresh()` | Form action + `revalidatePath` non aggiornava il server component montato; serve `router.refresh()` esplicito |

**Regola guida di prodotto**: massimo 3–4 passi per ogni azione frequente. Se un flusso richiede più passaggi, va semplificato prima di essere implementato.

---

## Testing

**Flussi E2E da testare (Playwright o simile):**
- Flusso A: apertura dashboard → lettura priorità (< 60 s)
- Flusso B: creazione nuovo ordine (< 2 min)
- Flusso C: aggiornamento stato ordine esistente (< 30 s)
- Flusso D: consegna + aggiornamento pagamento + follow-up

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
- **Fase 3** 🔄 in corso: etichetta stampabile con QR code (fatto); template messaggi (da fare); integrazioni canali (post-MVP)
- **Fase 4** (opzionale): Supabase Realtime — aggiornamenti automatici tra più tablet senza ricaricare la pagina
