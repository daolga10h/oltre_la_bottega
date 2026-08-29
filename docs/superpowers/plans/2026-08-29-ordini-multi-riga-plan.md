# Ordini multi-riga (Progetto 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one order contain multiple line items (articolo/testo/quantità/prezzo unitario) instead of a single `cosa_ordinato`/`prezzo`, with the order's total price calculated automatically from the lines.

**Architecture:** New child table `order_items` (same pattern as the existing `order_events` table). `orders.cosa_ordinato` and `orders.prezzo` stop being user-entered and become server-computed summary columns (comma-joined article names, summed line totals) — this is what lets every existing list/kanban/dashboard/search/CSV-backup view keep working with zero code changes, since they all just read those two columns. Order status stays a single value for the whole order, entirely unaffected by how many line items it has.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Jest.

**Full design reference:** `docs/superpowers/specs/2026-08-29-ordini-multi-riga-design.md`

---

### Task 1: Database migration — `order_items` table

**Files:**
- Create: `supabase/migrations/20260829000002_add_order_items.sql`

- [x] **Step 1: Write the migration file**

```sql
-- Order line items: one order can now contain multiple articles
-- (articolo/testo/quantità/prezzo), instead of a single cosa_ordinato/prezzo.
-- orders.cosa_ordinato and orders.prezzo remain on the orders table but
-- become server-computed summaries (see src/lib/orderItems.ts) — nothing
-- reading those two columns needs to change.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  cosa_ordinato text not null,
  testo_da_scrivere text,
  quantita integer not null default 1,
  prezzo_unitario numeric(10,2) not null default 0,
  posizione integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;
create policy "auth_all" on public.order_items for all using (auth.uid() is not null);

-- Backfill: every existing order becomes a single line item with the same
-- values it already has today, so no order changes appearance after this
-- migration runs.
insert into public.order_items (order_id, cosa_ordinato, testo_da_scrivere, quantita, prezzo_unitario, posizione)
select id, cosa_ordinato, testo_da_scrivere, coalesce(quantita, 1), coalesce(prezzo, 0), 0
from public.orders;
```

- [x] **Step 2: Note for whoever applies it**

This project applies migrations manually via the Supabase Dashboard SQL Editor (no CLI connected in dev — see CLAUDE.md). This step doesn't need to happen before the rest of the plan; the app code changes in later tasks assume the table exists, so apply this migration before deploying, not necessarily before writing the code.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260829000002_add_order_items.sql
git commit -m "feat: add order_items table for multi-line orders"
```

---

### Task 2: `computeOrderSummary` pure function

**Files:**
- Create: `src/lib/orderItems.ts`
- Test: `src/lib/__tests__/orderItems.test.ts`

- [x] **Step 1: Write the failing tests**

```typescript
import { computeOrderSummary, type OrderItemInput } from "../orderItems"

describe("computeOrderSummary", () => {
  it("joins a single item's name as-is and multiplies quantity by unit price", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "Targa", testo_da_scrivere: null, quantita: 2, prezzo_unitario: 6 },
    ]
    expect(computeOrderSummary(items)).toEqual({ cosaOrdinato: "Targa", prezzo: 12 })
  })

  it("joins multiple item names with a comma and sums their line totals", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "Targa", testo_da_scrivere: "Studio Rossi", quantita: 2, prezzo_unitario: 6 },
      { cosa_ordinato: "Timbro", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 10 },
    ]
    expect(computeOrderSummary(items)).toEqual({ cosaOrdinato: "Targa, Timbro", prezzo: 22 })
  })

  it("rounds the total to 2 decimals to avoid floating point drift", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "A", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 0.1 },
      { cosa_ordinato: "B", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 0.2 },
    ]
    expect(computeOrderSummary(items).prezzo).toBe(0.3)
  })

  it("treats a missing/zero quantity or price as contributing 0 to the total", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "Gratis", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 0 },
    ]
    expect(computeOrderSummary(items)).toEqual({ cosaOrdinato: "Gratis", prezzo: 0 })
  })
})
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/__tests__/orderItems.test.ts`
Expected: FAIL with "Cannot find module '../orderItems'"

- [x] **Step 3: Write the implementation**

```typescript
export type OrderItemInput = {
  cosa_ordinato: string
  testo_da_scrivere: string | null
  quantita: number
  prezzo_unitario: number
}

