# Backup giornaliero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passare il backup via email degli ordini da settimanale (lunedì 6:00 UTC) a giornaliero (20:00 UTC, sera), rinominando la route e i riferimenti da "weekly-backup" a "daily-backup" per coerenza.

**Architecture:** Rinomina della cartella route `src/app/api/cron/weekly-backup/` in `src/app/api/cron/daily-backup/` con aggiornamento dei log interni; cambio dello schedule e del path in `vercel.json`; aggiornamento del testo dell'email in `sendBackupEmail.ts`; aggiornamento di un commento in `middleware.ts`; aggiornamento di `CLAUDE.md`. Nessuna modifica alla logica di business (selezione ordini, CSV, esclusione utente di test).

**Tech Stack:** Next.js App Router (Route Handler), Vercel Cron, TypeScript, Jest.

**Full design reference:** `docs/superpowers/specs/2026-09-10-backup-giornaliero-design.md`

---

### Task 1: Rinominare la route e aggiornare i log interni

**Files:**
- Rename: `src/app/api/cron/weekly-backup/route.ts` → `src/app/api/cron/daily-backup/route.ts`
- Modify (dopo la rinomina): `src/app/api/cron/daily-backup/route.ts`

- [ ] **Step 1: Rinominare la cartella con git mv (preserva la history)**

```bash
git mv src/app/api/cron/weekly-backup/route.ts src/app/api/cron/daily-backup/route.ts
```

- [ ] **Step 2: Aggiornare i context string e il messaggio di log**

In `src/app/api/cron/daily-backup/route.ts`, sostituire tutte le occorrenze di `"cron/weekly-backup"` con `"cron/daily-backup"` (4 occorrenze: righe con `logError`/`logInfo`) e il messaggio `"Backup settimanale inviato"` con `"Backup giornaliero inviato"`.

Il file risultante deve essere:

```typescript
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ordersToCsv, type OrderExportRow } from "@/lib/csv"
import { sendBackupEmail } from "@/lib/email/sendBackupEmail"
import { getShopName } from "@/lib/shop-name"
import { logError, logInfo } from "@/lib/logger"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) {
      logError("cron/daily-backup", usersError)
      return NextResponse.json({ error: "No shop user" }, { status: 500 })
    }
    const shopUsers = usersData?.users.filter((u) => !u.email?.endsWith("@oltrelabottega.local")) ?? []
    const shopUser = shopUsers.length === 1 ? shopUsers[0] : null
    if (!shopUser?.email) {
      logError("cron/daily-backup", new Error(`Atteso esattamente un utente bottega, trovati ${shopUsers.length}`))
      return NextResponse.json({ error: "No shop user" }, { status: 500 })
    }

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        "nome, cognome, telefono, email_cliente, cosa_ordinato, data_ordine, data_consegna, data_consegnato, status, operatore, prezzo, acconto, saldo, note"
      )
      .order("data_ordine", { ascending: false })

    if (error) {
      logError("cron/daily-backup", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const csv = ordersToCsv((orders ?? []) as OrderExportRow[])
    await sendBackupEmail({
      to: shopUser.email,
      csv,
      shopName: getShopName(shopUser),
    })

    logInfo("cron/daily-backup", "Backup giornaliero inviato", { count: orders?.length ?? 0 })
    return NextResponse.json({ ok: true, count: orders?.length ?? 0 })
  } catch (error) {
    logError("cron/daily-backup", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/daily-backup/route.ts
git commit -m "refactor: rinomina route backup da weekly a daily-backup"
```

---

### Task 2: Rinominare e aggiornare il test della route

**Files:**
- Rename: `src/app/api/cron/weekly-backup/__tests__/route.test.ts` → `src/app/api/cron/daily-backup/__tests__/route.test.ts`

- [ ] **Step 1: Rinominare il file di test con git mv**

```bash
git mv src/app/api/cron/weekly-backup/__tests__/route.test.ts src/app/api/cron/daily-backup/__tests__/route.test.ts
```

- [ ] **Step 2: Aggiornare i riferimenti al percorso**

In `src/app/api/cron/daily-backup/__tests__/route.test.ts`:

Sostituire:
```typescript
  return new Request("http://localhost/api/cron/weekly-backup", {
```
con:
```typescript
  return new Request("http://localhost/api/cron/daily-backup", {
```

