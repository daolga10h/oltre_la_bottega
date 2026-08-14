# Continuità dati cliente — backup settimanale via email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un cron job settimanale che esporta tutti gli ordini in un CSV leggibile e lo invia via email (Resend) all'indirizzo della bottega, come rete di sicurezza indipendente dall'account Supabase/Vercel del cliente.

**Architettura:** Un Vercel Cron Job chiama una route API protetta da un secret header ogni lunedì mattina. La route usa un client Supabase con service role (nessuna sessione utente disponibile in un cron), interroga tutti gli ordini, li trasforma in CSV con una funzione pura testata separatamente, e li invia via Resend. Se `RESEND_API_KEY` non è configurata, la route termina senza errore e senza inviare nulla (funzione opzionale). Il piano NON include la configurazione di SimpleBackups (è un setup manuale su un servizio esterno, non codice) né l'esportazione manuale su richiesta (progetto separato) — vedere `docs/superpowers/specs/2026-08-14-continuita-dati-backup-design.md`.

**Tech Stack:** Next.js API route (Node.js runtime), `@supabase/supabase-js` (service role), Resend SDK, Jest.

---

### Task 1: Funzione pura di esportazione CSV

**Files:**
- Create: `src/lib/csv.ts`
- Test: `src/lib/__tests__/csv.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/csv.test.ts
import { ordersToCsv, type OrderExportRow } from "@/lib/csv"

function makeOrder(overrides: Partial<OrderExportRow> = {}): OrderExportRow {
  return {
    nome: "Gigi",
    cognome: "Rossi",
    telefono: "3331234567",
    email_cliente: "gigi@example.com",
    cosa_ordinato: "Targa incisa",
    data_ordine: "2026-08-01",
    data_consegna: "2026-08-10",
    data_consegnato: null,
    status: "pronto",
    operatore: "Maria",
    prezzo: 50,
    acconto: 20,
    saldo: 30,
    note: null,
    ...overrides,
  }
}

describe("ordersToCsv", () => {
  it("returns just the header row for an empty list", () => {
    const csv = ordersToCsv([])
    expect(csv).toBe(
      "Nome,Cognome,Telefono,Email,Cosa ordinato,Data ordine,Data consegna,Data consegnato,Stato,Operatore,Prezzo,Acconto,Saldo,Note"
    )
  })

  it("maps a full order to a CSV row, translating status to its Italian label", () => {
    const csv = ordersToCsv([makeOrder()])
    const lines = csv.split("\r\n")
    expect(lines[1]).toBe(
      "Gigi,Rossi,3331234567,gigi@example.com,Targa incisa,2026-08-01,2026-08-10,,Pronto,Maria,50,20,30,"
    )
  })

  it("turns null fields into empty strings instead of the literal word null", () => {
    const csv = ordersToCsv([
      makeOrder({ cognome: null, telefono: null, email_cliente: null, data_consegnato: null, operatore: null, note: null }),
    ])
    const lines = csv.split("\r\n")
    expect(lines[1]).not.toContain("null")
  })

  it("wraps a field containing a comma in quotes", () => {
    const csv = ordersToCsv([makeOrder({ cosa_ordinato: "Targa, incisione oro" })])
    expect(csv).toContain('"Targa, incisione oro"')
  })

  it("doubles internal quotes and wraps the field in quotes", () => {
    const csv = ordersToCsv([makeOrder({ note: 'Cliente dice "urgente"' })])
    expect(csv).toContain('"Cliente dice ""urgente"""')
  })

  it("falls back to the raw status value if it has no known Italian label", () => {
    const csv = ordersToCsv([makeOrder({ status: "stato_sconosciuto" })])
    expect(csv).toContain("stato_sconosciuto")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/csv.test.ts`
Expected: FAIL with "Cannot find module '@/lib/csv'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/csv.ts
import { STATUS_LABELS } from "@/lib/orderConstants"

export type OrderExportRow = {
  nome: string
  cognome: string | null
  telefono: string | null
  email_cliente: string | null
  cosa_ordinato: string
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  status: string
  operatore: string | null
  prezzo: number
  acconto: number
  saldo: number
  note: string | null
}

