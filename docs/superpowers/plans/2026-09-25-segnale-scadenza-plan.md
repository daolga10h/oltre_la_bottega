# Segnale visivo "in scadenza" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare su lista ordini, bacheca, scheda ordine e due liste della dashboard un segnale a 3 livelli (Domani / Oggi / In ritardo) — card colorata + pallino luminoso che pulsa piano per Oggi e In ritardo — calcolato solo dai giorni alla consegna.

**Architecture:** Una funzione pura `deadlineLevel(dataConsegna, status, now)` (`src/lib/deadline.ts`, testata con TDD, giorni contati su `Europe/Rome` confrontando date `YYYY-MM-DD`) decide il livello. Un componente senza stato `DeadlineDot` (+ mappa `DEADLINE_CARD_CLASSES` con le classi della card per livello) e poche classi CSS in `globals.css` (alone luminoso, pulsazione, `prefers-reduced-motion`) lo rendono in modo uniforme. Ogni punto d'uso chiama `deadlineLevel` e applica pallino e classi. Nessuna migration, nessun server action, nessuna dipendenza.

**Tech Stack:** Next.js 16 / React 19 (server e client component), TypeScript strict, Tailwind v4 (+ CSS puro in `globals.css`), `Intl.DateTimeFormat` (fuso `Europe/Rome`), Jest (`ts-jest`, `testEnvironment: "node"`), Playwright (verifica temporanea).

---

## Contesto tecnico importante (letto dal codice attuale, branch `main`)

