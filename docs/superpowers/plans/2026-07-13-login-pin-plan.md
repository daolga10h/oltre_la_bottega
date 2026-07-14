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

- [x] **Step 1: Avvia il server di sviluppo**
- [x] **Step 2: Login via magic link (invariato)** — tab "Link via email" selezionato di default confermato; l'invio effettivo dell'OTP è stato bloccato dal rate limit email di Supabase per l'utente di test (`over_email_send_rate_limit`, verificato con chiamata diretta all'API, non un errore del codice) dopo le numerose chiamate `generateLink`/`signInWithOtp` di questa sessione di verifica — il percorso `handleSubmit` non è stato toccato da questo piano
- [x] **Step 3: Imposta il PIN** — pulsante "Imposta PIN" quando `pin_set` è false, titolo "Crea il tuo PIN", conferma doppio inserimento, redirect a `/dashboard`
- [x] **Step 4: Login con PIN su sessione pulita** — tab "PIN" su sessione senza cookie/localStorage chiede l'email, login con email+PIN corretti reindirizza a `/dashboard`
- [x] **Step 5: Email ricordata** — dopo il login `localStorage.oltreBottegaEmail` è impostato; su una sessione senza cookie ma con lo stesso localStorage, il tab PIN mostra "Accesso come …" senza richiedere l'email
- [x] **Step 6: PIN errato** — messaggio "PIN errato, riprova." mostrato, nessun accesso, resta su `/login`
- [x] **Step 7: Titolo "Cambia PIN"** — dopo che `pin_set` è true, il pulsante in Impostazioni diventa "Cambia PIN" e il titolo di `/setup-pin` diventa "Cambia il tuo PIN"
- [x] **Step 8: Test automatici e typecheck completi** — 75/75 test Jest verdi (72 esistenti + 3 nuovi), `npx tsc --noEmit` pulito
- [x] **Step 9: Flussi E2E Playwright esistenti** — Flussi A, B, C invariati; 1 fallimento pre-esistente in Flusso D (`getByLabel('Nome *')` ambiguo, non collegato a questo lavoro — nessun file toccato da questo piano riguarda `OrderForm`/creazione ordine)

Verifica eseguita il 2026-07-14 con uno script Playwright temporaneo (non incluso nel commit) contro il server di sviluppo locale, autenticando l'utente di test `e2e-test@oltrelabottega.local` tramite Supabase Admin API — stesso pattern già usato da Flusso D. 11/12 controlli automatizzati superati; l'unico non superato (invio email magic link) è dovuto al rate limit di Supabase sull'ambiente di test, non a un difetto del codice.

---

## Note per chi esegue il piano

- Ogni task produce codice funzionante e compilabile da solo — nessuna dipendenza rotta tra un task e il successivo se eseguiti in ordine.
- Il Task 9 è l'unica verifica end-to-end reale: gran parte di questo lavoro è interazione diretta col client Supabase (login, PIN), non testabile in modo significativo con Jest (stesso discorso vale già oggi per il login a magic link esistente, mai stato testato a livello unitario).