export function computeOrderSummary(items: OrderItemInput[]): { cosaOrdinato: string; prezzo: number } {
  const cosaOrdinato = items.map((item) => item.cosa_ordinato).join(", ")
  const rawTotal = items.reduce((sum, item) => sum + item.quantita * item.prezzo_unitario, 0)
  const prezzo = Math.round(rawTotal * 100) / 100
  return { cosaOrdinato, prezzo }
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/__tests__/orderItems.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Commit**

```bash
git add src/lib/orderItems.ts src/lib/__tests__/orderItems.test.ts
git commit -m "feat: add computeOrderSummary for multi-line order totals"
```

---

### Task 3: `src/actions/orders.ts` — items-based create/update/read

**Files:**
- Modify: `src/actions/orders.ts`
- Test: `src/actions/__tests__/orders.test.ts`

This task replaces `cosa_ordinato`/`testo_da_scrivere`/`prezzo` as direct inputs to `createOrder`/`updateOrder` with an `items` array, and makes `getOrder` return those items.

- [x] **Step 1: Update `createOrder` tests to use `items` instead of `cosa_ordinato`**

In `src/actions/__tests__/orders.test.ts`, replace the entire `describe("createOrder", ...)` block (currently the last block in the file) with:

```typescript
describe("createOrder", () => {
  afterEach(() => jest.clearAllMocks())

  const items = [
    { cosa_ordinato: "Targa", testo_da_scrivere: "Studio Rossi", quantita: 2, prezzo_unitario: 6 },
    { cosa_ordinato: "Timbro", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 10 },
  ]

  it("computes cosa_ordinato/prezzo from items and inserts orders, then order_items, then order_events", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { id: "new-id" }, error: null }],
      order_items: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const result = await createOrder({ nome: "Gigi", items })

    expect(result).toEqual({ id: "new-id" })

    expect(client.from).toHaveBeenNthCalledWith(1, "orders")
    const orderBuilder = client.from.mock.results[0].value
    expect(orderBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Gigi", cosa_ordinato: "Targa, Timbro", prezzo: 22 })
    )

    expect(client.from).toHaveBeenNthCalledWith(2, "order_items")
    const itemsBuilder = client.from.mock.results[1].value
    expect(itemsBuilder.insert).toHaveBeenCalledWith([
      { ...items[0], order_id: "new-id", posizione: 0 },
      { ...items[1], order_id: "new-id", posizione: 1 },
    ])

    expect(client.from).toHaveBeenNthCalledWith(3, "order_events")
    const eventsBuilder = client.from.mock.results[2].value
    expect(eventsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "new-id", event_type: "created" })
    )
  })

  it("if the order_events insert fails, createOrder does not surface an error — the order exists with no timeline entry", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { id: "new-id" }, error: null }],
      order_items: [{ data: null, error: null }],
      order_events: [{ data: null, error: { message: "insert failed" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    await expect(createOrder({ nome: "Gigi", items })).resolves.toEqual({ id: "new-id" })
  })

  it("throws a save-failed AppError when the order insert itself fails", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: { message: "constraint violation" } }],
    })
    mockCreateClient.mockResolvedValue(client)
    jest.spyOn(console, "error").mockImplementation(() => {})

    await expect(createOrder({ nome: "Gigi", items })).rejects.toThrow()
  })

  it("rejects an empty items array before touching the database", async () => {
    const client = createSupabaseMock({})
    mockCreateClient.mockResolvedValue(client)

    await expect(createOrder({ nome: "Gigi", items: [] })).rejects.toThrow()
    expect(client.from).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Add `updateOrder` items tests and a `getOrder` items test**

Append these two new `describe` blocks to the same file (after the `createOrder` block):

```typescript
describe("updateOrder items handling", () => {
  afterEach(() => jest.clearAllMocks())

  it("recomputes cosa_ordinato/prezzo from items and replaces the order_items rows", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_items: [{ data: null, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const items = [
      { cosa_ordinato: "Targa", testo_da_scrivere: null, quantita: 3, prezzo_unitario: 6 },
    ]
    await updateOrder("id1", { items })

    const orderUpdateBuilder = client.from.mock.results[0].value
    expect(orderUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ cosa_ordinato: "Targa", prezzo: 18 })
    )

    expect(client.from).toHaveBeenNthCalledWith(2, "order_items")
    const deleteBuilder = client.from.mock.results[1].value
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith("order_id", "id1")

    expect(client.from).toHaveBeenNthCalledWith(3, "order_items")
    const insertBuilder = client.from.mock.results[2].value
    expect(insertBuilder.insert).toHaveBeenCalledWith([{ ...items[0], order_id: "id1", posizione: 0 }])
  })

  it("rejects an empty items array before touching the database", async () => {
    const client = createSupabaseMock({})
    mockCreateClient.mockResolvedValue(client)

    await expect(updateOrder("id1", { items: [] })).rejects.toThrow()
    expect(client.from).not.toHaveBeenCalled()
  })
})