const HEADERS = [
  "Nome",
  "Cognome",
  "Telefono",
  "Email",
  "Cosa ordinato",
  "Data ordine",
  "Data consegna",
  "Data consegnato",
  "Stato",
  "Operatore",
  "Prezzo",
  "Acconto",
  "Saldo",
  "Note",
]

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function rowToCsvLine(values: (string | number | null)[]): string {
  return values.map((v) => escapeCsvField(v === null ? "" : String(v))).join(",")
}

export function ordersToCsv(orders: OrderExportRow[]): string {
  const lines = [rowToCsvLine(HEADERS)]
  for (const order of orders) {
    lines.push(
      rowToCsvLine([
        order.nome,
        order.cognome,
        order.telefono,
        order.email_cliente,
        order.cosa_ordinato,
        order.data_ordine,
        order.data_consegna,
        order.data_consegnato,
        STATUS_LABELS[order.status] ?? order.status,
        order.operatore,
        order.prezzo,
        order.acconto,
        order.saldo,
        order.note,
      ])
    )
  }
  return lines.join("\r\n")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/csv.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/__tests__/csv.test.ts
git commit -m "feat: aggiunge la funzione pura per esportare gli ordini in CSV"
```

---

### Task 2: Client Supabase con service role (per contesti senza sessione utente)

**Files:**
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Write the factory function**

Nessun test dedicato: è una factory di 6 righe, stesso trattamento già riservato a `src/lib/supabase/server.ts` (non testato) — la logica che conta viene testata al Task 4 mockando questo modulo.

Nota: `src/types/supabase.ts` è generato da una migration meno recente e non include ancora colonne come `operatore` (vedere `src/actions/orders.ts`, che per lo stesso motivo usa `select("*")` con un tipo `Order` locale invece di affidarsi al tipo generato). Questo client resta volutamente non parametrizzato con `Database`, per non far fallire il type-check su colonne che esistono nel database reale ma non ancora nel file generato.

```typescript
// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js"

/**
 * Client con service role, per contesti senza sessione utente (es. cron job)
 * dove `src/lib/supabase/server.ts` (basato sui cookie di sessione) non è utilizzabile.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/admin.ts
git commit -m "feat: aggiunge un client Supabase con service role per contesti senza sessione utente"
```

---

### Task 3: Invio email di backup via Resend

**Files:**
- Create: `src/lib/email/sendBackupEmail.ts`
- Test: `src/lib/email/__tests__/sendBackupEmail.test.ts`
- Modify: `package.json` (nuova dipendenza `resend`)

- [ ] **Step 1: Install the Resend SDK**

Run: `npm install resend`
Expected: `resend` aggiunto a `dependencies` in `package.json` e `package-lock.json`

- [ ] **Step 2: Write the failing test (solo per il ramo "non configurato")**

Il resto della funzione chiama l'SDK esterno di Resend — non lo testiamo con una vera chiamata di rete (dipendenza esterna, verifica manuale prevista nel Task 6). Testiamo solo il comportamento di cui l'app dipende davvero: nessun invio, nessun errore, se la chiave non è configurata.

```typescript
// src/lib/email/__tests__/sendBackupEmail.test.ts
const mockSend = jest.fn()
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

import { sendBackupEmail } from "@/lib/email/sendBackupEmail"

describe("sendBackupEmail", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    mockSend.mockClear()
  })
  afterEach(() => {
    process.env = OLD_ENV
  })

  it("does nothing when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY
    await expect(
      sendBackupEmail({ to: "bottega@example.com", csv: "a,b\n1,2", shopName: "La Bottega" })
    ).resolves.toBeUndefined()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("sends the CSV as a base64 attachment when RESEND_API_KEY is configured", async () => {
    process.env.RESEND_API_KEY = "test-key"
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null })

    await sendBackupEmail({ to: "bottega@example.com", csv: "a,b\n1,2", shopName: "La Bottega" })

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe("bottega@example.com")
    expect(call.attachments[0].content).toBe(Buffer.from("a,b\n1,2").toString("base64"))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/email/__tests__/sendBackupEmail.test.ts`
Expected: FAIL with "Cannot find module '@/lib/email/sendBackupEmail'"

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/email/sendBackupEmail.ts
import { Resend } from "resend"

export async function sendBackupEmail(params: {
  to: string
  csv: string
  shopName: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const from = process.env.BACKUP_EMAIL_FROM ?? "onboarding@resend.dev"
  const today = new Date().toISOString().split("T")[0]

  await resend.emails.send({
    from,
    to: params.to,
    subject: `Copia di sicurezza ordini — ${params.shopName} (${today})`,
    html: `<p>In allegato la copia settimanale di tutti gli ordini di ${params.shopName}, aggiornata al ${today}.</p>`,
    attachments: [
      {
        filename: `ordini-${today}.csv`,
        content: Buffer.from(params.csv).toString("base64"),
      },
    ],
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/email/__tests__/sendBackupEmail.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/email/sendBackupEmail.ts src/lib/email/__tests__/sendBackupEmail.test.ts
git commit -m "feat: invia il CSV di backup via Resend, no-op se non configurato"
```

---

### Task 4: Route del cron settimanale

**Files:**
- Create: `src/app/api/cron/weekly-backup/route.ts`
- Test: `src/app/api/cron/weekly-backup/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/cron/weekly-backup/__tests__/route.test.ts
const mockCreateAdminClient = jest.fn()
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

const mockSendBackupEmail = jest.fn()
jest.mock("@/lib/email/sendBackupEmail", () => ({
  sendBackupEmail: (...args: unknown[]) => mockSendBackupEmail(...args),
}))

import { GET } from "../route"

function makeRequest(secret?: string): Request {
  return new Request("http://localhost/api/cron/weekly-backup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

function mockAdminClient(orders: unknown[], ordersError: unknown = null) {
  return {
    auth: {
      admin: {
        listUsers: () =>
          Promise.resolve({
            data: {
              users: [
                { id: "u1", email: "bottega@example.com", user_metadata: { shop_name: "La Bottega" } },
              ],
            },
          }),
      },
    },
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: ordersError ? null : orders, error: ordersError }),
      }),
    }),
  }
}

describe("GET /api/cron/weekly-backup", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret" }
    mockSendBackupEmail.mockResolvedValue(undefined)
  })
  afterEach(() => {
    process.env = OLD_ENV
    jest.clearAllMocks()
  })

  it("returns 401 when the secret header is missing or wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"))
    expect(res.status).toBe(401)
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("sends the CSV backup to the shop's own email on success", async () => {
    mockCreateAdminClient.mockReturnValue(
      mockAdminClient([
        {
          nome: "Gigi",
          cognome: "Rossi",
          telefono: null,
          email_cliente: null,
          cosa_ordinato: "Targa",
          data_ordine: "2026-08-01",
          data_consegna: null,
          data_consegnato: null,
          status: "pronto",
          operatore: "Maria",
          prezzo: 10,
          acconto: 0,
          saldo: 10,
          note: null,
        },
      ])
    )

    const res = await GET(makeRequest("test-secret"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(mockSendBackupEmail).toHaveBeenCalledTimes(1)
    const call = mockSendBackupEmail.mock.calls[0][0]
    expect(call.to).toBe("bottega@example.com")
    expect(call.shopName).toBe("La Bottega")
    expect(call.csv).toContain("Gigi")
  })

  it("returns 500 and does not send an email if the orders query fails", async () => {
    mockCreateAdminClient.mockReturnValue(mockAdminClient([], new Error("boom")))
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(500)
    expect(mockSendBackupEmail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/cron/weekly-backup/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/api/cron/weekly-backup/route.ts
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ordersToCsv, type OrderExportRow } from "@/lib/csv"
import { sendBackupEmail } from "@/lib/email/sendBackupEmail"
import { getShopName } from "@/lib/shop-name"
import { logError, logInfo } from "@/lib/logger"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    const { data: usersData } = await admin.auth.admin.listUsers()
    const shopUser = usersData?.users[0] ?? null
    if (!shopUser?.email) {
      logError("cron/weekly-backup", new Error("Nessun utente trovato per l'istanza"))
      return NextResponse.json({ error: "No shop user" }, { status: 500 })
    }

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        "nome, cognome, telefono, email_cliente, cosa_ordinato, data_ordine, data_consegna, data_consegnato, status, operatore, prezzo, acconto, saldo, note"
      )
      .order("data_ordine", { ascending: false })

    if (error) {
      logError("cron/weekly-backup", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const csv = ordersToCsv((orders ?? []) as OrderExportRow[])
    await sendBackupEmail({
      to: shopUser.email,
      csv,
      shopName: getShopName(shopUser),
    })

    logInfo("cron/weekly-backup", "Backup settimanale inviato", { count: orders?.length ?? 0 })
    return NextResponse.json({ ok: true, count: orders?.length ?? 0 })
  } catch (error) {
    logError("cron/weekly-backup", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/cron/weekly-backup/__tests__/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/weekly-backup/route.ts src/app/api/cron/weekly-backup/__tests__/route.test.ts
git commit -m "feat: route del cron settimanale che invia il backup CSV via email"
```

---

### Task 5: Schedulazione del cron su Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create the cron configuration**

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

Nota: Vercel aggiunge automaticamente l'header `Authorization: Bearer $CRON_SECRET` alle chiamate ai propri cron job quando la variabile d'ambiente `CRON_SECRET` è configurata nel progetto — nessun codice aggiuntivo necessario oltre al controllo già presente nella route (Task 4).

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: schedula il cron settimanale del backup ordini su Vercel"
```

---

### Task 6: Escludere le route cron dal redirect di autenticazione

**Files:**
- Modify: `src/middleware.ts:27` (blocco `config.matcher`)

Il middleware reindirizza a `/login` qualunque richiesta senza sessione utente. Una chiamata cron di Vercel non ha una sessione — senza questa esclusione, `/api/cron/weekly-backup` riceverebbe sempre un redirect 307 invece di eseguire la route. Stesso problema già risolto in passato per `manifest.webmanifest` (vedere CLAUDE.md, riga su `manifest.ts` + `apple-icon.tsx`).

- [ ] **Step 1: Update the matcher**

In `src/middleware.ts`, sostituire:

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

con:

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

- [ ] **Step 2: Run the full test suite and the type check to make sure nothing else broke**

Run: `npx jest`
Expected: PASS (tutte le suite, nessuna regressione)

Run: `npx tsc --noEmit`
Expected: nessun errore — in particolare, nessun errore sulle colonne selezionate in `src/app/api/cron/weekly-backup/route.ts` (vedere nota sul tipo `Database` non aggiornato nel Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "fix: esclude /api/cron dal redirect di autenticazione del middleware"
```

---

### Task 7: Variabili d'ambiente

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the new environment variables**

In `.env.example`, aggiungere in fondo al file:

```
CRON_SECRET=your-cron-secret
RESEND_API_KEY=your-resend-api-key
BACKUP_EMAIL_FROM=backups@yourdomain.com
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: documenta le variabili d'ambiente per il backup settimanale"
```

---

### Task 8: Verifica manuale su un cliente reale (non automatizzabile)

Questa parte non è testabile in automatico (dipendenze esterne: Resend, casella email reale) — stesso trattamento già riservato a stampante e link WhatsApp nel progetto. Da eseguire quando il primo cliente reale viene attivato:

- [ ] **Step 1: Configurare le variabili d'ambiente sul progetto Vercel del cliente**

Impostare `CRON_SECRET` (un valore casuale a scelta), `RESEND_API_KEY` (dall'account Resend del cliente) e `BACKUP_EMAIL_FROM` nelle Environment Variables del progetto Vercel, poi rideployare.

- [ ] **Step 2: Forzare un'esecuzione manuale del cron**

Da Vercel Dashboard → progetto del cliente → tab "Cron Jobs" → eseguire manualmente `/api/cron/weekly-backup` invece di aspettare il lunedì.

- [ ] **Step 3: Confermare la ricezione dell'email**

Verificare che l'email arrivi nella casella della bottega, con oggetto "Copia di sicurezza ordini — [nome bottega] (data)" e un allegato CSV che si apre correttamente in Excel/Fogli Google con tutti gli ordini reali del cliente.

- [ ] **Step 4: Aggiornare la documentazione del progetto**

Come indicato nello spec (`docs/superpowers/specs/2026-08-14-continuita-dati-backup-design.md`, sezione "Nota per l'implementazione"): aggiungere una riga in "Decisioni chiave e motivazioni" di CLAUDE.md, aggiornare la checklist pubblica "Cosa serve per usare Oltre la Bottega" con SimpleBackups/Google Drive come voce consigliata, e aggiornare la Roadmap/Fase 3 se pertinente.