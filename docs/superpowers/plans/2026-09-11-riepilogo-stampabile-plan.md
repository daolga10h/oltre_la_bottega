# Riepilogo stampabile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuova pagina `/riepilogo` che elenca tutti gli ordini attivi raggruppati per stato, con un bottone "Stampa" e una voce di menu dedicata; stampare qualunque pagina della dashboard nasconde automaticamente menu/barre/calcolatrice.

**Architecture:** Pagina server component che riusa `getOrders({ activeOnly: true })` (già ordinato per data di consegna) e la raggruppa per stato in memoria, stesso pattern di raggruppamento già usato in `KanbanBoard.tsx`. Un piccolo client component gestisce solo il click su "Stampa" (`window.print()`). Una modifica al layout condiviso (`(dashboard)/layout.tsx` e i componenti che renderizza) aggiunge `print:hidden` alla UI di navigazione/utility, effetto valido su tutte le pagine della dashboard, non solo su questa. Nessuna migration, nessun nuovo server action.

**Tech Stack:** Next.js App Router (Server + Client Component), TypeScript, Tailwind CSS (variante `print:`), lucide-react.

**Full design reference:** `docs/superpowers/specs/2026-09-11-riepilogo-stampabile-design.md`

---

### Task 1: Nascondere menu/barre/calcolatrice quando si stampa

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/nav/Sidebar.tsx`
- Modify: `src/components/nav/BottomNav.tsx`
- Modify: `src/components/CalculatorWidget.tsx`

- [ ] **Step 1: Nascondere l'header (barra di ricerca + bottone aggiorna) in `layout.tsx`**

Sostituire:
```tsx
        <header className="bg-card border-b border-border px-4 md:px-8 py-3 flex items-center gap-2">
```
con:
```tsx
        <header className="bg-card border-b border-border px-4 md:px-8 py-3 flex items-center gap-2 print:hidden">
```

- [ ] **Step 2: Nascondere la sidebar desktop**

In `src/components/nav/Sidebar.tsx`, sostituire:
```tsx
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card min-h-screen">
```
con:
```tsx
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card min-h-screen print:hidden">
```

- [ ] **Step 3: Nascondere la barra in basso**

In `src/components/nav/BottomNav.tsx`, sostituire:
```tsx
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 flex">
```
con:
```tsx
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 flex print:hidden">
```

- [ ] **Step 4: Nascondere il bottone della calcolatrice**

In `src/components/CalculatorWidget.tsx`, sostituire:
```tsx
    <div className="fixed left-4 bottom-20 md:bottom-4 z-50">
```
con:
```tsx
    <div className="fixed left-4 bottom-20 md:bottom-4 z-50 print:hidden">
```

- [ ] **Step 5: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Verifica manuale rapida**

Run: `npm run dev`, aprire una pagina qualsiasi della dashboard (es. `/dashboard`), apri l'anteprima di stampa del browser (Ctrl+P) — controllare che sidebar, barra di ricerca in alto, barra in basso (se visibile) e bottone calcolatrice non compaiano nell'anteprima, mentre a schermo normale restano visibili come sempre. Chiudere l'anteprima, fermare il server.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx" src/components/nav/Sidebar.tsx src/components/nav/BottomNav.tsx src/components/CalculatorWidget.tsx
git commit -m "feat: nasconde menu, barre e calcolatrice quando si stampa una pagina della dashboard"
```

---

### Task 2: Creare la pagina `/riepilogo`

**Files:**
- Create: `src/app/(dashboard)/riepilogo/StampaButton.tsx`
- Create: `src/app/(dashboard)/riepilogo/page.tsx`

- [ ] **Step 1: Creare il bottone di stampa (client component)**

```tsx
"use client"

import { Printer } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function StampaButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "print:hidden inline-flex items-center gap-1.5")}
    >
      <Printer className="w-4 h-4" />
      Stampa
    </button>
  )
}
```

- [ ] **Step 2: Creare la pagina**

