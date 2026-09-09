# Clienti ente/azienda con referente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an order be registered for an entity/company/PA instead of a private person — a new "È un ente/azienda" toggle in the order form relabels Nome to "Nome ente/azienda" (still required), hides Cognome/Azienda, and shows an independent, always-optional "Referente" field for a contact person who may change order to order while the entity stays the same.

**Architecture:** Two new columns on `orders`: `is_ente` (boolean, the toggle's saved state) and `referente` (text, always nullable, never merged with any other field). `nome`/`cognome`/`azienda` keep their exact current meaning and constraints — no migration needed on them. Every place that shows the client name already produces the correct single-line entity name for free, because in ente mode `cognome`/`azienda` are always saved as `null`. `referente`, when present, is rendered as its own separate line under the name — never concatenated into one string.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Jest.

**Full design reference:** `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md`

---

### Task 1: Database migration — `is_ente` + `referente` columns

**Files:**
- Create: `supabase/migrations/20260909000001_add_ente_referente.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Ordini da enti/aziende senza un nominativo persona (es. PA, associazioni):
-- is_ente segna l'interruttore "È un ente/azienda" nel form; referente è un
-- campo indipendente e sempre facoltativo per il contatto umano, quando c'è.
-- nome/cognome/azienda non cambiano vincoli né significato.
alter table public.orders
  add column if not exists is_ente boolean not null default false,
  add column if not exists referente text;
```

- [ ] **Step 2: Note for whoever applies it**

This project applies migrations manually via the Supabase Dashboard SQL Editor (no CLI connected in dev — see CLAUDE.md). Apply this before deploying the form changes below, not necessarily before writing the code.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260909000001_add_ente_referente.sql
git commit -m "feat: add is_ente/referente columns for entity-only clients"
```

---

### Task 2: `OrderRow` type gains `is_ente`/`referente`

**Files:**
- Modify: `src/actions/orders.ts:22-59`
- Test: `src/actions/__tests__/orders.test.ts`

`createOrder`/`updateOrder` spread their whole input object into `insert`/`update` calls, so once `is_ente`/`referente` are part of the type, they flow through automatically — this task adds one test per function confirming that passthrough actually happens (guards against someone later destructuring `rest` differently and silently dropping these two fields).

- [ ] **Step 1: Write the failing tests**

Add to the `describe("createOrder", ...)` block in `src/actions/__tests__/orders.test.ts`, after the first test (`"computes cosa_ordinato/prezzo from items and inserts orders..."`):

```typescript
  it("passes is_ente and referente straight through to the orders insert", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { id: "new-id" }, error: null }],
      order_items: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await createOrder({ nome: "Comune di X", is_ente: true, referente: "Mario Rossi", items })

    const orderBuilder = client.from.mock.results[0].value
    expect(orderBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_ente: true, referente: "Mario Rossi" })
    )
  })
