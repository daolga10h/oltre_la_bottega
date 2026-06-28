# Specifica tecnica completa
## Dashboard operativa + Mini CRM per la gestione delle botteghe

Versione: 2.0
Data: 2026-06-24
Stato: pronta per sviluppo MVP

---

## 1) Contesto e obiettivo

Il progetto e costruire una dashboard operativa con mini CRM, pensata per botteghe artigiane e micro-attivita.

Problema da risolvere:
- informazioni sparse tra chat, note, fogli, memoria personale;
- difficolta nel capire rapidamente priorita, urgenze e consegne;
- rischio di dimenticanze su ordini, follow-up e materiali.

Obiettivo prodotto:
- dare una vista unica, semplice e azionabile di cio che serve oggi per gestire la bottega.

Obiettivo MVP:
- ridurre il caos operativo quotidiano con 4 aree centrali:
1. ordini
2. clienti
3. agenda/promemoria
4. vista giornaliera delle priorita

---

## 2) Discovery Interview (sintesi decisionale)

### 2.1 Utente target
- titolare di bottega
- artigiano indipendente
- piccolo team (1-5 persone)

### 2.2 Jobs to be done principali
- capire in 30 secondi cosa fare oggi
- creare/aggiornare un ordine in pochi passaggi
- recuperare storico cliente senza cercare su piu canali
- non perdere scadenze o consegne

### 2.3 Pain point reali
- troppi strumenti separati
- aggiornamenti manuali lenti
- bassa disciplina nel tenere ordinati i dati
- difficolta a stimare carico e urgenze

### 2.4 Regola guida di prodotto
Il sistema non deve gestire tutto: deve rendere piu facile il lavoro di oggi.

### 2.5 Scope MVP deciso
Incluso:
- dashboard giornaliera
- ordini
- clienti
- promemoria/scadenze
- ricerca e filtri rapidi
- stato pagamento base

Escluso (post-MVP):
- parsing PDF fornitori automatico
- integrazioni WhatsApp/email native
- analytics avanzate
- automazioni complesse
- inventario avanzato multi-magazzino

---

## 3) Visione funzionale

### 3.1 Moduli principali
1. Dashboard operativa
2. Ordini
3. Clienti
4. Agenda e promemoria
5. Materiali (base)
6. Recensioni (base)

### 3.2 Funzionalita core MVP

Dashboard operativa:
- card KPI giornalieri (ordini aperti, urgenti, in ritardo, consegne oggi)
- lista Cosa fare oggi
- vista Oggi / Prossimi 7 giorni
- alert evidenti per urgenze

Ordini:
- creazione ordine rapida
- stati ordine configurabili (default: nuovo, in lavorazione, pronto, consegnato, annullato)
- data consegna e priorita
- note operative
- stato pagamento base (non pagato, acconto, saldato)
- timeline eventi ordine
- duplicazione ordine template

Clienti:
- anagrafica minima (nome, telefono, email opzionale)
- storico ordini
- note cliente
- tag semplici (es. ricorrente, urgente)

Agenda/Promemoria:
- reminder manuali e automatici semplici
- scadenze visibili in dashboard
- checklist giornaliera

Materiali (base):
- lista materiali essenziali
- quantita disponibile
- soglia minima
- alert stock basso

Recensioni (base):
- flag ordine consegnato da recensire
- stato richiesta recensione

### 3.3 Funzionalita post-MVP
- messaggi cliente da template con invio integrato
- import dati da file
- OCR foto/documenti
- reportistica avanzata
- automazioni a regole

---

## 4) Flussi operativi principali

### Flusso A - Avvio giornata
1. Apertura dashboard
2. Visualizzazione priorita e urgenze
3. Selezione task
4. Aggiornamento rapido stato ordine

Tempo target: meno di 60 secondi per individuare le priorita.

### Flusso B - Nuovo ordine
1. Click su Nuovo ordine
2. Selezione/creazione cliente
3. Inserimento lavorazione, consegna, priorita, prezzo stimato
4. Salvataggio
5. Aggiornamento automatico dashboard

Tempo target: meno di 2 minuti.

### Flusso C - Aggiornamento ordine durante il lavoro
1. Ricerca ordine
2. Cambio stato
3. Aggiunta nota o allegato foto
4. Salvataggio

Tempo target: meno di 30 secondi.

### Flusso D - Consegna e follow-up
1. Stato ordine su consegnato
2. Aggiornamento pagamento
3. Creazione task follow-up/recensione

### Flusso E - Gestione scadenze
1. Apertura vista Prossimi 7 giorni
2. Filtri per urgenza o stato
3. Riassegnazione priorita/task

---

## 5) Requisiti funzionali dettagliati

RF-01: creare, modificare, archiviare ordini.
RF-02: gestire stati ordine e data consegna.
RF-03: ricercare ordini per cliente, stato, data, priorita.
RF-04: gestire anagrafica cliente minima.
RF-05: visualizzare storico cliente.
RF-06: creare reminder collegati a ordini/clienti.
RF-07: mostrare dashboard con urgenze e KPI principali.
RF-08: gestire stato pagamento base dell ordine.
RF-09: tracciare attivita ordine (timeline).
RF-10: funzionare bene su desktop e mobile.
RF-11: gestire materiali base e alert stock basso.
RF-12: tracciare richiesta recensione in modo semplice.

---

## 6) Requisiti non funzionali

RNF-01 Prestazioni:
- tempo risposta UI inferiore a 300 ms per operazioni locali
- query elenco principali sotto 1 secondo

RNF-02 Usabilita:
- massimo 3-4 passi per azioni frequenti
- terminologia non tecnica

