# Livello base — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un livello "base" all'app, scelto con una variabile d'ambiente per installazione, che nasconde le funzioni avanzate e offre il foglio lavoro A4 al posto dell'etichetta termica, lasciando il livello "completo" identico a oggi.

**Architecture:** Un file puro `src/lib/plan.ts` legge `NEXT_PUBLIC_PLAN` (`base` | `completo`, default `completo`) ed espone `hasFeature(...)`, l'elenco degli stati per livello e la scelta del formato di stampa. Menu, form ordine, bacheca, scheda ordine, pagine fuori livello e pagina di stampa chiedono a `plan.ts` cosa mostrare; non conoscono i livelli. Nessuna modifica al database.

**Tech Stack:** Next.js 16 (App Router, server components + client components), TypeScript, Jest (`ts-jest`) per i test unitari, Playwright per la prova reale, Supabase invariato.

**Riferimento:** `docs/superpowers/specs/2026-09-26-livello-base-design.md`

---

## Note per chi esegue

- **Attribuzione dei commit:** ogni commit termina con la riga `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (usa `git commit -m "titolo" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`). Non scrivere il nome di un altro modello.
- **Lingua:** commenti nel codice, messaggi di commit e testi dell'interfaccia sono in italiano, come nel resto del progetto.
- **Comandi di verifica del progetto:** `npx jest --roots=src` (mai `npx jest` senza `--roots`, raccoglierebbe anche gli spec Playwright) e `npx tsc --noEmit`.
- **Il livello "completo" non deve cambiare mai.** Dopo ogni task che tocca file esistenti, `npx tsc --noEmit` deve essere pulito.

## Mappa dei file

| File | Azione | Responsabilità |
|---|---|---|
| `src/lib/plan.ts` | crea | Livelli, funzioni attive, ordine degli stati, formato di stampa |
| `src/lib/__tests__/plan.test.ts` | crea | Test unitari di `plan.ts` |
| `.env.example` | modifica | Documenta `NEXT_PUBLIC_PLAN` |
| `src/components/nav/Sidebar.tsx` | modifica | Nasconde le voci fuori livello |
| `src/components/nav/BottomNav.tsx` | modifica | Nasconde le voci fuori livello |
| `src/app/(dashboard)/layout.tsx` | modifica | Nasconde la calcolatrice nel base |
| `src/app/(dashboard)/pagamenti/page.tsx` | modifica | 404 nel base |
| `src/app/(dashboard)/riepilogo/page.tsx` | modifica | 404 nel base |
| `src/app/(dashboard)/impostazioni/page.tsx` | modifica | Nasconde "Operatori" nel base |
| `src/components/OrderForm.tsx` | modifica | Nasconde i campi fuori livello |
| `src/components/KanbanBoard.tsx` | modifica | Colonne e selettore di stato per livello |
| `src/app/(dashboard)/orders/[id]/page.tsx` | modifica | Stepper per livello, bottoni di stampa, freccia indietro |
| `src/app/(print)/orders/[id]/print/FoglioLavoroClient.tsx` | crea | Layout del foglio lavoro (mezzo A4) |
| `src/app/(print)/orders/[id]/print/page.tsx` | modifica | Sceglie etichetta o foglio |
| `playwright.base.config.ts` | crea | Avvia l'app con `NEXT_PUBLIC_PLAN=base` sulla porta 3100 |
| `e2e/livello-base.spec.ts` | crea | Prova reale del livello base |
| `CLAUDE.md` | modifica | Decisione, stato dei test |

---

### Task 0: Preparare l'ambiente di lavoro

**Files:** nessuno (solo ambiente).

- [ ] **Step 1: Creare il worktree partendo da `main` locale**

Il worktree deve partire da `main` *locale* (contiene spec e piano, non ancora pushati), non da `origin/main`. Dalla cartella principale del progetto:

```bash
git worktree add .claude/worktrees/livello-base -b feature/livello-base main
cd .claude/worktrees/livello-base
git log --oneline -1
```

Expected: l'ultimo commit è `docs: piano di implementazione del livello base` (o successivo).

- [ ] **Step 2: Installare le dipendenze e copiare le credenziali**

```bash
npm ci
cp ../../../.env.local .env.local
```

`.env.local` è ignorato da git: non va committato. Serve al test Playwright (Task 6) che usa il progetto Supabase reale.

- [ ] **Step 3: Verificare la base di partenza**

```bash
npx jest --roots=src
npx tsc --noEmit
```

Expected: tutte le suite verdi (17 suite / 152 test al momento in cui il piano è scritto), `tsc` senza errori. Se qualcosa fallisce già ora, fermarsi e segnalarlo: non è colpa di questo lavoro.

---

### Task 1: `plan.ts` con i suoi test

**Files:**
- Create: `src/lib/plan.ts`
- Test: `src/lib/__tests__/plan.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/__tests__/plan.test.ts`:

```ts
import {
  parsePlan,
  getPlan,
  hasFeature,
  statusOrderForPlan,
  resolvePrintFormat,
  type Feature,
} from "../plan"
import { STATUS_ORDER } from "../orderConstants"

const ALL_FEATURES: Feature[] = [
  "multi_riga",
  "ente",
  "materiale",
  "bozza_grafica",
  "campi_avanzati",
  "elenco_ordini",
  "operatore",
  "da_incassare",
  "riepilogo",
  "etichetta_termica",
  "calcolatrice",
]

describe("parsePlan", () => {
  it("riconosce 'base'", () => {
    expect(parsePlan("base")).toBe("base")
  })

  it("ignora maiuscole e spazi", () => {
    expect(parsePlan("  BASE ")).toBe("base")
  })

  it("ripiega su 'completo' se manca la variabile", () => {
    expect(parsePlan(undefined)).toBe("completo")
    expect(parsePlan("")).toBe("completo")
  })

  it("ripiega su 'completo' per valori non riconosciuti", () => {
    expect(parsePlan("premium")).toBe("completo")
    expect(parsePlan("completo")).toBe("completo")
  })
})

describe("getPlan", () => {
  const original = process.env.NEXT_PUBLIC_PLAN

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PLAN
    else process.env.NEXT_PUBLIC_PLAN = original
  })

  it("legge NEXT_PUBLIC_PLAN", () => {
    process.env.NEXT_PUBLIC_PLAN = "base"
    expect(getPlan()).toBe("base")
  })

  it("senza variabile è 'completo'", () => {
    delete process.env.NEXT_PUBLIC_PLAN
    expect(getPlan()).toBe("completo")
  })
})

