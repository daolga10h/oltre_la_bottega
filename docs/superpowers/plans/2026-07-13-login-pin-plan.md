# Login con PIN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un secondo metodo di accesso ("PIN", email + 6 cifre) accanto al magic link esistente, così i tablet in bottega non devono mai aprire una casella di posta.

**Architecture:** Il PIN è la password Supabase dell'account esistente (single-tenant, un solo account per bottega). Nessuna tabella, nessun endpoint nuovo: si riusa `supabase.auth.signInWithPassword` e la pagina `setup-pin` già presente ma oggi irraggiungibile dall'interfaccia. Si estrae anche un piccolo helper `getPostLoginRedirect` per non duplicare la logica di redirect post-login tra il callback del magic link e il nuovo login con PIN.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth (`@supabase/ssr`), Jest per gli unit test, shadcn/ui (`Input`, `Button`/`buttonVariants`, `Card`).

Spec di riferimento: `docs/superpowers/specs/2026-07-13-login-pin-design.md`

---

### Task 1: Estrarre `getPostLoginRedirect` (helper condiviso)

**Files:**
- Modify: `src/lib/shop-name.ts`
- Test: `src/lib/__tests__/shop-name.test.ts` (nuovo file)

Oggi `src/app/auth/callback/route.ts` calcola inline la destinazione post-login (`/auth/setup-shop` se il nome bottega non è ancora impostato, altrimenti `/dashboard`). Il nuovo login con PIN (Task 5) avrà bisogno della stessa identica logica — la estraiamo qui per non duplicarla.

- [x] **Step 1: Scrivi il test che fallisce**
- [x] **Step 2: Esegui il test e verifica che fallisca**
- [x] **Step 3: Implementa la funzione**
- [x] **Step 4: Esegui il test e verifica che passi**
- [x] **Step 5: Commit**

---

### Task 2: Usare l'helper nel callback del magic link (refactor)

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [x] **Step 1: Sostituisci la logica inline con l'helper**
- [x] **Step 2: Verifica che il progetto compili**
- [x] **Step 3: Commit**

---

### Task 3: Helper per l'email ricordata sul dispositivo

**Files:**
- Create: `src/lib/device-email.ts`

- [x] **Step 1: Crea il file**
- [x] **Step 2: Verifica che il progetto compili**
- [x] **Step 3: Commit**

---

### Task 4: Collegare `setup-pin` all'helper email + titolo dinamico

**Files:**
- Modify: `src/app/(auth)/setup-pin/page.tsx`

- [x] **Step 1: Sostituisci l'intero file**
- [x] **Step 2: Verifica che il progetto compili**
- [x] **Step 3: Commit**

---

### Task 5: Modalità "PIN" nella pagina di login

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [x] **Step 1: Sostituisci l'intero file**
- [x] **Step 2: Verifica che il progetto compili**
- [x] **Step 3: Commit**

---

### Task 6: Pagina "Impostazioni"

**Files:**
- Create: `src/app/(dashboard)/impostazioni/page.tsx`

- [x] **Step 1: Crea il file**
- [x] **Step 2: Verifica che il progetto compili**
- [x] **Step 3: Commit**

---

### Task 7: Voce "Impostazioni" nel sidebar

**Files:**
- Modify: `src/components/nav/Sidebar.tsx:1-18`

- [x] **Step 1: Aggiungi l'import dell'icona e la voce di menu**
- [x] **Step 2: Verifica che il progetto compili**
- [x] **Step 3: Commit**

---

### Task 8: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [x] **Step 1: Aggiungi la nuova riga**
- [x] **Step 2: Commit**

---

### Task 9: Verifica manuale end-to-end

**Files:** nessuno (solo verifica, nessuna modifica di codice)

- [ ] **Step 1: Avvia il server di sviluppo**
- [ ] **Step 2: Login via magic link (invariato)**
- [ ] **Step 3: Imposta il PIN**
- [ ] **Step 4: Login con PIN su sessione pulita**
- [ ] **Step 5: Email ricordata**
- [ ] **Step 6: PIN errato**
- [ ] **Step 7: Titolo "Cambia PIN"**
- [x] **Step 8: Test automatici e typecheck completi** — 75/75 test Jest verdi (72 esistenti + 3 nuovi), `npx tsc --noEmit` pulito
- [x] **Step 9: Flussi E2E Playwright esistenti** — Flussi A, B, C invariati; 1 fallimento pre-esistente in Flusso D (`getByLabel('Nome *')` ambiguo, non collegato a questo lavoro — nessun file toccato da questo piano riguarda `OrderForm`/creazione ordine)

Gli step 2-7 richiedono un login reale (magic link + PIN) su un progetto Supabase con credenziali vere e verifica visiva del comportamento — lasciati alla verifica manuale dell'utente sui dispositivi reali, che è comunque l'unico test che conta per il problema originale (tablet senza posta configurata).

---

## Note per chi esegue il piano

- Ogni task produce codice funzionante e compilabile da solo — nessuna dipendenza rotta tra un task e il successivo se eseguiti in ordine.
- Il Task 9 è l'unica verifica end-to-end reale: gran parte di questo lavoro è interazione diretta col client Supabase (login, PIN), non testabile in modo significativo con Jest (stesso discorso vale già oggi per il login a magic link esistente, mai stato testato a livello unitario).