describe("getOrder", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns items from the order_items join", async () => {
    const client = createSupabaseMock({
      orders: [{
        data: {
          id: "id1",
          order_events: [],
          order_items: [
            { id: "item1", order_id: "id1", cosa_ordinato: "Targa", testo_da_scrivere: null, quantita: 2, prezzo_unitario: 6, posizione: 0, created_at: "2026-08-29T00:00:00Z" },
          ],
        },
        error: null,
      }],
    })
    mockCreateClient.mockResolvedValue(client)

    const order = await getOrder("id1")

    expect(order?.items).toEqual([
      { id: "item1", order_id: "id1", cosa_ordinato: "Targa", testo_da_scrivere: null, quantita: 2, prezzo_unitario: 6, posizione: 0, created_at: "2026-08-29T00:00:00Z" },
    ])
  })

  it("defaults items to an empty array when the join returns none", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { id: "id1", order_events: [] }, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const order = await getOrder("id1")

    expect(order?.items).toEqual([])
  })
})
```

Also update the existing import line at the top of the file to include `getOrder`:

```typescript
import { getOrders, getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, createOrder, updateOrder } from "../orders"
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: FAIL — `createOrder`/`updateOrder` still expect `cosa_ordinato` directly, `getOrder` doesn't select `order_items`, `updateOrder` isn't exported.

- [x] **Step 4: Update the types and imports at the top of `src/actions/orders.ts`**

Replace lines 1–56 (from `"use server"` through the `CreateOrderInput` type) with:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"
import { STATUS_LABELS } from "@/lib/orderConstants"
import { buildSearchOrClause } from "@/lib/search"
import { computeOrderSummary, type OrderItemInput } from "@/lib/orderItems"

// Re-exported for convenience — consumers can also import directly from @/lib/orderConstants
// NOTE: cannot export non-async values from "use server" files, so pages import from orderConstants directly

export type { OrderItemInput }

export type OrderItemRow = OrderItemInput & {
  id: string
  order_id: string
  posizione: number
  created_at: string
}

export type OrderRow = {
  id: string
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  email_cliente: string | null
  canale: string
  operatore: string | null
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  cosa_ordinato: string
  testo_da_scrivere: string | null
  tipo_lavorazione: string | null
  quantita: number
  bozza_grafica: string
  preventivo: string
  materiale: string
  materiale_fornitore: string | null
  materiale_cosa_manca: string | null
  materiale_data_ordine: string | null
  dettagli_grafici: string | null
  foto_oggetto: string | null
  file_cliente: string | null
  note: string | null
  status: string
  prezzo: number
  acconto: number
  saldo: number
  consenso_marketing: boolean
  chiedere_recensione: boolean
  recensione_richiesta: boolean
  recensione_ricevuta: boolean
  msg_pronto_inviato: boolean
  created_at: string
  updated_at: string
}

export type OrderDetail = OrderRow & {
  events: Array<{ id: string; event_type: string; note: string | null; created_at: string }>
  items: OrderItemRow[]
}

export type CreateOrderInput = Omit<
  OrderRow,
  "id" | "created_at" | "updated_at" | "cosa_ordinato" | "testo_da_scrivere" | "quantita" | "prezzo"
