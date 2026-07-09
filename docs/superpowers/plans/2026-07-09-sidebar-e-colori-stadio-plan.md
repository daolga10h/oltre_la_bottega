# Sidebar semplificata e colori per stadio — Piano di implementazione

> **Per chi esegue in autonomia:** SOTTO-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire questo piano un task alla volta. I passi usano la sintassi checkbox (`- [ ]`) per il tracciamento.

**Obiettivo:** Semplificare il branding del sidebar (solo testo "Oltre la Bottega", niente quadratino/nome bottega) e far leggere a colpo d'occhio lo stadio esatto di preventivo/bozza grafica/materiale fornitore tramite colori (terracotta = da fare, honey = in attesa, sage = completato), sia nei bottoni della scheda ordine sia nei badge di lista/bacheca (senza icone).

**Architettura:** Tre funzioni pure di mappatura stadio in `src/lib/orderConstants.ts` (testate con Jest), un componente `StageBadge` condiviso esportato da `OrderCard.tsx`, e aggiornamenti mirati a 4 file esistenti (Sidebar, scheda ordine, OrderCard, KanbanBoard).

**Stack tecnico:** Next.js, React, TypeScript, Tailwind CSS, Jest.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-09-sidebar-e-colori-stadio-design.md`

---

### Task 1: Sidebar semplificata

**File:**
- Modifica: `src/components/nav/Sidebar.tsx`

- [ ] **Passo 1: Sostituisci il contenuto del file**

Sostituisci l'intero contenuto di `src/components/nav/Sidebar.tsx`:

```typescript
"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star } from "lucide-react"
import { cn } from "@/lib/utils"

const mainLinks = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
]

const managementLinks = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/customers", label: "Clienti", icon: Users },
]

function NavLink({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: React.ElementType; pathname: string }) {
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-semibold"
          : "text-bark hover:bg-muted/60 font-normal"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gold rounded-r-full" />
      )}
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card min-h-screen">
      {/* striscia ambra in cima */}
      <div className="mx-4 h-0.5 bg-gradient-to-r from-gold to-amber rounded-b-sm" />

      <div className="flex flex-col flex-1 p-4 gap-1">
        {/* Nome prodotto */}
        <div className="px-2 pb-5 pt-2">
          <span className="block font-bold text-[13px] tracking-tight text-foreground">Oltre la Bottega</span>
        </div>

        {/* Principale */}
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-warm-ash">Principale</p>
        {mainLinks.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} />
        ))}

        {/* Gestione */}
        <p className="px-3 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-warm-ash">Gestione</p>
        {managementLinks.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} />
        ))}
      </div>
    </aside>
  )
}
```

Nota: rimossi `useState`, `useEffect`, `createClient` (da `@/lib/supabase/client`), `getShopName` — non più usati in questo file. Il componente resta `"use client"` perché usa `usePathname()`.

- [ ] **Passo 2: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 3: Verifica manuale**

Esegui: `npm run dev`, apri qualunque pagina della dashboard. Nel sidebar
in alto a sinistra deve comparire solo il testo "Oltre la Bottega" in
grassetto, senza quadratino né nome bottega. Il resto del sidebar
(link di navigazione, striscia ambra) invariato.

- [ ] **Passo 4: Commit**

```bash
git add src/components/nav/Sidebar.tsx
git commit -m "feat: semplifica il sidebar, rimuovi quadratino e nome bottega"
```

---

### Task 2: Funzioni pure di mappatura stadio (TDD)

**File:**
- Modifica: `src/lib/orderConstants.ts`
- Test: `src/lib/__tests__/orderConstants.test.ts`

- [ ] **Passo 1: Scrivi i test che falliscono**

Aggiungi in fondo a `src/lib/__tests__/orderConstants.test.ts` (dopo il
blocco `describe("computeSaldo", ...)` esistente):

```typescript

import { preventivoStage, bozzaStage, materialeStage } from "../orderConstants"

describe("preventivoStage", () => {
  it("maps da_inviare to red", () => {
    expect(preventivoStage("da_inviare")).toBe("red")
  })
  it("maps inviato to yellow", () => {
    expect(preventivoStage("inviato")).toBe("yellow")
  })
  it("maps approvato to green", () => {
    expect(preventivoStage("approvato")).toBe("green")
  })
  it("returns null for non_inviare and unknown values", () => {
    expect(preventivoStage("non_inviare")).toBeNull()
    expect(preventivoStage("qualcosa")).toBeNull()
  })
})

