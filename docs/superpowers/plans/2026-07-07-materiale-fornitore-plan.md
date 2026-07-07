# Materiale da ordinare dal fornitore — Piano di implementazione

> **Per chi esegue in autonomia:** SOTTO-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire questo piano un task alla volta. I passi usano la sintassi checkbox (`- [ ]`) per il tracciamento.

**Obiettivo:** Tracciare, per ogni ordine, se serve ordinare del materiale a un fornitore prima di poter iniziare la lavorazione — un sottostato indipendente dallo `status` principale, visibile come badge sulle card ordine e come due sezioni azionabili nella dashboard "Oggi".

**Architettura:** Stesso pattern già usato per `preventivo`/`bozza_grafica`: una colonna di testo (sottostato) su `orders` (`non_serve | da_ordinare | ordinato | arrivato`) più due colonne di testo libero e una colonna data, una server action dedicata con bottoni rapidi nella scheda ordine, e due query aggiuntive nella route `/api/dashboard/today` già esistente.

**Stack tecnico:** Next.js Server Actions, Supabase (Postgres), Jest + ts-jest per i test unitari.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-07-materiale-fornitore-design.md`

---

### Task 1: Migration database

**File:**
- Crea: `supabase/migrations/20260707000001_add_materiale_fornitore.sql`

- [ ] **Passo 1: Scrivi il file di migration**

```sql
-- Add materiale fornitore sub-status columns
alter table public.orders
  add column if not exists materiale text default 'non_serve',
  add column if not exists materiale_fornitore text,
  add column if not exists materiale_cosa_manca text,
  add column if not exists materiale_data_ordine date;

alter table public.orders drop constraint if exists orders_materiale_check;
alter table public.orders add constraint orders_materiale_check
  check (materiale in ('non_serve','da_ordinare','ordinato','arrivato'));
```

- [ ] **Passo 2: Applica la migration**

Questo tocca il progetto Supabase reale (lo stesso usato dal test E2E e
potenzialmente da produzione — vedi la sezione Testing di `CLAUDE.md`). Non
eseguirla automaticamente. Segnala all'utente che il file è pronto e chiedi
di eseguire tu stesso, quando sei pronto:

```bash
supabase db push
```

oppure applicala dal SQL editor della Dashboard Supabase. Aspetta conferma
che sia applicata prima di affidarti alle nuove colonne nei passi di
verifica manuale successivi (i test unitari dei prossimi task mockano
Supabase e non hanno bisogno che la colonna esista davvero).

- [ ] **Passo 3: Commit del file di migration**

```bash
git add supabase/migrations/20260707000001_add_materiale_fornitore.sql
git commit -m "feat: aggiungi colonne materiale fornitore a orders"
```

---

### Task 2: Server action `updateMaterialeFornitore`

**File:**
- Modifica: `src/actions/orders.ts`
- Test: `src/actions/__tests__/orders.test.ts`

- [ ] **Passo 1: Aggiungi i nuovi campi a `OrderRow` e scrivi i test che falliscono**

In `src/actions/orders.ts`, modifica il tipo `OrderRow` (intorno alle righe 26-28):

```typescript
  bozza_grafica: string
  preventivo: string
  materiale: string
  materiale_fornitore: string | null
  materiale_cosa_manca: string | null
  materiale_data_ordine: string | null
  dettagli_grafici: string | null
