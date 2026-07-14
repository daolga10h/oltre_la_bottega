# Nome dell'operatore che inserisce l'ordine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un campo obbligatorio "Operatore" al form di creazione ordine, popolato da un elenco di nomi configurabile da Impostazioni, per sapere chi ha preso ogni ordine anche con il login PIN condiviso.

**Architecture:** L'elenco dei nomi vive in `user_metadata.operatori` (stesso posto di `shop_name`), nessuna tabella nuova. `orders.operatore` è una nuova colonna testo nullable, impostata solo alla creazione dell'ordine (il form di modifica non la mostra — è un dato fisso). L'ultimo operatore scelto su un dato dispositivo viene ricordato in `localStorage`, stesso meccanismo già usato per l'email nel login PIN.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + Auth `user_metadata`), Jest, shadcn/ui (`Select`, `Input`, `Button`, `Card`).

Spec di riferimento: `docs/superpowers/specs/2026-07-14-operatore-ordine-design.md`

---

### Task 1: Migration — colonna `orders.operatore`

**Files:**
- Create: `supabase/migrations/20260714000001_add_operatore.sql`

- [ ] **Step 1: Crea il file di migration**

```sql
-- Add operatore column (who took the order)
alter table public.orders
  add column if not exists operatore text;
```

- [ ] **Step 2: Applica la migration**

Run: `supabase db push`
Expected: la migration `20260714000001_add_operatore.sql` viene applicata senza errori (se `supabase db push` non è disponibile in questo ambiente, applicare lo stesso SQL manualmente da Supabase Dashboard → SQL Editor, e annotarlo nello step di commit).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260714000001_add_operatore.sql
git commit -m "feat: aggiungi colonna operatore alla tabella orders"
```

---

### Task 2: Helper puri per l'elenco operatori

**Files:**
- Create: `src/lib/operators.ts`
- Test: `src/lib/__tests__/operators.test.ts` (nuovo file)

Tre funzioni pure: leggere l'elenco da un oggetto `User` (stesso pattern di `getShopName` in `src/lib/shop-name.ts`), aggiungere un nome con validazione/dedupe, rimuovere un nome. `addOperatorName` ritorna **lo stesso riferimento** dell'array in input quando il nome non è valido (vuoto dopo trim) o è già presente (confronto case-insensitive) — permette al chiamante di distinguere "aggiunto" da "rifiutato" con un semplice confronto `===`, senza dover propagare un tipo di errore.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `src/lib/__tests__/operators.test.ts`:

```typescript
import { getOperatorNames, addOperatorName, removeOperatorName } from "@/lib/operators"
import type { User } from "@supabase/supabase-js"

function makeUser(operatori?: unknown): User {
  return {
    user_metadata: operatori === undefined ? {} : { operatori },
  } as User
}

describe("getOperatorNames", () => {
  it("returns an empty array when user is null", () => {
    expect(getOperatorNames(null)).toEqual([])
  })

  it("returns an empty array when operatori is not set", () => {
    expect(getOperatorNames(makeUser())).toEqual([])
  })

  it("returns an empty array when operatori is not an array (defensive)", () => {
    expect(getOperatorNames(makeUser("not-an-array"))).toEqual([])
  })

  it("returns the stored list when present", () => {
    expect(getOperatorNames(makeUser(["Maria", "Luca"]))).toEqual(["Maria", "Luca"])
  })
})

describe("addOperatorName", () => {
  it("adds a trimmed name to an empty list", () => {
    expect(addOperatorName([], "  Maria  ")).toEqual(["Maria"])
  })

  it("appends to an existing list without mutating it", () => {
    const current = ["Maria"]
    const result = addOperatorName(current, "Luca")
    expect(result).toEqual(["Maria", "Luca"])
    expect(current).toEqual(["Maria"])
  })

  it("rejects an empty name and returns the same array reference", () => {
    const current = ["Maria"]
    expect(addOperatorName(current, "   ")).toBe(current)
  })

  it("rejects a case-insensitive duplicate and returns the same array reference", () => {
    const current = ["Maria"]
    expect(addOperatorName(current, "maria")).toBe(current)
  })
})