```tsx
import { getOrders } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/orderConstants"
import { formatDate, formatEUR, buildClientDisplayName } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { StampaButton } from "./StampaButton"

export default async function RiepilogoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  const orders = await getOrders({ activeOnly: true })
  const oggi = formatDate(new Date())

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Riepilogo lavori</h1>
          <p className="text-sm text-muted-foreground">{shopName} — {oggi}</p>
        </div>
        <StampaButton />
      </div>

      {orders.length === 0 && (
        <p className="text-muted-foreground text-sm">Nessun ordine attivo.</p>
      )}

      {STATUS_ORDER.filter((s) => s !== "consegnato").map((status) => {
        const statusOrders = orders.filter((o) => o.status === status)
        if (statusOrders.length === 0) return null
        return (
          <div key={status} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">
              {STATUS_LABELS[status]}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {statusOrders.map((o) => {
                  const clientName = buildClientDisplayName(o.nome, o.cognome, o.azienda)
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 [break-inside:avoid]">
                      <td className="px-2 py-2 align-top">
                        <p className="font-semibold">{clientName}</p>
                        {o.referente && <p className="text-xs text-muted-foreground">Ref. {o.referente}</p>}
                      </td>
                      <td className="px-2 py-2 align-top">{o.cosa_ordinato}</td>
                      <td className="px-2 py-2 align-top text-muted-foreground">{o.telefono ?? "—"}</td>
                      <td className="px-2 py-2 align-top text-muted-foreground">
                        {o.data_consegna ? formatDate(o.data_consegna) : "—"}
                      </td>
                      <td className="px-2 py-2 align-top font-semibold text-gold">€{formatEUR(o.saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore riferito a questi due nuovi file

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/riepilogo"
git commit -m "feat: aggiunge la pagina /riepilogo con elenco stampabile degli ordini attivi per stato"
```

---

### Task 3: Aggiungere la voce di menu "Riepilogo"

**Files:**
- Modify: `src/components/nav/Sidebar.tsx`
- Modify: `src/components/nav/BottomNav.tsx`

- [ ] **Step 1: Aggiungere la voce in `Sidebar.tsx`**

Sostituire l'import delle icone:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Settings, Euro } from "lucide-react"
```
con:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Settings, Euro, ClipboardList } from "lucide-react"
```

Sostituire `managementLinks`:
```typescript
const managementLinks = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
]
```
con:
```typescript
const managementLinks = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro },
  { href: "/riepilogo", label: "Riepilogo", icon: ClipboardList },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
]
```

- [ ] **Step 2: Aggiungere la voce in `BottomNav.tsx`**

Sostituire l'import delle icone:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Euro } from "lucide-react"
```
con:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Euro, ClipboardList } from "lucide-react"
```

Sostituire `links`:
```typescript
const links = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro },
  { href: "/customers", label: "Clienti", icon: Users },
]
```
con:
```typescript
const links = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro },
  { href: "/riepilogo", label: "Riepilogo", icon: ClipboardList },
  { href: "/customers", label: "Clienti", icon: Users },
]
```

- [ ] **Step 3: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Commit**

```bash
git add src/components/nav/Sidebar.tsx src/components/nav/BottomNav.tsx
git commit -m "feat: aggiunge la voce di menu \"Riepilogo\" in sidebar e bottom nav"
```

---

### Task 4: Verifica finale e aggiornamento `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Eseguire l'intera suite di test unitari**

Run: `npx jest --roots=src`
Expected: PASS, stesso numero di suite/test di prima (nessun test aggiunto o rimosso — nessuna infrastruttura di test per pagine/nav in questo codebase)

- [ ] **Step 2: Eseguire il type checker sull'intero progetto**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Verifica manuale nel browser**