describe("hasFeature", () => {
  it("nel livello completo ogni funzione è attiva", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature(feature, "completo")).toBe(true)
    }
  })

  it("nel livello base ogni funzione avanzata è spenta", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature(feature, "base")).toBe(false)
    }
  })

  it("senza livello esplicito usa quello dell'ambiente", () => {
    const original = process.env.NEXT_PUBLIC_PLAN
    process.env.NEXT_PUBLIC_PLAN = "base"
    expect(hasFeature("materiale")).toBe(false)
    delete process.env.NEXT_PUBLIC_PLAN
    expect(hasFeature("materiale")).toBe(true)
    if (original !== undefined) process.env.NEXT_PUBLIC_PLAN = original
  })
})

describe("statusOrderForPlan", () => {
  it("nel completo restituisce tutti gli stati", () => {
    expect(statusOrderForPlan("completo")).toEqual(STATUS_ORDER)
  })

  it("nel base salta solo la bozza grafica e mantiene l'ordine", () => {
    expect(statusOrderForPlan("base")).toEqual([
      "preventivo",
      "da_fare",
      "in_lavorazione",
      "pronto",
      "consegnato",
    ])
  })

  it("non modifica la costante originale", () => {
    statusOrderForPlan("base")
    expect(STATUS_ORDER).toContain("bozza_grafica")
  })
})