```

Add to the `describe("updateOrder items handling", ...)` block, after its first test:

```typescript
  it("passes is_ente and referente straight through to the orders update", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_items: [{ data: null, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const items = [{ cosa_ordinato: "Targa", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 10 }]
    await updateOrder("id1", { is_ente: true, referente: "Mario Rossi", items })

    const orderUpdateBuilder = client.from.mock.results[0].value
    expect(orderUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_ente: true, referente: "Mario Rossi" })
    )
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: FAIL with a TypeScript error — `is_ente`/`referente` aren't valid `CreateOrderInput` fields yet.

- [ ] **Step 3: Add the two fields to `OrderRow`**

Replace this line in the `OrderRow` type:

```typescript
  azienda: string | null
  telefono: string | null
```

with:

```typescript
  azienda: string | null
  is_ente: boolean
  referente: string | null
  telefono: string | null
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: PASS (all tests, including the ones untouched by this task)

- [ ] **Step 5: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/actions/orders.ts src/actions/__tests__/orders.test.ts
git commit -m "feat: add is_ente/referente to OrderRow"
```

---

### Task 3: `getOrders` search includes `referente`

**Files:**
- Modify: `src/actions/orders.ts:92-96`
- Test: `src/actions/__tests__/orders.test.ts`

- [ ] **Step 1: Update the failing tests**

In `src/actions/__tests__/orders.test.ts`, update the existing search tests (in `describe("getOrders filters", ...)`) to expect `referente` in the clause:

Replace:

```typescript
  it("searches across nome, cognome, cosa_ordinato, telefono and azienda", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "rossi" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%rossi%",cognome.ilike."%rossi%",cosa_ordinato.ilike."%rossi%",telefono.ilike."%rossi%",azienda.ilike."%rossi%"'
    )
  })
```

with:

```typescript
  it("searches across nome, cognome, cosa_ordinato, telefono, azienda and referente", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "rossi" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%rossi%",cognome.ilike."%rossi%",cosa_ordinato.ilike."%rossi%",telefono.ilike."%rossi%",azienda.ilike."%rossi%",referente.ilike."%rossi%"'
    )
  })
```

Replace:

```typescript
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%"'
    )
```

with:

```typescript
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%",referente.ilike."%Rossi, Mario%"'
    )
```

Replace:

```typescript
    expect(orArg).toContain('nome.ilike."%targa \\"VIP\\"%"')
    expect(orArg).toContain('azienda.ilike."%targa \\"VIP\\"%"')
```

with:

```typescript
    expect(orArg).toContain('nome.ilike."%targa \\"VIP\\"%"')
    expect(orArg).toContain('azienda.ilike."%targa \\"VIP\\"%"')
    expect(orArg).toContain('referente.ilike."%targa \\"VIP\\"%"')
```

Replace:

```typescript
    expect(orArg).toContain('nome.ilike."%Mario (VIP) sig.ra%"')
    expect(orArg).toContain('azienda.ilike."%Mario (VIP) sig.ra%"')
```

with:

```typescript
    expect(orArg).toContain('nome.ilike."%Mario (VIP) sig.ra%"')
    expect(orArg).toContain('azienda.ilike."%Mario (VIP) sig.ra%"')
    expect(orArg).toContain('referente.ilike."%Mario (VIP) sig.ra%"')
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: FAIL — the actual clause is still missing `referente.ilike...`

- [ ] **Step 3: Add `referente` to the search fields**

Replace this line in `getOrders`:

```typescript
      query = query.or(
        buildSearchOrClause(filters.search, ["nome", "cognome", "cosa_ordinato", "telefono", "azienda"])
      )
```

with:

```typescript
      query = query.or(
        buildSearchOrClause(filters.search, ["nome", "cognome", "cosa_ordinato", "telefono", "azienda", "referente"])
      )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: PASS (all tests in the file, including the ones untouched by this task)

- [ ] **Step 5: Commit**

```bash
git add src/actions/orders.ts src/actions/__tests__/orders.test.ts
git commit -m "feat: include referente in getOrders search"
```

---

### Task 4: `src/actions/customers.ts` — types, aggregation, search

**Files:**
- Modify: `src/actions/customers.ts`
- Test: `src/actions/__tests__/customers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `describe("getCustomers", ...)` block in `src/actions/__tests__/customers.test.ts` (after the existing `"carries azienda from each customer's most recent order..."` test):

```typescript
  it("carries is_ente and referente from each customer's most recent order", async () => {
    const rows = [
      { nome: "Comune di X", cognome: null, telefono: "0522", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-20", azienda: null, is_ente: true, referente: "Mario Rossi" },
      { nome: "Comune di X", cognome: null, telefono: "0522", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-01", azienda: null, is_ente: true, referente: "Anna Bianchi" },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const [customer] = await getCustomers()
    expect(customer.is_ente).toBe(true)
    expect(customer.referente).toBe("Mario Rossi")
  })
```

Add to the `describe("getOrdersByCustomer", ...)` block (after the existing `"selects azienda..."` test):

```typescript
  it("selects referente so the profile header can show it", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrdersByCustomer("Maria Rossi", "3331112222")

    const builder = client.from.mock.results[0].value
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining("referente")
    )
  })
```

Also update the existing `"searches across nome, cognome, telefono and azienda..."` test, since the clause now includes `referente` too — replace:

```typescript
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%"'
    )
```

with:

```typescript
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%",referente.ilike."%Rossi, Mario%"'
    )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/actions/__tests__/customers.test.ts`
Expected: FAIL — `is_ente`/`referente` not yet on `CustomerSummary`, search clause doesn't include `referente`, `getOrdersByCustomer` doesn't select it.

- [ ] **Step 3: Update the types**

Replace the `CustomerOrder` type:

```typescript
export type CustomerOrder = {
  id: string
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  email_cliente: string | null
  cosa_ordinato: string
  status: string
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  prezzo: number
  acconto: number
  saldo: number
}
```

with:

```typescript
export type CustomerOrder = {
  id: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  telefono: string | null
  email_cliente: string | null
  cosa_ordinato: string
  status: string
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  prezzo: number
  acconto: number
  saldo: number
}
```

Replace the `CustomerSummary` type:

```typescript
export type CustomerSummary = {
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  email: string | null
  consenso_marketing: boolean
  totale_ordini: number
  ultimo_ordine: string | null
}
```

with:

```typescript
export type CustomerSummary = {
  nome: string
  cognome: string | null
  azienda: string | null
  is_ente: boolean
  referente: string | null
  telefono: string | null
  email: string | null
  consenso_marketing: boolean
  totale_ordini: number
  ultimo_ordine: string | null
}
```

- [ ] **Step 4: Update `getCustomers`**

Replace the select line:

```typescript
    .select("nome, cognome, azienda, telefono, email_cliente, consenso_marketing, data_ordine")
```

with:

```typescript
    .select("nome, cognome, azienda, is_ente, referente, telefono, email_cliente, consenso_marketing, data_ordine")
