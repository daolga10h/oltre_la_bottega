# Bottone "Segna come pagato" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un'azione rapida "Segna come pagato" che azzera il saldo di un ordine, disponibile sulla scheda ordine e nella lista "Da incassare" (`/pagamenti`).

**Architecture:** Nuova server action `markPaymentReceived(id)` in `src/actions/orders.ts` (stesso stile di `markReviewReceived`/`updateMaterialeFornitore`): legge `prezzo`, imposta `acconto = prezzo` e `saldo = 0`, registra un evento in timeline. Due bottoni client-invisibili (form + server action locale "use server", stesso pattern già usato in `recensioni/page.tsx`) la richiamano da `orders/[id]/page.tsx` e da `pagamenti/page.tsx`.

**Tech Stack:** Next.js App Router (Server Actions), Supabase, Jest per gli unit test sull'action.

Spec di riferimento: `docs/superpowers/specs/2026-09-15-segna-come-pagato-design.md`

---

### Task 1: Test falliti per `markPaymentReceived`

**Files:**
- Modify: `src/actions/__tests__/orders.test.ts:9` (import) e dopo il blocco `describe("updateMaterialeFornitore", ...)` (dopo la riga con la chiusura `})` a riga 336)

- [ ] **Step 1: Aggiungere `markPaymentReceived` all'import esistente**

In `src/actions/__tests__/orders.test.ts:9`, sostituire:

```ts
import { getOrders, getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, createOrder, updateOrder } from "../orders"
```

con:

```ts
import { getOrders, getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, markPaymentReceived, createOrder, updateOrder } from "../orders"
```

- [ ] **Step 2: Scrivere il blocco di test, subito dopo la chiusura di `describe("updateMaterialeFornitore", ...)` (riga 336, `})`), prima di `describe("createOrder", ...)`**

```ts
describe("markPaymentReceived", () => {
  afterEach(() => jest.clearAllMocks())

  it("sets acconto to the order's prezzo and saldo to 0", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { prezzo: 120 }, error: null }, { data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await markPaymentReceived("id1")

    const updateBuilder = client.from.mock.results[1].value
    const updatePayload = updateBuilder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ acconto: 120, saldo: 0 })
  })

  it("logs a payment_received event", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { prezzo: 80 }, error: null }, { data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await markPaymentReceived("id1")

    expect(client.from).toHaveBeenNthCalledWith(3, "order_events")
    const eventsBuilder = client.from.mock.results[2].value
    const eventPayload = eventsBuilder.insert.mock.calls[0][0]
    expect(eventPayload).toEqual({
      order_id: "id1",
      event_type: "payment_received",
      note: "Pagamento saldato",
    })
  })

  it("throws and does not attempt an update when reading the order's prezzo fails", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: { message: "boom" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    await expect(markPaymentReceived("id1")).rejects.toThrow()
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it("throws when the update fails", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { prezzo: 50 }, error: null }, { data: null, error: { message: "boom" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    await expect(markPaymentReceived("id1")).rejects.toThrow()
    expect(client.from).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano** (la funzione non esiste ancora)

Run: `npx jest --roots=src orders.test.ts`
Expected: FAIL — `markPaymentReceived is not a function` (o errore di import/tipo equivalente)

- [ ] **Step 4: Commit**

```bash
git add src/actions/__tests__/orders.test.ts
git commit -m "$(cat <<'EOF'
test: aggiunge test falliti per markPaymentReceived

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Implementare `markPaymentReceived`

**Files:**
- Modify: `src/actions/orders.ts` (dopo `markReviewReceived`, cioè dopo la riga 356 `}` di chiusura, fine file)

- [ ] **Step 1: Aggiungere la nuova action in coda al file**

In `src/actions/orders.ts`, dopo la chiusura di `markReviewReceived` (fine file, riga 356), aggiungere:

```ts

export async function markPaymentReceived(id: string): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: readError } = await (supabase as any)
    .from("orders")
    .select("prezzo")
    .eq("id", id)
    .single()
  if (readError || !order) {
    logError("markPaymentReceived", readError ?? new Error("order not found"), { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ acconto: order.prezzo, saldo: 0 })
    .eq("id", id)
  if (error) {
    logError("markPaymentReceived", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: id,
    event_type: "payment_received",
    note: "Pagamento saldato",
  })
}
```