```
(sostituisce il blocco esistente `bozza_grafica: string` / `preventivo: string` /
`dettagli_grafici: string | null` — vengono inserite solo 3 righe nuove tra
`preventivo` e `dettagli_grafici`.)

In `src/actions/__tests__/orders.test.ts`, aggiorna la riga di import in cima al file:

```typescript
import { getOrders, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, createOrder } from "../orders"
```

Poi aggiungi questo nuovo blocco `describe` subito dopo la chiusura del
blocco `describe("updatePreventivo", ...)` (riga 238, prima di
`describe("createOrder", ...)`):

```typescript
describe("updateMaterialeFornitore", () => {
  afterEach(() => jest.clearAllMocks())

  it("stamps materiale_data_ordine with today's date only when moving to ordinato", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-07T10:00:00Z"))
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterialeFornitore("id1", "ordinato")

    const builder = client.from.mock.results[0].value
    const updatePayload = builder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ materiale: "ordinato", materiale_data_ordine: "2026-07-07" })

    jest.useRealTimers()
  })

  it("does not touch materiale_data_ordine for da_ordinare", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterialeFornitore("id1", "da_ordinare")

    const builder = client.from.mock.results[0].value
    const updatePayload = builder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ materiale: "da_ordinare" })
  })

  it("advances status to in_lavorazione when materiale arrives and the order was da_fare", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { status: "da_fare" }, error: null }, { data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterialeFornitore("id1", "arrivato")

    const updateBuilder = client.from.mock.results[1].value
    const updatePayload = updateBuilder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ materiale: "arrivato", status: "in_lavorazione" })
  })

  it("does not advance status when materiale arrives but the order is still waiting on preventivo/bozza approval", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { status: "bozza_grafica" }, error: null }, { data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterialeFornitore("id1", "arrivato")

    const updateBuilder = client.from.mock.results[1].value
    const updatePayload = updateBuilder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ materiale: "arrivato" })
  })

  it("does not advance status when materiale arrives but the order is already past da_fare", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { status: "in_lavorazione" }, error: null }, { data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterialeFornitore("id1", "arrivato")

    const updateBuilder = client.from.mock.results[1].value
    const updatePayload = updateBuilder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ materiale: "arrivato" })
  })

  it("logs a human-readable Italian event for every materiale value", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterialeFornitore("id1", "da_ordinare")

    const eventsBuilder = client.from.mock.results[1].value
    expect(client.from).toHaveBeenNthCalledWith(2, "order_events")
    const eventPayload = eventsBuilder.insert.mock.calls[0][0]
    expect(eventPayload.note).toBe("Materiale da ordinare")
  })
})
```

- [ ] **Passo 2: Esegui i test per verificare che falliscano**

Comando: `npm test -- src/actions/__tests__/orders.test.ts`
Atteso: FALLISCE — `updateMaterialeFornitore` non è esportato da `../orders`
(errore TypeScript/modulo), tutti e 6 i nuovi test falliscono.

- [ ] **Passo 3: Implementa `updateMaterialeFornitore`**

In `src/actions/orders.ts`, aggiungi questa costante subito dopo
`PREVENTIVO_LABELS` (dopo la riga 158):

```typescript
const MATERIALE_LABELS: Record<string, string> = {
  non_serve: "Materiale non serve",
  da_ordinare: "Materiale da ordinare",
  ordinato: "Materiale ordinato al fornitore",
  arrivato: "Materiale arrivato",
}
```

Poi aggiungi questa funzione subito dopo la fine di `updateBozzaGrafica`
(dopo la riga 202, prima di `export async function updateOrderStatus`):

```typescript
export async function updateMaterialeFornitore(id: string, value: string): Promise<void> {
  const supabase = await createClient()
  const updates: Record<string, unknown> = { materiale: value }
  if (value === "ordinato") updates.materiale_data_ordine = new Date().toISOString().split("T")[0]
  if (value === "arrivato") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("orders")
      .select("status")
      .eq("id", id)
      .single()
    if (order?.status === "da_fare") updates.status = "in_lavorazione"
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("orders").update(updates).eq("id", id)
  if (error) {
    logError("updateMaterialeFornitore", error, { id, value })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: id,
    event_type: "materiale_change",
    note: MATERIALE_LABELS[value] ?? value,
  })
}
```

- [ ] **Passo 4: Esegui i test per verificare che passino**

Comando: `npm test -- src/actions/__tests__/orders.test.ts`
Atteso: PASSA — tutti i test del file verdi (quelli esistenti + i 6 nuovi).

- [ ] **Passo 5: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 6: Commit**

```bash
git add src/actions/orders.ts src/actions/__tests__/orders.test.ts
git commit -m "feat: aggiungi updateMaterialeFornitore con avanzamento automatico a in_lavorazione"
```

---

### Task 3: Bottoni rapidi nella scheda ordine

**File:**
- Modifica: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Passo 1: Importa la nuova action**

Sostituisci la riga di import (riga 2):

```typescript
import { getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo } from "@/actions/orders"
```

con:

```typescript
import { getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore } from "@/actions/orders"
```

- [ ] **Passo 2: Aggiungi la server action `changeMateriale`**

Aggiungi questo subito dopo la fine della funzione `changePreventivo` (dopo
la riga 45, prima di `const currentIdx = ...`):

```typescript
  async function changeMateriale(formData: FormData) {
    "use server"
    const value = formData.get("materiale") as string
    await updateMaterialeFornitore(id, value)
    revalidatePath(`/orders/${id}`)
    revalidatePath("/orders")
    revalidatePath("/dashboard")
  }