- **Regole di business** (concordate con l'utente, vedere `docs/superpowers/specs/2026-09-25-segnale-scadenza-design.md`): contano solo i giorni. `domani` = mancano 1 giorno, `oggi` = 0, `ritardo` = data passata, altrimenti nessun segnale. `consegnato` → mai segnale. `pronto` → solo `ritardo`, mai domani/oggi. Nessuna data → nessun segnale. Solo tema chiaro (i colori `.dark` in `globals.css` non vengono mai attivati). Nessuna nuova scheda in dashboard.
- **Colori** (palette esistente, mai `bg-amber`): honey `#f8da9d`, gold `#e89b01`, terracotta `#f0624f`. Classi card: `domani` = `border-honey bg-[#fef6e4]`, `oggi` = `border-gold bg-[#fde7bd]`, `ritardo` = `border-terracotta/40 bg-[#fdf0ef]` (quest'ultima identica a quella che `OrderCard` usa oggi per il ritardo).
- `src/components/OrderCard.tsx` (server component, lista ordini): oggi calcola `overdue` con `isOverdue` (`src/lib/utils.ts`, date-fns sul fuso del server) e applica `border-terracotta/40 bg-[#fdf0ef]` + data rossa. Il nuovo `deadlineLevel` la sostituisce **in questo file soltanto**; `isOverdue`/`dueDateLabel` restano in `utils.ts` (non toccarli).
- `src/components/KanbanBoard.tsx` (client component): le card mostrano solo la data grigia; oggi nemmeno il ritardo è evidenziato. `cn` è già importato. Le colonne escludono `consegnato`.
- `src/app/(dashboard)/orders/[id]/page.tsx` (server component): intestazione con "Consegna prevista" e la data in un `<span>`.
- `src/components/TodayBoard.tsx` (client): `DashboardListCard` mostra righe `OrderSummary` (senza `status`/`data_consegna`). La route `src/app/api/dashboard/today/route.ts` seleziona solo `id, cosa_ordinato, nome, cognome, azienda, referente` per `materialeDaOrdinare` (indice 5 in `from("orders")`) e `daAvvisare` (indice 7). Il test `src/app/api/dashboard/today/__tests__/route.test.ts` controlla le select con `client.from.mock.results[n].value.select.mock.calls[0][0]`.
- `cn` (`@/lib/utils`) è `clsx` + `tailwind-merge`: le classi in conflitto (`bg-card` vs `bg-[#...]`, `border-border` vs `border-honey`) si risolvono a favore dell'ultima.
- `src/app/globals.css` termina con un blocco `@layer base { ... }`: il nuovo CSS va **aggiunto in fondo al file**, fuori da qualunque `@layer`.
- Lista ordini: `/orders` supporta `?q=<testo>` (ricerca su nome/cosa ordinato/...). Bacheca: `/kanban`. Dashboard: `/dashboard` (carica i dati con `fetch("/api/dashboard/today")`).
- Jest: `npx jest --roots=src` (17 suite / 152 test verdi prima di iniziare). `npx tsc --noEmit` pulito. Lint: `npx eslint <file>`; il lint globale ha 12 errori pre-esistenti non correlati — l'obiettivo è **non aggiungerne di nuovi**. In `KanbanBoard.tsx` esistono già 2 errori `@typescript-eslint/no-explicit-any` (cast `(order as any).preventivo`), attesi.
- Nessuna infrastruttura di test per componenti/pagine (Jest senza DOM): la logica pura si testa con Jest (Task 1, Task 4), il resto con `tsc`/`eslint` e con lo script Playwright temporaneo (Task 7).
- I commit usano l'attribuzione `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` esattamente, indipendentemente dal modello che li esegue.

---

### Task 1: Funzione pura `deadlineLevel` (TDD)

**Files:**
- Create: `src/lib/deadline.ts`
- Test: `src/lib/__tests__/deadline.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `src/lib/__tests__/deadline.test.ts`:

```ts
import { deadlineLevel, DEADLINE_LABELS } from "../deadline"

// 24 set 2026, ore 12:00 a Roma (10:00 UTC)
const NOW = new Date("2026-09-24T10:00:00Z")

describe("deadlineLevel", () => {
  it("returns null when there is no delivery date", () => {
    expect(deadlineLevel(null, "in_lavorazione", NOW)).toBeNull()
    expect(deadlineLevel(undefined, "in_lavorazione", NOW)).toBeNull()
    expect(deadlineLevel("", "in_lavorazione", NOW)).toBeNull()
  })

  it("returns null for delivered orders, even when the date is in the past", () => {
    expect(deadlineLevel("2026-09-20", "consegnato", NOW)).toBeNull()
    expect(deadlineLevel("2026-09-25", "consegnato", NOW)).toBeNull()
  })

  it("returns 'domani' when delivery is tomorrow", () => {
    expect(deadlineLevel("2026-09-25", "in_lavorazione", NOW)).toBe("domani")
  })

  it("returns 'oggi' when delivery is today", () => {
    expect(deadlineLevel("2026-09-24", "in_lavorazione", NOW)).toBe("oggi")
  })

  it("returns 'ritardo' when the delivery date has passed", () => {
    expect(deadlineLevel("2026-09-23", "in_lavorazione", NOW)).toBe("ritardo")
    expect(deadlineLevel("2026-01-01", "in_lavorazione", NOW)).toBe("ritardo")
  })

  it("returns null when delivery is two or more days away", () => {
    expect(deadlineLevel("2026-09-26", "in_lavorazione", NOW)).toBeNull()
    expect(deadlineLevel("2026-12-31", "in_lavorazione", NOW)).toBeNull()
  })

  it.each(["preventivo", "bozza_grafica", "da_fare", "in_lavorazione"])(
    "signals domani, oggi and ritardo for status %s",
    (status) => {
      expect(deadlineLevel("2026-09-25", status, NOW)).toBe("domani")
      expect(deadlineLevel("2026-09-24", status, NOW)).toBe("oggi")
      expect(deadlineLevel("2026-09-23", status, NOW)).toBe("ritardo")
    }
  )

  it("never signals domani or oggi for orders that are already 'pronto'", () => {
    expect(deadlineLevel("2026-09-25", "pronto", NOW)).toBeNull()
    expect(deadlineLevel("2026-09-24", "pronto", NOW)).toBeNull()
  })

  it("still signals ritardo for 'pronto' orders", () => {
    expect(deadlineLevel("2026-09-23", "pronto", NOW)).toBe("ritardo")
  })

  it("counts days across a month boundary", () => {
    const endOfMonth = new Date("2026-09-30T10:00:00Z")
    expect(deadlineLevel("2026-10-01", "in_lavorazione", endOfMonth)).toBe("domani")
    expect(deadlineLevel("2026-09-30", "in_lavorazione", endOfMonth)).toBe("oggi")
  })

  it("counts days across a year boundary", () => {
    const endOfYear = new Date("2026-12-31T10:00:00Z")
    expect(deadlineLevel("2027-01-01", "in_lavorazione", endOfYear)).toBe("domani")
  })

  it("uses the Rome calendar day, not the UTC day", () => {
    // 00:30 del 24 set a Roma = 22:30 UTC del 23 set
    const justAfterMidnightInRome = new Date("2026-09-23T22:30:00Z")
    expect(deadlineLevel("2026-09-24", "in_lavorazione", justAfterMidnightInRome)).toBe("oggi")
    expect(deadlineLevel("2026-09-25", "in_lavorazione", justAfterMidnightInRome)).toBe("domani")
    expect(deadlineLevel("2026-09-23", "in_lavorazione", justAfterMidnightInRome)).toBe("ritardo")
  })

  it("stays correct across the end of daylight saving time", () => {
    // Il 25 ott 2026 a Roma si torna all'ora solare (03:00 -> 02:00)
    const beforeChange = new Date("2026-10-25T00:30:00Z") // 02:30 del 25 ott (ora legale)
    const afterChange = new Date("2026-10-25T23:30:00Z") // 00:30 del 26 ott (ora solare)
    expect(deadlineLevel("2026-10-25", "in_lavorazione", beforeChange)).toBe("oggi")
    expect(deadlineLevel("2026-10-26", "in_lavorazione", beforeChange)).toBe("domani")
    expect(deadlineLevel("2026-10-26", "in_lavorazione", afterChange)).toBe("oggi")
  })

  it("ignores a time part in the date string", () => {
    expect(deadlineLevel("2026-09-25T00:00:00", "in_lavorazione", NOW)).toBe("domani")
  })

  it("returns null for an unparseable date", () => {
    expect(deadlineLevel("boh", "in_lavorazione", NOW)).toBeNull()
  })
})

describe("DEADLINE_LABELS", () => {
  it("has a human-readable label for every level", () => {
    expect(DEADLINE_LABELS).toEqual({
      domani: "Consegna domani",
      oggi: "Consegna oggi",
      ritardo: "Consegna in ritardo",
    })
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/lib/__tests__/deadline.test.ts`
Expected: FAIL — `Cannot find module '../deadline'`

- [ ] **Step 3: Scrivi l'implementazione**

Crea `src/lib/deadline.ts`:

```ts
export type DeadlineLevel = "domani" | "oggi" | "ritardo"

export const DEADLINE_LABELS: Record<DeadlineLevel, string> = {
  domani: "Consegna domani",
  oggi: "Consegna oggi",
  ritardo: "Consegna in ritardo",
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Il server gira in UTC: calcolare "oggi" sul suo fuso sbaglierebbe giorno tra
// mezzanotte e l'una/due di notte italiane, quindi si usa sempre il giorno di Roma.
function romeDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number)
  const [ty, tm, td] = toIso.split("-").map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY)
}

export function deadlineLevel(
  dataConsegna: string | null | undefined,
  status: string,
  now: Date = new Date()
): DeadlineLevel | null {
  if (!dataConsegna || status === "consegnato") return null

  const diff = daysBetween(romeDate(now), dataConsegna.slice(0, 10))
  if (diff < 0) return "ritardo"
  if (status === "pronto") return null
  if (diff === 0) return "oggi"
  if (diff === 1) return "domani"
  return null
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/lib/__tests__/deadline.test.ts`
Expected: PASS — 19 test verdi (nel conteggio vanno contati i 4 casi di `it.each`)

- [ ] **Step 5: Verifica suite completa, tipi e lint**

Run: `npx jest --roots=src`
Expected: PASS, nessun test esistente rotto (152 + 19 = 171 test attesi: verifica il numero realmente stampato invece di fidarti di questo)

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx eslint src/lib/deadline.ts src/lib/__tests__/deadline.test.ts`
Expected: nessun output (0 problemi)

- [ ] **Step 6: Commit**

```bash
git add src/lib/deadline.ts src/lib/__tests__/deadline.test.ts
git commit -m "$(cat <<'EOF'
feat: aggiunge deadlineLevel per il segnale di scadenza degli ordini

Funzione pura che dice se un ordine e' in consegna domani, oggi o in
ritardo contando i giorni sulle date di Roma (non sul fuso del server).
Consegnato non ha mai segnale, pronto solo il ritardo. Primo passo del
segnale visivo "in scadenza"; non ancora usata da nessun componente.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Componente `DeadlineDot` e stile del pallino

**Files:**
- Create: `src/components/DeadlineDot.tsx`
- Modify: `src/app/globals.css` (aggiunta in fondo al file)

Nessun test automatico (componente di sola presentazione, Jest senza DOM): verifica con `tsc`/`eslint`; il comportamento reale (colori, pulsazione, `prefers-reduced-motion`) è verificato nel Task 7.

- [ ] **Step 1: Crea il componente**

Crea `src/components/DeadlineDot.tsx`:

```tsx
import { cn } from "@/lib/utils"
import { DEADLINE_LABELS, type DeadlineLevel } from "@/lib/deadline"

export const DEADLINE_CARD_CLASSES: Record<DeadlineLevel, string> = {
  domani: "border-honey bg-[#fef6e4]",
  oggi: "border-gold bg-[#fde7bd]",
  ritardo: "border-terracotta/40 bg-[#fdf0ef]",
}

export function DeadlineDot({ level, className }: { level: DeadlineLevel | null; className?: string }) {
  if (!level) return null

  return (
    <span
      role="img"
      aria-label={DEADLINE_LABELS[level]}
      title={DEADLINE_LABELS[level]}
      className={cn("deadline-dot", `deadline-dot-${level}`, className)}
    />
  )
}
```

- [ ] **Step 2: Aggiungi lo stile in fondo a `src/app/globals.css`**

Il file termina con il blocco `@layer base { ... }` (con `html { @apply font-sans; }`). Aggiungi **dopo** quel blocco, lasciando una riga vuota:

```css

.deadline-dot {
  display: inline-block;
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  border: 1.5px solid rgba(97, 89, 74, 0.35);
  background: rgb(var(--deadline-rgb));
  box-shadow:
    0 0 0 3px rgba(var(--deadline-rgb), 0.28),
    0 0 9px rgba(var(--deadline-rgb), 0.85);
}

.deadline-dot-domani {
  --deadline-rgb: 248, 218, 157;
}

.deadline-dot-oggi {
  --deadline-rgb: 232, 155, 1;
}

.deadline-dot-ritardo {
  --deadline-rgb: 240, 98, 79;
}

@keyframes deadline-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 0 rgba(var(--deadline-rgb), 0.55),
      0 0 8px rgba(var(--deadline-rgb), 0.7);
  }
  50% {
    box-shadow:
      0 0 0 8px rgba(var(--deadline-rgb), 0),
      0 0 14px rgba(var(--deadline-rgb), 1);
  }
}

.deadline-dot-oggi,
.deadline-dot-ritardo {
  animation: deadline-pulse 2.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .deadline-dot-oggi,
  .deadline-dot-ritardo {
    animation: none;
  }
}
```

- [ ] **Step 3: Verifica tipi e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx eslint src/components/DeadlineDot.tsx`
Expected: nessun output (0 problemi)

Run: `npx jest --roots=src`
Expected: PASS (nessuna regressione)

- [ ] **Step 4: Commit**

```bash
git add src/components/DeadlineDot.tsx src/app/globals.css
git commit -m "$(cat <<'EOF'
feat: aggiunge il pallino DeadlineDot e le classi card per livello

Pallino luminoso senza testo (role="img" con aria-label) e mappa delle
classi card per domani/oggi/ritardo con i soli colori gia' in palette.
Domani fermo, Oggi e In ritardo pulsano piano; prefers-reduced-motion
disattiva la pulsazione. Non ancora usato dalle card.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Segnale in lista ordini (`OrderCard`) e in Bacheca (`KanbanBoard`)

**Files:**
- Modify: `src/components/OrderCard.tsx`
- Modify: `src/components/KanbanBoard.tsx`

- [ ] **Step 1: `OrderCard.tsx` — import**

Trova:

```tsx
import { cn, formatDate, formatEUR, isOverdue, buildClientDisplayName } from "@/lib/utils"
import { preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
```

Sostituisci con:

```tsx
import { cn, formatDate, formatEUR, buildClientDisplayName } from "@/lib/utils"
import { preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
import { deadlineLevel } from "@/lib/deadline"
import { DeadlineDot, DEADLINE_CARD_CLASSES } from "@/components/DeadlineDot"
```

- [ ] **Step 2: `OrderCard.tsx` — calcolo del livello e classi della card**

Trova:

```tsx
  const overdue = order.data_consegna ? isOverdue(order.data_consegna) : false
```

Sostituisci con:

```tsx
  const level = deadlineLevel(order.data_consegna, order.status)
```

Trova:

```tsx
        overdue && order.status !== "consegnato" && "border-terracotta/40 bg-[#fdf0ef]"
```

Sostituisci con:

```tsx
        level && DEADLINE_CARD_CLASSES[level]
```

- [ ] **Step 3: `OrderCard.tsx` — pallino e data rossa**

Trova:

```tsx
            <StatusBadge status={order.status} />
```

Sostituisci con:

```tsx
            <StatusBadge status={order.status} />
            <DeadlineDot level={level} className="ml-1" />
```

Trova:

```tsx
            <span className={overdue && order.status !== "consegnato" ? "text-terracotta font-semibold" : ""}>
```

Sostituisci con:

```tsx
            <span className={level === "ritardo" ? "text-terracotta font-semibold" : ""}>
```

Dopo queste modifiche `isOverdue` non deve comparire più in `OrderCard.tsx` (verifica con una ricerca).

- [ ] **Step 4: `KanbanBoard.tsx` — import**

Trova:

```tsx
import { StageBadge } from "@/components/OrderCard"
```

Sostituisci con:

```tsx
import { StageBadge } from "@/components/OrderCard"
import { DeadlineDot, DEADLINE_CARD_CLASSES } from "@/components/DeadlineDot"
import { deadlineLevel } from "@/lib/deadline"
```

- [ ] **Step 5: `KanbanBoard.tsx` — calcolo del livello e classi della card**

Trova:

```tsx
                  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)
```

Sostituisci con:

```tsx
                  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)
                  const level = deadlineLevel(order.data_consegna, order.status)
```

Trova:

```tsx
                    <div
                      key={order.id}
                      className="bg-card border border-border rounded-lg p-3 shadow-[0px_2px_4px_0px_rgba(59,39,22,0.05)] hover:shadow-[0px_4px_10px_0px_rgba(59,39,22,0.1)] transition-shadow space-y-2"
                    >
```

Sostituisci con:

```tsx
                    <div
                      key={order.id}
                      className={cn(
                        "bg-card border border-border rounded-lg p-3 shadow-[0px_2px_4px_0px_rgba(59,39,22,0.05)] hover:shadow-[0px_4px_10px_0px_rgba(59,39,22,0.1)] transition-shadow space-y-2",
                        level && DEADLINE_CARD_CLASSES[level]
                      )}
                    >
```

- [ ] **Step 6: `KanbanBoard.tsx` — pallino e data rossa**

Trova:

```tsx
                          {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
                        </div>
```

Sostituisci con:

```tsx
                          {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
                          <DeadlineDot level={level} className="ml-1" />
                        </div>
```

Trova:

```tsx
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDate(order.data_consegna)}
                        </p>
```

Sostituisci con:

```tsx
                        <p className={cn("text-xs font-medium text-muted-foreground", level === "ritardo" && "text-terracotta font-semibold")}>
                          {formatDate(order.data_consegna)}
                        </p>
```

- [ ] **Step 7: Verifica tipi, suite e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: PASS (nessuna regressione; nessun test copre questi componenti)

Run: `npx eslint src/components/OrderCard.tsx src/components/KanbanBoard.tsx`
Expected: nessun problema in `OrderCard.tsx`; in `KanbanBoard.tsx` **solo** i 2 errori già esistenti `@typescript-eslint/no-explicit-any` (i cast `(order as any).preventivo`). Nessun altro errore o avviso.

- [ ] **Step 8: Commit**

```bash
git add src/components/OrderCard.tsx src/components/KanbanBoard.tsx
git commit -m "$(cat <<'EOF'
feat: mostra il segnale di scadenza in lista ordini e bacheca

Le card colorano sfondo e bordo e mostrano il pallino per Domani, Oggi
e In ritardo, calcolati da deadlineLevel. In lista il ritardo resta
identico a prima (bordo e sfondo rosati, data rossa); in bacheca e' una
novita', prima nemmeno il ritardo era evidenziato.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Segnale nelle righe della dashboard (route + `TodayBoard`)

**Files:**
- Test: `src/app/api/dashboard/today/__tests__/route.test.ts`
- Modify: `src/app/api/dashboard/today/route.ts`
- Modify: `src/components/TodayBoard.tsx`

- [ ] **Step 1: Scrivi il test che fallisce**

In `src/app/api/dashboard/today/__tests__/route.test.ts`, trova il test esistente che termina così (nel primo `describe`, subito prima di `it("returns 500 and does not leak internals if a query throws"`):

```ts
    expect(results[3].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[4].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[5].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[6].value.select.mock.calls[0][0]).toContain("referente")
    expect(results[7].value.select.mock.calls[0][0]).toContain("referente")
  })
```

Aggiungi subito dopo (una riga vuota di separazione):

```ts

  it("includes status and data_consegna in the select for materialeDaOrdinare and daAvvisare (needed for the deadline dot)", async () => {
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [])
    mockCreateClient.mockResolvedValue(client)

    await GET()

    const results = client.from.mock.results
    for (const index of [5, 7]) {
      const select = results[index].value.select.mock.calls[0][0]
      expect(select).toContain("status")
      expect(select).toContain("data_consegna")
    }
  })
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: FAIL solo nel nuovo test (`expect(select).toContain("status")` — la select di `materialeDaOrdinare` non contiene ancora `status`). Gli altri test del file restano verdi.

- [ ] **Step 3: Estendi le due select nella route**

In `src/app/api/dashboard/today/route.ts` trova:

```ts
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("materiale", "da_ordinare"),
```

Sostituisci con:

```ts
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("materiale", "da_ordinare"),
```

Trova:

```ts
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("status", "pronto").eq("msg_pronto_inviato", false),
```

Sostituisci con:

```ts
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("status", "pronto").eq("msg_pronto_inviato", false),
```

Non toccare le altre select (`deliveredRes`, `materialeOrdinatoOggiRes`, `todayRes`).

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: PASS, tutti i test del file verdi

- [ ] **Step 5: `TodayBoard.tsx` — import**

Trova:

```tsx
import { buildClientDisplayName } from "@/lib/utils"
import { Clock, CheckCircle2, Package } from "lucide-react"
```

Sostituisci con:

```tsx
import { buildClientDisplayName, cn } from "@/lib/utils"
import { deadlineLevel } from "@/lib/deadline"
import { DeadlineDot, DEADLINE_CARD_CLASSES } from "@/components/DeadlineDot"
import { Clock, CheckCircle2, Package } from "lucide-react"
```

(`Clock` è un import inutilizzato già presente: lascialo com'è, non è parte di questo lavoro.)

- [ ] **Step 6: `TodayBoard.tsx` — tipo `OrderSummary`**

Trova:

```tsx
interface OrderSummary {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
}
```

Sostituisci con:

```tsx
interface OrderSummary {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  status?: string
  data_consegna?: string | null
}
```

- [ ] **Step 7: `TodayBoard.tsx` — attiva il segnale solo su due liste**

Trova:

```tsx
        title="Da avvisare"
        items={daAvvisare}
        badgeClassName="bg-honey border-gold/40 text-bark"
        chevron
      />
```

Sostituisci con:

```tsx
        title="Da avvisare"
        items={daAvvisare}
        badgeClassName="bg-honey border-gold/40 text-bark"
        chevron
        showDeadline
      />
```

Trova:

```tsx
        title="Materiale da ordinare"
        items={materialeDaOrdinare}
        badgeClassName="bg-terracotta/15 border-terracotta/30 text-terracotta"
        chevron
      />
```

Sostituisci con:

```tsx
        title="Materiale da ordinare"
        items={materialeDaOrdinare}
        badgeClassName="bg-terracotta/15 border-terracotta/30 text-terracotta"
        chevron
        showDeadline
      />
```

Non aggiungere `showDeadline` alle altre tre liste ("Da consegnare oggi", "Consegnati oggi", "Materiale ordinato oggi").

- [ ] **Step 8: `TodayBoard.tsx` — props di `DashboardListCard`**

Trova:

```tsx
function DashboardListCard({
  title,
  items,
  badgeClassName,
  icon: Icon,
  chevron = false,
}: {
  title: string
  items: OrderSummary[]
  badgeClassName: string
  icon?: ComponentType<{ className?: string }>
  chevron?: boolean
}) {
```

Sostituisci con:

```tsx
function DashboardListCard({
  title,
  items,
  badgeClassName,
  icon: Icon,
  chevron = false,
  showDeadline = false,
}: {
  title: string
  items: OrderSummary[]
  badgeClassName: string
  icon?: ComponentType<{ className?: string }>
  chevron?: boolean
  showDeadline?: boolean
}) {
```

- [ ] **Step 9: `TodayBoard.tsx` — riga con pallino**

Trova:

```tsx
        {items.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className={`flex items-center bg-background rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors group ${Icon ? "gap-3" : "justify-between"}`}
          >
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
            {chevron && <span className="text-muted-foreground/50 group-hover:text-muted-foreground text-sm">›</span>}
          </Link>
        ))}
```

Sostituisci con:

```tsx
        {items.map((o) => {
          const level = showDeadline ? deadlineLevel(o.data_consegna, o.status ?? "") : null
          return (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className={cn(
                "flex items-center bg-background rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors group",
                Icon ? "gap-3" : "justify-between",
                level && cn("border", DEADLINE_CARD_CLASSES[level])
              )}
            >
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
              {(level || chevron) && (
                <div className="flex items-center gap-3">
                  <DeadlineDot level={level} />
                  {chevron && <span className="text-muted-foreground/50 group-hover:text-muted-foreground text-sm">›</span>}
                </div>
              )}
            </Link>
          )
        })}
```

- [ ] **Step 10: Verifica tipi, suite e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: PASS, tutti i test verdi (compreso il nuovo)

Run: `npx eslint src/components/TodayBoard.tsx src/app/api/dashboard/today/route.ts src/app/api/dashboard/today/__tests__/route.test.ts`
Expected: l'unico problema è l'avviso **già esistente** `'Clock' is defined but never used` in `TodayBoard.tsx`. Nulla di nuovo.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/dashboard/today/__tests__/route.test.ts src/app/api/dashboard/today/route.ts src/components/TodayBoard.tsx
git commit -m "$(cat <<'EOF'
feat: mostra il segnale di scadenza nelle righe della dashboard

Le liste "Materiale da ordinare" e "Da avvisare" mostrano ora sfondo
colorato e pallino per Domani/Oggi/In ritardo. La route aggiunge status
e data_consegna alle sole due select interessate. Nessun segnale in "Da
consegnare oggi" (sarebbe sempre Oggi) ne' nelle liste di lavoro gia'
fatto.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Pallino accanto alla data nella scheda ordine

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Import**

Trova:

```tsx
import { StatusBadge } from "@/components/OrderCard"
```

Sostituisci con:

```tsx
import { StatusBadge } from "@/components/OrderCard"
import { DeadlineDot } from "@/components/DeadlineDot"
import { deadlineLevel } from "@/lib/deadline"
```

- [ ] **Step 2: Calcolo del livello**

Trova:

```tsx
  const order = await getOrder(id)
  if (!order) notFound()
```

Sostituisci con:

```tsx
  const order = await getOrder(id)
  if (!order) notFound()
  const level = deadlineLevel(order.data_consegna, order.status)
```

- [ ] **Step 3: Pallino accanto alla data di consegna**

Trova:

```tsx
            <span className="text-base font-semibold text-foreground">{formatDate(order.data_consegna)}</span>
```

Sostituisci con:

```tsx
            <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <DeadlineDot level={level} />
              {formatDate(order.data_consegna)}
            </span>
```

- [ ] **Step 4: Verifica tipi, suite e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: PASS

Run: `npx eslint "src/app/(dashboard)/orders/[id]/page.tsx"`
Expected: l'unico problema è l'errore **già esistente** `@typescript-eslint/no-explicit-any` su `(order as any).preventivo`. Nulla di nuovo.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat: mostra il pallino di scadenza accanto alla data nella scheda ordine

Nell'intestazione, vicino a "Consegna prevista", compare lo stesso
pallino di lista e bacheca per Domani, Oggi e In ritardo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Documenta la convenzione in `DESIGN.md`

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Aggiungi la sezione prima di "KPI Card"**

Trova:

```markdown
### KPI Card
- Sfondo `bg-card`, bordo `border-border`
```

Sostituisci con:

```markdown
### Segnale di scadenza (2026-09-25)
- Tre livelli in base ai giorni alla consegna (`deadlineLevel` in `src/lib/deadline.ts`, giorni contati sul calendario di `Europe/Rome`): **Domani**, **Oggi**, **In ritardo**. `consegnato` non ha mai segnale; `pronto` solo "In ritardo"
- Card colorata (mappa `DEADLINE_CARD_CLASSES` in `src/components/DeadlineDot.tsx`): Domani `border-honey bg-[#fef6e4]`, Oggi `border-gold bg-[#fde7bd]`, In ritardo `border-terracotta/40 bg-[#fdf0ef]` — solo colori già in palette, mai `bg-amber` (riservato ai pulsanti primari)
- Pallino luminoso 12px (`DeadlineDot`, classi `.deadline-dot*` in `globals.css`), senza testo ma con `role="img"` e `aria-label`/`title` ("Consegna domani" / "Consegna oggi" / "Consegna in ritardo"). Domani fermo; Oggi e In ritardo pulsano piano (2,2 s), `prefers-reduced-motion` disattiva la pulsazione
- Compare in lista ordini, bacheca, scheda ordine (accanto alla data) e sulle righe dashboard "Materiale da ordinare" e "Da avvisare"; non in "Da consegnare oggi" (sarebbe sempre "Oggi")
- Solo tema chiaro: i colori `.dark` definiti in `globals.css` non sono mai attivati nell'app

### KPI Card
- Sfondo `bg-card`, bordo `border-border`
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "$(cat <<'EOF'
docs: documenta in DESIGN.md il segnale di scadenza

Livelli, colori (solo palette esistente), pallino luminoso con
pulsazione e dove compare.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Verifica end-to-end con uno script Playwright temporaneo

**Files:**
- Create (temporaneo, da cancellare a fine task, MAI da committare): `e2e/tmp-segnale-scadenza.spec.ts`

Questo task non produce commit: crea lo script, lo esegue, riporta i risultati **reali**, lo cancella. Gira contro lo stesso progetto Supabase dell'app (anche produzione): crea solo ordini il cui `nome` inizia con `E2E Scadenza ` e li cancella a fine run via service role. Non toccare altre righe. Non stampare valori segreti di `.env.local`.

- [ ] **Step 1: Prepara l'ambiente**

Il worktree non contiene `.env.local` (è in `.gitignore`). Copialo dal checkout principale (copia locale, non finisce in git):

```bash
cp "D:/Documenti/Projects/oltre_la_bottega/.env.local" .env.local
```

Verifica che la porta 3000 sia libera (altrimenti Playwright riuserebbe un server di sviluppo con codice diverso):

```bash
netstat -ano | grep ":3000 " || echo "porta 3000 libera"
```

Expected: `porta 3000 libera`. Se è occupata **fermati e riporta NEEDS_CONTEXT**: non terminare processi che non hai avviato tu. Se i browser Playwright non fossero installati: `npx playwright install chromium`.

- [ ] **Step 2: Crea lo script temporaneo**

Crea `e2e/tmp-segnale-scadenza.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { getTestAuthCookies } from "./helpers/auth"

// TEMPORANEO: verifica end-to-end del segnale di scadenza (Domani/Oggi/In ritardo).
// Da cancellare a verifica completata, non fa parte della suite permanente.
// Gira contro lo stesso progetto Supabase dell'app: gli ordini di prova vengono
// cancellati in afterAll tramite service role.

const PREFIX = "E2E Scadenza"

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const romeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
function romeToday(): string {
  const parts = romeFormat.formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const TODAY = romeToday()

const DOMANI = "Consegna domani"
const OGGI = "Consegna oggi"
const RITARDO = "Consegna in ritardo"

type Case = { key: string; overrides: Record<string, unknown>; expected: string | null }

const CASES: Case[] = [
  { key: "A", overrides: { status: "in_lavorazione", data_consegna: addDays(TODAY, 1) }, expected: DOMANI },
  { key: "B", overrides: { status: "da_fare", data_consegna: TODAY }, expected: OGGI },
  { key: "C", overrides: { status: "in_lavorazione", data_consegna: addDays(TODAY, -2) }, expected: RITARDO },
  { key: "D", overrides: { status: "in_lavorazione", data_consegna: addDays(TODAY, 3) }, expected: null },
  { key: "E", overrides: { status: "pronto", msg_pronto_inviato: true, data_consegna: addDays(TODAY, 1) }, expected: null },
  { key: "F", overrides: { status: "pronto", msg_pronto_inviato: false, data_consegna: addDays(TODAY, -1) }, expected: RITARDO },
  { key: "G", overrides: { status: "consegnato", data_consegnato: addDays(TODAY, -3), data_consegna: addDays(TODAY, -4) }, expected: null },
  { key: "H", overrides: { status: "in_lavorazione", materiale: "da_ordinare", data_consegna: addDays(TODAY, 1) }, expected: DOMANI },
]

const TINT: Record<string, RegExp> = {
  [DOMANI]: /bg-\[#fef6e4\]/,
  [OGGI]: /bg-\[#fde7bd\]/,
  [RITARDO]: /bg-\[#fdf0ef\]/,
}

test.describe("Segnale di scadenza (temporaneo)", () => {
  test.setTimeout(90_000)

  let cookies: Awaited<ReturnType<typeof getTestAuthCookies>>
  const fixtures: Record<string, { id: string; nome: string }> = {}

  test.beforeAll(async () => {
    cookies = await getTestAuthCookies()
    const db = admin()
    for (const c of CASES) {
      const nome = `${PREFIX} ${c.key} ${Date.now()}`
      const { data, error } = await db
        .from("orders")
        .insert({
          nome,
          cognome: "Test",
          telefono: "3331234567",
          canale: "negozio",
          cosa_ordinato: `Prova scadenza ${c.key}`,
          prezzo: 10,
          ...c.overrides,
        })
        .select("id")
        .single()
      if (error || !data) throw new Error(`Creazione ordine ${c.key} fallita: ${error?.message}`)
      const { error: itemError } = await db.from("order_items").insert({
        order_id: data.id,
        cosa_ordinato: `Prova scadenza ${c.key}`,
        quantita: 1,
        prezzo_unitario: 10,
        posizione: 0,
      })
      if (itemError) throw new Error(`Creazione riga articolo ${c.key} fallita: ${itemError.message}`)
      fixtures[c.key] = { id: data.id, nome }
    }
  })

  test.beforeEach(async ({ context }) => {
    await context.addCookies(cookies)
  })

  test.afterAll(async () => {
    const db = admin()
    for (const f of Object.values(fixtures)) {
      await db.from("orders").delete().eq("id", f.id)
    }
    const { count: orders } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .like("nome", `${PREFIX} %`)
    const { count: items } = await db
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .like("cosa_ordinato", "Prova scadenza %")
    console.log(`RESIDUI dopo cleanup: orders=${orders} order_items=${items}`)
    expect(orders).toBe(0)
    expect(items).toBe(0)
  })

  test("1. scheda ordine: pallino corretto accanto alla data", async ({ page }) => {
    for (const c of CASES) {
      const { id, nome } = fixtures[c.key]
      await page.goto(`/orders/${id}`)
      await expect(page.locator("h1").filter({ hasText: nome })).toBeVisible()
      const dots = page.getByRole("img", { name: /^Consegna/ })
      if (c.expected) {
        await expect(dots).toHaveCount(1)
        await expect(dots.first()).toHaveAttribute("aria-label", c.expected)
      } else {
        await expect(dots).toHaveCount(0)
      }
    }
  })

  test("2. lista ordini: card colorata e pallino", async ({ page }) => {
    await page.goto(`/orders?q=${encodeURIComponent(PREFIX)}`)
    for (const c of CASES) {
      const { nome } = fixtures[c.key]
      const card = page.locator("a", { hasText: nome })
      if (c.key === "G") {
        await expect(card).toHaveCount(0) // consegnato: fuori dalla lista attivi
        continue
      }
      await expect(card).toHaveCount(1)
      const dot = card.getByRole("img", { name: /^Consegna/ })
      if (c.expected) {
        await expect(dot).toHaveAttribute("aria-label", c.expected)
        await expect(card.locator("div").first()).toHaveClass(TINT[c.expected])
      } else {
        await expect(dot).toHaveCount(0)
        await expect(card.locator("div").first()).not.toHaveClass(/bg-\[#f/)
      }
    }
  })

  test("3. bacheca: card colorata e pallino", async ({ page }) => {
    await page.goto("/kanban")
    for (const c of CASES) {
      const { nome } = fixtures[c.key]
      if (c.key === "G") {
        await expect(page.getByText(nome)).toHaveCount(0) // consegnato: nessuna colonna
        continue
      }
      const nameEl = page.getByText(nome).first()
      await expect(nameEl).toBeVisible()
      const card = nameEl.locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
      const dot = card.getByRole("img", { name: /^Consegna/ })
      if (c.expected) {
        await expect(dot).toHaveAttribute("aria-label", c.expected)
        await expect(card).toHaveClass(TINT[c.expected])
      } else {
        await expect(dot).toHaveCount(0)
      }
    }
  })

  test("4. dashboard: pallino su Materiale da ordinare e Da avvisare, non su Da consegnare oggi", async ({ page }) => {
    await page.goto("/dashboard")

    const rowH = page.locator("a", { hasText: fixtures.H.nome })
    await expect(rowH).toBeVisible()
    await expect(rowH.getByRole("img", { name: DOMANI })).toBeVisible()

    const rowF = page.locator("a", { hasText: fixtures.F.nome })
    await expect(rowF).toBeVisible()
    await expect(rowF.getByRole("img", { name: RITARDO })).toBeVisible()

    const rowB = page.locator("a", { hasText: fixtures.B.nome })
    await expect(rowB).toBeVisible() // compare in "Da consegnare oggi"
    await expect(rowB.getByRole("img")).toHaveCount(0)
  })

  test("5. animazione: Oggi e In ritardo pulsano, Domani no; reduced-motion la spegne", async ({ page }) => {
    const animationOf = async (key: string) => {
      await page.goto(`/orders/${fixtures[key].id}`)
      const dot = page.getByRole("img", { name: /^Consegna/ })
      await expect(dot).toHaveCount(1)
      return dot.evaluate((el) => getComputedStyle(el).animationName)
    }

    expect(await animationOf("A")).toBe("none") // domani
    expect(await animationOf("B")).toBe("deadline-pulse") // oggi
    expect(await animationOf("C")).toBe("deadline-pulse") // ritardo

    await page.emulateMedia({ reducedMotion: "reduce" })
    expect(await animationOf("B")).toBe("none")
    expect(await animationOf("C")).toBe("none")
  })
})
```

- [ ] **Step 3: Esegui lo script**

Run: `npx playwright test e2e/tmp-segnale-scadenza.spec.ts --project=chromium --reporter=list`
Expected: avvia da solo il server di sviluppo (`npm run dev`, può richiedere fino a ~2 minuti al primo avvio) e termina con `5 passed`. L'output deve contenere la riga `RESIDUI dopo cleanup: orders=0 order_items=0`.

Nota sul test 4: la riga B compare in "Da consegnare oggi" solo se la data UTC coincide con quella di Roma (la route usa una data UTC, limite preesistente e fuori scope). Se lo script gira tra mezzanotte e l'una/due di notte italiane, il test 4 può fallire per questo motivo: in quel caso riporta l'orario e riesegui più tardi, non modificare l'app.

Se un test fallisce, **non modificare il codice dell'app di tua iniziativa**: riporta il test fallito, il messaggio d'errore esatto e cosa hai osservato (è il motivo per cui esiste la verifica). Se fallisce per un difetto dello script (locator sbagliato, timing), correggi lo script e riesegui, dichiarandolo nel report.

- [ ] **Step 4: Cancella lo script e ripulisci**

```bash
rm e2e/tmp-segnale-scadenza.spec.ts
git status --short
```

Expected: `git status --short` non mostra nulla di tracciabile (né lo script, né altri file; `.env.local` è ignorato). Se compaiono altri file (es. `test-results/`, `playwright-report/`), verifica che siano ignorati, altrimenti cancellali. Dopo il run, se restassero righe con `nome` come `E2E Scadenza %`, cancellale via service role e riportalo.

- [ ] **Step 5: Report**

Nessun commit. Riporta: test passati/falliti con i nomi, la riga `RESIDUI dopo cleanup: ...` così com'è stata stampata, eventuali aggiustamenti allo script, conferma che lo script è cancellato e `git status` è pulito.

---

## Dopo l'implementazione (fuori da questo piano)

Il controller (non gli implementatori):
1. Controlla in modo indipendente che non restino righe `E2E Scadenza %` nel database.
2. Porta il branch su `main` **senza fare `git checkout main` nel checkout principale** se questo è su un altro branch (oggi lo è: `feature/sito-vetrina`): usa un worktree temporaneo di `main` (`git worktree add .claude/worktrees/tmp-main-merge main`, `git -C <path> merge --ff-only <branch>`, poi rimuovilo). Verifica `npx jest --roots=src` e `npx tsc --noEmit` sul risultato.
3. Aggiorna `CLAUDE.md` (riga in "Decisioni chiave" + bullet in Testing) con l'esito reale della verifica, sempre via worktree temporaneo su `main`.
4. **Prima di pushare** avvisa l'utente: `main` locale contiene anche commit di documentazione del sito vetrina non ancora pushati, che il push pubblicherebbe. Poi push e controllo della CI con `gh run watch`.
5. L'utente guarda l'aspetto reale (colori, pulsazione) su un ordine vero, anche dal tablet.