> & {
  items: OrderItemInput[]
}
```

- [x] **Step 5: Update `getOrder` to join `order_items`**

Replace the `getOrder` function (originally lines 91–111) with:

```typescript
export async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_events(id, event_type, note, created_at), order_items(id, order_id, cosa_ordinato, testo_da_scrivere, quantita, prezzo_unitario, posizione, created_at)")
      .eq("id", id)
      .order("created_at", { referencedTable: "order_events", ascending: false })
      .order("posizione", { referencedTable: "order_items", ascending: true })
      .single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw new AppError(error.message, USER_MESSAGES.notFound)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any
    return { ...row, events: row.order_events ?? [], items: row.order_items ?? [] } as OrderDetail
  } catch (err) {
    logError("getOrder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}
```

- [x] **Step 6: Update `createOrder` and add `updateOrder`**

Replace the `createOrder` function and the existing `updateOrder` function (originally lines 113–147) with:

```typescript
export async function createOrder(input: Partial<CreateOrderInput> & { nome: string; items: OrderItemInput[] }): Promise<{ id: string }> {
  const { items, ...rest } = input
  if (items.length === 0) {
    throw new AppError("createOrder called with an empty items array", USER_MESSAGES.validationError)
  }
  const { cosaOrdinato, prezzo } = computeOrderSummary(items)
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("orders")
    .insert({ ...rest, cosa_ordinato: cosaOrdinato, prezzo })
    .select("id")
    .single()
  if (error) {
    logError("createOrder", error, { input })
    throw new AppError(error.message, USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_items").insert(
    items.map((item, idx) => ({ ...item, order_id: data.id, posizione: idx }))
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: data.id,
    event_type: "created",
    note: "Ordine creato",
  })
  revalidatePath("/orders")
  revalidatePath("/dashboard")
  return { id: data.id }
}

export async function updateOrder(id: string, input: Partial<CreateOrderInput> & { items: OrderItemInput[] }): Promise<void> {
  const { items, ...rest } = input
  if (items.length === 0) {
    throw new AppError("updateOrder called with an empty items array", USER_MESSAGES.validationError)
  }
  const { cosaOrdinato, prezzo } = computeOrderSummary(items)
  const updates: Record<string, unknown> = { ...rest, cosa_ordinato: cosaOrdinato, prezzo }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("orders").update(updates).eq("id", id)
  if (error) {
    logError("updateOrder", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_items").delete().eq("order_id", id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_items").insert(
    items.map((item, idx) => ({ ...item, order_id: id, posizione: idx }))
  )
  revalidatePath("/orders")
  revalidatePath("/dashboard")
  revalidatePath(`/orders/${id}`)
}
```

Note the empty-items guard now runs before `createClient()`/`from()` is called at all — matches the "rejects an empty items array before touching the database" tests above (`expect(client.from).not.toHaveBeenCalled()`).

**Post-review addendum (applied during Task 3's code-quality review loop):** the `order_items` writes above (create's insert, update's delete, update's insert) must also check their `error` and throw an `AppError` on failure — the same way the `orders` table calls already do — instead of being fire-and-forget like the `order_events` insert. Unlike `order_events` (just an audit log), `order_items` is the source of truth the `cosa_ordinato`/`prezzo` summary is computed from, so a silent failure there would leave the order's summary out of sync with its actual line items. This was implemented as commit `fix: surface order_items write failures in createOrder/updateOrder`, with 3 additional tests pinning down the new error paths.

- [x] **Step 7: Run the tests to verify they pass**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: PASS (all tests, including the pre-existing ones untouched by this task)

- [x] **Step 8: Run the full unit suite and the type checker**

Run: `npx jest src`
Expected: PASS (no regressions elsewhere)

Run: `npx tsc --noEmit`
Expected: errors only in `OrderForm.tsx` (still calling the old signature — fixed in Task 4) and `orders/[id]/page.tsx` if it references `order.testo_da_scrivere` for the removed-in-Task-5 card. If `orders.ts` itself has no errors, this step is done.

- [x] **Step 9: Commit**

```bash
git add src/actions/orders.ts src/actions/__tests__/orders.test.ts
git commit -m "feat: createOrder/updateOrder accept order_items, getOrder returns them"
```

---

### Task 4: `OrderForm.tsx` — Articoli section

**Files:**
- Modify: `src/components/OrderForm.tsx`

No component test infrastructure exists in this codebase (all existing tests cover `src/actions`/`src/lib`/`src/app/api`, not React components) — this task is verified via `tsc` and the manual check in Task 6, consistent with that existing convention.

- [x] **Step 1: Update imports and the `Props` type**

Replace line 14 (`import { computeOrderStatus, computeSaldo } from "@/lib/orderConstants"`) with:

```typescript
import { computeOrderStatus, computeSaldo } from "@/lib/orderConstants"
import { computeOrderSummary, type OrderItemInput } from "@/lib/orderItems"
import type { OrderItemRow } from "@/actions/orders"
```

Replace the `Props` interface (lines 41–44) with:

```typescript
interface Props {
  order?: OrderRow & { items?: OrderItemRow[] }
  operatori?: string[]
}
```

- [x] **Step 2: Replace the `prezzoText` state with an `items` array state**

Replace this line (118):

```typescript
  const [prezzoText, setPrezzoText] = useState(order?.prezzo ? order.prezzo.toFixed(2) : "")
```

with:

```typescript
  type ItemRow = { id: number; cosaOrdinato: string; testoDaScrivere: string; quantita: string; prezzoUnitario: string }
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (order?.items && order.items.length > 0) {
      return order.items.map((it, idx) => ({
        id: idx,
        cosaOrdinato: it.cosa_ordinato,
        testoDaScrivere: it.testo_da_scrivere ?? "",
        quantita: String(it.quantita),
        prezzoUnitario: it.prezzo_unitario.toFixed(2),
      }))
    }
    return [{ id: 0, cosaOrdinato: "", testoDaScrivere: "", quantita: "1", prezzoUnitario: "" }]
  })
  const nextItemId = useRef(items.length)

  function addItem() {
    setItems((prev) => [...prev, { id: nextItemId.current++, cosaOrdinato: "", testoDaScrivere: "", quantita: "1", prezzoUnitario: "" }])
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev))
  }
  function updateItem(id: number, field: keyof Omit<ItemRow, "id">, value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }
  const itemInputs: OrderItemInput[] = items.map((it) => ({
    cosa_ordinato: it.cosaOrdinato.trim(),
    testo_da_scrivere: it.testoDaScrivere.trim() || null,
    quantita: parseInt(it.quantita, 10) || 1,
    prezzo_unitario: parseFloat(it.prezzoUnitario) || 0,
  }))
  const { prezzo: itemsTotal } = computeOrderSummary(itemInputs)