```

- [ ] **Passo 3: Aggiungi il blocco UI dei bottoni rapidi**

Nella griglia "Key info", subito dopo la chiusura del blocco `bozza_grafica`
(dopo il `)}` della riga 194, ancora dentro il
`<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">`), aggiungi:

```typescript
        {order.materiale !== "non_serve" && (
          <div className="sm:col-span-3">
            <span className="text-muted-foreground block text-xs mb-1">Materiale fornitore</span>
            <div className="flex gap-2 flex-wrap">
              {([["da_ordinare", "Da ordinare"], ["ordinato", "Ordinato"], ["arrivato", "Arrivato"]] as const).map(([v, label]) => (
                <form key={v} action={changeMateriale}>
                  <input type="hidden" name="materiale" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    order.materiale === v
                      ? "bg-honey text-bark border-gold/40"
                      : "bg-card text-foreground border-border hover:border-foreground/30"
                  )}>{label}</button>
                </form>
              ))}
            </div>
            {(order.materiale_fornitore || order.materiale_cosa_manca) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[order.materiale_cosa_manca, order.materiale_fornitore].filter(Boolean).join(" — ")}
                {order.materiale_data_ordine && ` · ordinato il ${formatDate(order.materiale_data_ordine)}`}
              </p>
            )}
          </div>
        )}
```

- [ ] **Passo 4: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 5: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: aggiungi bottoni rapidi materiale fornitore nella scheda ordine"
```

---

### Task 4: Campi nel form ordine

**File:**
- Modifica: `src/components/OrderForm.tsx`

- [ ] **Passo 1: Aggiungi `MATERIALE_OPTIONS`**

Aggiungi questa costante subito dopo `PREVENTIVO_OPTIONS` (dopo la riga 29):

```typescript
const MATERIALE_OPTIONS = [
  { value: "non_serve", label: "Non serve" },
  { value: "da_ordinare", label: "Da ordinare" },
  { value: "ordinato", label: "Ordinato" },
  { value: "arrivato", label: "Arrivato" },
]
```

- [ ] **Passo 2: Aggiungi lo state del form**

Subito dopo la riga dello state `preventivo` (riga 97), aggiungi:

```typescript
  const [materiale, setMateriale] = useState(order?.materiale ?? "non_serve")
  const [materialeFornitore, setMaterialeFornitore] = useState(order?.materiale_fornitore ?? "")
  const [materialeCosaManca, setMaterialeCosaManca] = useState(order?.materiale_cosa_manca ?? "")
```

- [ ] **Passo 3: Aggiungi i campi al payload di submit**

Nell'oggetto `payload` dentro `handleSubmit`, subito dopo la riga
`bozza_grafica: bozza,` (riga 130), aggiungi:

```typescript
      materiale,
      materiale_fornitore: materialeFornitore.trim() || null,
      materiale_cosa_manca: materialeCosaManca.trim() || null,
      materiale_data_ordine: isEdit ? (order.materiale_data_ordine ?? null) : undefined,