describe("bozzaStage", () => {
  it("maps da_fare to red", () => {
    expect(bozzaStage("da_fare")).toBe("red")
  })
  it("maps inviata and modificata to yellow", () => {
    expect(bozzaStage("inviata")).toBe("yellow")
    expect(bozzaStage("modificata")).toBe("yellow")
  })
  it("maps approvata to green", () => {
    expect(bozzaStage("approvata")).toBe("green")
  })
  it("returns null for non_serve and unknown values", () => {
    expect(bozzaStage("non_serve")).toBeNull()
    expect(bozzaStage("qualcosa")).toBeNull()
  })
})

describe("materialeStage", () => {
  it("maps da_ordinare to red", () => {
    expect(materialeStage("da_ordinare")).toBe("red")
  })
  it("maps ordinato to yellow", () => {
    expect(materialeStage("ordinato")).toBe("yellow")
  })
  it("maps arrivato to green", () => {
    expect(materialeStage("arrivato")).toBe("green")
  })
  it("returns null for non_serve and unknown values", () => {
    expect(materialeStage("non_serve")).toBeNull()
    expect(materialeStage("qualcosa")).toBeNull()
  })
})
```

- [ ] **Passo 2: Esegui i test per verificare che falliscano**

Comando: `npx jest src/lib/__tests__/orderConstants.test.ts`
Atteso: FALLISCE — `preventivoStage`/`bozzaStage`/`materialeStage` non
sono esportate da `../orderConstants`.

- [ ] **Passo 3: Implementa le tre funzioni**

Aggiungi in fondo a `src/lib/orderConstants.ts`:

```typescript

export type Stage = "red" | "yellow" | "green"

export function preventivoStage(value: string): Stage | null {
  if (value === "da_inviare") return "red"
  if (value === "inviato") return "yellow"
  if (value === "approvato") return "green"
  return null
}

export function bozzaStage(value: string): Stage | null {
  if (value === "da_fare") return "red"
  if (value === "inviata" || value === "modificata") return "yellow"
  if (value === "approvata") return "green"
  return null
}

export function materialeStage(value: string): Stage | null {
  if (value === "da_ordinare") return "red"
  if (value === "ordinato") return "yellow"
  if (value === "arrivato") return "green"
  return null
}
```

- [ ] **Passo 4: Esegui i test per verificare che passino**

Comando: `npx jest src/lib/__tests__/orderConstants.test.ts`
Atteso: PASSA — tutti i test verdi (esistenti + 12 nuovi).

- [ ] **Passo 5: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 6: Commit**

```bash
git add src/lib/orderConstants.ts src/lib/__tests__/orderConstants.test.ts
git commit -m "feat: aggiungi funzioni pure di mappatura stadio (preventivo/bozza/materiale)"
```

---

### Task 3: Bottoni rapidi nella scheda ordine — colore per stadio

**File:**
- Modifica: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Passo 1: Importa le funzioni di stadio**

Sostituisci la riga di import (riga 3):

```typescript
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/orderConstants"
```

con:

```typescript
import { STATUS_LABELS, STATUS_ORDER, preventivoStage, bozzaStage, materialeStage, type Stage } from "@/lib/orderConstants"
```

- [ ] **Passo 2: Aggiungi la mappa colore-stadio**

Aggiungi questa costante subito dopo il blocco degli import (dopo la
riga `import { getShopName } from "@/lib/shop-name"`):

```typescript

const PILL_STAGE_CLASSES: Record<Stage, string> = {
  red: "bg-terracotta/15 text-terracotta border-terracotta/30",
  yellow: "bg-honey text-bark border-gold/40",
  green: "bg-sage text-[#3a5a2e] border-sage",
}
const PILL_OFF_CLASS = "bg-card text-foreground border-border hover:border-foreground/30"
```

- [ ] **Passo 3: Aggiorna il gruppo di pill "Preventivo"**

Sostituisci (righe 172-181):

```typescript
              {([["da_inviare", "Da inviare"], ["inviato", "Inviato"], ["approvato", "Approvato"]] as const).map(([v, label]) => (
                <form key={v} action={changePreventivo}>
                  <input type="hidden" name="preventivo" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    (order as any).preventivo === v
                      ? "bg-espresso text-cream border-espresso"
                      : "bg-card text-foreground border-border hover:border-foreground/30"
                  )}>{label}</button>
                </form>
              ))}