Run: `npm run dev`, poi:
1. Aprire `/riepilogo` senza ordini attivi — controllare che appaia "Nessun ordine attivo."
2. Creare 3 ordini attivi con stati diversi (es. uno "Da fare", uno "In lavorazione", uno "Pronto") e date di consegna diverse — controllare che in `/riepilogo` compaiano raggruppati in sezioni nell'ordine Preventivo → Bozza grafica → Da fare → In lavorazione → Pronto (solo le sezioni non vuote), e che dentro ogni sezione l'ordinamento sia per data di consegna crescente
3. Creare un ordine ente con un Referente, attivo — controllare che compaia con il nome dell'ente e la riga "Ref. {referente}" sotto
4. Controllare che ogni riga mostri correttamente Cosa ordinato, Telefono (o "—" se assente), Data di consegna (o "—" se assente), Saldo in euro
5. Cliccare "Stampa" — controllare che si apra il dialogo di stampa del browser; nell'anteprima non devono comparire sidebar, barra di ricerca, barra in basso, calcolatrice né il bottone "Stampa" stesso — solo titolo, nome bottega/data, e le sezioni con le righe
6. Controllare che la voce di menu "Riepilogo" (icona lista) compaia sia nella sidebar desktop sia nella barra in basso su una finestra ridotta/mobile, e che porti a `/riepilogo`
7. Un ordine consegnato non deve mai comparire in questa pagina (controllo di non-regressione)
8. Fermare il server di sviluppo (Ctrl+C)

- [ ] **Step 4: Aggiornare `CLAUDE.md`**

Aggiungere questa riga alla tabella "Decisioni chiave e motivazioni", dopo la riga su "Pagina dedicata 'Da incassare'" (l'ultima riga della tabella):

```markdown
| Pagina stampabile "Riepilogo" (`/riepilogo`) con tutti gli ordini attivi raggruppati per stato (2026-09-11) | Serve poter sfogliare o stampare su carta un elenco di tutti i lavori in corso con lo stato di ciascuno, senza navigare nell'app — richiesto dall'utente come riferimento fisico occasionale. Nessuna migration, nessun nuovo server action: riusa `getOrders({ activeOnly: true })` (già ordinato per data di consegna) raggruppandolo in memoria per stato, stesso ordine di `STATUS_ORDER` già usato in `KanbanBoard.tsx` (Preventivo → Bozza grafica → Da fare → In lavorazione → Pronto). Nessun badge di sottostato — la sezione per stato è già l'evidenziazione richiesta. Bottone "Stampa" (`window.print()`) senza dimensione di carta forzata, a differenza dell'etichetta termica esistente. Effetto collaterale voluto, applicato a tutta la dashboard: `(dashboard)/layout.tsx`, `Sidebar.tsx`, `BottomNav.tsx` e `CalculatorWidget.tsx` guadagnano la classe Tailwind `print:hidden`, così stampare qualunque pagina della dashboard mostra solo il contenuto, non più menu/barre/calcolatrice — nessuna pagina aveva un motivo per volerli anche sulla carta. Design in `docs/superpowers/specs/2026-09-11-riepilogo-stampabile-design.md`, piano in `docs/superpowers/plans/2026-09-11-riepilogo-stampabile-plan.md` |
```

Poi aggiungere questo bullet alla sezione `## Testing`, dopo il bullet "Feature (2026-09-10/11): pagina 'Da incassare' per gli ordini in attesa di pagamento":

```markdown
- **Feature (2026-09-11)**: pagina stampabile "Riepilogo" con tutti gli ordini attivi raggruppati per stato — vedere riga corrispondente in Decisioni chiave. Nuova pagina `src/app/(dashboard)/riepilogo/page.tsx` + `StampaButton.tsx` (client component per `window.print()`), nuova voce di menu in `Sidebar.tsx`/`BottomNav.tsx` (icona `ClipboardList`). `print:hidden` aggiunto a `(dashboard)/layout.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `CalculatorWidget.tsx` — effetto valido su tutta la dashboard, non solo su questa pagina. Nessuna migration, nessun nuovo server action, nessuna infrastruttura di test per pagine in questo codebase (stessa convenzione di `/recensioni`/`/pagamenti`) — verificato manualmente nel browser: raggruppamento e ordinamento corretti, ordine ente mostra "Ref.", anteprima di stampa priva di menu/barre/calcolatrice su questa pagina e su un'altra pagina qualsiasi della dashboard, ordini consegnati esclusi. Design in `docs/superpowers/specs/2026-09-11-riepilogo-stampabile-design.md`, piano in `docs/superpowers/plans/2026-09-11-riepilogo-stampabile-plan.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta la pagina /riepilogo in CLAUDE.md"
```
