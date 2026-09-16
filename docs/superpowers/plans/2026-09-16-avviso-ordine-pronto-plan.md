# Avviso ordine pronto — sezione "Da avvisare" + auto-segna "Msg pronto inviato" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un ordine "pronto" non ancora notificato al cliente compare nella dashboard "Oggi" finché non viene avvisato, e cliccare il link WhatsApp/Email nella scheda ordine segna da solo il flag `msg_pronto_inviato`, senza passare da "Modifica".

**Architecture:** Nuova query in `/api/dashboard/today` + nuova sezione in `TodayBoard.tsx` (stesso pattern di "Materiale da ordinare"). Nuova server action `markMsgProntoInviato`, richiamata da un piccolo componente client (`NotifyReadyLinks`) che avvolge i due `QuickContactLink` esistenti nel riquadro "Avvisa il cliente" della scheda ordine.

**Tech Stack:** Next.js Server Actions, Supabase (client `@/lib/supabase/server`), Jest per i test unitari di action/route (nessuna infrastruttura di test per pagine/componenti in questo codebase — verifica manuale a fine piano, stessa convenzione già seguita per `/pagamenti`/`/riepilogo`/"Segna come pagato").

Spec di riferimento: `docs/superpowers/specs/2026-09-16-avviso-ordine-pronto-design.md`.

---

### Task 1: Server action `markMsgProntoInviato`

**Files:**
- Modify: `src/actions/orders.ts:9` (import), `src/actions/orders.ts:386` (dopo la chiusura di `markPaymentReceived`, prima di `export async function createOrder`)
- Test: `src/actions/__tests__/orders.test.ts:9` (import), `src/actions/__tests__/orders.test.ts:393` (dopo la chiusura del blocco `describe("markPaymentReceived", ...)`, prima di `describe("createOrder", ...)`)

- [ ] **Step 1: Aggiungere l'import nel file di test**

In `src/actions/__tests__/orders.test.ts:9`, sostituire:

```ts
import { getOrders, getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, markPaymentReceived, createOrder, updateOrder } from "../orders"
```

con:

```ts
import { getOrders, getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo, updateMaterialeFornitore, markPaymentReceived, markMsgProntoInviato, createOrder, updateOrder } from "../orders"
```

- [ ] **Step 2: Scrivere i test che devono fallire**

Subito dopo la riga 393 (chiusura di `describe("markPaymentReceived", ...)`), inserire:

```ts
describe("markMsgProntoInviato", () => {
  afterEach(() => jest.clearAllMocks())

  it("sets msg_pronto_inviato to true", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await markMsgProntoInviato("id1")

    const updateBuilder = client.from.mock.results[0].value
    const updatePayload = updateBuilder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ msg_pronto_inviato: true })
  })

  it("logs a msg_pronto_inviato event", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await markMsgProntoInviato("id1")

    expect(client.from).toHaveBeenNthCalledWith(2, "order_events")
    const eventsBuilder = client.from.mock.results[1].value
    const eventPayload = eventsBuilder.insert.mock.calls[0][0]
    expect(eventPayload).toEqual({
      order_id: "id1",
      event_type: "msg_pronto_inviato",
      note: "Messaggio \"pronto per il ritiro\" inviato",
    })
  })

  it("throws when the update fails", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: { message: "boom" } }],
    })
    mockCreateClient.mockResolvedValue(client)
    jest.spyOn(console, "error").mockImplementation(() => {})

    await expect(markMsgProntoInviato("id1")).rejects.toThrow()
    expect(client.from).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npx jest --roots=src src/actions/__tests__/orders.test.ts -t "markMsgProntoInviato"`
Expected: FAIL — `markMsgProntoInviato is not a function` (o errore di import/undefined), perché la funzione non esiste ancora.

- [ ] **Step 4: Implementare la action**

In `src/actions/orders.ts`, subito dopo la chiusura di `markPaymentReceived` (riga 386), aggiungere:

```ts

export async function markMsgProntoInviato(id: string): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ msg_pronto_inviato: true })
    .eq("id", id)
  if (error) {
    logError("markMsgProntoInviato", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: id,
    event_type: "msg_pronto_inviato",
    note: "Messaggio \"pronto per il ritiro\" inviato",
  })
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npx jest --roots=src src/actions/__tests__/orders.test.ts -t "markMsgProntoInviato"`
Expected: PASS — 3 test verdi.