Sostituire:
```typescript
describe("GET /api/cron/weekly-backup", () => {
```
con:
```typescript
describe("GET /api/cron/daily-backup", () => {
```

- [ ] **Step 3: Rimuovere la cartella `weekly-backup` ormai vuota**

```bash
rmdir src/app/api/cron/weekly-backup/__tests__ 2>/dev/null; rmdir src/app/api/cron/weekly-backup 2>/dev/null
```

Nota: se il comando `rmdir` non è disponibile in questa shell, verificare a mano con `git status` che non restino file orfani sotto `src/app/api/cron/weekly-backup/` e cancellare la cartella manualmente se serve.

- [ ] **Step 4: Eseguire il test rinominato**

Run: `npx jest --roots=src src/app/api/cron/daily-backup/__tests__/route.test.ts`
Expected: PASS, 5 test verdi (stessi casi di prima, solo percorso e nome cambiati)

- [ ] **Step 5: Commit**

```bash
git add -A src/app/api/cron/
git commit -m "test: aggiorna il test della route al nuovo percorso daily-backup"
```

---

### Task 3: Aggiornare il testo dell'email di backup

**Files:**
- Modify: `src/lib/email/sendBackupEmail.ts:19`

- [ ] **Step 1: Cambiare "settimanale" in "giornaliera" nel corpo dell'email**

Sostituire:
```typescript
    html: `<p>In allegato la copia settimanale di tutti gli ordini di ${params.shopName}, aggiornata al ${today}.</p>`,
```
con:
```typescript
    html: `<p>In allegato la copia giornaliera di tutti gli ordini di ${params.shopName}, aggiornata al ${today}.</p>`,
```

- [ ] **Step 2: Eseguire il test esistente per confermare che non si rompe nulla**