```

Replace the search clause:

```typescript
  if (search) {
    query = query.or(buildSearchOrClause(search, ["nome", "cognome", "telefono", "azienda"]))
  }
```

with:

```typescript
  if (search) {
    query = query.or(buildSearchOrClause(search, ["nome", "cognome", "telefono", "azienda", "referente"]))
  }
```

Replace the map type:

```typescript
  const map = new Map<string, {
    nome: string; cognome: string | null; azienda: string | null; telefono: string | null
    email: string | null; consenso: boolean; count: number; lastDate: string | null
  }>()
```

with:

```typescript
  const map = new Map<string, {
    nome: string; cognome: string | null; azienda: string | null; isEnte: boolean; referente: string | null
    telefono: string | null; email: string | null; consenso: boolean; count: number; lastDate: string | null
  }>()
```

Replace the aggregation loop's `map.set` call:

```typescript
    if (!map.has(key)) {
      map.set(key, {
        nome: o.nome, cognome: o.cognome, azienda: o.azienda, telefono: o.telefono,
        email: o.email_cliente, consenso: false, count: 0, lastDate: null,
      })
    }
```

with:

```typescript
    if (!map.has(key)) {
      map.set(key, {
        nome: o.nome, cognome: o.cognome, azienda: o.azienda, isEnte: o.is_ente, referente: o.referente,
        telefono: o.telefono, email: o.email_cliente, consenso: false, count: 0, lastDate: null,
      })
    }
```

Replace the return mapping:

```typescript
    .map((c) => ({
      nome: c.nome,
      cognome: c.cognome,
      azienda: c.azienda,
      telefono: c.telefono,
      email: c.email,
      consenso_marketing: c.consenso,
      totale_ordini: c.count,
      ultimo_ordine: c.lastDate,
    }))
```

with:

```typescript
    .map((c) => ({
      nome: c.nome,
      cognome: c.cognome,
      azienda: c.azienda,
      is_ente: c.isEnte,
      referente: c.referente,
      telefono: c.telefono,
      email: c.email,
      consenso_marketing: c.consenso,
      totale_ordini: c.count,
      ultimo_ordine: c.lastDate,
    }))
```

- [ ] **Step 5: Update `getOrdersByCustomer`**

Replace:

```typescript
    .select("id, nome, cognome, azienda, telefono, email_cliente, cosa_ordinato, status, data_ordine, data_consegna, data_consegnato, prezzo, acconto, saldo")
```

with:

```typescript
    .select("id, nome, cognome, azienda, referente, telefono, email_cliente, cosa_ordinato, status, data_ordine, data_consegna, data_consegnato, prezzo, acconto, saldo")
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/actions/__tests__/customers.test.ts`
Expected: PASS (all tests, including the ones untouched by this task)

- [ ] **Step 7: Commit**

```bash
git add src/actions/customers.ts src/actions/__tests__/customers.test.ts
git commit -m "feat: carry is_ente/referente through getCustomers and getOrdersByCustomer"
```

---

### Task 5: Ricerca globale (`/api/search`) — select, search clause, display

**Files:**
- Modify: `src/app/api/search/route.ts`
- Modify: `src/components/SearchBar.tsx`
- Test: `src/app/api/search/__tests__/route.test.ts`

- [ ] **Step 1: Update the failing tests**

Replace in `src/app/api/search/__tests__/route.test.ts`:

```typescript
  it("includes azienda in the select so results can be labeled with it", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request("http://localhost/api/search?q=rossi")
    await GET(req)

    const builder = client.from.mock.results[0].value
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("azienda"))
  })

  it("searches across nome, cognome, cosa_ordinato, telefono and azienda with escaping", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request(`http://localhost/api/search?q=${encodeURIComponent("Rossi, Mario")}`)
    await GET(req)

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%"'
    )
  })
```

with:

```typescript
  it("includes azienda and referente in the select so results can be labeled with them", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request("http://localhost/api/search?q=rossi")
    await GET(req)

    const builder = client.from.mock.results[0].value
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("azienda"))
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("referente"))
  })

  it("searches across nome, cognome, cosa_ordinato, telefono, azienda and referente with escaping", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request(`http://localhost/api/search?q=${encodeURIComponent("Rossi, Mario")}`)
    await GET(req)

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%",referente.ilike."%Rossi, Mario%"'
    )
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/app/api/search/__tests__/route.test.ts`
Expected: FAIL — select/clause don't include `referente` yet.

- [ ] **Step 3: Update the route**

Replace:

```typescript
    const { data } = await supabase
      .from("orders")
      .select("id, cosa_ordinato, nome, cognome, azienda, status")
      .or(buildSearchOrClause(q, ["nome", "cognome", "cosa_ordinato", "telefono", "azienda"]))