```

- [ ] **Passo 4: Aggiungi la riga UI**

Subito dopo la chiusura del `</div>` della griglia "Tipo lavorazione ·
Bozza grafica · Preventivo" (dopo la riga 310), aggiungi una nuova riga:

```typescript
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="materiale">Materiale fornitore</Label>
            <Select items={MATERIALE_OPTIONS} value={materiale} onValueChange={(v) => v && setMateriale(v)}>
              <SelectTrigger id="materiale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIALE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {materiale !== "non_serve" && (
            <>
              <div>
                <Label htmlFor="materiale_fornitore">Fornitore</Label>
                <Input id="materiale_fornitore" value={materialeFornitore} onChange={(e) => setMaterialeFornitore(e.target.value)} placeholder="Nome fornitore" />
              </div>
              <div>
                <Label htmlFor="materiale_cosa_manca">Cosa manca</Label>
                <Input id="materiale_cosa_manca" value={materialeCosaManca} onChange={(e) => setMaterialeCosaManca(e.target.value)} placeholder="Es. cartoncino 300gr" />
              </div>
            </>
          )}
        </div>
```

- [ ] **Passo 5: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 6: Verifica manuale**

Esegui: `npm run dev`, apri `http://localhost:3000/orders/new`, compila i
campi obbligatori, seleziona "Materiale fornitore" → "Da ordinare", verifica
che compaiano i campi Fornitore e Cosa manca, compilali, salva. Apri
l'ordine creato e verifica che i bottoni rapidi del Task 3 compaiano con "Da
ordinare" evidenziato, e che il testo fornitore/cosa manca sia mostrato
sotto.

- [ ] **Passo 7: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: aggiungi campi materiale fornitore al form ordine"
```

---

### Task 5: Badge sulle card ordine (lista + bacheca)

**File:**
- Modifica: `src/components/OrderCard.tsx`
- Modifica: `src/components/KanbanBoard.tsx`

- [ ] **Passo 1: `OrderCard.tsx` — aggiungi il badge**

Sostituisci il blocco import (righe 1-3):

```typescript
import Link from "next/link"
import { cn, formatDate, formatEUR, isOverdue } from "@/lib/utils"
import type { OrderRow } from "@/actions/orders"
```

con:

```typescript
import Link from "next/link"
import { Package } from "lucide-react"
import { cn, formatDate, formatEUR, isOverdue } from "@/lib/utils"
import type { OrderRow } from "@/actions/orders"
```

Sostituisci la riga di testata (righe 44-47):

```typescript
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-foreground">{clientName}</p>
          <StatusBadge status={order.status} />
        </div>
```

con:

```typescript
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-foreground">{clientName}</p>
          <div className="flex items-center gap-1 shrink-0">
            {(order.materiale === "da_ordinare" || order.materiale === "ordinato") && (
              <span className="inline-flex items-center gap-1 text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">
                <Package className="w-3 h-3" />materiale
              </span>
            )}
            <StatusBadge status={order.status} />
          </div>
        </div>
```

- [ ] **Passo 2: `KanbanBoard.tsx` — aggiungi il badge**

Sostituisci l'import delle icone (riga 10):

```typescript
import { Clock } from "lucide-react"
```

con:

```typescript
import { Clock, Package } from "lucide-react"
```

Sostituisci il blocco di testata della card (righe 66-75):

```typescript
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-foreground">{clientName}</p>
                        {((order.status === "preventivo" && (order as any).preventivo === "inviato") ||
                          (order.status === "bozza_grafica" && (order.bozza_grafica === "inviata" || order.bozza_grafica === "modificata"))) && (
                          <span className="inline-flex items-center gap-1 text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            attesa
                          </span>
                        )}
                      </div>
