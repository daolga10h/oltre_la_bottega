# Calcolatrice al volo — Piano di implementazione

> **Per chi esegue in autonomia:** SOTTO-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire questo piano un task alla volta. I passi usano la sintassi checkbox (`- [ ]`) per il tracciamento.

**Obiettivo:** Aggiungere un bottone flottante in basso a sinistra, visibile su tutte le pagine dell'app, che apre un pannello con una calcolatrice semplice (le 4 operazioni base, calcolo sequenziale senza precedenza tra operatori).

**Architettura:** Logica di calcolo pura ed estratta in `src/lib/calculator.ts` (testata con Jest), componente client `src/components/CalculatorWidget.tsx` che gestisce stato e UI, montato una sola volta in `src/app/(dashboard)/layout.tsx`.

**Stack tecnico:** Next.js, React (useState/useEffect/useRef), TypeScript, Tailwind CSS, lucide-react (icona `Calculator`), Jest per i test della logica pura.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-09-calcolatrice-widget-design.md`

---

### Task 1: Logica di calcolo pura (`applyOperator`)

**File:**
- Crea: `src/lib/calculator.ts`
- Test: `src/lib/__tests__/calculator.test.ts`

- [ ] **Passo 1: Scrivi i test che falliscono**

Crea `src/lib/__tests__/calculator.test.ts`:

```typescript
import { applyOperator } from "../calculator"

describe("applyOperator", () => {
  it("adds two numbers", () => {
    expect(applyOperator(4, "+", 6)).toBe(10)
  })

  it("subtracts two numbers", () => {
    expect(applyOperator(10, "-", 3)).toBe(7)
  })

  it("multiplies two numbers", () => {
    expect(applyOperator(4, "×", 5)).toBe(20)
  })

  it("divides two numbers", () => {
    expect(applyOperator(10, "÷", 2)).toBe(5)
  })

  it("returns null when dividing by zero", () => {
    expect(applyOperator(5, "÷", 0)).toBeNull()
  })

  it("chains sequentially without operator precedence (4 + 6 then × 2 = 20, not 16)", () => {
    const step1 = applyOperator(4, "+", 6)
    expect(step1).toBe(10)
    const step2 = applyOperator(step1 as number, "×", 2)
    expect(step2).toBe(20)
  })
})
```

- [ ] **Passo 2: Esegui i test per verificare che falliscano**

Comando: `npx jest src/lib/__tests__/calculator.test.ts`
Atteso: FALLISCE — `src/lib/calculator.ts` non esiste ancora (errore di modulo non trovato).

- [ ] **Passo 3: Implementa `applyOperator`**

Crea `src/lib/calculator.ts`:

```typescript
export type CalculatorOperator = "+" | "-" | "×" | "÷"

export function applyOperator(a: number, op: CalculatorOperator, b: number): number | null {
  switch (op) {
    case "+":
      return a + b
    case "-":
      return a - b
    case "×":
      return a * b
    case "÷":
      return b === 0 ? null : a / b
  }
}
```

- [ ] **Passo 4: Esegui i test per verificare che passino**

Comando: `npx jest src/lib/__tests__/calculator.test.ts`
Atteso: PASSA — tutti e 6 i test verdi.

- [ ] **Passo 5: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 6: Commit**

```bash
git add src/lib/calculator.ts src/lib/__tests__/calculator.test.ts
git commit -m "feat: aggiungi logica pura applyOperator per la calcolatrice"
```

---

### Task 2: Componente `CalculatorWidget`

**File:**
- Crea: `src/components/CalculatorWidget.tsx`

- [ ] **Passo 1: Crea il componente**

Crea `src/components/CalculatorWidget.tsx`:

```typescript
"use client"

import { useEffect, useRef, useState } from "react"
import { Calculator } from "lucide-react"
import { applyOperator, type CalculatorOperator } from "@/lib/calculator"

