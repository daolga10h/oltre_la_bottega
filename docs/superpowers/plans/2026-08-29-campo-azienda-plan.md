# Campo Azienda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un campo facoltativo "Azienda" agli ordini, visibile sempre accanto al nome cliente (card, bacheca, scheda ordine, etichetta di stampa) e incluso nella ricerca e nella rubrica clienti.

**Architecture:** Nuova colonna nullable `orders.azienda`. Due helper condivisi in `src/lib`: `buildSearchOrClause` (query PostgREST `.or()` con escaping anti filter-injection, riusato nei 3 punti di ricerca) e `buildClientDisplayName` (formato "Nome Cognome — Azienda", riusato nei 4 punti dove oggi è duplicato `[nome, cognome].filter(Boolean).join(" ")`). Il resto sono modifiche puntuali per propagare il campo attraverso form, azioni e pagine già esistenti.

**Tech Stack:** Next.js (Server Actions, Route Handlers), Supabase/PostgREST, Jest.

Spec di riferimento: `docs/superpowers/specs/2026-08-29-campo-azienda-design.md`

---

### Task 1: Migration — colonna `azienda`

**Files:**
- Create: `supabase/migrations/20260829000001_add_azienda.sql`

- [ ] **Step 1: Scrivi la migration**

```sql
-- Add azienda column (ragione sociale facoltativa, per clienti che sono associazioni/aziende)
alter table public.orders
  add column if not exists azienda text;
```

- [ ] **Step 2: Applica la migration**