```

- [x] **Step 3: Update the `prezzo`/`saldo` calculation**

Replace lines 120–122:

```typescript
  const prezzo = parseFloat(prezzoText) || 0
  const acconto = parseFloat(accontoText) || 0
  const saldo = computeSaldo(prezzo, acconto)
```

with:

```typescript
  const acconto = parseFloat(accontoText) || 0
  const saldo = computeSaldo(itemsTotal, acconto)
```

- [x] **Step 4: Update the submit payload**

In `handleSubmit`, replace these lines from the `payload` object:

```typescript
      cosa_ordinato: (fd.get("cosa_ordinato") as string).trim(),
      testo_da_scrivere: v("testo_da_scrivere"),
      tipo_lavorazione: tipoLavorazione || null,
```

with:

```typescript
      items: itemInputs,
      tipo_lavorazione: tipoLavorazione || null,
```

And replace this line in the same `payload` object:

```typescript
      prezzo,
      acconto,
```

with:

```typescript
      acconto,
```

- [x] **Step 5: Replace the "Cosa ordinato" / "Testo da scrivere" fields with the Articoli section**

Replace this block (originally lines 328–335):

```tsx
        <div>
          <Label htmlFor="cosa_ordinato">Cosa ordinato *</Label>
          <Input id="cosa_ordinato" name="cosa_ordinato" required autoComplete="off" defaultValue={order?.cosa_ordinato} placeholder="Es. targa plexiglass, timbro, portachiavi inciso..." />
        </div>
        <div>
          <Label htmlFor="testo_da_scrivere">Testo da scrivere / incidere / stampare</Label>
          <Textarea id="testo_da_scrivere" name="testo_da_scrivere" rows={3} autoComplete="off" defaultValue={order?.testo_da_scrivere ?? ""} placeholder="Frase, nome, data, testo targa, testo timbro..." />
        </div>