export function CalculatorWidget() {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState("0")
  const [previous, setPrevious] = useState<number | null>(null)
  const [operator, setOperator] = useState<CalculatorOperator | null>(null)
  const [overwrite, setOverwrite] = useState(true)
  const [error, setError] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  function handleDigit(d: string) {
    if (error) {
      setError(false)
      setDisplay(d)
      setOverwrite(false)
      return
    }
    if (overwrite) {
      setDisplay(d)
      setOverwrite(false)
    } else {
      setDisplay(display === "0" ? d : display + d)
    }
  }

  function handleDecimal() {
    if (error) {
      setError(false)
      setDisplay("0.")
      setOverwrite(false)
      return
    }
    if (overwrite) {
      setDisplay("0.")
      setOverwrite(false)
      return
    }
    if (!display.includes(".")) setDisplay(display + ".")
  }

  function handleOperator(op: CalculatorOperator) {
    if (error) {
      setError(false)
      setPrevious(parseFloat(display) || 0)
      setOperator(op)
      setOverwrite(true)
      return
    }
    const current = parseFloat(display)
    if (previous !== null && operator !== null && !overwrite) {
      const result = applyOperator(previous, operator, current)
      if (result === null) {
        setError(true)
        setDisplay("Errore")
        setPrevious(null)
        setOperator(null)
        setOverwrite(true)
        return
      }
      setPrevious(result)
      setDisplay(String(result))
    } else {
      setPrevious(current)
    }
    setOperator(op)
    setOverwrite(true)
  }

  function handleEquals() {
    if (error || operator === null || previous === null) return
    const current = parseFloat(display)
    const result = applyOperator(previous, operator, current)
    if (result === null) {
      setError(true)
      setDisplay("Errore")
    } else {
      setDisplay(String(result))
    }
    setPrevious(null)
    setOperator(null)
    setOverwrite(true)
  }

  function handleClear() {
    setDisplay("0")
    setPrevious(null)
    setOperator(null)
    setOverwrite(true)
    setError(false)
  }

  const digitClass =
    "h-9 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted/60"
  const opClass =
    "h-9 rounded-lg bg-honey text-bark text-sm font-semibold hover:bg-gold/40"

  return (
    <div className="fixed left-4 bottom-20 md:bottom-4 z-50">
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-border bg-card shadow-[0px_8px_24px_0px_rgba(38,27,7,0.18)] p-3 space-y-2"
        >
          <div className="h-10 rounded-lg border border-border bg-background px-3 flex items-center justify-end text-lg font-semibold text-foreground overflow-hidden">
            {display}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => handleDigit("7")} className={digitClass}>7</button>
            <button type="button" onClick={() => handleDigit("8")} className={digitClass}>8</button>
            <button type="button" onClick={() => handleDigit("9")} className={digitClass}>9</button>
            <button type="button" onClick={() => handleOperator("÷")} className={opClass}>÷</button>

            <button type="button" onClick={() => handleDigit("4")} className={digitClass}>4</button>
            <button type="button" onClick={() => handleDigit("5")} className={digitClass}>5</button>
            <button type="button" onClick={() => handleDigit("6")} className={digitClass}>6</button>
            <button type="button" onClick={() => handleOperator("×")} className={opClass}>×</button>

            <button type="button" onClick={() => handleDigit("1")} className={digitClass}>1</button>
            <button type="button" onClick={() => handleDigit("2")} className={digitClass}>2</button>
            <button type="button" onClick={() => handleDigit("3")} className={digitClass}>3</button>
            <button type="button" onClick={() => handleOperator("-")} className={opClass}>−</button>

            <button type="button" onClick={handleClear} className="h-9 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20">C</button>
            <button type="button" onClick={() => handleDigit("0")} className={digitClass}>0</button>
            <button type="button" onClick={handleDecimal} className={digitClass}>.</button>
            <button type="button" onClick={() => handleOperator("+")} className={opClass}>+</button>

            <button
              type="button"
              onClick={handleEquals}
              className="col-span-4 h-9 rounded-lg bg-espresso text-cream text-sm font-semibold hover:bg-espresso/90"
            >
              =
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Calcolatrice"
        title="Calcolatrice"
        className="h-12 w-12 rounded-full bg-espresso text-cream shadow-[0px_4px_12px_0px_rgba(38,27,7,0.32)] flex items-center justify-center hover:bg-espresso/90 transition-colors"
      >
        <Calculator className="w-5 h-5" />
      </button>
    </div>
  )
}
```

- [ ] **Passo 2: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 3: Commit**

```bash
git add src/components/CalculatorWidget.tsx
git commit -m "feat: aggiungi componente CalculatorWidget"
```

---

### Task 3: Monta il widget nel layout dashboard

**File:**
- Modifica: `src/app/(dashboard)/layout.tsx`

- [ ] **Passo 1: Importa e monta il componente**

Sostituisci il contenuto di `src/app/(dashboard)/layout.tsx`:

```typescript
import { Sidebar } from "@/components/nav/Sidebar"
import { BottomNav } from "@/components/nav/BottomNav"
import { SearchBar } from "@/components/SearchBar"
import { RefreshButton } from "@/components/RefreshButton"
import { CalculatorWidget } from "@/components/CalculatorWidget"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border px-4 md:px-8 py-3 flex items-center gap-2">
          <SearchBar />
          <RefreshButton />
        </header>
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">{children}</main>
      </div>
      <BottomNav />
      <CalculatorWidget />
    </div>
  )
}
```

- [ ] **Passo 2: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 3: Verifica manuale**

Esegui: `npm run dev`, apri `http://localhost:3000/dashboard`.
- Verifica che il bottone rotondo con l'icona calcolatrice compaia in basso
  a sinistra, senza testo.