```

con:

```typescript
              {([["da_inviare", "Da inviare"], ["inviato", "Inviato"], ["approvato", "Approvato"]] as const).map(([v, label]) => (
                <form key={v} action={changePreventivo}>
                  <input type="hidden" name="preventivo" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    (order as any).preventivo === v
                      ? PILL_STAGE_CLASSES[preventivoStage(v) ?? "yellow"]
                      : PILL_OFF_CLASS
                  )}>{label}</button>
                </form>
              ))}
```

- [ ] **Passo 4: Aggiorna il gruppo di pill "Bozza grafica"**

Sostituisci (righe 190-199):

```typescript
              {([["da_fare", "Da fare"], ["inviata", "Inviata"], ["modificata", "Modificata"], ["approvata", "Approvata"]] as const).map(([v, label]) => (
                <form key={v} action={changeBozza}>
                  <input type="hidden" name="bozza" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    order.bozza_grafica === v
                      ? "bg-sage text-[#3a5a2e] border-sage"
                      : "bg-card text-foreground border-border hover:border-foreground/30"
                  )}>{label}</button>
                </form>
              ))}
```

con:

```typescript
              {([["da_fare", "Da fare"], ["inviata", "Inviata"], ["modificata", "Modificata"], ["approvata", "Approvata"]] as const).map(([v, label]) => (
                <form key={v} action={changeBozza}>
                  <input type="hidden" name="bozza" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    order.bozza_grafica === v
                      ? PILL_STAGE_CLASSES[bozzaStage(v) ?? "yellow"]
                      : PILL_OFF_CLASS
                  )}>{label}</button>
                </form>
              ))}
```

- [ ] **Passo 5: Aggiorna il gruppo di pill "Materiale fornitore"**

Sostituisci (righe 208-217):

```typescript
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
```

con:

```typescript
              {([["da_ordinare", "Da ordinare"], ["ordinato", "Ordinato"], ["arrivato", "Arrivato"]] as const).map(([v, label]) => (
                <form key={v} action={changeMateriale}>
                  <input type="hidden" name="materiale" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    order.materiale === v
                      ? PILL_STAGE_CLASSES[materialeStage(v) ?? "yellow"]
                      : PILL_OFF_CLASS
                  )}>{label}</button>
                </form>
              ))}
```

- [ ] **Passo 6: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 7: Verifica manuale**

Esegui: `npm run dev`, apri un ordine con bozza grafica in stato "Da
fare": il pill "Da fare" deve essere terracotta (non più sage). Usa il
bottone rapido per passare a "Inviata": diventa honey. Passa ad
"Approvata": diventa sage. Ripeti lo stesso controllo per Preventivo
(da_inviare→terracotta, inviato→honey, approvato→sage) e Materiale
fornitore (da_ordinare→terracotta, ordinato→honey, arrivato→sage).

- [ ] **Passo 8: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: colora i bottoni rapidi della scheda ordine in base allo stadio"
```

---

### Task 4: Componente `StageBadge` condiviso

**File:**
- Modifica: `src/components/OrderCard.tsx`

- [ ] **Passo 1: Aggiungi il componente `StageBadge`**

In `src/components/OrderCard.tsx`, aggiungi questo subito dopo la fine
della funzione `StatusBadge` (dopo la riga 33, prima di
`export function OrderCard`):

```typescript

const BADGE_STAGE_CLASSES: Record<"red" | "yellow", string> = {
  red: "bg-terracotta/15 text-terracotta",
  yellow: "bg-honey text-bark",
}

export function StageBadge({ label, tone }: { label: string; tone: "red" | "yellow" }) {
  return (
    <span className={cn(
      "inline-flex items-center text-xs px-1.5 py-0.5 rounded whitespace-nowrap",
      BADGE_STAGE_CLASSES[tone]
    )}>
      {label}
    </span>
  )
}
```