```

con:

```typescript
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-foreground">{clientName}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {(order.materiale === "da_ordinare" || order.materiale === "ordinato") && (
                            <span className="inline-flex items-center gap-1 text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">
                              <Package className="w-3 h-3" />
                              materiale
                            </span>
                          )}
                          {((order.status === "preventivo" && (order as any).preventivo === "inviato") ||
                            (order.status === "bozza_grafica" && (order.bozza_grafica === "inviata" || order.bozza_grafica === "modificata"))) && (
                            <span className="inline-flex items-center gap-1 text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">
                              <Clock className="w-3 h-3" />
                              attesa
                            </span>
                          )}
                        </div>
                      </div>
```

- [ ] **Passo 3: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 4: Verifica manuale**

Con l'ordine creato nel Task 4 (materiale = "Da ordinare"), apri
`http://localhost:3000/orders` e `http://localhost:3000/kanban` — verifica
che il badge "materiale" compaia sulla card di quell'ordine in entrambe le
viste, e non compaia sugli altri ordini.

- [ ] **Passo 5: Commit**

```bash
git add src/components/OrderCard.tsx src/components/KanbanBoard.tsx
git commit -m "feat: badge materiale in attesa su lista e bacheca ordini"
```

---

### Task 6: Route dashboard — due nuove query

**File:**
- Modifica: `src/app/api/dashboard/today/route.ts`
- Test: `src/app/api/dashboard/today/__tests__/route.test.ts`

- [ ] **Passo 1: Aggiorna l'helper di test e scrivi il test che fallisce**

In `src/app/api/dashboard/today/__tests__/route.test.ts`, sostituisci
l'helper `mockOrdersSequence` (righe 10-23):

```typescript
// L'ordine delle risposte deve rispettare l'ordine dei from("orders") nel
// Promise.all della route: open, urgent, overdue, todayOrders, deliveredToday.
function mockOrdersSequence(counts: { open: number; urgent: number; overdue: number }, todayOrders: unknown[], deliveredToday: unknown[]) {
  return createSupabaseMock({
    orders: [
      { data: null, error: null, count: counts.open },
      { data: null, error: null, count: counts.urgent },
      { data: null, error: null, count: counts.overdue },
      { data: todayOrders, error: null },
      { data: deliveredToday, error: null },
    ],
    reminders: [{ data: [], error: null }],
  })
}
```

con:

```typescript
// L'ordine delle risposte deve rispettare l'ordine dei from("orders") nel
// Promise.all della route: open, urgent, overdue, todayOrders, deliveredToday,
// materialeDaOrdinare, materialeOrdinatoOggi.
function mockOrdersSequence(
  counts: { open: number; urgent: number; overdue: number },
  todayOrders: unknown[],
  deliveredToday: unknown[],
  materialeDaOrdinare: unknown[] = [],
  materialeOrdinatoOggi: unknown[] = []
) {
  return createSupabaseMock({
    orders: [
      { data: null, error: null, count: counts.open },
      { data: null, error: null, count: counts.urgent },
      { data: null, error: null, count: counts.overdue },
      { data: todayOrders, error: null },
      { data: deliveredToday, error: null },
      { data: materialeDaOrdinare, error: null },
      { data: materialeOrdinatoOggi, error: null },
    ],
    reminders: [{ data: [], error: null }],
  })
}
```

Sostituisci il test "defaults every count to 0" (righe 62-82):

```typescript
  it("defaults every count to 0 instead of null/undefined when Supabase returns no count", async () => {
    const client = createSupabaseMock({
      orders: [
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      reminders: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.kpi).toEqual({ open: 0, urgent: 0, overdue: 0, todayDeliveries: 0 })
    expect(body.todayOrders).toEqual([])
    expect(body.deliveredToday).toEqual([])
    expect(body.reminders).toEqual([])
  })
```

con:

```typescript
  it("defaults every count to 0 instead of null/undefined when Supabase returns no count", async () => {
    const client = createSupabaseMock({
      orders: [
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      reminders: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.kpi).toEqual({ open: 0, urgent: 0, overdue: 0, todayDeliveries: 0 })
    expect(body.todayOrders).toEqual([])
    expect(body.deliveredToday).toEqual([])
    expect(body.materialeDaOrdinare).toEqual([])
    expect(body.materialeOrdinatoOggi).toEqual([])
    expect(body.reminders).toEqual([])
  })
```

Aggiungi un nuovo blocco `describe` alla fine del file, subito prima della
chiusura finale:

```typescript

describe("materiale sections", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns materialeDaOrdinare and materialeOrdinatoOggi from their dedicated queries", async () => {
    const daOrdinare = [{ id: "m1", cosa_ordinato: "Targa", nome: "Gigi", cognome: null }]
    const ordinatoOggi = [{ id: "m2", cosa_ordinato: "Timbro", nome: "Ada", cognome: null }]
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [], daOrdinare, ordinatoOggi)
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.materialeDaOrdinare).toEqual(daOrdinare)
    expect(body.materialeOrdinatoOggi).toEqual(ordinatoOggi)
  })
})
```

- [ ] **Passo 2: Esegui i test per verificare che falliscano**

Comando: `npm test -- src/app/api/dashboard/today/__tests__/route.test.ts`
Atteso: FALLISCE — `body.materialeDaOrdinare`/`body.materialeOrdinatoOggi`
sono `undefined`, e le nuove asserzioni del test "defaults" falliscono
anch'esse perché la route non restituisce ancora quei campi.

- [ ] **Passo 3: Implementa le due nuove query nella route**