```

with:

```typescript
    const { data } = await supabase
      .from("orders")
      .select("id, cosa_ordinato, nome, cognome, azienda, referente, status")
      .or(buildSearchOrClause(q, ["nome", "cognome", "cosa_ordinato", "telefono", "azienda", "referente"]))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/app/api/search/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Update `SearchBar.tsx` to show the referente line**

No test infrastructure exists for components in this codebase — verified manually in Task 14.

Replace the `SearchResult` type:

```typescript
interface SearchResult {
  orders: Array<{ id: string; cosa_ordinato: string; nome: string; cognome: string | null; azienda: string | null; status: string }>
}
```

with:

```typescript
interface SearchResult {
  orders: Array<{ id: string; cosa_ordinato: string; nome: string; cognome: string | null; azienda: string | null; referente: string | null; status: string }>
}
```

Replace the result row rendering:

```typescript
          {results!.orders.map((o) => (
            <button
              key={o.id}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted/40"
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <span className="font-medium">{o.cosa_ordinato}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {buildClientDisplayName(o.nome, o.cognome, o.azienda)}
              </span>
            </button>
          ))}
```

with:

```typescript
          {results!.orders.map((o) => (
            <button
              key={o.id}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted/40"
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <span className="font-medium">{o.cosa_ordinato}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {buildClientDisplayName(o.nome, o.cognome, o.azienda)}
              </span>
              {o.referente && (
                <span className="text-muted-foreground ml-2 text-xs">Ref. {o.referente}</span>
              )}
            </button>
          ))}
```