- [ ] **Passo 2: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore (il componente non è ancora usato altrove, va
bene).

- [ ] **Passo 3: Commit**

```bash
git add src/components/OrderCard.tsx
git commit -m "feat: aggiungi componente StageBadge condiviso"
```

---

### Task 5: Badge in Lista Ordini (`OrderCard.tsx`)

**File:**
- Modifica: `src/components/OrderCard.tsx`

- [ ] **Passo 1: Importa le funzioni di stadio**

Sostituisci la riga di import (riga 3):

```typescript
import { cn, formatDate, formatEUR, isOverdue } from "@/lib/utils"
```

con:

```typescript
import { cn, formatDate, formatEUR, isOverdue } from "@/lib/utils"
import { preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
```

- [ ] **Passo 2: Rimuovi l'import dell'icona `Package` non più necessaria**

Sostituisci (riga 2):

```typescript
import { Package } from "lucide-react"
```

Rimuovi questa riga (non serve più: `StageBadge` non usa icone).

- [ ] **Passo 3: Sostituisci il badge materiale ed aggiungi il badge bozza/preventivo**

Sostituisci il blocco di testata della card (dentro `export function
OrderCard`, il div `flex items-start justify-between gap-2`):

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

con:

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

- [ ] **Passo 4: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 5: Verifica manuale**

Esegui: `npm run dev`, apri `/orders`. Trova (o crea/modifica) un ordine
con bozza grafica "da fare": deve comparire un badge rosso "da fare"
sulla card, senza icona. Passalo a "inviata": badge giallo "in attesa".
Passalo ad "approvata": badge sparisce (lo status principale avanza).
Ripeti per preventivo e materiale fornitore (materiale "da ordinare" →
badge rosso "da ordinare"; "ordinato" → badge giallo "ordinato";
"arrivato" → nessun badge, come già oggi).

- [ ] **Passo 6: Commit**

```bash
git add src/components/OrderCard.tsx
git commit -m "feat: aggiungi badge per stadio bozza/preventivo/materiale in lista ordini"
```

---

### Task 6: Badge in Bacheca (`KanbanBoard.tsx`)

**File:**
- Modifica: `src/components/KanbanBoard.tsx`

- [ ] **Passo 1: Aggiorna gli import**

Il file oggi ha queste righe di import (circa righe 3-11):

```typescript
import { useState, useTransition } from "react"
import { updateOrderStatus } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/orderConstants"
import { formatDate, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Clock, Package } from "lucide-react"
import type { OrderRow } from "@/actions/orders"
```

Sostituiscile con:

```typescript
import { useState, useTransition } from "react"
import { updateOrderStatus } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS, preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
import { formatDate, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { StageBadge } from "@/components/OrderCard"
import type { OrderRow } from "@/actions/orders"
```

Note: la riga `import { Clock, Package } from "lucide-react"` è rimossa
del tutto — nessuna delle due icone è più usata in questo file, dato che
`StageBadge` non ha icone.

- [ ] **Passo 2: Sostituisci il blocco badge nella card**

Sostituisci (righe 66-83, il blocco di testata della card kanban):

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

con:

```typescript
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-foreground">{clientName}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {materialeStage(order.materiale) === "red" && <StageBadge label="da ordinare" tone="red" />}
                          {materialeStage(order.materiale) === "yellow" && <StageBadge label="ordinato" tone="yellow" />}
                          {order.status === "preventivo" && preventivoStage((order as any).preventivo) === "red" && <StageBadge label="da inviare" tone="red" />}
                          {order.status === "preventivo" && preventivoStage((order as any).preventivo) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
                          {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "red" && <StageBadge label="da fare" tone="red" />}
                          {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
                        </div>
                      </div>
```

- [ ] **Passo 3: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 4: Verifica manuale**

Esegui: `npm run dev`, apri `/kanban`. Stessa verifica del Task 5 ma
nella vista Bacheca. Verifica anche il caso con due badge insieme (un
ordine con materiale "da ordinare" E bozza "inviata" nella stessa card):
devono comparire entrambi i badge, rosso e giallo, senza sovrapporsi.

- [ ] **Passo 5: Commit**