Run: `supabase db push`
Expected: la migration viene applicata senza errori (stesso comando già usato per `20260714000001_add_operatore.sql`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260829000001_add_azienda.sql
git commit -m "feat: aggiunge colonna azienda a orders"
```

---

### Task 2: Helper `buildSearchOrClause` (ricerca con escaping condiviso)

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/__tests__/search.test.ts`

Estrae in un helper condiviso la logica di escaping anti filter-injection già presente in `getOrders` (`src/actions/orders.ts:75-84`), così i 3 punti di ricerca (ordini, clienti, barra globale) usano lo stesso codice invece di duplicare la regex.

- [ ] **Step 1: Scrivi i test**

```typescript
import { buildSearchOrClause } from "../search"

describe("buildSearchOrClause", () => {
  it("builds an ilike clause per field, wrapping the term in double quotes", () => {
    expect(buildSearchOrClause("rossi", ["nome", "cognome"])).toBe(
      'nome.ilike."%rossi%",cognome.ilike."%rossi%"'
    )
  })

  it("quotes a term containing a comma so it is treated as one literal value, not split into extra clauses", () => {
    expect(buildSearchOrClause("Rossi, Mario", ["nome"])).toBe(
      'nome.ilike."%Rossi, Mario%"'
    )
  })

  it("escapes double quotes and backslashes inside the term", () => {
    expect(buildSearchOrClause('targa "VIP"', ["nome"])).toBe(
      'nome.ilike."%targa \\"VIP\\"%"'
    )
  })

  it("protects parentheses and periods in the term from PostgREST's .or() grouping syntax", () => {
    expect(buildSearchOrClause("Mario (VIP) sig.ra", ["nome"])).toBe(
      'nome.ilike."%Mario (VIP) sig.ra%"'
    )
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx jest src/lib/__tests__/search.test.ts`
Expected: FAIL — `Cannot find module '../search'`

- [ ] **Step 3: Implementa l'helper**

```typescript
/**
 * Costruisce la parte destra di una `.or()` PostgREST che cerca `term` (case
 * insensitive, sottostringa) su più colonne. PostgREST usa "," e "()" come
 * delimitatori dentro `.or()`, quindi il termine va racchiuso tra doppi apici
 * (con backslash/apici interni escapati) per essere trattato come valore letterale.
 */
export function buildSearchOrClause(term: string, fields: string[]): string {
  const escaped = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const quoted = `"%${escaped}%"`
  return fields.map((field) => `${field}.ilike.${quoted}`).join(",")
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx jest src/lib/__tests__/search.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/__tests__/search.test.ts
git commit -m "feat: estrae buildSearchOrClause per la ricerca con escaping condiviso"
```

---

### Task 3: Helper `buildClientDisplayName`

**Files:**
- Modify: `src/lib/utils.ts`
- Test: `src/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Scrivi i test**

```typescript
import { buildClientDisplayName } from "../utils"

describe("buildClientDisplayName", () => {
  it("joins nome and cognome with a space", () => {
    expect(buildClientDisplayName("Mario", "Rossi")).toBe("Mario Rossi")
  })

  it("omits cognome when absent", () => {
    expect(buildClientDisplayName("Mario", null)).toBe("Mario")
  })

  it("appends azienda after an em dash when present", () => {
    expect(buildClientDisplayName("Mario", "Rossi", "ASD Calcio Torino")).toBe(
      "Mario Rossi — ASD Calcio Torino"
    )
  })

  it("omits the azienda suffix when azienda is null or empty", () => {
    expect(buildClientDisplayName("Mario", "Rossi", null)).toBe("Mario Rossi")
    expect(buildClientDisplayName("Mario", "Rossi", "")).toBe("Mario Rossi")
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx jest src/lib/__tests__/utils.test.ts`
Expected: FAIL — `buildClientDisplayName` non esiste

- [ ] **Step 3: Implementa l'helper**

Aggiungi in fondo a `src/lib/utils.ts`:

```typescript
/** Costruisce il nome cliente mostrato in card, bacheca, scheda ordine ed etichetta. */
export function buildClientDisplayName(
  nome: string,
  cognome: string | null,
  azienda?: string | null
): string {
  const name = [nome, cognome].filter(Boolean).join(" ")
  return azienda ? `${name} — ${azienda}` : name
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx jest src/lib/__tests__/utils.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts
git commit -m "feat: aggiunge buildClientDisplayName condiviso"
```

---

### Task 4: `getOrders` — azienda nel tipo e nella ricerca

**Files:**
- Modify: `src/actions/orders.ts:12-48` (tipo `OrderRow`), `src/actions/orders.ts:75-84` (ricerca)
- Test: `src/actions/__tests__/orders.test.ts:51-98`

- [ ] **Step 1: Aggiorna i test esistenti per includere azienda**

In `src/actions/__tests__/orders.test.ts`, sostituisci le 4 asserzioni sulla stringa `.or()` (righe 59, 73-75, 86, 97) per includere `azienda`:

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

  it("quotes a search term containing a comma so it is treated as one literal value, not split into extra clauses", async () => {
    // A customer typing "Rossi, Mario" (or a pasted "cosa ordinato" with a comma)
    // must not be split by PostgREST's .or() comma delimiter — the whole term
    // is wrapped in double quotes to keep it as a single literal value.
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "Rossi, Mario" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%"'
    )
  })

  it("escapes double quotes and backslashes inside the search term", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: 'targa "VIP"' })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toContain('nome.ilike."%targa \\"VIP\\"%"')
    expect(orArg).toContain('azienda.ilike."%targa \\"VIP\\"%"')
  })

  it("also protects parentheses and periods in the search term from PostgREST's .or() grouping syntax", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "Mario (VIP) sig.ra" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toContain('nome.ilike."%Mario (VIP) sig.ra%"')
    expect(orArg).toContain('azienda.ilike."%Mario (VIP) sig.ra%"')
  })
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: FAIL sulle 4 asserzioni appena aggiornate (l'attuale `.or()` non include `azienda`)

- [ ] **Step 3: Aggiorna il tipo `OrderRow`**

In `src/actions/orders.ts`, dentro `OrderRow` (dopo `cognome: string | null` a riga 15):

```typescript
  cognome: string | null
  azienda: string | null
```

- [ ] **Step 4: Aggiorna la ricerca per usare l'helper condiviso**

In `src/actions/orders.ts`, aggiungi l'import in cima al file:

```typescript
import { buildSearchOrClause } from "@/lib/search"
```

Sostituisci il blocco di ricerca (righe 75-84):

```typescript
    if (filters?.search) {
      query = query.or(
        buildSearchOrClause(filters.search, ["nome", "cognome", "cosa_ordinato", "telefono", "azienda"])
      )
    }
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npx jest src/actions/__tests__/orders.test.ts`
Expected: PASS (tutti i test del file)

- [ ] **Step 6: Commit**

```bash
git add src/actions/orders.ts src/actions/__tests__/orders.test.ts
git commit -m "feat: include azienda in OrderRow e nella ricerca ordini"
```

---

### Task 5: `getCustomers` — azienda, ricerca ed escaping

**Files:**
- Modify: `src/actions/customers.ts:1-78`
- Test: `src/actions/__tests__/customers.test.ts`

`getCustomers` non ha oggi l'escaping anti filter-injection applicato a `getOrders` — lo aggiungiamo qui contestualmente, riusando lo stesso `buildSearchOrClause` del Task 2 (vedi spec, sezione Ricerca).

- [ ] **Step 1: Scrivi i test (ricerca + escaping + azienda in aggregazione)**

Aggiungi in `src/actions/__tests__/customers.test.ts`, dentro `describe("getCustomers", ...)`:

```typescript
  it("searches across nome, cognome, telefono and azienda with the shared escaping helper", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getCustomers("Rossi, Mario")

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%"'
    )
  })

  it("carries azienda from each customer's most recent order", async () => {
    const rows = [
      { nome: "Maria", cognome: "Rossi", telefono: "333", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-20", azienda: "ASD Calcio Torino" },
      { nome: "Maria", cognome: "Rossi", telefono: "333", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-01", azienda: null },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const [customer] = await getCustomers()
    expect(customer.azienda).toBe("ASD Calcio Torino")
  })
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx jest src/actions/__tests__/customers.test.ts`
Expected: FAIL — `getCustomers` non cerca ancora tramite `.or()` con escaping, `customer.azienda` è `undefined`

- [ ] **Step 3: Aggiorna i tipi**

In `src/actions/customers.ts`, dentro `CustomerOrder` (dopo riga 8) e `CustomerSummary` (dopo riga 23):

```typescript
export type CustomerOrder = {
  id: string
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  ...
```

```typescript
export type CustomerSummary = {
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  ...
```

- [ ] **Step 4: Aggiorna `getCustomers`**

Aggiungi l'import in cima al file:

```typescript
import { buildSearchOrClause } from "@/lib/search"
```

Sostituisci il corpo di `getCustomers` (righe 31-78):

```typescript
export async function getCustomers(search?: string): Promise<CustomerSummary[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("orders")
    .select("nome, cognome, azienda, telefono, email_cliente, consenso_marketing, data_ordine")
    .order("data_ordine", { ascending: false })

  if (search) {
    query = query.or(buildSearchOrClause(search, ["nome", "cognome", "telefono", "azienda"]))
  }

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, {
    nome: string; cognome: string | null; azienda: string | null; telefono: string | null
    email: string | null; consenso: boolean; count: number; lastDate: string | null
  }>()

  for (const o of data ?? []) {
    const key = o.telefono?.trim() || `${o.nome}|${o.cognome ?? ""}`
    if (!map.has(key)) {
      map.set(key, {
        nome: o.nome, cognome: o.cognome, azienda: o.azienda, telefono: o.telefono,
        email: o.email_cliente, consenso: false, count: 0, lastDate: null,
      })
    }
    const c = map.get(key)!
    c.count++
    if (!c.lastDate || (o.data_ordine && o.data_ordine > c.lastDate)) c.lastDate = o.data_ordine
    if (o.consenso_marketing) c.consenso = true
  }

  return Array.from(map.values())
    .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""))
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
}
```

Nota: `map.set` avviene solo al primo incontro della chiave (righe di query ordinate per `data_ordine desc`), quindi `azienda` riflette lo stesso ordine — il più recente — da cui provengono già `nome`/`cognome`/`telefono`/`email`. Nessun cambiamento alla logica di aggregazione oltre ad aggiungere il campo.

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npx jest src/actions/__tests__/customers.test.ts`
Expected: PASS (tutti i test del file)

- [ ] **Step 6: Commit**

```bash
git add src/actions/customers.ts src/actions/__tests__/customers.test.ts
git commit -m "feat: include azienda in getCustomers, con escaping anti filter-injection sulla ricerca"
```

---

### Task 6: `getOrdersByCustomer` — azienda nel select

**Files:**
- Modify: `src/actions/customers.ts` (funzione `getOrdersByCustomer`, riga ~85)
- Test: `src/actions/__tests__/customers.test.ts`

- [ ] **Step 1: Scrivi il test**

Aggiungi in `src/actions/__tests__/customers.test.ts`, dentro `describe("getOrdersByCustomer", ...)`:

```typescript
  it("selects azienda so the profile header can show it", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrdersByCustomer("Maria Rossi", "3331112222")

    const builder = client.from.mock.results[0].value
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining("azienda")
    )
  })
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/actions/__tests__/customers.test.ts`
Expected: FAIL — il select attuale non contiene `azienda`

- [ ] **Step 3: Aggiorna il select**

In `src/actions/customers.ts`, dentro `getOrdersByCustomer`:

```typescript
    .select("id, nome, cognome, azienda, telefono, email_cliente, cosa_ordinato, status, data_ordine, data_consegna, data_consegnato, prezzo, acconto, saldo")
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/actions/__tests__/customers.test.ts`
Expected: PASS (tutti i test del file)

- [ ] **Step 5: Commit**

```bash
git add src/actions/customers.ts src/actions/__tests__/customers.test.ts
git commit -m "feat: include azienda nel select di getOrdersByCustomer"
```

---

### Task 7: `/api/search` — azienda ed escaping

**Files:**
- Modify: `src/app/api/search/route.ts`
- Test: `src/app/api/search/__tests__/route.test.ts` (nuovo)

Come `getCustomers`, anche questa route non ha l'escaping anti filter-injection — applicato contestualmente all'aggiunta di azienda (vedi spec).

- [ ] **Step 1: Scrivi il test**

```typescript
import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

import { GET } from "../route"

describe("GET /api/search", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns an empty list when the query is missing or shorter than 2 chars", async () => {
    const req = new Request("http://localhost/api/search?q=a")
    const res = await GET(req)
    const body = await res.json()
    expect(body).toEqual({ orders: [] })
  })

  it("returns an empty list when there is no authenticated user", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] }, { user: null })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request("http://localhost/api/search?q=rossi")
    const res = await GET(req)
    const body = await res.json()
    expect(body).toEqual({ orders: [] })
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
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/app/api/search/__tests__/route.test.ts`
Expected: FAIL sull'ultimo test (`.or()` non contiene ancora azienda/escaping)

- [ ] **Step 3: Aggiorna la route**

Sostituisci `src/app/api/search/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { buildSearchOrClause } from "@/lib/search"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ orders: [] })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ orders: [] })

    const { data } = await supabase
      .from("orders")
      .select("id, cosa_ordinato, nome, cognome, status")
      .or(buildSearchOrClause(q, ["nome", "cognome", "cosa_ordinato", "telefono", "azienda"]))
      .not("status", "eq", "consegnato")
      .limit(8)

    return NextResponse.json({ orders: data ?? [] })
  } catch (error) {
    logError("search", error, { q })
    return NextResponse.json({ orders: [] })
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/app/api/search/__tests__/route.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/search/route.ts src/app/api/search/__tests__/route.test.ts
git commit -m "feat: include azienda in /api/search, con escaping anti filter-injection"
```

---

### Task 8: Form ordine — campo Azienda

**Files:**
- Modify: `src/components/OrderForm.tsx`

Nessun test automatico esiste oggi per `OrderForm.tsx` (componente client con `useState`/DOM) — verifica manuale nel Task 11.

- [ ] **Step 1: Aggiungi lo stato controllato**

In `src/components/OrderForm.tsx`, dopo la riga 65 (`const [cognomeValue, setCognomeValue] = useState(order?.cognome ?? "")`):

```typescript
  const [cognomeValue, setCognomeValue] = useState(order?.cognome ?? "")
  const [aziendaValue, setAziendaValue] = useState(order?.azienda ?? "")
```

(`OrderRow.azienda` è già stato aggiunto al Task 4, eseguito prima di questo.)

- [ ] **Step 2: Includi azienda nel filtro autocomplete**

Sostituisci `handleNomeInput` (righe 83-93):

```typescript
  function handleNomeInput(value: string) {
    setNomeValue(value)
    if (value.length < 2) { setShowSugg(false); return }
    const v = value.toLowerCase()
    const matches = allCustomers.filter((c) =>
      `${c.nome} ${c.cognome ?? ""}`.toLowerCase().includes(v) ||
      (c.azienda ?? "").toLowerCase().includes(v) ||
      (c.telefono ?? "").includes(value)
    ).slice(0, 6)
    setSuggestions(matches)
    setShowSugg(matches.length > 0)
  }
```

- [ ] **Step 3: Precompila azienda dal suggerimento selezionato**

Sostituisci `fillCustomer` (righe 95-101):

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

(`CustomerSummary.azienda` è già stato aggiunto al Task 5, eseguito prima di questo.)

- [ ] **Step 4: Mostra azienda nel dropdown suggerimenti**

Sostituisci il contenuto del `<button>` nel dropdown (righe 204-214):

```typescript
                {suggestions.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => fillCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between border-b border-border last:border-0"
                  >
                    <span className="font-medium">
                      {[c.nome, c.cognome].filter(Boolean).join(" ")}
                      {c.azienda && (
                        <span className="text-muted-foreground font-normal"> — {c.azienda}</span>
                      )}
                    </span>
                    {c.telefono && <span className="text-muted-foreground text-xs">{c.telefono}</span>}
                  </button>
                ))}
```

- [ ] **Step 5: Includi azienda nel payload di salvataggio**

In `handleSubmit`, dopo `cognome: cognomeValue.trim() || null,` (riga 136):

```typescript
      nome: nomeValue.trim(),
      cognome: cognomeValue.trim() || null,
      azienda: aziendaValue.trim() || null,
```

- [ ] **Step 6: Aggiungi il campo nel form (sezione Cliente)**

In `src/components/OrderForm.tsx`, dentro il `<div className="grid grid-cols-3 gap-3">` della sezione Cliente, subito dopo il blocco `Cognome` (dopo riga 228, prima del blocco `Telefono`):

```typescript
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
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 8: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: aggiunge campo Azienda al form ordine, incluso nell'autocomplete"
```

---

### Task 9: Card, bacheca e scheda ordine — nome visualizzato con azienda

**Files:**
- Modify: `src/components/OrderCard.tsx:51-53`
- Modify: `src/components/KanbanBoard.tsx:58-60`
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx:64` (uso a riga 113)

- [ ] **Step 1: `OrderCard.tsx`**

Aggiungi l'import in cima al file:

```typescript
import { cn, formatDate, formatEUR, isOverdue, buildClientDisplayName } from "@/lib/utils"
```

Sostituisci riga 53:

```typescript
  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)
```

- [ ] **Step 2: `KanbanBoard.tsx`**

Aggiungi l'import in cima al file:

```typescript
import { formatDate, cn, buildClientDisplayName } from "@/lib/utils"
```

Sostituisci righe 58-60:

```typescript
                  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)
```

- [ ] **Step 3: Scheda ordine**

Aggiungi l'import in `src/app/(dashboard)/orders/[id]/page.tsx`:

```typescript
import { formatDate, formatEUR, buildWhatsAppLink, buildMailtoLink, buildClientDisplayName } from "@/lib/utils"
```

Sostituisci riga 64:

```typescript
  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 5: Commit**

```bash
git add src/components/OrderCard.tsx src/components/KanbanBoard.tsx "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: mostra azienda accanto al nome in card, bacheca e scheda ordine"
```

---

### Task 10: Etichetta di stampa — riga azienda

**Files:**
- Modify: `src/app/(print)/orders/[id]/print/page.tsx`
- Modify: `src/app/(print)/orders/[id]/print/PrintClient.tsx`

- [ ] **Step 1: Passa `azienda` come prop dalla pagina**

In `src/app/(print)/orders/[id]/print/page.tsx`, aggiungi la prop dopo `cognome={order.cognome}`:

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

- [ ] **Step 2: Accetta la prop e mostra la riga in `PrintClient.tsx`**

Aggiorna l'interfaccia `Props`:

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
```

Aggiorna la firma della funzione:

```typescript
export function PrintClient({ orderId, nome, cognome, azienda, telefono, dataConsegna, saldo, shopName }: Props) {
```

Aggiungi la riga azienda subito dopo il nome (dopo `<p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px 0" }}>{clientName}</p>`), prima del telefono:

```typescript
      <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px 0" }}>{clientName}</p>
      {azienda && <p style={{ fontSize: "11px", margin: "0 0 3px 0" }}>{azienda}</p>}
      {telefono && <p style={{ margin: "0 0 3px 0" }}>{telefono}</p>}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Verifica manuale**

Run: `npm run dev`, apri `/orders/<id>/print` per un ordine con azienda valorizzata (impostala prima da `/orders/<id>/edit`).
Expected: sotto il nome, in corpo più piccolo, compare il nome azienda; senza andare a capo dentro il nome cliente.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(print)/orders/[id]/print/page.tsx" "src/app/(print)/orders/[id]/print/PrintClient.tsx"
git commit -m "feat: mostra azienda sull'etichetta di stampa"
```

---

### Task 11: Rubrica clienti — azienda in lista e profilo

**Files:**
- Modify: `src/app/(dashboard)/customers/page.tsx:79-88`
- Modify: `src/app/(dashboard)/customers/profilo/page.tsx:11-34`

- [ ] **Step 1: Lista clienti**

In `src/app/(dashboard)/customers/page.tsx`, aggiungi l'import:

```typescript
import { formatDate, buildClientDisplayName } from "@/lib/utils"
```

Sostituisci righe 78-88 (dentro `customers.map`):

```typescript
              {customers.map((c, i) => {
                const fullName = [c.nome, c.cognome].filter(Boolean).join(" ")
                const displayName = buildClientDisplayName(c.nome, c.cognome, c.azienda)
                const href =
                  `/customers/profilo?nome=${encodeURIComponent(fullName)}` +
                  (c.telefono ? `&tel=${encodeURIComponent(c.telefono)}` : "")
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={href} className="font-bold hover:underline">
                        {displayName}
                      </Link>
```

Nota: `fullName` (solo nome+cognome) resta usato per l'URL — è la chiave di ricerca passata a `getOrdersByCustomer`, non cambia. `displayName` (con azienda) è solo per il testo mostrato nel link.

- [ ] **Step 2: Profilo cliente**

In `src/app/(dashboard)/customers/profilo/page.tsx`, aggiungi l'import:

```typescript
import { formatDate, formatEUR, buildClientDisplayName } from "@/lib/utils"
```

Sostituisci il blocco dell'header (righe 15-35):

```typescript
  const firstOrder = orders[0]
  const email = firstOrder?.email_cliente
  const telefono = tel ?? firstOrder?.telefono
  const displayName = firstOrder
    ? buildClientDisplayName(firstOrder.nome, firstOrder.cognome, firstOrder.azienda)
    : nome
  const totalSpeso = orders.reduce((sum, o) => sum + (o.prezzo ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3 h-3" />Clienti
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <div className="flex flex-col gap-0.5 mt-1">
          {telefono && <p className="text-sm text-muted-foreground">{telefono}</p>}
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>
      </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Verifica manuale**

Run: `npm run dev`. Crea/modifica un ordine con Azienda valorizzata, poi apri `/customers` e `/customers/profilo?...`.
Expected: entrambe le pagine mostrano "Nome Cognome — Azienda".

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/customers/page.tsx" "src/app/(dashboard)/customers/profilo/page.tsx"
git commit -m "feat: mostra azienda in rubrica clienti e profilo"
```

---

### Task 12: Verifica finale

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: tutte le suite verdi (nessuna regressione sulle 17 suite/160 test esistenti, più le nuove aggiunte in questo piano)

- [ ] **Step 2: Type-check completo**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: nessun errore

- [ ] **Step 4: Verifica manuale end-to-end**

Run: `npm run dev`. Crea un ordine nuovo con Azienda valorizzata → verifica che compaia nella card lista ordini, in bacheca, nella scheda ordine, sull'etichetta di stampa e nella rubrica clienti (lista + profilo). Verifica anche che un ordine SENZA azienda non mostri mai "— " residuo in nessuno di questi punti.

- [ ] **Step 5: Aggiorna CLAUDE.md**

Aggiungi una riga nella tabella "Decisioni chiave e motivazioni" di `CLAUDE.md` che documenti il campo Azienda (facoltativo, sempre visibile accanto al nome, motivazione: clienti che sono associazioni/aziende). Aggiorna anche la sezione Testing con il nuovo conteggio suite/test.

```bash
git add CLAUDE.md
git commit -m "docs: documenta il campo Azienda in CLAUDE.md"
```