- [ ] **Step 6: Eseguire l'intera suite delle action per verificare nessuna regressione**

Run: `npx jest --roots=src src/actions/__tests__/orders.test.ts`
Expected: PASS — tutti i test del file verdi (nessuna regressione sulle altre action).

- [ ] **Step 7: Commit**

```bash
git add src/actions/orders.ts src/actions/__tests__/orders.test.ts
git commit -m "feat: aggiunge markMsgProntoInviato per segnare l'invio dell'avviso ordine pronto"
```

---

### Task 2: `onClick` opzionale su `QuickContactLink`

**Files:**
- Modify: `src/components/QuickContactLink.tsx`

- [ ] **Step 1: Aggiungere il prop opzionale**

Sostituire l'intero contenuto di `src/components/QuickContactLink.tsx` con:

```tsx
import { type LucideIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuickContactLinkProps {
  href: string | null
  icon: LucideIcon
  label: string
  external?: boolean
  variant?: "toolbar" | "table"
  onClick?: () => void
}

export function QuickContactLink({ href, icon: Icon, label, external = false, variant = "table", onClick }: QuickContactLinkProps) {
  if (!href) return null
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        variant === "toolbar"
          ? "inline-flex items-center gap-1 bg-card"
          : "w-full text-xs inline-flex items-center justify-center gap-1"
      )}
    >
      <Icon className={variant === "toolbar" ? "w-3.5 h-3.5" : "w-3 h-3"} />{label}
    </a>
  )
}
```

Nota: `onClick` su un elemento renderizzato da un Server Component (`QuickContactLink` non ha `"use client"`) funziona perché il componente, quando importato da un file `"use client"` (Task 3), viene bundlato ed eseguito lato client insieme al suo chiamante — non è un problema di serializzazione RSC, la funzione arriva dallo stesso modulo client.

- [ ] **Step 2: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore (i 4 usi esistenti in `recensioni/page.tsx` e `pagamenti/page.tsx` non passano `onClick`, resta `undefined` e va bene: `onClick={undefined}` su un `<a>` è un no-op).

- [ ] **Step 3: Commit**

```bash
git add src/components/QuickContactLink.tsx
git commit -m "feat: QuickContactLink accetta un onClick opzionale"
```

---

### Task 3: Componente client `NotifyReadyLinks`

**Files:**
- Create: `src/components/NotifyReadyLinks.tsx`

- [ ] **Step 1: Creare il componente**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { MessageCircle, Mail } from "lucide-react"
import { QuickContactLink } from "@/components/QuickContactLink"
import { markMsgProntoInviato } from "@/actions/orders"

interface NotifyReadyLinksProps {
  orderId: string
  waLink: string | null
  mailLink: string | null
}

export function NotifyReadyLinks({ orderId, waLink, mailLink }: NotifyReadyLinksProps) {
  const router = useRouter()

  function handleClick() {
    markMsgProntoInviato(orderId).then(() => router.refresh())
  }

  return (
    <>
      <QuickContactLink href={waLink} icon={MessageCircle} label="WhatsApp" external variant="toolbar" onClick={handleClick} />
      <QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" onClick={handleClick} />
    </>
  )
}
```

Il click non blocca la navigazione: l'`<a>` apre comunque WhatsApp (nuova scheda, `target="_blank"`) o il client di posta (`mailto:`), mentre `markMsgProntoInviato` parte in parallelo. `router.refresh()` aggiorna la UI (il riquadro "Avvisa il cliente" sparisce, il badge "Msg PRONTO" nei Flags si accende) non appena la action risponde.

- [ ] **Step 2: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotifyReadyLinks.tsx
git commit -m "feat: aggiunge NotifyReadyLinks per segnare l'invio al click"
```

---