```bash
git add src/components/KanbanBoard.tsx
git commit -m "feat: colora per stadio i badge bozza/preventivo/materiale in bacheca"
```

---

### Task 7: Aggiorna DESIGN.md e CLAUDE.md

**File:**
- Modifica: `DESIGN.md`
- Modifica: `CLAUDE.md`

- [ ] **Passo 1: Aggiorna la sezione "Badge stato ordine" in DESIGN.md**

Trova la sezione `### Badge stato ordine` in `DESIGN.md` e aggiungi
subito dopo la tabella esistente (dopo la riga `| consegnato |
\`bg-linen text-muted-foreground\` |`):

```markdown

### Colori per stadio (preventivo, bozza grafica, materiale fornitore)
- Non un colore fisso per tutto il sottostato: il colore dipende dal
  valore esatto — terracotta (non ancora iniziato), honey (in attesa),
  sage (completato)
- Classi pill (bottoni scheda ordine): `bg-terracotta/15 text-terracotta
  border-terracotta/30` / `bg-honey text-bark border-gold/40` /
  `bg-sage text-[#3a5a2e] border-sage`
- Classi badge (card lista/bacheca, solo rosso/giallo — il verde non
  serve badge, sparisce da solo): `bg-terracotta/15 text-terracotta` /
  `bg-honey text-bark`
- Nessuna icona nei badge di stadio: solo testo su sfondo colorato, su
  richiesta esplicita (le iconcine abbassavano la percezione qualitativa
  delle card)
```

Trova anche la sezione `### Logo mark "OB" — riutilizzo` e aggiungi una
riga in fondo alla sua lista puntata:

```markdown
- Sidebar: **rimosso il 2026-07-09** — mostra solo il testo "Oltre la
  Bottega", nessun quadratino né nome bottega personalizzato (resta
  invece in login, etichetta di stampa e favicon)
```

- [ ] **Passo 2: Aggiungi righe a "Decisioni chiave e motivazioni" in CLAUDE.md**

Aggiungi queste righe alla tabella (in fondo, dopo l'ultima riga
esistente):

```markdown
| Sidebar: rimosso il quadratino con le iniziali e il nome bottega personalizzato, resta solo "Oltre la Bottega" | Semplificazione visiva su richiesta esplicita; il nome bottega personalizzato resta comunque usato altrove (messaggi WhatsApp/email, etichetta di stampa) tramite `getShopName()` |
| Colori per stadio su preventivo/bozza grafica/materiale fornitore (bottoni scheda ordine + badge lista/bacheca) | Prima un solo colore fisso per l'intero sottostato rendeva indistinguibili "appena iniziato" e "completato". Ora terracotta/honey/sage in base al valore esatto, riusando colori già nel design system con lo stesso significato semantico (terracotta = urgenza, honey = attivo, sage = completato). Funzioni pure `preventivoStage`/`bozzaStage`/`materialeStage` in `src/lib/orderConstants.ts`, testate. Badge di lista/bacheca senza icone (solo testo colorato) su richiesta esplicita |
```

- [ ] **Passo 3: Commit**

```bash
git add DESIGN.md CLAUDE.md
git commit -m "docs: documenta sidebar semplificato e colori per stadio"
```

---

## Note di autoverifica

- **Copertura spec:** sidebar (Task 1), funzioni di stadio (Task 2),
  bottoni scheda ordine (Task 3), componente condiviso (Task 4), badge
  lista (Task 5), badge bacheca (Task 6), documentazione (Task 7) —
  ogni sezione della spec è coperta.
- **Nessun placeholder:** ogni passo mostra codice esatto, percorsi file
  esatti, comandi esatti.
- **Coerenza dei tipi:** `Stage` definito in Task 2 (`orderConstants.ts`)
  è lo stesso tipo importato e usato in Task 3; `StageBadge` definito in
  Task 4 (`OrderCard.tsx`) ha la stessa firma (`label`, `tone: "red" |
  "yellow"`) usata nei Task 5 e 6; `preventivoStage`/`bozzaStage`/
  `materialeStage` hanno la stessa firma ovunque vengano chiamate.
- **Badge senza icone:** confermato in Task 4/5/6 — nessun `Clock`/
  `Package` importato o usato, coerente con il feedback dell'utente sul
  mockup.