- [ ] **Step 6: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/api/search/route.ts src/components/SearchBar.tsx src/app/api/search/__tests__/route.test.ts
git commit -m "feat: include referente in global search results"
```

---

### Task 6: Dashboard "Oggi" — select + display

**Files:**
- Modify: `src/app/api/dashboard/today/route.ts`
- Modify: `src/components/TodayBoard.tsx`
- Test: `src/app/api/dashboard/today/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/app/api/dashboard/today/__tests__/route.test.ts`, in the `describe("GET /api/dashboard/today", ...)` block, after the existing `"includes azienda in the select..."` test:

```typescript
  it("includes referente in the select for todayOrders, deliveredToday, materialeDaOrdinare and materialeOrdinatoOggi", async () => {
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [])
    mockCreateClient.mockResolvedValue(client)

    await GET()

    const results = client.from.mock.results
    expect(results[3].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[4].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[5].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[6].value.select.mock.calls[0][0]).toContain("referente")
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: FAIL — none of the four selects include `referente` yet.

- [ ] **Step 3: Add `referente` to the four selects**

Replace:

```typescript
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, status, data_consegna")
        .eq("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda")
        .eq("data_consegnato", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda")
        .eq("materiale", "da_ordinare"),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda")
        .eq("materiale", "ordinato").eq("materiale_data_ordine", today),
```

with:

```typescript
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("data_consegnato", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("materiale", "da_ordinare"),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("materiale", "ordinato").eq("materiale_data_ordine", today),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: PASS (all tests, including the ones untouched by this task)

- [ ] **Step 5: Update `TodayBoard.tsx` types and rendering**

No test infrastructure exists for components in this codebase — verified manually in Task 14.

Replace the `TodayOrder` interface:

```typescript
interface TodayOrder {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  azienda: string | null
  status: string
  data_consegna: string | null
}
```

with:

```typescript
interface TodayOrder {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  status: string
  data_consegna: string | null
}
```

Replace the `OrderSummary` interface:

```typescript
interface OrderSummary {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  azienda: string | null
}
```

with:

```typescript
interface OrderSummary {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
}
```

Replace the `DashboardListCard` item rendering:

```typescript
            {Icon && <Icon className="w-4 h-4 text-[#3a5a2e] shrink-0" />}
            <div>
              <p className="font-semibold text-sm text-foreground">{o.cosa_ordinato}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {buildClientDisplayName(o.nome, o.cognome, o.azienda)}
              </p>
            </div>
```

with:

```typescript
            {Icon && <Icon className="w-4 h-4 text-[#3a5a2e] shrink-0" />}
            <div>
              <p className="font-semibold text-sm text-foreground">{o.cosa_ordinato}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {buildClientDisplayName(o.nome, o.cognome, o.azienda)}
              </p>
              {o.referente && (
                <p className="text-xs text-muted-foreground">Ref. {o.referente}</p>
              )}
            </div>
```

- [ ] **Step 6: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/api/dashboard/today/route.ts src/components/TodayBoard.tsx src/app/api/dashboard/today/__tests__/route.test.ts
git commit -m "feat: show referente in the Oggi dashboard lists"
```

---

### Task 7: `OrderForm.tsx` — toggle, Referente field, autocomplete

**Files:**
- Modify: `src/components/OrderForm.tsx`

No component test infrastructure exists in this codebase — verified via `tsc` and the manual check in Task 14, consistent with the same convention used for the multi-riga Articoli section.

- [ ] **Step 1: Add `isEnte`/`referenteValue` state**

Replace:

```typescript
  const [aziendaValue, setAziendaValue] = useState(order?.azienda ?? "")
```

with:

```typescript
  const [aziendaValue, setAziendaValue] = useState(order?.azienda ?? "")
  const [isEnte, setIsEnte] = useState(order?.is_ente ?? false)
  const [referenteValue, setReferenteValue] = useState(order?.referente ?? "")
```

- [ ] **Step 2: Update `fillCustomer`**

Replace:

```typescript
  function fillCustomer(c: CustomerSummary) {
    setNomeValue(c.nome)
    setCognomeValue(c.cognome ?? "")
    setAziendaValue(c.azienda ?? "")
    setTelefonoValue(c.telefono ?? "")
    setEmailValue(c.email ?? "")
    setShowSugg(false)
  }
```

with:

```typescript
  function fillCustomer(c: CustomerSummary) {
    setNomeValue(c.nome)
    setIsEnte(c.is_ente)
    setCognomeValue(c.is_ente ? "" : (c.cognome ?? ""))
    setAziendaValue(c.is_ente ? "" : (c.azienda ?? ""))
    setReferenteValue(c.is_ente ? (c.referente ?? "") : "")
    setTelefonoValue(c.telefono ?? "")
    setEmailValue(c.email ?? "")
    setShowSugg(false)
  }
```

- [ ] **Step 3: Update the suggestion dropdown rendering**

Replace:

```typescript
                    <span className="font-medium">
                      {[c.nome, c.cognome].filter(Boolean).join(" ")}
                      {c.azienda && (
                        <span className="text-muted-foreground font-normal"> — {c.azienda}</span>
                      )}
                    </span>
```

with:

```typescript
                    <span className="font-medium">
                      {c.is_ente ? c.nome : [c.nome, c.cognome].filter(Boolean).join(" ")}
                      {!c.is_ente && c.azienda && (
                        <span className="text-muted-foreground font-normal"> — {c.azienda}</span>
                      )}
                      {c.is_ente && c.referente && (
                        <span className="text-muted-foreground font-normal"> — Ref. {c.referente}</span>
                      )}
                    </span>
```

- [ ] **Step 4: Update the submit payload**

Replace:

```typescript
      nome: nomeValue.trim(),
      cognome: cognomeValue.trim() || null,
      azienda: aziendaValue.trim() || null,
```

with:

```typescript
      nome: nomeValue.trim(),
      is_ente: isEnte,
      cognome: isEnte ? null : (cognomeValue.trim() || null),
      azienda: isEnte ? null : (aziendaValue.trim() || null),
      referente: isEnte ? (referenteValue.trim() || null) : null,
```

- [ ] **Step 5: Add the toggle and Referente field, hide Cognome/Azienda when ente**

Replace this block (the Cliente section's opening, including the Nome field and the Cognome/Azienda fields):

```typescript
        <div className="grid grid-cols-3 gap-3">
          <div ref={suggRef} className="relative">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              name="nome"
              required
              value={nomeValue}
              onChange={(e) => handleNomeInput(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSugg(true) }}
              placeholder="Nome"
              autoComplete="off"
            />
            {showSugg && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => fillCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between border-b border-border last:border-0"
                  >
                    <span className="font-medium">
                      {c.is_ente ? c.nome : [c.nome, c.cognome].filter(Boolean).join(" ")}
                      {!c.is_ente && c.azienda && (
                        <span className="text-muted-foreground font-normal"> — {c.azienda}</span>
                      )}
                      {c.is_ente && c.referente && (
                        <span className="text-muted-foreground font-normal"> — Ref. {c.referente}</span>
                      )}
                    </span>
                    {c.telefono && <span className="text-muted-foreground text-xs">{c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="cognome">Cognome *</Label>
            <Input
              id="cognome"
              name="cognome"
              required
              value={cognomeValue}
              onChange={(e) => setCognomeValue(e.target.value)}
              placeholder="Cognome"
            />
          </div>
          <div>
            <Label htmlFor="azienda">Azienda</Label>
            <Input
              id="azienda"
              name="azienda"
              value={aziendaValue}
              onChange={(e) => setAziendaValue(e.target.value)}
              placeholder="Associazione, azienda... (facoltativo)"
            />
          </div>
          <div>
            <Label htmlFor="telefono">Telefono *</Label>
```

with:

```typescript
        <div className="flex items-center gap-2">
          <input
            id="is_ente"
            type="checkbox"
            checked={isEnte}
            onChange={(e) => setIsEnte(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="is_ente" className="mb-0 font-normal text-sm cursor-pointer">
            È un ente/azienda (non una persona)
          </Label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div ref={suggRef} className="relative">
            <Label htmlFor="nome">{isEnte ? "Nome ente/azienda *" : "Nome *"}</Label>
            <Input
              id="nome"
              name="nome"
              required
              value={nomeValue}
              onChange={(e) => handleNomeInput(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSugg(true) }}
              placeholder={isEnte ? "Es. Comune di X" : "Nome"}
              autoComplete="off"
            />
            {showSugg && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => fillCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between border-b border-border last:border-0"
                  >
                    <span className="font-medium">
                      {c.is_ente ? c.nome : [c.nome, c.cognome].filter(Boolean).join(" ")}
                      {!c.is_ente && c.azienda && (
                        <span className="text-muted-foreground font-normal"> — {c.azienda}</span>
                      )}
                      {c.is_ente && c.referente && (
                        <span className="text-muted-foreground font-normal"> — Ref. {c.referente}</span>
                      )}
                    </span>
                    {c.telefono && <span className="text-muted-foreground text-xs">{c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isEnte && (
            <div>
              <Label htmlFor="cognome">Cognome *</Label>
              <Input
                id="cognome"
                name="cognome"
                required
                value={cognomeValue}
                onChange={(e) => setCognomeValue(e.target.value)}
                placeholder="Cognome"
              />
            </div>
          )}
          {!isEnte && (
            <div>
              <Label htmlFor="azienda">Azienda</Label>
              <Input
                id="azienda"
                name="azienda"
                value={aziendaValue}
                onChange={(e) => setAziendaValue(e.target.value)}
                placeholder="Associazione, azienda... (facoltativo)"
              />
            </div>
          )}
          {isEnte && (
            <div>
              <Label htmlFor="referente">Referente</Label>
              <Input
                id="referente"
                name="referente"
                value={referenteValue}
                onChange={(e) => setReferenteValue(e.target.value)}
                placeholder="Facoltativo — persona di contatto"
              />
            </div>
          )}
          <div>
            <Label htmlFor="telefono">Telefono *</Label>
```

- [ ] **Step 6: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `OrderForm.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: add È un ente/azienda toggle and Referente field to OrderForm"
```

---

### Task 8: `OrderCard.tsx` — show referente under the client name

**Files:**
- Modify: `src/components/OrderCard.tsx`

- [ ] **Step 1: Wrap the client name in its own block and add the referente line**

Replace this whole block:

```typescript
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-foreground">{clientName}</p>
          <div className="flex items-center gap-1 shrink-0">
            {materialeStage(order.materiale) === "red" && <StageBadge label="da ordinare" tone="red" />}
            {materialeStage(order.materiale) === "yellow" && <StageBadge label="ordinato" tone="yellow" />}
            {order.status === "preventivo" && preventivoStage(order.preventivo) === "red" && <StageBadge label="da inviare" tone="red" />}
            {order.status === "preventivo" && preventivoStage(order.preventivo) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
            {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "red" && <StageBadge label="da fare" tone="red" />}
            {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
            <StatusBadge status={order.status} />
          </div>
        </div>
```

with:

```typescript
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-foreground">{clientName}</p>
            {order.referente && (
              <p className="text-xs text-muted-foreground">Ref. {order.referente}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {materialeStage(order.materiale) === "red" && <StageBadge label="da ordinare" tone="red" />}
            {materialeStage(order.materiale) === "yellow" && <StageBadge label="ordinato" tone="yellow" />}
            {order.status === "preventivo" && preventivoStage(order.preventivo) === "red" && <StageBadge label="da inviare" tone="red" />}
            {order.status === "preventivo" && preventivoStage(order.preventivo) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
            {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "red" && <StageBadge label="da fare" tone="red" />}
            {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
            <StatusBadge status={order.status} />
          </div>
        </div>
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `OrderCard.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/OrderCard.tsx
git commit -m "feat: show referente under the client name on order cards"
```

---

### Task 9: `KanbanBoard.tsx` — show referente under the client name

**Files:**
- Modify: `src/components/KanbanBoard.tsx`

- [ ] **Step 1: Wrap the client name and add the referente line**

Replace:

```typescript
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-foreground">{clientName}</p>
                        <div className="flex items-center gap-1 shrink-0">
```

with:

```typescript
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{clientName}</p>
                          {order.referente && (
                            <p className="text-xs text-muted-foreground">Ref. {order.referente}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `KanbanBoard.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/KanbanBoard.tsx
git commit -m "feat: show referente under the client name on the bacheca"
```

---

### Task 10: Scheda ordine — show referente under the client name

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Add the referente line under the `h1`**

Replace:

```typescript
        <div>
          <h1 className="text-xl font-bold tracking-tight">{clientName}</h1>
          <p className="text-bark font-medium">{order.cosa_ordinato}</p>
          {order.telefono && <p className="text-sm text-muted-foreground">{order.telefono}</p>}
        </div>
```

with:

```typescript
        <div>
          <h1 className="text-xl font-bold tracking-tight">{clientName}</h1>
          {order.referente && <p className="text-sm text-muted-foreground">Ref. {order.referente}</p>}
          <p className="text-bark font-medium">{order.cosa_ordinato}</p>
          {order.telefono && <p className="text-sm text-muted-foreground">{order.telefono}</p>}
        </div>
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `orders/[id]/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: show referente on the order detail page"
```

---

### Task 11: Etichetta di stampa — show referente

**Files:**
- Modify: `src/app/(print)/orders/[id]/print/PrintClient.tsx`
- Modify: `src/app/(print)/orders/[id]/print/page.tsx`

- [ ] **Step 1: Add the `referente` prop to `PrintClient`**

Replace:

```typescript
interface Props {
  orderId: string
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  dataConsegna: string | null
  saldo: number
  shopName: string
}

export function PrintClient({ orderId, nome, cognome, azienda, telefono, dataConsegna, saldo, shopName }: Props) {
```

with:

```typescript
interface Props {
  orderId: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  telefono: string | null
  dataConsegna: string | null
  saldo: number
  shopName: string
}

export function PrintClient({ orderId, nome, cognome, azienda, referente, telefono, dataConsegna, saldo, shopName }: Props) {
```

- [ ] **Step 2: Render the referente line**

Replace:

```typescript
      <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px 0" }}>{clientName}</p>
      {azienda && <p style={{ fontSize: "11px", margin: "0 0 3px 0" }}>{azienda}</p>}
      {telefono && <p style={{ margin: "0 0 3px 0" }}>{telefono}</p>}
```

with:

```typescript
      <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px 0" }}>{clientName}</p>
      {azienda && <p style={{ fontSize: "11px", margin: "0 0 3px 0" }}>{azienda}</p>}
      {referente && <p style={{ fontSize: "11px", margin: "0 0 3px 0" }}>Ref. {referente}</p>}
      {telefono && <p style={{ margin: "0 0 3px 0" }}>{telefono}</p>}
```

- [ ] **Step 3: Pass the prop from `page.tsx`**

Replace:

```typescript
      <PrintClient
        orderId={id}
        nome={order.nome}
        cognome={order.cognome}
        azienda={order.azienda}
        telefono={order.telefono}
        dataConsegna={order.data_consegna}
        saldo={order.saldo}
        shopName={shopName}
      />
```

with:

```typescript
      <PrintClient
        orderId={id}
        nome={order.nome}
        cognome={order.cognome}
        azienda={order.azienda}
        referente={order.referente}
        telefono={order.telefono}
        dataConsegna={order.data_consegna}
        saldo={order.saldo}
        shopName={shopName}
      />
```

- [ ] **Step 4: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `PrintClient.tsx` or the print `page.tsx`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(print)/orders/[id]/print/PrintClient.tsx" "src/app/(print)/orders/[id]/print/page.tsx"
git commit -m "feat: show referente on the print label"
```

---

### Task 12: Rubrica clienti — show referente

**Files:**
- Modify: `src/app/(dashboard)/customers/page.tsx`

- [ ] **Step 1: Add the referente line under the client name cell**

Replace:

```typescript
                    <td className="px-4 py-3">
                      <Link href={href} className="font-bold hover:underline">
                        {displayName}
                      </Link>
                      {c.consenso_marketing && (
                        <span className="ml-2 text-xs bg-honey text-bark px-1.5 py-0.5 rounded">
                          consenso
                        </span>
                      )}
                    </td>
```

with:

```typescript
                    <td className="px-4 py-3">
                      <Link href={href} className="font-bold hover:underline">
                        {displayName}
                      </Link>
                      {c.consenso_marketing && (
                        <span className="ml-2 text-xs bg-honey text-bark px-1.5 py-0.5 rounded">
                          consenso
                        </span>
                      )}
                      {c.referente && (
                        <p className="text-xs text-muted-foreground mt-0.5">Ref. {c.referente}</p>
                      )}
                    </td>
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `customers/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/customers/page.tsx"
git commit -m "feat: show referente in the rubrica clienti"
```

---

### Task 13: Profilo cliente — show referente

**Files:**
- Modify: `src/app/(dashboard)/customers/profilo/page.tsx`

- [ ] **Step 1: Read `referente` from the first order**

Replace:

```typescript
  const firstOrder = orders[0]
  const email = firstOrder?.email_cliente
  const telefono = tel ?? firstOrder?.telefono
  const displayName = firstOrder
    ? buildClientDisplayName(firstOrder.nome, firstOrder.cognome, firstOrder.azienda)
    : nome
```

with:

```typescript
  const firstOrder = orders[0]
  const email = firstOrder?.email_cliente
  const telefono = tel ?? firstOrder?.telefono
  const referente = firstOrder?.referente
  const displayName = firstOrder
    ? buildClientDisplayName(firstOrder.nome, firstOrder.cognome, firstOrder.azienda)
    : nome
```

- [ ] **Step 2: Render the referente line under the header**

Replace:

```typescript
      <div>
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <div className="flex flex-col gap-0.5 mt-1">
          {telefono && <p className="text-sm text-muted-foreground">{telefono}</p>}
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>
      </div>
```

with:

```typescript
      <div>
        <h1 className="text-2xl font-bold">{displayName}</h1>
        {referente && <p className="text-sm text-muted-foreground">Ref. {referente}</p>}
        <div className="flex flex-col gap-0.5 mt-1">
          {telefono && <p className="text-sm text-muted-foreground">{telefono}</p>}
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>
      </div>
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `customers/profilo/page.tsx`

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/customers/profilo/page.tsx"
git commit -m "feat: show referente on the customer profile page"
```

---

### Task 14: Full verification and CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full unit test suite**

Run: `npx jest --roots=src`
Expected: PASS, all suites green. Note the new total suite/test count in the output for Step 4. (Use `--roots=src`, not plain `npx jest src` — this repo can have nested worktrees under `.claude/worktrees/` that plain `src` picks up too; see CLAUDE.md Testing section.)

- [ ] **Step 2: Run the type checker on the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual golden-path check in the dev server**

Run: `npm run dev`, then in the browser:
1. Go to `/orders/new`, fill in Telefono/Data consegna/Operatore.
2. Check "È un ente/azienda" — confirm Cognome and Azienda disappear, "Nome" becomes "Nome ente/azienda", and a "Referente" field appears.
3. Type "Comune di X" in Nome ente/azienda, "Mario Rossi" in Referente. Fill an articolo, save.
4. On the order detail page, confirm you see "Comune di X" as the title, "Ref. Mario Rossi" on its own line right below, and the rest of the order unchanged.
5. Go to `/orders` (list) and `/kanban` — confirm the card shows "Comune di X" and "Ref. Mario Rossi" on two separate lines, never joined into one string.
6. Print the label (`/orders/<id>/print`) — confirm the referente line appears under the entity name.
7. Go to `/customers` — confirm the rubrica row shows the referente line; open the profile — confirm it shows there too.
8. Search "Mario Rossi" in the global search bar (top nav) — confirm this order appears.
9. Click "Modifica" on the order — confirm the toggle is already checked and Nome ente/Referente are pre-filled correctly.
10. Uncheck "È un ente/azienda" on a **different**, brand-new order — confirm Nome/Cognome/Azienda behave exactly as before (no regression for private customers).
11. Stop the dev server (Ctrl+C).

- [ ] **Step 4: Update CLAUDE.md**

Add this row to the "Decisioni chiave e motivazioni" table, after the row about "Ordini multi-riga" (the last row in the table):

```markdown
| Clienti ente/azienda con referente: nuove colonne `orders.is_ente`/`orders.referente` (2026-09-09) | Alcuni ordini arrivano da aziende/PA, non da una persona — il modello nome/cognome obbligatori non li rappresentava. Interruttore "È un ente/azienda" nel form: relabela "Nome" a "Nome ente/azienda" (resta obbligatorio, nessuna modifica al vincolo NOT NULL esistente), nasconde Cognome/Azienda, mostra "Referente" (sempre facoltativo, indipendente — mai concatenato con nome/azienda in una stringa unica, mostrato sempre su una riga separata ovunque compare il nome cliente). `is_ente` è un flag esplicito salvato con l'ordine perché lo stesso dato (nome+azienda) sarebbe altrimenti ambiguo tra "persona che lavora per un'azienda" (ordine esistente, azienda dopo il nome) ed "ente con referente" (ordine davanti, referente dopo) — non deducibile a posteriori. `buildClientDisplayName` non ha richiesto modifiche: in modalità ente cognome/azienda restano sempre null, quindi la funzione esistente produce già da sola solo il nome dell'ente. Vedere `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md` |
```

Then update the Testing section: replace the current suite/test count sentence (`**Stato al 2026-08-29**: 16 suite / 129 test ...`) with the new count from Step 1's output (same sentence structure, just the updated numbers and today's date), and add a new bullet after the "Feature (2026-08-29/30): ordini multi-riga" bullet:

```markdown
- **Feature (2026-09-09)**: clienti ente/azienda con referente — vedere riga corrispondente in Decisioni chiave. Nuove colonne `orders.is_ente`/`orders.referente` (migration `20260909000001_add_ente_referente.sql`). `getOrders`/`getCustomers`/`/api/search` includono `referente` nella ricerca (nuovi test); `getCustomers`/`getOrdersByCustomer` includono `is_ente`/`referente` nella select e nell'aggregazione clienti (nuovi test). `OrderForm.tsx` guadagna l'interruttore "È un ente/azienda" (Nome→"Nome ente/azienda", Cognome/Azienda nascosti, campo "Referente" facoltativo); `fillCustomer`/autocomplete adattati. Referente mostrato su una riga separata in card ordini, bacheca, scheda ordine, etichetta di stampa, rubrica clienti, profilo cliente, dashboard "Oggi" e ricerca globale — mai unito al nome in una sola stringa. Design in `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md`, piano in `docs/superpowers/plans/2026-09-09-clienti-ente-referente-plan.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document clienti ente/azienda con referente in CLAUDE.md"
```