Run: `npx jest --roots=src src/lib/email/__tests__/sendBackupEmail.test.ts`
Expected: PASS, 3 test verdi (nessuna asserzione controlla il testo dell'HTML, quindi il cambiamento non li tocca)

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/sendBackupEmail.ts
git commit -m "feat: aggiorna il testo dell'email di backup a cadenza giornaliera"
```

---

### Task 4: Aggiornare `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Cambiare percorso e schedule del cron**

Sostituire il contenuto di `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-backup",
      "schedule": "0 6 * * 1"
    }
  ]
}
```
con:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-backup",
      "schedule": "0 20 * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: cron backup giornaliero alle 20:00 UTC (sera)"
```

---

### Task 5: Aggiornare il commento in `middleware.ts`

**Files:**
- Modify: `src/middleware.ts:48`

- [ ] **Step 1: Aggiornare il riferimento nel commento**

Sostituire:
```typescript
    // CRON_SECRET, vedere api/cron/weekly-backup), il middleware non offre
```
con:
```typescript
    // CRON_SECRET, vedere api/cron/daily-backup), il middleware non offre
```

- [ ] **Step 2: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "docs: aggiorna il commento del middleware al nuovo nome daily-backup"
```

---

### Task 6: Aggiornare `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Aggiornare il titolo e il corpo della riga "Decisioni chiave" sul backup**

Sostituire:
```markdown
| Backup settimanale via email (CSV di tutti gli ordini) come rete di sicurezza contro la perdita dati (2026-08-14) | Nato da un confronto con Danea Easyfatt: a differenza del vecchio desktop (dati sempre consultabili sul PC anche a zero rinnovi), la nostra architettura è tutta cloud — se un'istanza resta inattiva a lungo (malattia, ferie) o viene persa, non c'è fallback locale. Un Vercel Cron settimanale (`vercel.json`, lunedì mattina) chiama `/api/cron/weekly-backup`, che genera un CSV leggibile di tutti gli ordini e lo invia via Resend all'email della bottega — verificato end-to-end in produzione il 2026-08-14.
```
con:
```markdown
| Backup giornaliero via email (CSV di tutti gli ordini) come rete di sicurezza contro la perdita dati (2026-08-14, passato da settimanale a giornaliero il 2026-09-10) | Nato da un confronto con Danea Easyfatt: a differenza del vecchio desktop (dati sempre consultabili sul PC anche a zero rinnovi), la nostra architettura è tutta cloud — se un'istanza resta inattiva a lungo (malattia, ferie) o viene persa, non c'è fallback locale. Un Vercel Cron (`vercel.json`) chiama `/api/cron/daily-backup` ogni giorno alle 20:00 UTC (21:00 inverno / 22:00 estate — Vercel programma i cron solo in UTC, orario di sera scelto esplicitamente dall'utente per essere dopo la chiusura della bottega, accettando l'oscillazione di un'ora tra le stagioni), che genera un CSV leggibile di tutti gli ordini e lo invia via Resend all'email della bottega. **Passato da settimanale a giornaliero il 2026-09-10** su richiesta esplicita dell'utente ("così sono più sicura") — rinominata anche la route da `weekly-backup` a `daily-backup` (percorso, log, test) per coerenza col nome; nessun costo aggiuntivo, il piano gratuito Resend copre ampiamente 1 email/giorno. Design in `docs/superpowers/specs/2026-09-10-backup-giornaliero-design.md`. Verificato end-to-end in produzione il 2026-08-14 (versione settimanale originale).
```

- [ ] **Step 2: Aggiungere un nuovo bullet alla sezione Testing**

Nella sezione `## Testing`, dopo il bullet che inizia con `- **Feature (2026-09-10)**: niente pipeline recensione per gli ordini ente`, aggiungere:

```markdown
- **Feature (2026-09-10)**: backup email da settimanale a giornaliero — vedere riga corrispondente in Decisioni chiave. Rinominata la route `src/app/api/cron/weekly-backup/` in `src/app/api/cron/daily-backup/` (percorso, log interni, test), cambiato lo schedule in `vercel.json` da `"0 6 * * 1"` a `"0 20 * * *"`, aggiornato il testo dell'email in `sendBackupEmail.ts` ("giornaliera" invece di "settimanale") e il commento di riferimento in `middleware.ts`. Nessuna modifica alla logica di selezione ordini o al formato CSV — stessi test esistenti, spostati e aggiornati solo nei riferimenti al percorso. Design in `docs/superpowers/specs/2026-09-10-backup-giornaliero-design.md`, piano in `docs/superpowers/plans/2026-09-10-backup-giornaliero-plan.md`.
```

- [ ] **Step 3: Aggiornare il riferimento nella sezione Roadmap**

Sostituire:
```markdown
- ~~SimpleBackups (backup tecnico giornaliero + anti-pausa Supabase) non ancora configurato~~ — configurato e verificato funzionante il 2026-08-24, vedere riga "Backup settimanale via email" in Decisioni chiave per il dettaglio del fix (problema di scope OAuth Google Drive, risolto con "Refresh Authentication" dentro SimpleBackups).
```
con:
```markdown
- ~~SimpleBackups (backup tecnico giornaliero + anti-pausa Supabase) non ancora configurato~~ — configurato e verificato funzionante il 2026-08-24, vedere riga "Backup giornaliero via email" in Decisioni chiave per il dettaglio del fix (problema di scope OAuth Google Drive, risolto con "Refresh Authentication" dentro SimpleBackups).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta il passaggio a backup giornaliero in CLAUDE.md"
```

---

### Task 7: Verifica finale

**Files:** nessuno (solo comandi di verifica)

- [ ] **Step 1: Eseguire l'intera suite di test unitari**

Run: `npx jest --roots=src`
Expected: PASS, stesso numero di suite/test di prima (nessun test aggiunto o rimosso, solo spostato)

- [ ] **Step 2: Eseguire il type checker sull'intero progetto**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Verifica manuale con il server di sviluppo**

Run: `npm run dev`, poi in un altro terminale:

```bash
curl -H "Authorization: Bearer <CRON_SECRET_da_.env.local>" http://localhost:3000/api/cron/daily-backup
```

Expected: risposta JSON `{"ok":true,"count":<N>}`, e un'email ricevuta all'indirizzo della bottega con oggetto "Copia di sicurezza ordini — ..." e corpo che dice "copia giornaliera" (non più "settimanale"). Se `RESEND_API_KEY` non è configurata in locale, l'invio è no-op (nessun errore, nessuna email) — in tal caso limitarsi a verificare la risposta JSON.

Fermare il server di sviluppo (Ctrl+C) al termine.

- [ ] **Step 4: Verificare che non restino riferimenti orfani a "weekly-backup"**

Run: `grep -ri "weekly-backup" -r src/ vercel.json CLAUDE.md`
Expected: nessun risultato