- Cliccalo: il pannello si apre sopra il bottone.
- Prova la sequenza `12 + 8 =` → il display mostra `20`.
- Prova `5 ÷ 0 =` → il display mostra `Errore`; premi un numero → si
  azzera e riparte normalmente.
- Clicca fuori dal pannello → si chiude.
- Restringi la finestra del browser (o apri da mobile) → verifica che il
  bottone non si sovrapponga alla barra di navigazione in basso.
- Naviga su `/orders`, `/kanban`, `/agenda` → il bottone resta visibile e
  funzionante su ogni pagina.
- Apri `/login` (esci prima se necessario) e una pagina di stampa
  `/orders/[id]/print` → il bottone NON deve comparire (layout diversi,
  non toccati da questo lavoro).

- [ ] **Passo 4: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat: monta CalculatorWidget nel layout dashboard"
```

---

### Task 4: Aggiorna CLAUDE.md

**File:**
- Modifica: `CLAUDE.md`

- [ ] **Passo 1: Aggiungi riga a "Decisioni chiave e motivazioni"**

Aggiungi questa riga alla tabella (in fondo, dopo l'ultima riga esistente):

```markdown
| Calcolatrice al volo: bottone flottante in basso a sinistra su tutte le pagine dashboard | Serve per calcoli veloci (somme, sconti) senza uscire dall'app. Logica pura (`applyOperator`) testata in `src/lib/calculator.ts`; calcolo sequenziale senza precedenza tra operatori, come una calcolatrice tascabile. Nessun collegamento ai campi del form — solo icona, nessuna cronologia salvata |
```

- [ ] **Passo 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta il widget calcolatrice in CLAUDE.md"
```

---

## Note di autoverifica

- **Copertura spec:** logica di calcolo (Task 1), componente UI e
  comportamento pannello/bottone (Task 2), montaggio globale (Task 3),
  documentazione (Task 4) — ogni sezione del design è coperta.
- **Nessun placeholder:** ogni passo mostra codice esatto, percorsi file
  esatti, comandi esatti.
- **Coerenza:** `CalculatorOperator` definito in Task 1 è lo stesso tipo
  importato e usato in Task 2; i nomi delle funzioni (`applyOperator`)
  corrispondono esattamente tra dichiarazione e utilizzo.