RNF-03 Affidabilita:
- salvataggio consistente
- gestione errori con messaggi chiari

RNF-04 Sicurezza:
- autenticazione obbligatoria
- autorizzazioni per tenant/utente
- audit log delle operazioni sensibili

RNF-05 Scalabilita:
- struttura pronta per passare da singola bottega a multi-bottega

RNF-06 Osservabilita:
- logging applicativo
- metriche base su uso e errori

---

## 7) Architettura tecnica proposta

### 7.1 Stack
- Frontend: Next.js + TypeScript
- UI: Tailwind CSS + libreria componenti leggera
- Backend: Next.js route handlers/server actions
- Database: PostgreSQL (Supabase)
- Auth: Supabase Auth
- Storage: Supabase Storage
- Hosting: Vercel

### 7.2 Architettura logica
1. Presentation layer (dashboard, ordini, clienti)
2. Application layer (use case: crea ordine, aggiorna stato, genera agenda)
3. Data access layer (repository)
4. Persistence layer (PostgreSQL + storage file)

### 7.3 API interne minime
- POST /api/orders
- PATCH /api/orders/:id
- GET /api/orders
- GET /api/customers
- POST /api/reminders
- GET /api/dashboard/today
- GET /api/dashboard/week

---

## 8) Modello dati (v1)

### Tabelle principali

users:
- id
- email
- full_name
- created_at

shops:
- id
- owner_user_id
- name
- timezone
- created_at

customers:
- id
- shop_id
- name
- phone
- email
- tags
- notes
- created_at

orders:
- id
- shop_id
- customer_id
- title
- description
- status
- priority
- due_date
- amount_estimated
- payment_status
- created_at
- updated_at

order_events:
- id
- order_id
- event_type
- note
- created_at
- created_by

reminders:
- id
- shop_id
- order_id nullable
- customer_id nullable
- title
- due_at
- status
- created_at

inventory_items:
- id
- shop_id
- name
- unit
- quantity_available
- reorder_threshold
- updated_at

reviews:
- id
- shop_id
- order_id
- requested_at
- received_at nullable
- rating nullable
- note nullable

attachments:
- id
- shop_id
- entity_type
- entity_id
- storage_path
- created_at

### Vincoli essenziali
- ogni record operativo legato a shop_id
- indici su due_date, status, priority, customer_id
- soft delete opzionale in fase 2

---

## 9) UX e interazione

### 9.1 Principi UX
- una home con domanda implicita: cosa devo fare oggi
- frizione minima su azioni frequenti
- stati visivi leggibili
- testi brevi e concreti

### 9.2 Layout principale
- header con ricerca globale
- colonna centrale con task giornalieri
- pannello laterale con scadenze e alert
- accesso rapido a Nuovo ordine

### 9.3 Mobile
- bottom navigation (dashboard, ordini, clienti, agenda)
- quick actions sempre visibili
- form semplificati

---

## 10) Sicurezza, privacy e conformita

- autenticazione con sessioni sicure
- isolamento dati per bottega
- logging operazioni critiche
- backup giornaliero DB
- policy retention allegati
- cancellazione dati su richiesta owner

---

## 11) Metriche e criteri di successo

### KPI di adozione
- utenti attivi settimanali per bottega
- ordini creati/aggiornati per settimana
- tasso completamento reminder

### KPI di efficienza operativa
- tempo medio creazione ordine inferiore a 2 minuti
- percentuale ordini con stato aggiornato entro giornata superiore al 70%
- riduzione task dimenticati (proxy: reminder scaduti non completati)

### KPI qualita prodotto
- errori bloccanti sotto soglia concordata
- tempo medio risposta dashboard sotto 1 secondo

---

## 12) Piano di rilascio

### Fase 0 - Setup (3-5 giorni)
- bootstrap progetto
- auth + database
- schema dati v1

### Fase 1 - MVP core (2-4 settimane)
- dashboard oggi/prossimi 7 giorni
- CRUD ordini
- CRUD clienti minimo
- reminder
- ricerca/filtri

### Fase 2 - Stabilizzazione (1-2 settimane)
- timeline ordini
- pagamento base
- inventario base
- miglioramenti UX mobile

### Fase 3 - Estensioni (opzionale)
- recensioni
- template messaggi
- integrazioni canali esterni

---

## 13) Rischi principali e mitigazioni

Rischio 1: scope creep (troppa roba nel MVP)
- Mitigazione: backlog rigido con gate di priorita

Rischio 2: dati non aggiornati
- Mitigazione: UX rapida, reminder interni, azioni da un click

Rischio 3: prodotto percepito come CRM pesante
- Mitigazione: lessico operativo, campi minimi, focus su giornata

Rischio 4: adozione mobile insufficiente
- Mitigazione: mobile-first per azioni frequenti

---

## 14) Backlog tecnico iniziale (pronto sviluppo)

1. Setup Next.js TypeScript Tailwind
2. Configurazione Supabase progetto e policy
3. Implementazione schema SQL v1
4. Pagine:
   - Dashboard
   - Ordini
   - Clienti
   - Agenda
5. Componenti:
   - OrderForm rapido
   - TodayBoard
   - ReminderList
   - SearchBar globale
6. API CRUD ordini/clienti/reminder
7. Filtri e ricerca
8. Log errori e monitoraggio base
9. Test E2E flussi A-B-C

---

## 15) Decisione finale di prodotto

Il progetto è una dashboard operativa con mini CRM per botteghe.

Non è un agente AI come prodotto principale.

L AI, se introdotta, resta un acceleratore secondario (es. suggerimenti testuali o compilazione assistita), non il centro dell esperienza.

Il centro resta la gestione pratica, veloce e quotidiana del lavoro in bottega.