```

with:

```tsx
        <div className="space-y-3">
          <Label>Articoli *</Label>
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Riga {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-terracotta hover:underline"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
              <Input
                required
                autoComplete="off"
                value={item.cosaOrdinato}
                onChange={(e) => updateItem(item.id, "cosaOrdinato", e.target.value)}
                placeholder="Es. targa plexiglass, timbro, portachiavi inciso..."
              />
              <Textarea
                rows={2}
                autoComplete="off"
                value={item.testoDaScrivere}
                onChange={(e) => updateItem(item.id, "testoDaScrivere", e.target.value)}
                placeholder="Testo da scrivere / incidere / stampare"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantità</Label>
                  <input
                    type="number" inputMode="numeric" min="1" step="1"
                    value={item.quantita}
                    onChange={(e) => updateItem(item.id, "quantita", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={numClass}
                  />
                </div>
                <div>
                  <Label className="text-xs">Prezzo unitario €</Label>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0" max="99999"
                    value={item.prezzoUnitario} placeholder="0.00"
                    onChange={(e) => updateItem(item.id, "prezzoUnitario", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={numClass}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            + Aggiungi articolo
          </Button>
          <p className="text-sm text-muted-foreground">
            Totale: <span className="font-semibold text-foreground">€{itemsTotal.toFixed(2)}</span>
          </p>
        </div>
```

- [x] **Step 6: Replace the editable "Prezzo €" field with a read-only computed box**

Replace this block (originally lines 444–452):

```tsx
          <div>
            <Label htmlFor="prezzo">Prezzo €</Label>
            <input id="prezzo" type="number" inputMode="decimal" step="0.01" min="0" max="99999"
              value={prezzoText} placeholder="0.00"
              onChange={(e) => setPrezzoText(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setPrezzoText(prezzoText ? (parseFloat(prezzoText) || 0).toFixed(2) : "")}
              className={numClass} />
          </div>
```

with:

```tsx
          <div>
            <Label>Prezzo € (calcolato)</Label>
            <div className="h-9 rounded-lg border border-input bg-background px-2 text-sm flex items-center font-medium text-foreground">
              {itemsTotal.toFixed(2)}
            </div>
          </div>
```

- [x] **Step 7: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `OrderForm.tsx`

- [x] **Step 8: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: OrderForm supports multiple line items with a live total"
```

---

### Task 5: Order detail page — Articoli section

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx`

- [x] **Step 1: Replace the "Testo da scrivere" card with an "Articoli" list**

Replace this block (originally lines 240–248):

```tsx
      {/* Text to engrave */}
      {order.testo_da_scrivere && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Testo da scrivere</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <p className="font-medium">{order.testo_da_scrivere}</p>
          </CardContent>
        </Card>
      )}
```

with:

```tsx
      {/* Articoli */}
      {order.items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Articoli</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{item.cosa_ordinato} &times; {item.quantita}</p>
                  {item.testo_da_scrivere && (
                    <p className="text-sm text-muted-foreground">{item.testo_da_scrivere}</p>
                  )}
                </div>
                <p className="text-sm shrink-0">€{formatEUR(item.quantita * item.prezzo_unitario)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
```

- [x] **Step 2: Update the "Prezzo" payment box label**

Replace this block (originally lines 261–265):

```tsx
        <div className="rounded-lg border border-border bg-card px-3 py-3 text-center shadow-[0px_4px_8px_0px_rgba(59,39,22,0.06)]">
          <p className="text-xs text-muted-foreground">Prezzo</p>
          <p className="font-semibold text-base text-foreground">€{formatEUR(order.prezzo)}</p>
        </div>
```

with:

```tsx
        <div className="rounded-lg border border-border bg-card px-3 py-3 text-center shadow-[0px_4px_8px_0px_rgba(59,39,22,0.06)]">
          <p className="text-xs text-muted-foreground">Prezzo (calcolato)</p>
          <p className="font-semibold text-base text-foreground">€{formatEUR(order.prezzo)}</p>
        </div>
```

- [x] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `orders/[id]/page.tsx`

- [x] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: order detail page lists line items instead of a single testo_da_scrivere"
```

---

### Task 6: Full verification and CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [x] **Step 1: Run the full unit test suite**

Run: `npx jest src`
Expected: PASS, all suites green. Note the new total suite/test count in the output for Step 4.

- [x] **Step 2: Run the type checker on the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual golden-path check in the dev server**

**Not performed in this pass** — this worktree has no `.env.local`/Supabase credentials, and the new `order_items` migration has not yet been applied to any live database (it's applied manually via the Supabase Dashboard SQL Editor, per this project's convention). Do this check once the migration has been applied to a real environment:

Run: `npm run dev`, then in the browser:
1. Go to `/orders/new`, fill in Nome/Cognome/Telefono/Data consegna/Operatore.
2. In "Articoli", enter row 1: "Targa", quantità 2, prezzo unitario 6.00. Click "+ Aggiungi articolo", enter row 2: "Timbro", quantità 1, prezzo unitario 10.00.
3. Confirm "Totale: €22.00" updates live as you type.
4. Save the order — confirm it redirects to the order detail page, shows both articles in the "Articoli" card, and "Prezzo (calcolato)" reads €22.00.
5. Click "Modifica" — confirm both rows reload with their original values — remove the "Timbro" row, save, confirm the detail page now shows one article and Prezzo €12.00.
6. Go to `/orders` (list) and the bacheca (`/kanban`) — confirm the order's card still shows correctly (client name + "Targa" + date), no layout break.
7. Stop the dev server (Ctrl+C).

- [x] **Step 4: Update CLAUDE.md**

Add this row to the "Decisioni chiave e motivazioni" table, after the row about the "Azienda" field (the last row in the table):

```markdown
| Ordini multi-riga: nuova tabella `order_items`, `orders.cosa_ordinato`/`orders.prezzo` diventano calcolati automaticamente (2026-08-29) | Un ordine contiene spesso più articoli diversi con prezzo e testo diversi (es. 2 targhe + 1 timbro) — il modello a singolo `cosa_ordinato`/`prezzo` non lo rappresentava, gap già annotato il 2026-07-09 alla rimozione del vecchio campo "Qtà" e rimandato apposta. `orders.cosa_ordinato`/`orders.prezzo` restano sulla tabella `orders` ma vengono scritti in automatico (`computeOrderSummary` in `src/lib/orderItems.ts`) invece che a mano — per questo liste, bacheca, dashboard, ricerca e backup CSV non hanno richiesto nessuna modifica di codice. Stato ordine resta un unico valore per l'intero ordine, invariato. Discussa e volutamente rimandata a un secondo progetto la richiesta di fasi (preventivo/bozza/materiale/lavorazione) per singolo articolo — troppo grande per essere affrontata insieme alla base multi-riga; vedere `docs/superpowers/specs/2026-08-29-ordini-multi-riga-design.md` per il dettaglio, incluso lo spunto emerso in conversazione per quel design futuro (gli articoli avanzano quasi sempre insieme — il vero bisogno è segnalare le eccezioni, non tracciare ogni riga sempre separatamente) |
```

Then update the Testing section: replace the current suite/test count sentence (`**Stato al 2026-08-29**: 23 suite / 191 test ...`) with the new count from Step 1's output (same sentence structure, just the updated numbers and today's date), and add a new bullet after the "Feature (2026-08-29): campo Azienda" bullet:

```markdown
- **Feature (2026-08-29)**: ordini multi-riga (Progetto 1) — vedere riga corrispondente in Decisioni chiave. Nuova tabella `order_items` (migration `20260829000002_add_order_items.sql`, con backfill di un articolo per ogni ordine esistente), funzione pura `computeOrderSummary` (`src/lib/orderItems.ts`, 4 test TDD), `createOrder`/`updateOrder` ora accettano un array `items` invece dei singoli campi `cosa_ordinato`/`testo_da_scrivere`/`prezzo` (nuovi test in `src/actions/__tests__/orders.test.ts`), `getOrder` restituisce anche `items`. `OrderForm.tsx` sostituisce i vecchi campi con una sezione "Articoli" (righe aggiungibili/rimovibili, totale calcolato dal vivo); scheda ordine mostra l'elenco articoli al posto del vecchio "Testo da scrivere". Design in `docs/superpowers/specs/2026-08-29-ordini-multi-riga-design.md`, piano in `docs/superpowers/plans/2026-08-29-ordini-multi-riga-plan.md`. Fasi per singolo articolo (Progetto 2) volutamente fuori scope, da riprendere a parte.
```

- [x] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document multi-line order items in CLAUDE.md"
```

---

## Execution notes (filled in during implementation, 2026-08-29)

All 6 tasks executed via `superpowers:subagent-driven-development` in worktree `worktree-ordini-multi-riga`, each task implemented by a fresh subagent and reviewed twice (spec compliance, then code quality) before moving on. One real issue was caught and fixed during Task 3's code-quality review loop (see the addendum under Task 3 Step 6 above) — everything else passed both review stages on the first pass. Final state: 16 suites / 128 tests passing (`npx jest src`), `npx tsc --noEmit` clean. Step 3 of Task 6 (manual browser click-through) was explicitly skipped for the reason stated inline — do it after applying the migration to a real database, before merging to production.
