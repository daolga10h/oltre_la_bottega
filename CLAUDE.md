# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Descrizione del progetto

**Oltre la Bottega** è una dashboard operativa con mini CRM per botteghe artigiane e micro-attività (1–5 persone). L'obiettivo è dare una vista unica, semplice e azionabile di ciò che serve oggi per gestire la bottega, riducendo il caos operativo quotidiano.

Il prodotto NON è un CRM generico né un gestionale aziendale. È una "cabina di comando" operativa centrata sulla domanda: **"Cosa devo fare oggi?"**. L'AI, se introdotta, è un acceleratore secondario, non il centro dell'esperienza.

**Stato attuale**: specifiche tecniche complete, MVP pronto per lo sviluppo. Il codice non è ancora stato scaffoldato. Il file `mini_crm_freelancer_single_html.html` è il prototipo HTML di riferimento per la UI.

---

## Struttura del progetto (pianificata)

```
oltre_la_bottega/
├── CLAUDE.md
├── specifica_tecnica_agente_ai.md   # Spec tecnica completa v2.0
├── idea.md                          # Concept e progettazione
├── research.md                      # Ricerca su UX, design, stack
├── critiche.md                      # Analisi critica e rischi
├── mini_crm_freelancer_single_html.html  # Prototipo UI di riferimento
├── gestione.html                    # File HTML aggiuntivo di riferimento
└── [src/]                           # App Next.js da creare (non ancora presente)
```

**Struttura Next.js da scaffoldare:**
```
src/
├── app/
│   ├── (dashboard)/page.tsx         # Vista oggi / prossimi 7 giorni
│   ├── orders/page.tsx
│   ├── customers/page.tsx
│   ├── agenda/page.tsx
│   └── api/
│       ├── orders/route.ts
│       ├── customers/route.ts
│       ├── reminders/route.ts
│       └── dashboard/
│           ├── today/route.ts
│           └── week/route.ts
├── components/
│   ├── TodayBoard.tsx
│   ├── OrderForm.tsx
│   ├── ReminderList.tsx
│   └── SearchBar.tsx
└── lib/
    └── supabase.ts
```

---

## Tech Stack

| Layer         | Tecnologia              | Motivazione                                      |
|---------------|-------------------------|--------------------------------------------------|
| Frontend      | Next.js + TypeScript    | App Router, server actions, tipi sicuri          |
| Styling       | Tailwind CSS            | Design rapido, responsivo, coerente              |
| UI Components | shadcn/ui               | Componenti puliti senza overhead                 |
| Database      | Supabase (PostgreSQL)   | CRUD semplice, RLS per isolamento bottega        |
| Auth          | Supabase Auth           | Sessioni sicure, multi-tenant ready              |
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

**Multi-tenancy**: ogni record operativo è legato a `shop_id`. Le Row Level Security (RLS) policies di Supabase garantiscono l'isolamento dati tra botteghe.

**API interne minime:**
- `POST /api/orders` · `PATCH /api/orders/:id` · `GET /api/orders`
- `GET /api/customers` · `POST /api/reminders`
- `GET /api/dashboard/today` · `GET /api/dashboard/week`

---

## Modello dati (v1)

Tabelle principali in PostgreSQL: `users`, `shops`, `customers`, `orders`, `order_events`, `reminders`, `inventory_items`, `reviews`, `attachments`.

Vincoli critici:
- Ogni record ha `shop_id` (isolamento tenant)
- Indici su `due_date`, `status`, `priority`, `customer_id`
- `order_events` traccia la timeline di ogni ordine (audit log leggero)

---

## Decisioni chiave e motivazioni

| Decisione | Motivazione |
|---|---|
| Next.js Server Actions per mutation | Evita un layer API separato nell'MVP |
| Supabase invece di backend custom | Zero infrastruttura da gestire, auth + RLS inclusi |
| shadcn/ui invece di libreria full | Componenti copiabili e personalizzabili, nessun lock-in |
| Scope MVP stretto (ordini + clienti + dashboard + reminder) | Il rischio principale è lo scope creep; funzioni come parsing PDF e WhatsApp sono post-MVP |
| Layout card-based con colori di stato | Gli utenti devono leggere le priorità in meno di 30 secondi |

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
- [ ] RLS: un utente non vede i dati di un'altra bottega
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

- **Fase 0** (3–5 gg): scaffold Next.js, Supabase project, schema SQL v1, auth
- **Fase 1** (2–4 sett): dashboard oggi/7 giorni, CRUD ordini, CRUD clienti, reminder, ricerca/filtri
- **Fase 2** (1–2 sett): timeline ordini, pagamento base, inventario base, UX mobile
- **Fase 3** (opzionale): recensioni, template messaggi, integrazioni canali esterni