Sostituisci l'intero contenuto di `src/app/api/dashboard/today/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const today = new Date().toISOString().split("T")[0]

    const [openRes, urgentRes, overdueRes, todayRes, deliveredRes, materialeDaOrdinareRes, materialeOrdinatoOggiRes, remindersRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "in_lavorazione"),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .lt("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, status, data_consegna")
        .eq("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome")
        .eq("data_consegnato", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome")
        .eq("materiale", "da_ordinare"),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome")
        .eq("materiale", "ordinato").eq("materiale_data_ordine", today),
      supabase.from("reminders").select("id, title, due_at")
        .eq("status", "attivo").lte("due_at", `${today}T23:59:59Z`).order("due_at"),
    ])

    return NextResponse.json({
      kpi: {
        open: openRes.count ?? 0,
        urgent: urgentRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        todayDeliveries: todayRes.data?.length ?? 0,
      },
      todayOrders: todayRes.data ?? [],
      deliveredToday: deliveredRes.data ?? [],
      materialeDaOrdinare: materialeDaOrdinareRes.data ?? [],
      materialeOrdinatoOggi: materialeOrdinatoOggiRes.data ?? [],
      reminders: remindersRes.data ?? [],
    })
  } catch (error) {
    logError("dashboard/today", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Passo 4: Esegui i test per verificare che passino**

Comando: `npm test -- src/app/api/dashboard/today/__tests__/route.test.ts`
Atteso: PASSA — tutti i test verdi, compresi i due aggiornati e quello nuovo.

- [ ] **Passo 5: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 6: Commit**

```bash
git add src/app/api/dashboard/today/route.ts "src/app/api/dashboard/today/__tests__/route.test.ts"
git commit -m "feat: aggiungi query materiale da ordinare/ordinato oggi alla dashboard"
```

---

### Task 7: UI dashboard — due nuove sezioni

**File:**
- Modifica: `src/components/TodayBoard.tsx`

- [ ] **Passo 1: Aggiungi l'import dell'icona e le nuove interfacce**

Sostituisci l'import delle icone (riga 7):

```typescript
import { Clock, CheckCircle2 } from "lucide-react"
```

con:

```typescript
import { Clock, CheckCircle2, Package } from "lucide-react"
```

Sostituisci le interfacce `DeliveredOrder`/`DashboardData` (righe 32-44):

```typescript
interface DeliveredOrder {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
}

interface DashboardData {
  kpi: KPI
  todayOrders: TodayOrder[]
  deliveredToday: DeliveredOrder[]
  reminders: Reminder[]
}
```

con:

```typescript
interface DeliveredOrder {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
}

interface MaterialeOrder {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
}

interface DashboardData {
  kpi: KPI
  todayOrders: TodayOrder[]
  deliveredToday: DeliveredOrder[]
  materialeDaOrdinare: MaterialeOrder[]
  materialeOrdinatoOggi: MaterialeOrder[]
  reminders: Reminder[]
}
```

- [ ] **Passo 2: Estrai i nuovi campi**

Sostituisci la riga 74:

```typescript
  const { kpi, todayOrders, deliveredToday, reminders } = data!
```

con:

```typescript
  const { kpi, todayOrders, deliveredToday, materialeDaOrdinare, materialeOrdinatoOggi, reminders } = data!
```

- [ ] **Passo 3: Aggiungi le due nuove sezioni**

Inserisci questo subito dopo la chiusura del `</Card>` di "Consegnati oggi"
(dopo la riga 139, prima del blocco "Promemoria di oggi"
`{reminders.length > 0 && (`):

```typescript
      {materialeDaOrdinare.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Materiale da ordinare</CardTitle>
            <span className="text-xs font-semibold bg-terracotta/15 border border-terracotta/30 rounded-full px-2.5 py-0.5 text-terracotta">
              {materialeDaOrdinare.length}
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {materialeDaOrdinare.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center justify-between bg-background rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-sm text-foreground">{o.cosa_ordinato}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[o.nome, o.cognome].filter(Boolean).join(" ")}
                  </p>
                </div>
                <span className="text-muted-foreground/50 group-hover:text-muted-foreground text-sm">›</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {materialeOrdinatoOggi.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Materiale ordinato oggi</CardTitle>
            <span className="text-xs font-semibold bg-sage border border-[#3a5a2e]/30 rounded-full px-2.5 py-0.5 text-[#3a5a2e]">
              {materialeOrdinatoOggi.length}
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {materialeOrdinatoOggi.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 bg-background rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors group"
              >
                <Package className="w-4 h-4 text-[#3a5a2e] shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">{o.cosa_ordinato}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[o.nome, o.cognome].filter(Boolean).join(" ")}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
```

- [ ] **Passo 4: Aggiorna la condizione dello stato vuoto**

Sostituisci la riga 160:

```typescript
      {todayOrders.length === 0 && deliveredToday.length === 0 && reminders.length === 0 && (
```

con:

```typescript
      {todayOrders.length === 0 && deliveredToday.length === 0 && materialeDaOrdinare.length === 0 && materialeOrdinatoOggi.length === 0 && reminders.length === 0 && (
```

- [ ] **Passo 5: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 6: Verifica manuale**

Esegui: `npm run dev`, apri `http://localhost:3000/dashboard`. Usando
l'ordine creato nel Task 4 (materiale = "Da ordinare"):
1. Verifica che la scheda "Materiale da ordinare" lo mostri.
2. Apri l'ordine, clicca il bottone rapido "Ordinato" (Task 3).
3. Ricarica la dashboard — verifica che l'ordine si sia spostato da
   "Materiale da ordinare" a "Materiale ordinato oggi", con la data di oggi.
4. Clicca "Arrivato" sull'ordine — se il suo status era "Da fare", verifica
   che lo stepper di stato nella scheda ordine mostri ora "In lavorazione"
   come stato corrente.
5. Ricarica la dashboard — verifica che l'ordine non compaia più in nessuna
   delle due schede materiale.

- [ ] **Passo 7: Commit**

```bash
git add src/components/TodayBoard.tsx
git commit -m "feat: aggiungi sezioni materiale da ordinare/ordinato oggi alla dashboard"
```

---

### Task 8: Aggiorna CLAUDE.md

**File:**
- Modifica: `d:\Documenti\Projects\oltre_la_bottega\CLAUDE.md`

- [ ] **Passo 1: Documenta le nuove colonne**

Nella sezione "Modello dati (v1)", sotto l'elenco puntato di `orders`,
aggiungi una nuova riga dopo la riga "Sottostato bozza":

```markdown
- Sottostato materiale: `materiale` (non_serve | da_ordinare | ordinato | arrivato), `materiale_fornitore`, `materiale_cosa_manca`, `materiale_data_ordine`
```

- [ ] **Passo 2: Aggiungi la migration all'elenco ordinato**

Aggiungi come punto 7 nell'elenco "Migrations da applicare in ordine":

```markdown
7. `20260707000001_add_materiale_fornitore.sql` — colonne materiale fornitore su `orders`
```

- [ ] **Passo 3: Aggiungi righe a "Decisioni chiave e motivazioni"**

Aggiungi queste righe alla tabella:

```markdown
| Materiale fornitore = sottostato indipendente da `status` (come preventivo/bozza) | Situazione ricorrente (ordini che richiedono materiale dal fornitore prima di essere lavorati), quasi sempre nota alla creazione ma a volte scoperta durante la lavorazione. Non blocca il cambio di stato manuale — il lavoro può procedere in parte (es. bozze grafiche) anche senza materiale, coerente con l'assenza di blocchi rigidi nel resto dell'app |
| Materiale "arrivato" + status "da_fare" → avanza automaticamente a "in_lavorazione" | Evita un passaggio manuale quando l'unico motivo per cui l'ordine era fermo era il materiale mancante. Non scatta se lo status è ancora "preventivo"/"bozza_grafica" (in attesa del cliente), perché "da_fare" si raggiunge solo dopo che questi passaggi sono già risolti |
| Dashboard "Oggi": schede "Materiale da ordinare" / "Materiale ordinato oggi" | Stessa logica di "Consegnati oggi": la seconda scheda resta visibile solo fino a fine giornata (filtrata su `materiale_data_ordine = oggi`), dà conferma visiva del lavoro amministrativo fatto |
```

- [ ] **Passo 4: Aggiorna la sezione Testing**

Aggiungi un nuovo punto sotto "Stato al 2026-07-07" (o aggiorna la data se
nel frattempo esiste già una voce più recente) che documenti i nuovi test:

```markdown
- **Feature (2026-07-07)**: tracciamento materiale da ordinare al fornitore (`materiale`/`materiale_fornitore`/`materiale_cosa_manca`/`materiale_data_ordine` su `orders`). Nuova server action `updateMaterialeFornitore` con 6 nuovi test unitari (data automatica, avanzamento condizionale a `in_lavorazione`, log eventi). Dashboard "Oggi" estesa con due sezioni ("Materiale da ordinare", "Materiale ordinato oggi") e relativi test sulla route `/api/dashboard/today`. Design in `docs/superpowers/specs/2026-07-07-materiale-fornitore-design.md`.
```

- [ ] **Passo 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: aggiorna CLAUDE.md con il tracciamento materiale fornitore"
```

---

## Note di autoverifica

- **Copertura spec:** modello dati (Task 1), avanzamento automatico dello
  status (Task 2), form (Task 4), scheda ordine (Task 3), badge
  lista/bacheca (Task 5), dashboard "Oggi" (Task 6+7) — ogni sezione del
  documento di design è coperta da un task.
- **Nessun placeholder:** ogni passo mostra codice esatto, percorsi file
  esatti, comandi esatti.
- **Coerenza dei tipi:** la firma `updateMaterialeFornitore(id, value)`
  corrisponde al suo utilizzo in `changeMateriale` (Task 3); la forma di
  `MaterialeOrder` in `TodayBoard.tsx` corrisponde alle colonne del
  `select(...)` in `route.ts` (`id, cosa_ordinato, nome, cognome`); i campi
  `OrderRow` aggiunti nel Task 2 corrispondono a ogni punto in cui vengono
  letti nei Task 3, 4, 5.