describe("removeOperatorName", () => {
  it("removes an exact match", () => {
    expect(removeOperatorName(["Maria", "Luca"], "Maria")).toEqual(["Luca"])
  })

  it("is a no-op when the name is not in the list", () => {
    expect(removeOperatorName(["Maria"], "Luca")).toEqual(["Maria"])
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/lib/__tests__/operators.test.ts`
Expected: FAIL — `Cannot find module '@/lib/operators'` o equivalente (il file non esiste ancora).

- [ ] **Step 3: Implementa le funzioni**

Crea `src/lib/operators.ts`:

```typescript
import type { User } from "@supabase/supabase-js"

export function getOperatorNames(user: User | null): string[] {
  const value = user?.user_metadata?.operatori
  return Array.isArray(value) ? value : []
}

export function addOperatorName(current: string[], candidate: string): string[] {
  const trimmed = candidate.trim()
  if (!trimmed) return current
  if (current.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return current
  return [...current, trimmed]
}

export function removeOperatorName(current: string[], name: string): string[] {
  return current.filter((o) => o !== name)
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/lib/__tests__/operators.test.ts`
Expected: PASS — 8 test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operators.ts src/lib/__tests__/operators.test.ts
git commit -m "feat: aggiungi helper puri per l'elenco operatori"
```

---

### Task 3: Helper per l'ultimo operatore ricordato sul dispositivo

**Files:**
- Create: `src/lib/device-operator.ts`

Stesso pattern di `src/lib/device-email.ts` (già usato dal login con PIN): wrapper minimi su `localStorage`, non testabili in modo significativo con `testEnvironment: "node"` senza mockare l'intero oggetto `window` — costo non giustificato per due one-liner, copertura reale dalla verifica manuale del Task 11.

- [ ] **Step 1: Crea il file**

```typescript
const STORAGE_KEY = "oltreBottegaOperatore"

export function getRememberedOperator(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setRememberedOperator(nome: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, nome)
  } catch {
    // Private browsing, quota exceeded, o storage disabilitato — scrittura
    // best-effort, la selezione dell'operatore deve funzionare comunque.
  }
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore (il file non è ancora importato da nessuno, ma deve comunque tipizzare correttamente).

- [ ] **Step 3: Commit**

```bash
git add src/lib/device-operator.ts
git commit -m "feat: aggiungi helper per l'ultimo operatore ricordato sul dispositivo"
```

---

### Task 4: Colonna `operatore` nel tipo `OrderRow`

**Files:**
- Modify: `src/actions/orders.ts:12-47`

- [ ] **Step 1: Aggiungi il campo al tipo**

In `src/actions/orders.ts`, trova:

```typescript
export type OrderRow = {
  id: string
  nome: string
  cognome: string | null
  telefono: string | null
  email_cliente: string | null
  canale: string
  data_ordine: string | null
```

Sostituisci con:

```typescript
export type OrderRow = {
  id: string
  nome: string
  cognome: string | null
  telefono: string | null
  email_cliente: string | null
  canale: string
  operatore: string | null
  data_ordine: string | null
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore (nessun altro punto del codice referenzia ancora `operatore`, quindi non ci sono errori di tipo mancante da correggere qui).

- [ ] **Step 3: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat: aggiungi operatore al tipo OrderRow"
```

---

### Task 5: Card "Operatori" in Impostazioni

**Files:**
- Create: `src/components/OperatoriSettings.tsx`
- Modify: `src/app/(dashboard)/impostazioni/page.tsx`

- [ ] **Step 1: Crea il componente client**

Crea `src/components/OperatoriSettings.tsx`:

```tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { addOperatorName, removeOperatorName } from "@/lib/operators"

interface Props {
  initialOperatori: string[]
}

export function OperatoriSettings({ initialOperatori }: Props) {
  const [operatori, setOperatori] = useState(initialOperatori)
  const [nome, setNome] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function persist(next: string[]) {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ data: { operatori: next } })
    setSaving(false)
    if (err) {
      setError("Errore durante il salvataggio. Riprova.")
      return
    }
    setOperatori(next)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const next = addOperatorName(operatori, nome)
    if (next === operatori) {
      setError(nome.trim() ? "Questo nome è già in elenco." : null)
      return
    }
    setNome("")
    await persist(next)
  }

  async function handleRemove(name: string) {
    await persist(removeOperatorName(operatori, name))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Operatori</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Elenco dei nomi selezionabili come &quot;chi ha preso l&apos;ordine&quot; nel form nuovo ordine.
        </p>
        {operatori.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {operatori.map((o) => (
              <li key={o} className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm">
                {o}
                <button
                  type="button"
                  onClick={() => handleRemove(o)}
                  disabled={saving}
                  aria-label={`Rimuovi ${o}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome operatore"
            disabled={saving}
          />
          <Button type="submit" disabled={saving}>Aggiungi</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Collega il componente alla pagina Impostazioni**

Leggi `src/app/(dashboard)/impostazioni/page.tsx` (contenuto attuale, 31 righe). Sostituisci l'intero file con:

```tsx
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOperatorNames } from "@/lib/operators"
import { OperatoriSettings } from "@/components/OperatoriSettings"

export default async function ImpostazioniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pinSet = Boolean(user?.user_metadata?.pin_set)
  const operatori = getOperatorNames(user)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accesso con PIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Imposta un PIN per accedere dai tablet senza dover passare dalla posta.
          </p>
          <Link href="/setup-pin" className={cn(buttonVariants({ variant: "default" }), "w-fit")}>
            {pinSet ? "Cambia PIN" : "Imposta PIN"}
          </Link>
        </CardContent>
      </Card>

      <OperatoriSettings initialOperatori={operatori} />
    </div>
  )
}
```

- [ ] **Step 3: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/components/OperatoriSettings.tsx "src/app/(dashboard)/impostazioni/page.tsx"
git commit -m "feat: aggiungi gestione elenco operatori in Impostazioni"
```

---

### Task 6: Campo "Operatore" nel form nuovo ordine

**Files:**
- Modify: `src/components/OrderForm.tsx`

- [ ] **Step 1: Aggiungi import e prop**

In `src/components/OrderForm.tsx`, trova:

```typescript
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import { computeOrderStatus, computeSaldo } from "@/lib/orderConstants"
```

Sostituisci con:

```typescript
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import { computeOrderStatus, computeSaldo } from "@/lib/orderConstants"
import { getRememberedOperator, setRememberedOperator } from "@/lib/device-operator"
import Link from "next/link"
```

Trova:

```typescript
interface Props {
  order?: OrderRow
}

export function OrderForm({ order }: Props) {
```

Sostituisci con:

```typescript
interface Props {
  order?: OrderRow
  operatori?: string[]
}

export function OrderForm({ order, operatori = [] }: Props) {
```

- [ ] **Step 2: Aggiungi lo stato per l'operatore selezionato**

Trova:

```typescript
  const [canale, setCanale] = useState(order?.canale ?? "negozio")
```

Sostituisci con:

```typescript
  const [canale, setCanale] = useState(order?.canale ?? "negozio")
  const [operatoreValue, setOperatoreValue] = useState<string>(() => {
    if (isEdit) return ""
    const remembered = getRememberedOperator()
    return remembered && operatori.includes(remembered) ? remembered : ""
  })
```

- [ ] **Step 3: Aggiungi il campo al payload e ricorda la scelta al salvataggio**

Trova:

```typescript
      canale,
      data_ordine: isEdit ? (order.data_ordine ?? null) : undefined,
```

Sostituisci con:

```typescript
      canale,
      operatore: isEdit ? undefined : operatoreValue,
      data_ordine: isEdit ? (order.data_ordine ?? null) : undefined,
```

Trova:

```typescript
    try {
      if (isEdit) {
        await updateOrder(order.id, payload)
        window.location.href = `/orders/${order.id}`
      } else {
        const { id } = await createOrder(payload)
        window.location.href = `/orders/${id}`
      }
    } catch (err) {
```

Sostituisci con:

```typescript
    try {
      if (isEdit) {
        await updateOrder(order.id, payload)
        window.location.href = `/orders/${order.id}`
      } else {
        const { id } = await createOrder(payload)
        setRememberedOperator(operatoreValue)
        window.location.href = `/orders/${id}`
      }
    } catch (err) {
```

- [ ] **Step 4: Aggiungi il campo nella sezione Ordine**

Trova (riga di apertura della sezione Ordine e del primo campo):

```tsx
      {/* ORDINE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-foreground border-b pb-1">Ordine</h2>
        <div>
          <Label htmlFor="cosa_ordinato">Cosa ordinato *</Label>
```

Sostituisci con:

```tsx
      {/* ORDINE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-foreground border-b pb-1">Ordine</h2>
        {!isEdit && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="operatore">Operatore *</Label>
              {operatori.length > 0 ? (
                <Select value={operatoreValue} onValueChange={(v) => v && setOperatoreValue(v)}>
                  <SelectTrigger id="operatore" className="w-full">
                    <SelectValue placeholder="— Seleziona —" />
                  </SelectTrigger>
                  <SelectContent>
                    {operatori.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground pt-2">
                  Nessun operatore configurato.{" "}
                  <Link href="/impostazioni" className="underline hover:text-foreground">
                    Aggiungi operatori in Impostazioni
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="cosa_ordinato">Cosa ordinato *</Label>
```

- [ ] **Step 5: Blocca il salvataggio finché l'operatore non è scelto**

Trova:

```tsx
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea ordine"}
        </Button>
```

Sostituisci con:

```tsx
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || (!isEdit && !operatoreValue)}>
          {saving ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea ordine"}
        </Button>
```

`!operatoreValue` copre già sia il caso "elenco vuoto" (il menu non è renderizzato, `operatoreValue` resta `""`) sia il caso "elenco non vuoto ma nessuna scelta fatta" — un solo controllo per entrambi.

- [ ] **Step 6: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: aggiungi campo Operatore obbligatorio al form nuovo ordine"
```

---

### Task 7: Passare l'elenco operatori alla pagina Nuovo ordine

**Files:**
- Modify: `src/app/(dashboard)/orders/new/page.tsx`

- [ ] **Step 1: Sostituisci l'intero file**

Contenuto attuale:

```tsx
import { OrderForm } from "@/components/OrderForm"

export default function NewOrderPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo ordine</h1>
      <OrderForm />
    </div>
  )
}
```

Sostituiscilo con:

```tsx
import { OrderForm } from "@/components/OrderForm"
import { createClient } from "@/lib/supabase/server"
import { getOperatorNames } from "@/lib/operators"

export default async function NewOrderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const operatori = getOperatorNames(user)

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo ordine</h1>
      <OrderForm operatori={operatori} />
    </div>
  )
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/orders/new/page.tsx"
git commit -m "feat: passa l'elenco operatori al form nuovo ordine"
```

---

### Task 8: Mostrare l'operatore nella scheda ordine

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx:170-174`

- [ ] **Step 1: Aggiungi il blocco nella sezione Key info**

Trova:

```tsx
      {/* Key info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {order.data_consegnato && (
          <div><span className="text-muted-foreground block text-xs">Consegnato il</span>{formatDate(order.data_consegnato)}</div>
        )}
```

Sostituisci con:

```tsx
      {/* Key info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {order.operatore && (
          <div><span className="text-muted-foreground block text-xs">Operatore</span>{order.operatore}</div>
        )}
        {order.data_consegnato && (
          <div><span className="text-muted-foreground block text-xs">Consegnato il</span>{formatDate(order.data_consegnato)}</div>
        )}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: mostra l'operatore nella scheda ordine"
```

---

### Task 9: Seedare un operatore di test e aggiornare Flusso D

**Files:**
- Modify: `e2e/helpers/auth.ts`
- Modify: `e2e/flusso-d-consegna.spec.ts`

Flusso D crea davvero un ordine passando dal form (`/orders/new` → compila
campi → click "Crea ordine"), senza selezionare un operatore. Con il campo
ora obbligatorio, il pulsante resterebbe disabilitato e il test non
creerebbe mai l'ordine. Serve seedare un operatore sull'account di test e
selezionarlo nel test. L'utente di test può già esistere da esecuzioni
precedenti (persiste come account di servizio, vedi CLAUDE.md) — la sola
`createUser({ ..., user_metadata: { operatori: [...] } })` non basta,
perché viene ignorata quando l'utente esiste già. Serve un passo esplicito
che aggiorna i metadati anche per un utente già esistente.

- [ ] **Step 1: Aggiungi un operatore di test idempotente**

In `e2e/helpers/auth.ts`, trova:

```typescript
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@oltrelabottega.local"
```

Sostituisci con:

```typescript
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@oltrelabottega.local"
export const TEST_OPERATOR = "Operatore Test"
```

Trova:

```typescript
  // Idempotente: se l'utente di test esiste già, l'errore viene ignorato.
  await admin.auth.admin
    .createUser({ email: TEST_EMAIL, email_confirm: true, user_metadata: { shop_name: "Bottega E2E" } })
    .catch(() => {})

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL })
```

Sostituisci con:

```typescript
  // Idempotente: se l'utente di test esiste già, l'errore viene ignorato.
  await admin.auth.admin
    .createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      user_metadata: { shop_name: "Bottega E2E", operatori: [TEST_OPERATOR] },
    })
    .catch(() => {})

  // L'utente di test può già esistere da esecuzioni precedenti (senza
  // l'operatore, se creato prima di questo campo) — createUser sopra viene
  // ignorata in quel caso, quindi qui ci assicuriamo che l'operatore di test
  // sia comunque presente nei metadati.
  const { data: existing } = await admin.auth.admin.listUsers()
  const existingUser = existing?.users.find((u) => u.email === TEST_EMAIL)
  if (existingUser) {
    const current: string[] = Array.isArray(existingUser.user_metadata?.operatori)
      ? existingUser.user_metadata.operatori
      : []
    if (!current.includes(TEST_OPERATOR)) {
      await admin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, operatori: [...current, TEST_OPERATOR] },
      })
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL })
```

- [ ] **Step 2: Seleziona l'operatore in Flusso D**

In `e2e/flusso-d-consegna.spec.ts`, trova:

```typescript
import { getTestAuthCookies, deleteTestOrder } from "./helpers/auth"
```

Sostituisci con:

```typescript
import { getTestAuthCookies, deleteTestOrder, TEST_OPERATOR } from "./helpers/auth"
```

Trova:

```typescript
    await page.goto("/orders/new")
    await page.getByLabel("Nome *").fill(nomeCliente)
    await page.getByLabel("Cosa ordinato *").fill("Targa incisa — test E2E")
    await page.getByLabel("Prezzo €").fill("50")
    await page.getByRole("button", { name: "Crea ordine" }).click()
```

Sostituisci con:

```typescript
    await page.goto("/orders/new")
    await page.getByLabel("Nome *").fill(nomeCliente)
    await page.getByLabel("Cosa ordinato *").fill("Targa incisa — test E2E")
    await page.getByLabel("Operatore *").click()
    await page.getByRole("option", { name: TEST_OPERATOR }).click()
    await page.getByLabel("Prezzo €").fill("50")
    await page.getByRole("button", { name: "Crea ordine" }).click()
```

- [ ] **Step 3: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/auth.ts e2e/flusso-d-consegna.spec.ts
git commit -m "test: seeda un operatore di test e selezionalo in Flusso D"
```

---

### Task 10: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Per la regola del progetto ("quando viene presa una decisione che cambia quanto scritto in CLAUDE.md, aggiornare... nello stesso commit"), aggiungi una riga alla tabella "Decisioni chiave e motivazioni", dopo la riga sul PIN.

- [ ] **Step 1: Aggiungi la nuova riga**

Trova in `CLAUDE.md` la riga:

```
| PIN aggiunto come metodo di accesso alternativo al magic link (2026-07-13) | ...
```

Aggiungi subito dopo (stessa tabella):

```
| Campo "Operatore" obbligatorio in creazione ordine, elenco configurabile da Impostazioni (2026-07-14) | Con il login PIN condiviso si perde il segnale "chi ha preso l'ordine" che oggi si legge dalla calligrafia sulla carta. `orders.operatore` (nullable) si imposta solo alla creazione — non compare nel form di modifica, è un dato di fatto non revisionabile a posteriori. L'elenco dei nomi selezionabili vive in `user_metadata.operatori` (stesso posto di `shop_name`), gestito da una nuova card in Impostazioni; nessuna tabella dipendenti/utenti, coerente col modello single-tenant. Se l'elenco è vuoto il salvataggio dell'ordine resta bloccato finché non si aggiunge almeno un operatore. L'ultimo operatore scelto viene ricordato per dispositivo (`localStorage`), stesso meccanismo già usato per l'email nel login PIN |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta il campo Operatore in CLAUDE.md"
```

---

### Task 11: Verifica manuale end-to-end

**Files:** nessuno (solo verifica, nessuna modifica di codice)

- [ ] **Step 1: Avvia il server di sviluppo**

Run: `npm run dev`

- [ ] **Step 2: Elenco operatori vuoto blocca la creazione**

Con un account senza `operatori` configurati, apri `/orders/new`: verifica che al posto del menu compaia il messaggio con link a Impostazioni, e che il pulsante "Crea ordine" sia disabilitato.

- [ ] **Step 3: Aggiungi operatori da Impostazioni**

Apri `/impostazioni` → card "Operatori" → aggiungi "Maria" → verifica che compaia come chip rimovibile. Prova ad aggiungere di nuovo "maria" (minuscolo) → verifica messaggio "Questo nome è già in elenco." e che non venga duplicato. Aggiungi anche "Luca".

- [ ] **Step 4: Crea un ordine con operatore**

Torna su `/orders/new`: verifica che il menu "Operatore *" ora mostri "Maria" e "Luca", che il pulsante "Crea ordine" sia abilitato solo dopo averne scelto uno, e che l'ordine venga creato correttamente.

- [ ] **Step 5: L'operatore compare nella scheda, non nel form di modifica**

Apri la scheda dell'ordine appena creato → verifica che "Operatore" compaia nel blocco info con il nome scelto. Vai su "Modifica" → verifica che il campo Operatore non sia presente nel form.

- [ ] **Step 6: Preselezione sullo stesso dispositivo**

Crea un secondo ordine dallo stesso browser → verifica che il menu Operatore sia già preselezionato sull'ultima scelta fatta (comunque modificabile).

- [ ] **Step 7: Rimozione operatore**

Da Impostazioni, rimuovi "Luca" → verifica che sparisca dall'elenco e dal menu di `/orders/new`, mentre l'ordine già creato con quell'operatore continua a mostrarlo correttamente nella sua scheda.

- [ ] **Step 8: Test automatici e typecheck completi**

Run: `npx jest`
Expected: tutte le suite verdi (test esistenti + 8 nuovi in `operators.test.ts`).

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 9: Flussi E2E Playwright esistenti**

Run: `npx playwright test`
Expected: Flussi A e C invariati. Flusso B invariato (testa solo redirect da non autenticato, non crea ordini). Flusso D crea l'ordine selezionando `TEST_OPERATOR` (Task 9) — se fallisce, verificare prima se è per il motivo pre-esistente e non collegato già noto (`getByLabel('Nome *')` ambiguo, documentato nel piano del login PIN) prima di considerarlo un problema introdotto da questo lavoro.

---

## Note per chi esegue il piano

- Ogni task produce codice funzionante e compilabile da solo — nessuna dipendenza rotta tra un task e il successivo se eseguiti in ordine.
- Il Task 11 è l'unica verifica end-to-end reale, in particolare il comportamento con elenco operatori vuoto e la preselezione via `localStorage` — non testabili in modo significativo con Jest.
- Il Task 9 esiste perché Flusso D crea davvero un ordine tramite l'UI — senza seedare un operatore di test, il nuovo campo obbligatorio lo romperebbe silenziosamente (pulsante "Crea ordine" disabilitato, nessun errore esplicito). Flusso B invece testa solo redirect di autenticazione, non è a rischio.