Nessun nuovo import necessario: `createClient`, `logError`, `USER_MESSAGES` sono già importati in cima al file.

- [ ] **Step 2: Eseguire i test e verificare che passino**

Run: `npx jest --roots=src orders.test.ts`
Expected: PASS, tutti i test del file verdi (compresi i 4 nuovi)

- [ ] **Step 3: Verificare che il typecheck sia pulito**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Aggiungere `revalidatePath("/pagamenti")` a `updateOrder`**

Un saldo può tornare a zero anche modificando l'ordine per intero da "Modifica" (non solo con il nuovo bottone), ma oggi `updateOrder` non revalida `/pagamenti` — un ordine saldato così continuerebbe a comparire nella lista fino al prossimo refetch. In `src/actions/orders.ts`, dentro `updateOrder` (fine funzione, dopo `revalidatePath(\`/orders/${id}\`)`), sostituire:

```ts
  revalidatePath("/orders")
  revalidatePath("/dashboard")
  revalidatePath(`/orders/${id}`)
}
```

con:

```ts
  revalidatePath("/orders")
  revalidatePath("/dashboard")
  revalidatePath(`/orders/${id}`)
  revalidatePath("/pagamenti")
}
```

- [ ] **Step 5: Eseguire di nuovo i test (nessuna nuova asserzione da aggiungere: `revalidatePath` è già mockato come `jest.fn()` globale e non viene verificato per `updateOrder` nei test esistenti)**

Run: `npx jest --roots=src orders.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/actions/orders.ts
git commit -m "$(cat <<'EOF'
feat: aggiunge markPaymentReceived per segnare un ordine come pagato

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Bottone nella scheda ordine

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx:2` (import), `changeStatus` (righe 32-39), dopo `changeMateriale` (dopo la riga 62 `}`), e dopo la griglia Pagamento (dopo la riga 270 `</div>`)

- [ ] **Step 1: Aggiungere `markPaymentReceived` all'import delle action**

In `src/app/(dashboard)/orders/[id]/page.tsx:2`, sostituire:

```ts
import { getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore } from "@/actions/orders"
```

con:

```ts
import { getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, markPaymentReceived } from "@/actions/orders"
```

- [ ] **Step 2: Aggiungere `revalidatePath("/pagamenti")` a `changeStatus`**

Cambiare manualmente lo stato di un ordine (es. portarlo su "Consegnato", o farlo tornare indietro) può far entrare/uscire l'ordine dalla lista "Da incassare" tanto quanto il nuovo bottone — oggi `changeStatus` non la revalida. In `src/app/(dashboard)/orders/[id]/page.tsx:32-39`, sostituire:

```ts
  async function changeStatus(formData: FormData) {
    "use server"
    const status = formData.get("status") as string
    await updateOrderStatus(id, status)
    revalidatePath(`/orders/${id}`)
    revalidatePath("/orders")
    revalidatePath("/dashboard")
  }
```

con:

```ts
  async function changeStatus(formData: FormData) {
    "use server"
    const status = formData.get("status") as string
    await updateOrderStatus(id, status)
    revalidatePath(`/orders/${id}`)
    revalidatePath("/orders")
    revalidatePath("/dashboard")
    revalidatePath("/pagamenti")
  }
```

- [ ] **Step 3: Aggiungere la funzione locale `"use server"` per il nuovo bottone, subito dopo la chiusura di `changeMateriale` (dopo la riga 62 `}`)**

```ts

  async function markPaid() {
    "use server"
    await markPaymentReceived(id)
    revalidatePath(`/orders/${id}`)
    revalidatePath("/pagamenti")
  }
```

`revalidatePath` è già importato in cima al file (riga 12).

- [ ] **Step 4: Aggiungere il bottone subito dopo la griglia Pagamento**

Il blocco Pagamento attuale (righe 257-270) finisce con:

```tsx
        <div className="rounded-lg border border-border bg-card px-3 py-3 text-center shadow-[0px_4px_8px_0px_rgba(59,39,22,0.06)]">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="font-semibold text-base text-gold">€{formatEUR(order.saldo)}</p>
        </div>
      </div>
```

Subito dopo quel `</div>` di chiusura della grid (riga 270), aggiungere:

```tsx

      {order.saldo > 0 && (
        <form action={markPaid}>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
          >
            Segna come pagato
          </button>
        </form>
      )}
```

`buttonVariants` e `cn` sono già importati in cima al file (righe 7 e 11).

- [ ] **Step 5: Verificare il typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Verifica manuale nel browser**

Con il dev server attivo (`npm run dev`):
1. Aprire un ordine consegnato con saldo residuo (o crearne uno: stato "Consegnato", Acconto inferiore al Prezzo)
2. Confermare che il bottone "Segna come pagato" compaia sotto il riquadro Pagamento
3. Cliccarlo, confermare che Saldo diventi 0.00 e Acconto uguagli il Prezzo
4. Confermare che il bottone sparisca dopo il click (saldo non più > 0)
5. Aprire un ordine con saldo già a 0: confermare che il bottone non compaia mai

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat: aggiunge bottone Segna come pagato nella scheda ordine

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bottone nella lista "Da incassare"

**Files:**
- Modify: `src/app/(dashboard)/pagamenti/page.tsx` (import in testa al file, funzione locale, colonna Azioni)

- [ ] **Step 1: Aggiungere gli import mancanti**

In `src/app/(dashboard)/pagamenti/page.tsx:1-10`, sostituire le prime due righe:

```ts
import { getOrders } from "@/actions/orders"
import { toUserMessage } from "@/lib/errors"
```

con:

```ts
import { getOrders, markPaymentReceived } from "@/actions/orders"
import { toUserMessage } from "@/lib/errors"
import { revalidatePath } from "next/cache"
```

- [ ] **Step 2: Aggiungere la funzione locale `"use server"`, subito dopo la chiusura della funzione `PagamentiPage` iniziale (dopo la riga con `const shopName = getShopName(user)`, riga 15)**

```ts

  async function segnaPagato(formData: FormData) {
    "use server"
    const id = formData.get("id") as string
    await markPaymentReceived(id)
    revalidatePath("/pagamenti")
    revalidatePath(`/orders/${id}`)
  }
```

- [ ] **Step 3: Aggiungere il bottone nella colonna Azioni, dopo il link "Scheda" (dopo la riga 83 `</Link>`, prima della chiusura `</div>` di riga 84)**

La colonna Azioni attuale (righe 74-85):

```tsx
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <QuickContactLink href={waLink} icon={MessageCircle} label="Chiedi su WhatsApp" external />
                        <QuickContactLink href={mailLink} icon={Mail} label="Chiedi via email" />
                        <Link
                          href={`/orders/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                        >
                          Scheda
                        </Link>
                      </div>
                    </td>
```

Sostituire con:

```tsx
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <QuickContactLink href={waLink} icon={MessageCircle} label="Chiedi su WhatsApp" external />
                        <QuickContactLink href={mailLink} icon={Mail} label="Chiedi via email" />
                        <Link
                          href={`/orders/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                        >
                          Scheda
                        </Link>
                        <form action={segnaPagato}>
                          <input type="hidden" name="id" value={o.id} />
                          <button
                            type="submit"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                          >
                            Segna come pagato
                          </button>
                        </form>
                      </div>
                    </td>
```

- [ ] **Step 4: Verificare il typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 5: Verifica manuale nel browser**

1. Aprire `/pagamenti` con almeno un ordine in elenco
2. Cliccare "Segna come pagato" direttamente dalla riga
3. Confermare che la riga sparisca dall'elenco senza bisogno di aprire la scheda
4. Aprire la scheda dello stesso ordine da un'altra pagina, confermare Saldo 0.00

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/pagamenti/page.tsx"
git commit -m "$(cat <<'EOF'
feat: aggiunge bottone Segna come pagato nella lista Da incassare

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verifica finale

- [ ] **Step 1: Suite completa**

Run: `npx jest --roots=src`
Expected: tutte le suite verdi (137 esistenti + 4 nuove = 141 test)

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Aggiornare CLAUDE.md**

Aggiungere una riga alla tabella "Decisioni chiave" e una voce in "Testing" (sezione Feature), seguendo lo stile delle voci esistenti (es. quella di "Da incassare" del 2026-09-10/11): cosa cambia, perché, come verificato. Committare insieme.

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: documenta il bottone Segna come pagato in CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