describe("resolvePrintFormat", () => {
  it("nel completo senza parametro è l'etichetta (come oggi)", () => {
    expect(resolvePrintFormat(undefined, "completo")).toBe("etichetta")
  })

  it("nel completo con formato=foglio è il foglio lavoro", () => {
    expect(resolvePrintFormat("foglio", "completo")).toBe("foglio")
  })

  it("nel completo un formato sconosciuto ripiega sull'etichetta", () => {
    expect(resolvePrintFormat("altro", "completo")).toBe("etichetta")
  })

  it("nel base è sempre il foglio lavoro, anche chiedendo l'etichetta", () => {
    expect(resolvePrintFormat(undefined, "base")).toBe("foglio")
    expect(resolvePrintFormat("etichetta", "base")).toBe("foglio")
    expect(resolvePrintFormat("foglio", "base")).toBe("foglio")
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx jest --roots=src src/lib/__tests__/plan.test.ts`
Expected: FAIL con `Cannot find module '../plan'`.

- [ ] **Step 3: Scrivere l'implementazione minima**

Creare `src/lib/plan.ts`:

```ts
import { STATUS_ORDER } from "@/lib/orderConstants"

/**
 * Livello dell'installazione. Ogni cliente ha la propria istanza, quindi il
 * livello è una variabile d'ambiente, non un dato nel database.
 *
 * - "completo": tutto ciò che l'app sa fare (il livello della mia bottega).
 * - "base": la versione semplificata da vendere; nasconde le funzioni avanzate.
 */
export type Plan = "base" | "completo"

/**
 * Funzioni presenti solo nel livello completo. Chi le usa chiede
 * `hasFeature(...)` e non deve mai conoscere i nomi dei livelli.
 */
export type Feature =
  | "multi_riga"
  | "ente"
  | "materiale"
  | "bozza_grafica"
  | "campi_avanzati" // tipo lavorazione, dettagli grafici, file cliente, foto oggetto
  | "elenco_ordini" // voce di menu "Ordini": nel base si lavora dalla Bacheca
  | "operatore"
  | "da_incassare"
  | "riepilogo"
  | "etichetta_termica"
  | "calcolatrice"

const OFF_IN_BASE: ReadonlySet<Feature> = new Set<Feature>([
  "multi_riga",
  "ente",
  "materiale",
  "bozza_grafica",
  "campi_avanzati",
  "elenco_ordini",
  "operatore",
  "da_incassare",
  "riepilogo",
  "etichetta_termica",
  "calcolatrice",
])

/** Valore mancante o non riconosciuto → "completo": l'installazione esistente non deve rompersi. */
export function parsePlan(value: string | undefined | null): Plan {
  return value?.trim().toLowerCase() === "base" ? "base" : "completo"
}

export function getPlan(): Plan {
  // Deve restare un accesso letterale a process.env.NEXT_PUBLIC_PLAN: Next lo
  // sostituisce con il valore fisso a build-time anche nei componenti client.
  return parsePlan(process.env.NEXT_PUBLIC_PLAN)
}

export function hasFeature(feature: Feature, plan: Plan = getPlan()): boolean {
  return plan === "completo" || !OFF_IN_BASE.has(feature)
}

/** Stati dell'ordine disponibili nel livello, nell'ordine del percorso. */
export function statusOrderForPlan(plan: Plan): string[] {
  return hasFeature("bozza_grafica", plan)
    ? [...STATUS_ORDER]
    : STATUS_ORDER.filter((s) => s !== "bozza_grafica")
}

export type PrintFormat = "etichetta" | "foglio"

/**
 * Nel base esiste solo il foglio lavoro (stampante normale), anche se si apre
 * a mano l'indirizzo dell'etichetta. Nel completo l'etichetta resta il
 * formato predefinito, il foglio si chiede con `?formato=foglio`.
 */
export function resolvePrintFormat(requested: string | undefined, plan: Plan): PrintFormat {
  if (!hasFeature("etichetta_termica", plan)) return "foglio"
  return requested === "foglio" ? "foglio" : "etichetta"
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx jest --roots=src src/lib/__tests__/plan.test.ts`
Expected: PASS, tutti i test verdi.

- [ ] **Step 5: Documentare la variabile e fare il commit**

Aggiungere in fondo a `.env.example`:

```
# Livello dell'installazione: "completo" (default) oppure "base". Richiede un nuovo deploy per cambiare.
NEXT_PUBLIC_PLAN=completo
```

```bash
git add src/lib/plan.ts src/lib/__tests__/plan.test.ts .env.example
git commit -m "feat: livelli base/completo, funzioni attive per livello" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Menu, calcolatrice, pagine fuori livello, Impostazioni

**Files:**
- Modify: `src/components/nav/Sidebar.tsx`
- Modify: `src/components/nav/BottomNav.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/pagamenti/page.tsx`
- Modify: `src/app/(dashboard)/riepilogo/page.tsx`
- Modify: `src/app/(dashboard)/impostazioni/page.tsx`

Non c'è infrastruttura di test per questi componenti (convenzione del progetto): la verifica è `tsc` ora e la prova Playwright nel Task 6.

- [ ] **Step 1: Sidebar**

In `src/components/nav/Sidebar.tsx` sostituire le righe 1-21 (import e le due liste di link) con:

```tsx
"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Settings, Euro, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { hasFeature, type Feature } from "@/lib/plan"

type NavItem = { href: string; label: string; icon: React.ElementType; feature?: Feature }

const mainLinks: NavItem[] = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag, feature: "elenco_ordini" },
]

const managementLinks: NavItem[] = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro, feature: "da_incassare" },
  { href: "/riepilogo", label: "Riepilogo", icon: ClipboardList, feature: "riepilogo" },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
]

const visible = (links: NavItem[]) => links.filter((l) => !l.feature || hasFeature(l.feature))
```

Poi, dentro `Sidebar()`, sostituire `mainLinks.map(` con `visible(mainLinks).map(` e `managementLinks.map(` con `visible(managementLinks).map(`.

- [ ] **Step 2: BottomNav**

In `src/components/nav/BottomNav.tsx` sostituire le righe 1-17 con:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Euro, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { hasFeature, type Feature } from "@/lib/plan"

type NavItem = { href: string; label: string; icon: React.ElementType; feature?: Feature }

const allLinks: NavItem[] = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag, feature: "elenco_ordini" },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro, feature: "da_incassare" },
  { href: "/riepilogo", label: "Riepilogo", icon: ClipboardList, feature: "riepilogo" },
  { href: "/customers", label: "Clienti", icon: Users },
]

const links = allLinks.filter((l) => !l.feature || hasFeature(l.feature))
```

Il resto del file (`links.map(...)` dentro `BottomNav`) resta invariato.

- [ ] **Step 3: Layout della dashboard (calcolatrice)**

In `src/app/(dashboard)/layout.tsx` aggiungere l'import dopo quello di `CalculatorWidget`:

```tsx
import { hasFeature } from "@/lib/plan"
```

e sostituire `      <CalculatorWidget />` con:

```tsx
      {hasFeature("calcolatrice") && <CalculatorWidget />}
```

- [ ] **Step 4: Pagine "Da incassare" e "Riepilogo" → 404 nel base**

In `src/app/(dashboard)/pagamenti/page.tsx` aggiungere agli import:

```tsx
import { notFound } from "next/navigation"
import { hasFeature } from "@/lib/plan"
```

e come prima riga del corpo di `PagamentiPage` (prima di `const supabase = await createClient()`):

```tsx
  if (!hasFeature("da_incassare")) notFound()
```

In `src/app/(dashboard)/riepilogo/page.tsx` aggiungere gli stessi due import e come prima riga del corpo di `RiepilogoPage`:

```tsx
  if (!hasFeature("riepilogo")) notFound()
```

- [ ] **Step 5: Impostazioni senza "Operatori" nel base**

In `src/app/(dashboard)/impostazioni/page.tsx` aggiungere l'import:

```tsx
import { hasFeature } from "@/lib/plan"
```

e sostituire `      <OperatoriSettings initialOperatori={operatori} />` con:

```tsx
      {hasFeature("operatore") && <OperatoriSettings initialOperatori={operatori} />}
```

- [ ] **Step 6: Verificare i tipi**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add src/components/nav src/app/\(dashboard\)/layout.tsx src/app/\(dashboard\)/pagamenti/page.tsx src/app/\(dashboard\)/riepilogo/page.tsx src/app/\(dashboard\)/impostazioni/page.tsx
git commit -m "feat: menu, calcolatrice e pagine fuori livello nascosti nel livello base" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Form ordine per livello

**Files:**
- Modify: `src/components/OrderForm.tsx`

Il form è lungo: le modifiche sono piccole e localizzate. Applicarle una alla volta con lo strumento di modifica, controllando ogni volta che la stringa da sostituire sia esattamente quella indicata.

- [ ] **Step 1: Import**

Dopo la riga `import { getRememberedOperator, setRememberedOperator } from "@/lib/device-operator"` aggiungere:

```tsx
import { hasFeature } from "@/lib/plan"
```

- [ ] **Step 2: Payload — operatore e campi avanzati**

Sostituire

```tsx
      operatore: isEdit ? undefined : operatoreValue,
```

con

```tsx
      operatore: isEdit || !hasFeature("operatore") ? undefined : operatoreValue,
```

Sostituire

```tsx
      foto_oggetto: v("foto_oggetto"),
      dettagli_grafici: v("dettagli_grafici"),
      file_cliente: fileCliente || null,
```

con

```tsx
      // Nel livello base questi campi non ci sono: non vanno inviati, altrimenti
      // il salvataggio azzererebbe i valori già presenti nell'ordine.
      ...(hasFeature("campi_avanzati")
        ? {
            foto_oggetto: v("foto_oggetto"),
            dettagli_grafici: v("dettagli_grafici"),
            file_cliente: fileCliente || null,
          }
        : {}),
```

Sostituire

```tsx
        setRememberedOperator(operatoreValue)
```

con

```tsx
        if (hasFeature("operatore")) setRememberedOperator(operatoreValue)
```

- [ ] **Step 3: Interruttore "È un ente/azienda"**

Sostituire il blocco

```tsx
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
```

con

```tsx
        {hasFeature("ente") && (
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
        )}
```

- [ ] **Step 4: Operatore**

Sostituire `        {!isEdit && (\n          <div className="grid grid-cols-3 gap-3">\n            <div>\n              <Label htmlFor="operatore">Operatore *</Label>` mantenendo il resto identico, cambiando solo la condizione della prima riga in:

```tsx
        {!isEdit && hasFeature("operatore") && (
```

Sostituire

```tsx
        <Button type="submit" disabled={saving || (!isEdit && !operatoreValue)}>
```

con

```tsx
        <Button type="submit" disabled={saving || (!isEdit && hasFeature("operatore") && !operatoreValue)}>
```

- [ ] **Step 5: Un solo articolo**

Sostituire

```tsx
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            + Aggiungi articolo
          </Button>
```

con

```tsx
          {hasFeature("multi_riga") && (
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              + Aggiungi articolo
            </Button>
          )}
```

- [ ] **Step 6: Campi avanzati, bozza, materiale**

Sostituire l'intera regione che va dal blocco `<div>` con `<Label htmlFor="dettagli_grafici">` fino alla chiusura del blocco `file_cliente` / `foto_oggetto` (ultima `</div>` prima di `</section>` della sezione "ORDINE") con questo codice:

```tsx
        {hasFeature("campi_avanzati") && (
          <div>
            <Label htmlFor="dettagli_grafici">Dettagli grafici</Label>
            <Textarea id="dettagli_grafici" name="dettagli_grafici" rows={2} defaultValue={(order as any)?.dettagli_grafici ?? ""} placeholder="Font, posizione logo, colori, misure..." />
          </div>
        )}

        {/* Tipo lavorazione · Bozza grafica · Inviare preventivo — stessa riga */}
        <div className="grid grid-cols-3 gap-3">
          {hasFeature("campi_avanzati") && (
            <div>
              <Label htmlFor="tipo_lavorazione">Tipo lavorazione</Label>
              <Select value={tipoLavorazione} onValueChange={(v) => setTipoLavorazione(v ?? "")}>
                <SelectTrigger id="tipo_lavorazione" className="w-full">
                  <SelectValue placeholder="— Seleziona —" />
                </SelectTrigger>
                <SelectContent>
                  {TIPI_LAVORAZIONE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {hasFeature("bozza_grafica") && (
            <div>
              <Label htmlFor="bozza_grafica">Bozza grafica</Label>
              <Select items={BOZZA_OPTIONS} value={bozza} onValueChange={(v) => v && setBozza(v)}>
                <SelectTrigger id="bozza_grafica" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOZZA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="preventivo">Preventivo</Label>
            <Select items={PREVENTIVO_OPTIONS} value={preventivo} onValueChange={(v) => v && setPreventivo(v)}>
              <SelectTrigger id="preventivo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREVENTIVO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasFeature("materiale") && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="materiale">Materiale fornitore</Label>
              <Select items={MATERIALE_OPTIONS} value={materiale} onValueChange={(v) => {
                if (!v) return
                setMateriale(v)
                if (v === "non_serve") {
                  setMaterialeFornitore("")
                  setMaterialeCosaManca("")
                }
              }}>
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
        )}

        {hasFeature("campi_avanzati") && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="file_cliente">File inviati dal cliente</Label>
              <Input id="file_cliente" value={fileCliente} onChange={(e) => setFileCliente(e.target.value)} placeholder="Nome file, link Drive, foto WhatsApp..." />
            </div>
            <div>
              <Label htmlFor="foto_oggetto">Foto oggetto</Label>
              <Input id="foto_oggetto" name="foto_oggetto" defaultValue={order?.foto_oggetto ?? ""} placeholder="Nome file o link" />
            </div>
          </div>
        )}
```

- [ ] **Step 7: Verificare**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npx jest --roots=src`
Expected: tutto verde (nessun test tocca il form).

- [ ] **Step 8: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: il form ordine mostra solo i campi del livello" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Bacheca e scheda ordine per livello

**Files:**
- Modify: `src/components/KanbanBoard.tsx`
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Bacheca — colonne e selettore di stato**

In `src/components/KanbanBoard.tsx` sostituire l'import

```tsx
import { STATUS_ORDER, STATUS_LABELS, preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
```

con

```tsx
import { STATUS_LABELS, preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
import { getPlan, statusOrderForPlan } from "@/lib/plan"
```

Nel corpo di `KanbanBoard`, dopo `const [isPending, startTransition] = useTransition()`, aggiungere:

```tsx
  const statusOrder = statusOrderForPlan(getPlan())
  const columns = statusOrder.filter((s) => s !== "consegnato")
```

Sostituire

```tsx
      <div className="grid grid-cols-[repeat(5,minmax(170px,1fr))] gap-3">
      {STATUS_ORDER.filter((s) => s !== "consegnato").map((status) => {
```

con

```tsx
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(170px, 1fr))` }}>
      {columns.map((status) => {
```

Sostituire `{STATUS_ORDER.map((s) => (` (nel selettore di stato della card) con `{statusOrder.map((s) => (`.

- [ ] **Step 2: Scheda ordine — stepper per livello**

In `src/app/(dashboard)/orders/[id]/page.tsx` sostituire la riga di import

```tsx
import { STATUS_LABELS, STATUS_ORDER, preventivoStage, bozzaStage, materialeStage, type Stage } from "@/lib/orderConstants"
```

con

```tsx
import { STATUS_LABELS, preventivoStage, bozzaStage, materialeStage, type Stage } from "@/lib/orderConstants"
import { getPlan, hasFeature, statusOrderForPlan } from "@/lib/plan"
```

Sostituire `  const currentIdx = STATUS_ORDER.indexOf(order.status)` con:

```tsx
  const statusOrder = statusOrderForPlan(getPlan())
  const currentIdx = statusOrder.indexOf(order.status)
```

Sostituire `{STATUS_ORDER.map((s, i) => (` con `{statusOrder.map((s, i) => (`.

- [ ] **Step 3: Scheda ordine — bottoni di stampa**

Sostituire il blocco

```tsx
          <Link href={`/orders/${id}/print`} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}>
            <Printer className="w-3 h-3" />Etichetta
          </Link>
```

con

```tsx
          {hasFeature("etichetta_termica") && (
            <Link href={`/orders/${id}/print`} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}>
              <Printer className="w-3 h-3" />Etichetta
            </Link>
          )}
          <Link href={`/orders/${id}/print?formato=foglio`} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}>
            <Printer className="w-3 h-3" />Foglio lavoro
          </Link>
```

- [ ] **Step 4: Scheda ordine — freccia "indietro"**

Nel base non c'è l'elenco Ordini nel menu: la freccia in alto nella scheda ordine riporta alla Bacheca. Sostituire

```tsx
        <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" />Ordini
        </Link>
```

con

```tsx
        <Link href={hasFeature("elenco_ordini") ? "/orders" : "/kanban"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" />{hasFeature("elenco_ordini") ? "Ordini" : "Bacheca"}
        </Link>
```

- [ ] **Step 5: Verificare**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/orders" src/components/KanbanBoard.tsx
git commit -m "feat: bacheca e scheda ordine seguono il livello" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Foglio lavoro (pagina di stampa)

**Files:**
- Create: `src/app/(print)/orders/[id]/print/FoglioLavoroClient.tsx`
- Modify: `src/app/(print)/orders/[id]/print/page.tsx`

- [ ] **Step 1: Creare il componente del foglio**

Creare `src/app/(print)/orders/[id]/print/FoglioLavoroClient.tsx`. Stessi dati dell'etichetta, caratteri più grandi, disposti su mezzo foglio A4 (210 × 148 mm, metà superiore del foglio), con il QR a destra:

```tsx
"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { formatEUR } from "@/lib/utils"

interface Props {
  orderId: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  telefono: string | null
  articoli: { cosa_ordinato: string; quantita: number }[]
  dataConsegna: string | null
  saldo: number
  shopName: string
}

/**
 * Foglio lavoro per stampante normale: mezzo foglio A4 (210×148 mm) nella metà
 * superiore della pagina, da allegare alla busta o al lavoro. Stessi dati e
 * stesso QR dell'etichetta termica, caratteri più grandi.
 */
export function FoglioLavoroClient({ orderId, nome, cognome, azienda, referente, telefono, articoli, dataConsegna, saldo, shopName }: Props) {
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(`${window.location.origin}/orders/${orderId}`)
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [orderId])

  const clientName = [nome, cognome].filter(Boolean).join(" ")

  const date = dataConsegna
    ? new Date(dataConsegna).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    : null

  return (
    <div
      data-testid="foglio-lavoro"
      style={{
        width: "210mm",
        height: "148mm",
        boxSizing: "border-box",
        padding: "12mm",
        display: "flex",
        justifyContent: "space-between",
        gap: "12mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "18px",
        lineHeight: 1.4,
        borderBottom: "1px dashed #999",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "2px solid #000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-mono.png" alt="" style={{ width: "28px", height: "28px", display: "block" }} />
          <span style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "0.5px" }}>{shopName}</span>
        </div>
        <p style={{ fontWeight: "bold", fontSize: "32px", margin: "0 0 6px 0" }}>{clientName}</p>
        {azienda && <p style={{ fontSize: "20px", margin: "0 0 4px 0" }}>{azienda}</p>}
        {referente && <p style={{ fontSize: "20px", margin: "0 0 4px 0" }}>Ref. {referente}</p>}
        {telefono && <p style={{ fontSize: "22px", margin: "0 0 12px 0" }}>{telefono}</p>}
        {articoli.length > 0 && (
          <div style={{ margin: "0 0 12px 0", fontSize: "22px" }}>
            {articoli.map((a, i) => (
              <p key={i} style={{ margin: 0 }}>
                {articoli.length > 1 ? "• " : ""}{a.cosa_ordinato}{a.quantita > 1 ? ` × ${a.quantita}` : ""}
              </p>
            ))}
          </div>
        )}
        {date && <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 6px 0" }}>Consegnare: {date}</p>}
        <p style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>Da pagare: €{formatEUR(saldo)}</p>
      </div>
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        {url && <QRCodeSVG value={url} size={170} />}
        <p style={{ fontSize: "12px", margin: "6px 0 0 0" }}>Scansiona per aprire la scheda</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Far scegliere alla pagina il formato**

Sostituire l'intero contenuto di `src/app/(print)/orders/[id]/print/page.tsx` con:

```tsx
import { notFound } from "next/navigation"
import { getOrder } from "@/actions/orders"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { getPlan, resolvePrintFormat } from "@/lib/plan"
import { PrintClient } from "./PrintClient"
import { FoglioLavoroClient } from "./FoglioLavoroClient"

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ formato?: string }>
}) {
  const { id } = await params
  const { formato } = await searchParams
  const order = await getOrder(id)
  if (!order) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  const format = resolvePrintFormat(formato, getPlan())

  const data = {
    orderId: id,
    nome: order.nome,
    cognome: order.cognome,
    azienda: order.azienda,
    referente: order.referente,
    telefono: order.telefono,
    articoli: order.items.map((item) => ({ cosa_ordinato: item.cosa_ordinato, quantita: item.quantita })),
    dataConsegna: order.data_consegna,
    saldo: order.saldo,
    shopName,
  }

  return (
    <>
      <style>
        {format === "foglio"
          ? `
        @page { margin: 0; size: A4 portrait; }
        body { margin: 0; background: white; }
      `
          : `
        @page { margin: 0; size: 62mm auto; }
        body { margin: 0; background: white; }
      `}
      </style>
      {format === "foglio" ? <FoglioLavoroClient {...data} /> : <PrintClient {...data} />}
    </>
  )
}
```

- [ ] **Step 3: Verificare**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(print)"
git commit -m "feat: foglio lavoro A4 per stampante normale" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Prova reale con Playwright (livello base)

**Files:**
- Create: `playwright.base.config.ts`
- Create: `e2e/livello-base.spec.ts`

Serve `.env.local` nel worktree (Task 0). Il test usa lo stesso progetto Supabase dell'app: ogni ordine creato viene cancellato in `afterEach`, come negli altri flussi.

**Attenzione:** due server `next dev` nella stessa cartella si bloccano a vicenda. Fermare prima qualunque `npm run dev` già in esecuzione nel worktree.

- [ ] **Step 1: Configurazione dedicata al livello base**

Creare `playwright.base.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test"

// Il livello va impostato qui, nel processo che esegue i test (lo spec lo
// legge per decidere se girare), e non solo nell'ambiente del server web.
process.env.NEXT_PUBLIC_PLAN = "base"

// Avvia l'app con NEXT_PUBLIC_PLAN=base su una porta a parte e lancia solo lo
// spec del livello base. Uso: npx playwright test --config playwright.base.config.ts
export default defineConfig({
  testDir: "./e2e",
  testMatch: "livello-base.spec.ts",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_PLAN: "base" },
  },
})
```

- [ ] **Step 2: Scrivere lo spec**

Creare `e2e/livello-base.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test"
import { getTestAuthCookies, deleteTestOrder } from "./helpers/auth"

// Gira solo con NEXT_PUBLIC_PLAN=base (vedere playwright.base.config.ts);
// con la configurazione normale (livello completo) viene saltato.
test.skip(process.env.NEXT_PUBLIC_PLAN !== "base", "richiede NEXT_PUBLIC_PLAN=base")

test.describe("Livello base", () => {
  const orderIds: string[] = []

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies(await getTestAuthCookies())
    // window.print() aprirebbe la finestra di stampa: nei test non serve.
    await page.addInitScript(() => {
      window.print = () => {}
    })
  })

  test.afterEach(async () => {
    while (orderIds.length > 0) {
      await deleteTestOrder(orderIds.pop()!).catch(() => {})
    }
  })

  async function compilaOrdineBase(page: Page, nome: string) {
    await page.goto("/orders/new")
    await page.locator("#nome").fill(nome)
    await page.locator("#cognome").fill("E2E")
    await page.locator("#telefono").fill("3331234567")
    await page.locator("#data_consegna").fill("2026-12-15")
    const riga1 = page.locator("div.rounded-lg.border-border.p-3").first()
    await riga1.getByPlaceholder("Es. targa plexiglass, timbro, portachiavi inciso...").fill("Targa base — test E2E")
    await riga1.locator('input[type="number"]').nth(1).fill("40")
  }

  async function creaEAnnota(page: Page) {
    await page.getByRole("button", { name: "Crea ordine" }).click()
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
    const id = new URL(page.url()).pathname.split("/").pop()!
    orderIds.push(id)
    return id
  }

  test("il menu ha solo le voci del livello base", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.locator("aside a")).toHaveText([
      "Oggi",
      "Bacheca",
      "Agenda",
      "Recensioni",
      "Clienti",
      "Impostazioni",
    ])
  })

  test("le pagine fuori livello rispondono 404", async ({ page }) => {
    for (const path of ["/pagamenti", "/riepilogo"]) {
      await page.goto(path)
      await expect(page.getByText("This page could not be found")).toBeVisible()
    }
  })

  test("Impostazioni non mostra gli operatori", async ({ page }) => {
    await page.goto("/impostazioni")
    await expect(page.getByText("Accesso con PIN")).toBeVisible()
    await expect(page.getByText("Operatori", { exact: true })).toHaveCount(0)
  })

  test("il form ordine ha solo i campi del livello", async ({ page }) => {
    await page.goto("/orders/new")
    for (const selector of ["#is_ente", "#operatore", "#bozza_grafica", "#materiale", "#tipo_lavorazione", "#dettagli_grafici", "#file_cliente", "#foto_oggetto"]) {
      await expect(page.locator(selector)).toHaveCount(0)
    }
    await expect(page.getByRole("button", { name: "+ Aggiungi articolo" })).toHaveCount(0)
    await expect(page.locator("#preventivo")).toBeVisible()
    await expect(page.getByRole("button", { name: "Crea ordine" })).toBeEnabled()
  })

  test("ordine senza preventivo: parte da Da fare e arriva a Consegnato", async ({ page }) => {
    await compilaOrdineBase(page, `E2E Base ${Date.now()}`)
    await creaEAnnota(page)

    await expect(page.getByRole("button", { name: "Bozza grafica" })).toHaveCount(0)
    await expect(page.locator("form button.bg-espresso")).toHaveText("Da fare")
    // Senza elenco Ordini, la freccia indietro porta alla Bacheca.
    await expect(page.locator("main").getByRole("link", { name: "Bacheca" })).toHaveAttribute("href", "/kanban")

    await page.getByRole("button", { name: "In lavorazione", exact: true }).click()
    await expect(page.locator("form button.bg-espresso")).toHaveText("In lavorazione")

    await page.getByRole("button", { name: "Pronto", exact: true }).click()
    await expect(page.getByText("Avvisa il cliente:")).toBeVisible()

    await page.getByRole("button", { name: "Consegnato", exact: true }).click()
    await expect(page.getByText("Consegnato il")).toBeVisible()
  })

  test("ordine con preventivo: passa a Da fare quando viene approvato", async ({ page }) => {
    await compilaOrdineBase(page, `E2E BasePrev ${Date.now()}`)
    await page.locator("#preventivo").click()
    await page.getByRole("option", { name: "Da inviare" }).click()
    await creaEAnnota(page)

    await expect(page.locator("form button.bg-espresso")).toHaveText("Preventivo")
    await page.getByRole("button", { name: "Approvato" }).click()
    await expect(page.locator("form button.bg-espresso")).toHaveText("Da fare")
  })

  test("la scheda ordine offre solo il foglio lavoro e la stampa mostra il foglio", async ({ page }) => {
    const nome = `E2E BaseStampa ${Date.now()}`
    await compilaOrdineBase(page, nome)
    const id = await creaEAnnota(page)

    await expect(page.getByRole("link", { name: "Etichetta" })).toHaveCount(0)
    const foglio = page.getByRole("link", { name: "Foglio lavoro" })
    await expect(foglio).toHaveAttribute("href", `/orders/${id}/print?formato=foglio`)

    // Anche aprendo a mano l'indirizzo dell'etichetta si vede il foglio.
    await page.goto(`/orders/${id}/print`)
    const fogliolavoro = page.getByTestId("foglio-lavoro")
    await expect(fogliolavoro).toBeVisible()
    await expect(fogliolavoro).toContainText(nome)
    await expect(fogliolavoro).toContainText("Da pagare: €40.00")
  })

  test("la bacheca ha 4 colonne, senza Bozza grafica", async ({ page }) => {
    await page.goto("/kanban")
    for (const titolo of ["Preventivo", "Da fare", "In lavorazione", "Pronto"]) {
      await expect(page.getByText(titolo, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText("Bozza grafica", { exact: true })).toHaveCount(0)
  })
})
```

- [ ] **Step 3: Eseguire la prova**

Fermare eventuali `next dev` attivi, poi:

Run: `npx playwright test --config playwright.base.config.ts`
Expected: 7 test passati. Il primo avvio compila le pagine e può richiedere un paio di minuti.

Se un test fallisce, guardare il messaggio e correggere **il codice del livello base** (Task 2-5), non indebolire il test. Due eccezioni note e legittime da correggere nello spec: il testo esatto del 404 (`This page could not be found` è quello predefinito di Next) e i selettori dei pulsanti, se un'etichetta è leggermente diversa da quanto scritto.

- [ ] **Step 4: Controllare che non siano rimasti dati di prova**

Ogni ordine creato è cancellato in `afterEach`. Verificarlo con una query indipendente:

```bash
node -e "
const {createClient}=require('@supabase/supabase-js');
require('fs').readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z0-9_]+)=(.*?)\r?$/);if(m)process.env[m[1]]=m[2].trim()});
createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).from('orders').select('id',{count:'exact',head:true}).like('nome','E2E Base%').then(r=>console.log('ordini di prova rimasti:',r.count))
"
```

Expected: `ordini di prova rimasti: 0`.

- [ ] **Step 5: Commit**

```bash
git add playwright.base.config.ts e2e/livello-base.spec.ts
git commit -m "test: prova reale del livello base con Playwright" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Nessuna regressione sul livello completo, poi documentazione

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Test unitari e tipi**

```bash
npx jest --roots=src
npx tsc --noEmit
```

Expected: tutto verde (le suite esistenti più quella di `plan.ts`), `tsc` pulito.

- [ ] **Step 2: Lint informativo**

Run: `npx eslint .`
Expected: nessun errore **nuovo** rispetto a prima (restano i pre-esistenti già documentati in `CLAUDE.md`, per esempio il `(order as any)` in `OrderForm.tsx`).

- [ ] **Step 3: Il livello completo è identico a oggi**

Senza impostare `NEXT_PUBLIC_PLAN`, con `.env.local` presente e nessun `next dev` in esecuzione:

Run: `npx playwright test`
Expected: i flussi A-D passano come prima (Flusso D è quello che crea davvero un ordine e la cui pulizia va verificata); `livello-base.spec.ts` risulta saltato ("skipped").

In più, controllo a occhio con `npm run dev` (livello completo): aprire un ordine e verificare che compaiano i due bottoni "Etichetta" e "Foglio lavoro", che il menu abbia tutte le voci e che il form abbia operatore, ente, bozza e materiale.

- [ ] **Step 4: Aggiornare `CLAUDE.md`**

Nella tabella "Decisioni chiave e motivazioni" aggiungere una riga:

```
| Livello "base" dell'app scelto con `NEXT_PUBLIC_PLAN` (2026-09-26) | Nasce dal lavoro sul target (PEP: controllo del lavoro, semplicità, storico clienti): una versione semplificata da vendere, con la promessa "apri l'app e sai cosa fare oggi", accanto al livello "completo" (quello della mia bottega). Un solo codice, un interruttore per installazione: `src/lib/plan.ts` legge `NEXT_PUBLIC_PLAN` (`base`/`completo`, valore mancante o non valido = completo) ed espone `hasFeature`, `statusOrderForPlan`, `resolvePrintFormat`; i componenti non conoscono i livelli. Il valore è fissato al build, quindi il cambio richiede un nuovo deploy; il database non cambia. Nel base: menu a 5 voci (Oggi, Bacheca, Agenda, Clienti, Recensioni; l'elenco Ordini non compare, si lavora dalla Bacheca e si crea da Oggi) senza "Da incassare"/"Riepilogo", niente operatore/ente/materiale/bozza/multi-riga/calcolatrice, campi avanzati del form nascosti (tipo lavorazione, dettagli grafici, file cliente, foto oggetto), preventivo e WhatsApp per "ordine pronto" e recensioni inclusi, stampa solo come **foglio lavoro** A4 (mezza pagina, `?formato=foglio`) al posto dell'etichetta termica, che resta nel completo. Livello di mezzo non definito. Design in `docs/superpowers/specs/2026-09-26-livello-base-design.md`, piano in `docs/superpowers/plans/2026-09-26-livello-base-plan.md` |
```

Nella sezione "Testing" aggiungere un punto:

```
- **Feature (2026-09-26)**: livello "base" — vedere riga corrispondente in Decisioni chiave. Nuovo `src/lib/plan.ts` con test unitari in `src/lib/__tests__/plan.test.ts`; prova reale con `npx playwright test --config playwright.base.config.ts` (avvia l'app con `NEXT_PUBLIC_PLAN=base` sulla porta 3100, richiede di fermare altri `next dev` nella stessa cartella e `.env.local`). Il livello completo è verificato invariato con jest, `tsc` e i flussi E2E A-D.
```

Aggiornare il conteggio dei test nella riga "Stato al ..." solo se i numeri sono cambiati (suite e test in più da `plan.test.ts`).

Aggiungere anche in `## Struttura del progetto` → sotto `src/lib` non serve: la struttura elenca solo i file principali.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: livello base nel CLAUDE.md" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Chiusura**

Il lavoro è pronto per il merge su `main`. Usare la skill `superpowers:finishing-a-development-branch`, ricordando che il checkout principale può essere su un altro ramo (`feature/sito-vetrina`): il merge su `main` va fatto con un worktree temporaneo di `main`, non con `git checkout main`.

---

### Task 8: Correzioni dopo la revisione (ente/azienda nel base, foglio a 150 mm senza nome)

**Questo task sostituisce le parti dei Task 1, 3 e 5 che riguardano `ente`, il layout del foglio e il nome sulla stampa.** Motivo (richieste dell'utente a lavoro finito): (1) l'interruttore "È un ente/azienda" con referente serve anche nel base (es. un'officina a cui portano i mezzi di aziende: non si può mettere nome e cognome di una persona); (2) nel base sul foglio compare solo il logo, senza il nome della bottega; (3) i margini di stampa non si controllano: il foglio passa da 210 mm a **150 mm di larghezza con 30 mm di margine per lato** e in alto.

**Files:**
- Modify: `src/lib/plan.ts`, `src/lib/__tests__/plan.test.ts`
- Modify: `src/components/OrderForm.tsx`
- Modify: `src/app/(print)/orders/[id]/print/FoglioLavoroClient.tsx`, `src/app/(print)/orders/[id]/print/page.tsx`
- Modify: `e2e/livello-base.spec.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `plan.ts` — `ente` diventa sempre attivo, nasce `nome_su_stampa`**

In `src/lib/plan.ts` sostituire, nel tipo `Feature`, la riga `  | "ente"` con:

```ts
  | "nome_su_stampa" // nome della bottega sul foglio lavoro: nel base c'è solo il logo
```

e, nell'insieme `OFF_IN_BASE`, sostituire `  "ente",` con `  "nome_su_stampa",`.

In `src/lib/__tests__/plan.test.ts`, nella mappa `ALL_FEATURES_MAP` sostituire `  ente: true,` con `  nome_su_stampa: true,`.

Run: `npx jest --roots=src` — Expected: PASS, stesso numero di test di prima (19 suite / 188).

- [ ] **Step 2: `OrderForm` — l'interruttore ente non è più nascosto**

In `src/components/OrderForm.tsx` sostituire il blocco

```tsx
        {hasFeature("ente") && (
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
        )}
```

con il codice originale (identico a `git show 2fe17ec:src/components/OrderForm.tsx`):

```tsx
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
```

Run: `npx tsc --noEmit` — Expected: nessun errore (non deve restare nessun `hasFeature("ente")` nel codice).

- [ ] **Step 3: foglio lavoro a 150 mm, solo logo**

Sostituire l'intero contenuto di `src/app/(print)/orders/[id]/print/FoglioLavoroClient.tsx` con:

```tsx
"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { formatEUR } from "@/lib/utils"

interface Props {
  orderId: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  telefono: string | null
  articoli: { cosa_ordinato: string; quantita: number }[]
  dataConsegna: string | null
  saldo: number
  /** Nome della bottega da mostrare accanto al logo; null = solo il logo (livello base). */
  shopName: string | null
}

/**
 * Foglio lavoro per stampante normale: 150 mm di larghezza centrati su un A4
 * (210 mm), quindi 30 mm di margine per lato e in alto. Non conosciamo i margini
 * non stampabili della stampante di ogni cliente: 30 mm sono abbondanti.
 * L'altezza segue il contenuto. Stessi dati e stesso QR dell'etichetta termica,
 * caratteri più grandi.
 */
export function FoglioLavoroClient({ orderId, nome, cognome, azienda, referente, telefono, articoli, dataConsegna, saldo, shopName }: Props) {
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(`${window.location.origin}/orders/${orderId}`)
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [orderId])

  const clientName = [nome, cognome].filter(Boolean).join(" ")

  const date = dataConsegna
    ? new Date(dataConsegna).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    : null

  return (
    <div
      data-testid="foglio-lavoro"
      style={{
        width: "150mm",
        margin: "30mm 30mm 0 30mm",
        boxSizing: "border-box",
        padding: "8mm",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "8mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "18px",
        lineHeight: 1.4,
        border: "1px dashed #999",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "2px solid #000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-mono.png" alt="" style={{ width: "40px", height: "40px", display: "block" }} />
          {shopName && <span style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "0.5px" }}>{shopName}</span>}
        </div>
        <p style={{ fontWeight: "bold", fontSize: "28px", margin: "0 0 6px 0" }}>{clientName}</p>
        {azienda && <p style={{ fontSize: "18px", margin: "0 0 4px 0" }}>{azienda}</p>}
        {referente && <p style={{ fontSize: "18px", margin: "0 0 4px 0" }}>Ref. {referente}</p>}
        {telefono && <p style={{ fontSize: "20px", margin: "0 0 12px 0" }}>{telefono}</p>}
        {articoli.length > 0 && (
          <div style={{ margin: "0 0 12px 0", fontSize: "20px" }}>
            {articoli.map((a, i) => (
              <p key={i} style={{ margin: 0 }}>
                {articoli.length > 1 ? "• " : ""}{a.cosa_ordinato}{a.quantita > 1 ? ` × ${a.quantita}` : ""}
              </p>
            ))}
          </div>
        )}
        {date && <p style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 6px 0" }}>Consegnare: {date}</p>}
        <p style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>Da pagare: €{formatEUR(saldo)}</p>
      </div>
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        {url && <QRCodeSVG value={url} size={130} />}
        <p style={{ fontSize: "11px", margin: "6px 0 0 0" }}>Scansiona per aprire la scheda</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `page.tsx` di stampa — il nome solo se la funzione è attiva**

In `src/app/(print)/orders/[id]/print/page.tsx` cambiare l'import `import { getPlan, resolvePrintFormat } from "@/lib/plan"` in:

```tsx
import { getPlan, hasFeature, resolvePrintFormat } from "@/lib/plan"
```

Nell'oggetto `data` **togliere** la riga `    shopName,`. Sostituire la riga di rendering

```tsx
      {format === "foglio" ? <FoglioLavoroClient {...data} /> : <PrintClient {...data} />}
```

con

```tsx
      {format === "foglio" ? (
        <FoglioLavoroClient {...data} shopName={hasFeature("nome_su_stampa") ? shopName : null} />
      ) : (
        <PrintClient {...data} shopName={shopName} />
      )}
```

Run: `npx tsc --noEmit` — Expected: nessun errore.

- [ ] **Step 5: prova reale — aggiornare `e2e/livello-base.spec.ts`**

(a) Nel test "il form ordine ha solo i campi del livello" togliere `"#is_ente", ` dall'elenco dei selettori che devono essere assenti e, subito dopo l'attesa che `#preventivo` sia visibile, aggiungere:

```ts
    await expect(page.locator("#is_ente")).toBeVisible()
```

(b) Aggiungere questo test dopo quello "ordine con preventivo…":

```ts
  test("cliente ente/azienda: interruttore, referente e scheda ordine", async ({ page }) => {
    const nome = `E2E BaseEnte ${Date.now()}`
    await page.goto("/orders/new")
    await page.locator("#is_ente").check()
    await expect(page.getByLabel("Nome ente/azienda *")).toBeVisible()
    await expect(page.locator("#cognome")).toHaveCount(0)
    await page.locator("#nome").fill(nome)
    await page.locator("#referente").fill("Referente Test")
    await page.locator("#telefono").fill("3331234567")
    await page.locator("#data_consegna").fill("2026-12-15")
    const riga1 = page.locator("div.rounded-lg.border-border.p-3").first()
    await riga1.getByPlaceholder("Es. targa plexiglass, timbro, portachiavi inciso...").fill("Riparazione — test E2E")
    await riga1.locator('input[type="number"]').nth(1).fill("120")
    await creaEAnnota(page)

    await expect(page.getByRole("heading", { name: nome })).toBeVisible()
    await expect(page.getByText("Ref. Referente Test")).toBeVisible()
  })
```

(c) Nel test "la scheda ordine offre solo il foglio lavoro e la stampa mostra il foglio", dopo `await expect(fogliolavoro).toContainText("Da pagare: €40.00")` aggiungere:

```ts
    // Solo il logo, senza il nome della bottega (l'utente di prova ha nome "Bottega E2E").
    await expect(fogliolavoro.locator('img[src="/icon-mono.png"]')).toBeVisible()
    await expect(fogliolavoro).not.toContainText("Bottega E2E")

    // 150 mm di larghezza con 30 mm di margine a sinistra (1 mm ≈ 3,78 px).
    const box = await fogliolavoro.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(560)
    expect(box!.width).toBeLessThan(575)
    expect(box!.x).toBeGreaterThan(110)
    expect(box!.x).toBeLessThan(117)
```

Run (porta 3100 libera, nessun altro `next dev` in questa cartella): `npx playwright test --config playwright.base.config.ts` — Expected: 9 passati. Poi la query dei dati rimasti con `like('nome','E2E%')`: 0.

- [ ] **Step 6: aggiornare `CLAUDE.md`**

Nella riga `Livello "base" dell'app scelto con NEXT_PUBLIC_PLAN (2026-09-26)` della tabella Decisioni chiave: sostituire `niente operatore/ente/materiale/bozza/multi-riga/calcolatrice` con `niente operatore/materiale/bozza/multi-riga/calcolatrice (l'interruttore "È un ente/azienda" con referente resta anche nel base: serve, per esempio, a un'officina a cui portano mezzi intestati ad aziende)` e sostituire `stampa solo come **foglio lavoro** A4 (mezza pagina, ?formato=foglio)` con `stampa solo come **foglio lavoro** A4 (?formato=foglio: 150 mm centrati con 30 mm di margine per lato, perché non controlliamo i margini delle stampanti dei clienti; solo il logo, senza il nome della bottega)`. Nel bullet "Feature (2026-09-26)" della sezione Testing aggiungere in coda: `Aggiornato a fine lavoro: ente/azienda attivo anche nel base, foglio a 150 mm senza nome bottega (9 test nella prova del livello base).`

- [ ] **Step 7: verifiche e commit**

```bash
npx tsc --noEmit
npx jest --roots=src
```

Expected: puliti / 19 suite, 188 test verdi.

```bash
git add src/lib src/components/OrderForm.tsx "src/app/(print)" e2e/livello-base.spec.ts CLAUDE.md
git commit -m "feat: ente/azienda anche nel base, foglio a 150 mm con solo il logo" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Autoverifica del piano rispetto al documento di progetto

- **Menu a 5 voci (senza Ordini nel base)** → Task 1 (`elenco_ordini`), Task 2 (Sidebar/BottomNav), verificato nel Task 6 (test "il menu…"). Freccia indietro verso la Bacheca → Task 4 step 4, test nel Task 6.
- **Oggi senza sezioni materiale** → nessuna modifica necessaria (spiegato nel design); nessun test dedicato perché non c'è codice da testare.
- **Stati con Preventivo, senza Bozza grafica** → Task 1 (`statusOrderForPlan`), Task 4 (stepper, bacheca, filtro lista); test nel Task 6 (ordine con e senza preventivo, bacheca a 4 colonne).
- **Una sola riga articolo, campi obbligatori, campi nascosti** → Task 3; test "il form ordine ha solo i campi del livello".
- **Foglio lavoro, un solo bottone nel base, indirizzo etichetta che mostra il foglio** → Task 1 (`resolvePrintFormat`), Task 4 (bottoni), Task 5 (pagina); test dedicato nel Task 6.
- **Pagine fuori livello → 404, Impostazioni senza operatori, calcolatrice nascosta** → Task 2; test nel Task 6 (404 e Impostazioni). La calcolatrice non ha un test dedicato: è una riga nel layout, verificata a occhio nel Task 7.
- **Livello completo invariato, variabile mancante = completo** → test unitari del Task 1, controlli del Task 7.
- **Fuori scope** (livello di mezzo, "lavori fermi", cambio livello da dentro l'app, griglia di etichette) → nessun task, come da design.