### Task 4: Sostituire i link diretti nella scheda ordine

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx:9` (import icone), `src/app/(dashboard)/orders/[id]/page.tsx` (nuovo import componente), `src/app/(dashboard)/orders/[id]/page.tsx:159-160` (uso)

- [ ] **Step 1: Aggiornare gli import**

In `src/app/(dashboard)/orders/[id]/page.tsx:9`, `MessageCircle` e `Mail` non servono più direttamente in questo file (passano dentro `NotifyReadyLinks`). Sostituire:

```ts
import { ArrowLeft, Edit, Printer, CalendarPlus, MessageCircle, Mail } from "lucide-react"
```

con:

```ts
import { ArrowLeft, Edit, Printer, CalendarPlus } from "lucide-react"
```

Subito dopo l'import di `QuickContactLink` (riga 5), aggiungere:

```ts
import { NotifyReadyLinks } from "@/components/NotifyReadyLinks"
```

- [ ] **Step 2: Sostituire i due `QuickContactLink` con `NotifyReadyLinks`**

Alle righe 159-160, sostituire:

```tsx
            <QuickContactLink href={waLink} icon={MessageCircle} label="WhatsApp" external variant="toolbar" />
            <QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" />
```

con:

```tsx
            <NotifyReadyLinks orderId={id} waLink={waLink} mailLink={mailLink} />
```

Il resto del blocco (calcolo di `waLink`/`mailLink`, il testo dei messaggi, il rispetto del canale "mail" che forza `waLink` a `null`) resta identico — cambia solo chi rende i due bottoni.

- [ ] **Step 3: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore (nessun import inutilizzato, nessun tipo mancante).

- [ ] **Step 4: Eseguire l'intera suite per verificare nessuna regressione**

Run: `npx jest --roots=src`
Expected: PASS — tutte le suite verdi (nessuna infrastruttura di test copre questa pagina, ma la action sottostante sì).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: il click su WhatsApp/Email nella scheda ordine segna Msg pronto inviato"
```

---

### Task 5: Query `daAvvisare` in `/api/dashboard/today`

**Files:**
- Modify: `src/app/api/dashboard/today/route.ts`
- Test: `src/app/api/dashboard/today/__tests__/route.test.ts`

- [ ] **Step 1: Aggiornare l'helper `mockOrdersSequence` e i test esistenti che ne dipendono**

In `src/app/api/dashboard/today/__tests__/route.test.ts`, sostituire il commento e la funzione (righe 10-32):

```ts
// L'ordine delle risposte deve rispettare l'ordine dei from("orders") nel
// Promise.all della route: open, urgent, overdue, todayOrders, deliveredToday,
// materialeDaOrdinare, materialeOrdinatoOggi, daAvvisare.
function mockOrdersSequence(
  counts: { open: number; urgent: number; overdue: number },
  todayOrders: unknown[],
  deliveredToday: unknown[],
  materialeDaOrdinare: unknown[] = [],
  materialeOrdinatoOggi: unknown[] = [],
  daAvvisare: unknown[] = []
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
      { data: daAvvisare, error: null },
    ],
    reminders: [{ data: [], error: null }],
  })
}
```

Nel test `"defaults every count to 0 instead of null/undefined when Supabase returns no count"`, nell'array `orders` passato a `createSupabaseMock`, aggiungere un ottavo elemento `{ data: null, error: null }` dopo il settimo, e aggiungere l'assert:

```ts
    expect(body.daAvvisare).toEqual([])
```

(subito dopo `expect(body.materialeOrdinatoOggi).toEqual([])`).

Nei due test `"includes azienda in the select for ..."` e `"includes referente in the select for ..."`, rinominare il titolo per includere `daAvvisare` (es. `"...materialeDaOrdinare, materialeOrdinatoOggi and daAvvisare"`) e aggiungere in ciascuno:

```ts
    expect(results[7].value.select.mock.calls[0][0]).toContain("azienda")
```

risp.

```ts
    expect(results[7].value.select.mock.calls[0][0]).toContain("referente")
```

- [ ] **Step 2: Scrivere i nuovi test che devono fallire**

Alla fine del file, dopo il blocco `describe("materiale sections", ...)`, aggiungere:

```ts

describe("avvisi ordine pronto", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns daAvvisare from its dedicated query", async () => {
    const daAvvisare = [{ id: "p1", cosa_ordinato: "Targa", nome: "Gigi", cognome: null }]
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [], [], [], daAvvisare)
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.daAvvisare).toEqual(daAvvisare)
  })

  it("filters by status pronto and msg_pronto_inviato false", async () => {
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [])
    mockCreateClient.mockResolvedValue(client)

    await GET()

    const builder = client.from.mock.results[7].value
    expect(builder.eq).toHaveBeenCalledWith("status", "pronto")
    expect(builder.eq).toHaveBeenCalledWith("msg_pronto_inviato", false)
  })
})
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npx jest --roots=src src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: FAIL — i test aggiornati/nuovi falliscono (`body.daAvvisare` è `undefined`, `results[7]` è `undefined`), perché la route non ha ancora l'ottava query.

- [ ] **Step 4: Implementare la query nella route**

In `src/app/api/dashboard/today/route.ts`, sostituire il blocco `Promise.all` (righe 13-30) con:

```ts
    const [openRes, urgentRes, overdueRes, todayRes, deliveredRes, materialeDaOrdinareRes, materialeOrdinatoOggiRes, daAvvisareRes, remindersRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "in_lavorazione"),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .lt("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("data_consegnato", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("materiale", "da_ordinare"),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("materiale", "ordinato").eq("materiale_data_ordine", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("status", "pronto").eq("msg_pronto_inviato", false),
      supabase.from("reminders").select("id, title, due_at")
        .eq("status", "attivo").lte("due_at", `${today}T23:59:59Z`).order("due_at"),
    ])
```

E nell'oggetto restituito da `NextResponse.json` (righe 32-44), aggiungere subito dopo `materialeOrdinatoOggi`:

```ts
      daAvvisare: daAvvisareRes.data ?? [],
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npx jest --roots=src src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: PASS — tutti i test del file verdi.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/dashboard/today/route.ts src/app/api/dashboard/today/__tests__/route.test.ts
git commit -m "feat: aggiunge la query daAvvisare a /api/dashboard/today"
```

---

### Task 6: Sezione "Da avvisare" in `TodayBoard.tsx`

**Files:**
- Modify: `src/components/TodayBoard.tsx`

- [ ] **Step 1: Aggiungere il campo all'interfaccia e alla destrutturazione**

Alla riga 44-51, sostituire:

```ts
interface DashboardData {
  kpi: KPI
  todayOrders: TodayOrder[]
  deliveredToday: OrderSummary[]
  materialeDaOrdinare: OrderSummary[]
  materialeOrdinatoOggi: OrderSummary[]
  reminders: Reminder[]
}
```

con:

```ts
interface DashboardData {
  kpi: KPI
  todayOrders: TodayOrder[]
  deliveredToday: OrderSummary[]
  materialeDaOrdinare: OrderSummary[]
  materialeOrdinatoOggi: OrderSummary[]
  daAvvisare: OrderSummary[]
  reminders: Reminder[]
}
```

Alla riga 81, sostituire:

```ts
  const { kpi, todayOrders, deliveredToday, materialeDaOrdinare, materialeOrdinatoOggi, reminders } = data!
```

con:

```ts
  const { kpi, todayOrders, deliveredToday, materialeDaOrdinare, materialeOrdinatoOggi, daAvvisare, reminders } = data!
```

- [ ] **Step 2: Aggiungere la card, subito dopo "Da consegnare oggi"**

Dopo la chiusura della card "Da consegnare oggi" (riga 97, `/>` seguito da riga vuota), prima della card "Consegnati oggi" (riga 99), inserire:

```tsx

      <DashboardListCard
        title="Da avvisare"
        items={daAvvisare}
        badgeClassName="bg-honey border-gold/40 text-bark"
        chevron
      />
```

- [ ] **Step 3: Aggiornare la condizione dell'empty state**

Alla riga 139, sostituire:

```tsx
      {todayOrders.length === 0 && deliveredToday.length === 0 && materialeDaOrdinare.length === 0 && materialeOrdinatoOggi.length === 0 && reminders.length === 0 && (
```

con:

```tsx
      {todayOrders.length === 0 && deliveredToday.length === 0 && materialeDaOrdinare.length === 0 && materialeOrdinatoOggi.length === 0 && daAvvisare.length === 0 && reminders.length === 0 && (
```

- [ ] **Step 4: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 5: Eseguire l'intera suite per verificare nessuna regressione**

Run: `npx jest --roots=src`
Expected: PASS — tutte le suite verdi (nessuna infrastruttura di test copre `TodayBoard.tsx`, coerente con la convenzione esistente per i componenti pagina).

- [ ] **Step 6: Commit**

```bash
git add src/components/TodayBoard.tsx
git commit -m "feat: aggiunge la sezione Da avvisare alla dashboard Oggi"
```

---

### Task 7: Verifica manuale end-to-end e aggiornamento CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`
- Create/Delete: script Playwright temporaneo (nessun percorso fisso — cancellato a verifica completata, stesso pattern già usato per le feature precedenti)

- [ ] **Step 1: Eseguire l'intera suite e il type check come rete di sicurezza finale**

Run: `npx jest --roots=src`
Expected: PASS — tutte le suite verdi (conteggio invariato + i nuovi test di Task 1 e Task 5).

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 2: Verifica manuale con script Playwright temporaneo**

Scrivere ed eseguire uno script temporaneo (stesso pattern di autenticazione di `e2e/helpers/auth.ts`, cancellato a verifica completata) che:
1. Crea (o riusa) un ordine di test con `status = "pronto"` e `msg_pronto_inviato = false`, con telefono e email validi.
2. Apre la dashboard "Oggi" e verifica che l'ordine compaia nella sezione "Da avvisare".
3. Apre la scheda ordine, verifica che il riquadro "Avvisa il cliente" sia visibile con i bottoni WhatsApp/Email.
4. Clicca il bottone WhatsApp (o Email), attende il refresh, e verifica che: il riquadro "Avvisa il cliente" sia sparito, il badge "Msg PRONTO" nei Flags sia acceso.
5. Torna alla dashboard "Oggi" e verifica che l'ordine sia sparito dalla sezione "Da avvisare".
6. Crea un secondo ordine di test con `status = "pronto"`, `msg_pronto_inviato = false`, **senza** telefono né email, e verifica che compaia comunque in "Da avvisare" (ma senza riquadro "Avvisa il cliente" visibile in scheda, comportamento invariato).
7. Cancella entrambi gli ordini di test (bypassando l'app via service role, stesso pattern di Flusso D).

- [ ] **Step 3: Aggiornare CLAUDE.md**

Aggiungere una riga alla tabella "Decisioni chiave e motivazioni" (dopo la riga su "Segna come pagato"):

```markdown
| Sezione "Da avvisare" nella dashboard "Oggi" + auto-segna "Msg pronto inviato" al click sul link WhatsApp/Email (2026-09-16) | Il problema reale non era "il messaggio si perde dopo l'invio" ma il passo umano che salta a monte: l'ordine resta "pronto" senza che nessun punto dell'app lo segnali come "cosa da fare oggi". Scartata una nuova voce di menu dedicata (navigazione già a 8 voci) in favore di una sezione nella dashboard esistente — stesso pattern di "Materiale da ordinare". Nuova server action `markMsgProntoInviato` richiamata dal click sui bottoni WhatsApp/Email (componente client `NotifyReadyLinks`, che avvolge `QuickContactLink` ora con un `onClick` opzionale) — un passaggio in meno, non uno in più: prima serviva comunque aprire "Modifica" per spuntare il flag a mano. La sezione mostra anche gli ordini pronti senza telefono/email valido, perché in quel caso serve comunque un'azione (chiamare, o aggiungere il contatto). Nessuna integrazione WhatsApp Business API vera: resta un link `wa.me`/`mailto` cliccato dall'utente — l'invio davvero automatico (senza click umano) richiederebbe verifica Meta, numero dedicato, template pre-approvati e un costo per conversazione, scartato in fase di brainstorming perché il problema reale era il passo che salta, non la mancanza di automazione. Design in `docs/superpowers/specs/2026-09-16-avviso-ordine-pronto-design.md`, piano in `docs/superpowers/plans/2026-09-16-avviso-ordine-pronto-plan.md` |
```

Aggiungere un bullet alla sezione "Testing" (dopo il bullet su "Segna come pagato"), riassumendo cosa è stato costruito e cosa ha verificato lo script Playwright temporaneo del Step 2 (nuova action `markMsgProntoInviato` con relativi test, nuova query `daAvvisare` in `/api/dashboard/today` con relativi test, nuovo componente `NotifyReadyLinks`, conteggio suite/test aggiornato).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta la sezione Da avvisare e l'auto-segna Msg pronto inviato in CLAUDE.md"
```
