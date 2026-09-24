# Invia anteprima Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere alla scheda ordine un riquadro "Invia anteprima" con link WhatsApp/Email già precompilati col testo dell'anteprima, che al click segna la bozza grafica come "Inviata".

**Architecture:** Un nuovo componente client `SendPreviewLinks` (stesso schema di `NotifyReadyLinks`) riceve i due link già costruiti dal server e, al click, chiama la server action già esistente `updateBozzaGrafica(orderId, "inviata")` seguita da `router.refresh()`. La pagina `orders/[id]/page.tsx` costruisce i link (`buildWhatsAppLink` assente se `canale === "mail"`, `buildMailtoLink`) e mostra il riquadro solo se `status === "bozza_grafica"` e la bozza è `"da_fare"` o `"modificata"`. Nessuna migration, nessun nuovo server action, nessuna dipendenza.

**Tech Stack:** Next.js 16 / React 19 (Server Component per la pagina, client component per i link), TypeScript strict, `lucide-react` (`MessageCircle`, `Mail`), `QuickContactLink` e helper `buildWhatsAppLink`/`buildMailtoLink` già esistenti, Playwright (script di verifica temporaneo).

---

## Contesto tecnico importante (letto dal codice attuale)

- `src/app/(dashboard)/orders/[id]/page.tsx` è un Server Component. Il riquadro "Avvisa il cliente" (commento `{/* Avvisa cliente — ordine pronto */}`, circa righe 138-156) è un blocco condizionale con una IIFE che costruisce `waLink`/`mailLink`, esce con `null` se mancano entrambi, altrimenti renderizza `<div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-honey/40 px-3 py-2">` con un `<span className="text-xs font-semibold text-bark mr-1">` e `<NotifyReadyLinks ... />`. Subito dopo c'è il commento `{/* Key info */}`. Il nuovo riquadro va **tra questi due blocchi**.
- `src/components/NotifyReadyLinks.tsx` è il modello da copiare: client component con `useRouter`, `handleClick` che chiama `markMsgProntoInviato(orderId).then(() => router.refresh())`, e due `QuickContactLink` (WhatsApp con `external`, Email) con `variant="toolbar"` e `onClick={handleClick}`.
- `updateBozzaGrafica(id, value)` (`src/actions/orders.ts:251`) esiste già: imposta `orders.bozza_grafica`, per `"approvata"` porta anche `status` a `da_fare`, e scrive in `order_events` la nota `"Bozza inviata al cliente"` per `"inviata"`. Per `"inviata"` non ha altri effetti collaterali. **Non va modificata.**
- `buildWhatsAppLink(telefono, messaggio)` restituisce `https://wa.me/39<cifre>?text=<messaggio codificato>` (aggiunge il prefisso `39` se manca) o `null`; `buildMailtoLink(email, oggetto, corpo)` restituisce `mailto:<email>?subject=...&body=...` o `null`. Entrambe in `src/lib/utils.ts`, già importate nella pagina.
- Nessuna infrastruttura di test per componenti/pagine in questo codebase (Jest gira con `testEnvironment: "node"`, nessun DOM). **Non esiste quindi nessuna unità pura da testare con Jest in questa feature**: i Task 1 e 2 si verificano con `tsc`/`eslint`, il Task 3 con uno script Playwright temporaneo end-to-end (stesso pattern già usato per le feature precedenti, poi cancellato).
- `npm run lint` (`eslint .`) oggi mostra 12 errori + 6 avvisi **già presenti e non correlati** (lint informativo in CI). L'obiettivo qui è non aggiungerne di nuovi nei due file toccati: nella pagina `orders/[id]/page.tsx` esiste già un errore `@typescript-eslint/no-explicit-any` su `(order as any).preventivo`, atteso.
- I commit di questo piano usano l'attribuzione `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` esattamente, indipendentemente dal modello che li esegue.

---

### Task 1: Componente `SendPreviewLinks`

**Files:**
- Create: `src/components/SendPreviewLinks.tsx`

- [ ] **Step 1: Crea il componente**

Crea `src/components/SendPreviewLinks.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { MessageCircle, Mail } from "lucide-react"
import { QuickContactLink } from "@/components/QuickContactLink"
import { updateBozzaGrafica } from "@/actions/orders"

interface SendPreviewLinksProps {
  orderId: string
  waLink: string | null
  mailLink: string | null
}

export function SendPreviewLinks({ orderId, waLink, mailLink }: SendPreviewLinksProps) {
  const router = useRouter()

  function handleClick() {
    updateBozzaGrafica(orderId, "inviata").then(() => router.refresh())
  }

  return (
    <>
      <QuickContactLink href={waLink} icon={MessageCircle} label="WhatsApp" external variant="toolbar" onClick={handleClick} />
      <QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" onClick={handleClick} />
    </>
  )
}
```

- [ ] **Step 2: Verifica i tipi**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Verifica il lint sul nuovo file**

Run: `npx eslint src/components/SendPreviewLinks.tsx`
Expected: nessun output (0 problemi)

- [ ] **Step 4: Commit**

```bash
git add src/components/SendPreviewLinks.tsx
git commit -m "$(cat <<'EOF'
feat: aggiunge il componente SendPreviewLinks

Link WhatsApp/Email per mandare l'anteprima al cliente: al click segna
la bozza grafica come "Inviata" (updateBozzaGrafica gia' esistente) e
aggiorna la pagina. Stesso schema di NotifyReadyLinks. Non ancora
collegato alla scheda ordine.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Mostra il riquadro "Invia anteprima" nella scheda ordine

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Aggiungi l'import del componente**

Trova (riga 5):

```tsx
import { NotifyReadyLinks } from "@/components/NotifyReadyLinks"
```

Aggiungi subito dopo:

```tsx
import { SendPreviewLinks } from "@/components/SendPreviewLinks"
```

- [ ] **Step 2: Aggiungi la costante col testo del messaggio**

Trova (righe 14-19):

```tsx
const PILL_STAGE_CLASSES: Record<Stage, string> = {
  red: "bg-terracotta/15 text-terracotta border-terracotta/30",
  yellow: "bg-honey text-bark border-gold/40",
  green: "bg-sage text-[#3a5a2e] border-sage",
}
const PILL_OFF_CLASS = "bg-card text-foreground border-border hover:border-foreground/30"
```

Aggiungi subito dopo `PILL_OFF_CLASS`:

```tsx
const PREVIEW_MESSAGE = "Buongiorno, ecco l'anteprima. Attendo i commenti o le modifiche da apportare."
```

- [ ] **Step 3: Aggiungi il blocco condizionale tra "Avvisa cliente" e "Key info"**

Trova questo blocco esistente (la fine del riquadro "Avvisa cliente" seguita dall'inizio di "Key info"):

```tsx
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-honey/40 px-3 py-2">
            <span className="text-xs font-semibold text-bark mr-1">Avvisa il cliente:</span>
            <NotifyReadyLinks orderId={id} waLink={waLink} mailLink={mailLink} />
          </div>
        )
      })()}

      {/* Key info */}
```

Sostituiscilo con:

```tsx
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-honey/40 px-3 py-2">
            <span className="text-xs font-semibold text-bark mr-1">Avvisa il cliente:</span>
            <NotifyReadyLinks orderId={id} waLink={waLink} mailLink={mailLink} />
          </div>
        )
      })()}

      {/* Invia anteprima — bozza grafica da mandare o rimandare */}
      {order.status === "bozza_grafica" && (order.bozza_grafica === "da_fare" || order.bozza_grafica === "modificata") && (() => {
        const waLink = order.canale === "mail" ? null : buildWhatsAppLink(order.telefono, PREVIEW_MESSAGE)
        const mailLink = buildMailtoLink(order.email_cliente, "Anteprima", PREVIEW_MESSAGE)
        if (!waLink && !mailLink) return null
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-honey/40 px-3 py-2">
            <span className="text-xs font-semibold text-bark mr-1">Invia anteprima:</span>
            <SendPreviewLinks orderId={id} waLink={waLink} mailLink={mailLink} />
          </div>
        )
      })()}

      {/* Key info */}
```

- [ ] **Step 4: Verifica i tipi e la suite esistente**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: PASS, tutti i test esistenti verdi (nessun cambiamento atteso nel conteggio: nessun test copre la pagina)

- [ ] **Step 5: Verifica che il lint non aggiunga problemi nuovi**

Run: `npx eslint "src/app/(dashboard)/orders/[id]/page.tsx" src/components/SendPreviewLinks.tsx`
Expected: l'unico problema è l'errore **già esistente** `@typescript-eslint/no-explicit-any` su `(order as any).preventivo` nella pagina. Nessun altro errore o avviso, e nulla nel nuovo componente. Se compaiono problemi diversi, correggili prima di procedere.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat: aggiunge il riquadro Invia anteprima alla scheda ordine

Con l'ordine in stato "Bozza grafica" e la bozza "Da fare" o
"Modificata" compare un riquadro con i link WhatsApp/Email gia'
precompilati col testo dell'anteprima (WhatsApp assente per il canale
"mail"); al click la bozza passa a "Inviata". Stesso stile e posizione
di "Avvisa il cliente".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verifica end-to-end con uno script Playwright temporaneo

**Files:**
- Create (temporaneo, da cancellare a fine task, MAI da committare): `e2e/tmp-invia-anteprima.spec.ts`

Questo task non produce commit: crea uno script, lo esegue, riporta i risultati **reali** (non assunti), lo cancella. Gira contro lo stesso progetto Supabase dell'app (anche produzione): ogni ordine di prova viene cancellato via service role a fine di ogni test.

- [ ] **Step 1: Prepara l'ambiente**

Il worktree non contiene `.env.local` (è in `.gitignore`). Copialo dal checkout principale (solo copia locale di un file già presente su questa macchina, non finisce in git):

```bash
cp "D:/Documenti/Projects/oltre_la_bottega/.env.local" .env.local
```

Verifica che la porta 3000 sia libera, altrimenti Playwright (`reuseExistingServer`) userebbe un server sviluppo vecchio invece del codice di questo worktree:

```bash
netstat -ano | grep ":3000 " || echo "porta 3000 libera"
```

Expected: `porta 3000 libera`. Se la porta è occupata **fermati e riporta NEEDS_CONTEXT**: non terminare processi che non hai avviato tu (potrebbe essere il server di sviluppo dell'utente).

Se i browser Playwright non fossero installati (errore "Executable doesn't exist"): `npx playwright install chromium`.

- [ ] **Step 2: Crea lo script temporaneo**

Crea `e2e/tmp-invia-anteprima.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { getTestAuthCookies } from "./helpers/auth"

// TEMPORANEO: verifica end-to-end della feature "Invia anteprima" (bozza grafica).
// Da cancellare a verifica completata, non fa parte della suite permanente.
// Gira contro lo stesso progetto Supabase dell'app: ogni ordine di prova viene
// cancellato in afterEach tramite service role.

const TESTO = "Buongiorno, ecco l'anteprima. Attendo i commenti o le modifiche da apportare."

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function createTestOrder(overrides: Record<string, unknown> = {}): Promise<string> {
  const db = admin()
  const { data, error } = await db
    .from("orders")
    .insert({
      nome: `E2E Anteprima ${Date.now()}`,
      cognome: "Test",
      telefono: "3331234567",
      email_cliente: "cliente-test@example.com",
      canale: "negozio",
      cosa_ordinato: "Targa test anteprima",
      prezzo: 10,
      status: "bozza_grafica",
      bozza_grafica: "da_fare",
      ...overrides,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(`Creazione ordine di prova fallita: ${error?.message}`)
  const { error: itemError } = await db.from("order_items").insert({
    order_id: data.id,
    cosa_ordinato: "Targa test anteprima",
    quantita: 1,
    prezzo_unitario: 10,
    posizione: 0,
  })
  if (itemError) throw new Error(`Creazione riga articolo fallita: ${itemError.message}`)
  return data.id
}

test.describe("Invia anteprima (temporaneo)", () => {
  let cookies: Awaited<ReturnType<typeof getTestAuthCookies>>
  const createdIds: string[] = []

  async function newOrder(overrides: Record<string, unknown> = {}) {
    const id = await createTestOrder(overrides)
    createdIds.push(id)
    return id
  }

  test.beforeAll(async () => {
    cookies = await getTestAuthCookies()
  })

  test.beforeEach(async ({ context }) => {
    await context.addCookies(cookies)
  })

  test.afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await admin().from("orders").delete().eq("id", id)
    }
  })

  test.afterAll(async () => {
    const db = admin()
    const { count: orders } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .like("nome", "E2E Anteprima %")
    const { count: items } = await db
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("cosa_ordinato", "Targa test anteprima")
    console.log(`RESIDUI dopo cleanup: orders=${orders} order_items=${items}`)
    expect(orders).toBe(0)
    expect(items).toBe(0)
  })

  test("1. bozza 'Da fare' con telefono+email: riquadro visibile con link corretti", async ({ page }) => {
    const id = await newOrder()
    await page.goto(`/orders/${id}`)
    await expect(page.getByText("Invia anteprima:")).toBeVisible()
    await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute(
      "href",
      `https://wa.me/393331234567?text=${encodeURIComponent(TESTO)}`
    )
    await expect(page.getByRole("link", { name: "Email", exact: true })).toHaveAttribute(
      "href",
      `mailto:cliente-test@example.com?subject=Anteprima&body=${encodeURIComponent(TESTO)}`
    )
  })

  test("2. click su Email: bozza 'Inviata', riquadro sparisce, evento in cronologia; poi 'Modificata' lo fa ricomparire", async ({ page }) => {
    const id = await newOrder()
    await page.goto(`/orders/${id}`)
    await expect(page.getByText("Invia anteprima:")).toBeVisible()

    // Evita che il click apra davvero un client di posta: il click React parte comunque.
    await page.evaluate(() => {
      document.addEventListener(
        "click",
        (e) => {
          const a = (e.target as HTMLElement).closest("a")
          if (a && a.href.startsWith("mailto:")) e.preventDefault()
        },
        true
      )
    })

    await page.getByRole("link", { name: "Email", exact: true }).click()
    await expect(page.getByText("Invia anteprima:")).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByText("Bozza inviata al cliente")).toBeVisible()

    const { data } = await admin().from("orders").select("bozza_grafica").eq("id", id).single()
    expect(data?.bozza_grafica).toBe("inviata")

    await admin().from("orders").update({ bozza_grafica: "modificata" }).eq("id", id)
    await page.reload()
    await expect(page.getByText("Invia anteprima:")).toBeVisible()
  })

  test("3. canale 'mail' con telefono+email: solo il link Email", async ({ page }) => {
    const id = await newOrder({ canale: "mail" })
    await page.goto(`/orders/${id}`)
    await expect(page.getByText("Invia anteprima:")).toBeVisible()
    await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Email", exact: true })).toBeVisible()
  })

  const CASI_SENZA_RIQUADRO: [string, Record<string, unknown>][] = [
    ["bozza gia' 'inviata'", { bozza_grafica: "inviata" }],
    ["bozza 'approvata'", { bozza_grafica: "approvata" }],
    ["bozza 'non_serve'", { bozza_grafica: "non_serve" }],
    ["status diverso da 'bozza_grafica'", { status: "da_fare" }],
    ["canale mail senza email", { canale: "mail", email_cliente: null }],
    ["senza telefono e senza email", { telefono: null, email_cliente: null }],
  ]

  for (const [label, overrides] of CASI_SENZA_RIQUADRO) {
    test(`4. nessun riquadro: ${label}`, async ({ page }) => {
      const id = await newOrder(overrides)
      await page.goto(`/orders/${id}`)
      // Ancora: la pagina e' renderizzata prima di verificare l'assenza.
      await expect(page.locator("h1").filter({ hasText: "E2E Anteprima" })).toBeVisible()
      await expect(page.getByText("Invia anteprima:")).toHaveCount(0)
    })
  }
})
```

- [ ] **Step 3: Esegui lo script**

Run: `npx playwright test e2e/tmp-invia-anteprima.spec.ts --project=chromium --reporter=list`
Expected: avvia da solo il server di sviluppo (`npm run dev`, può richiedere fino a ~2 minuti al primo avvio) e termina con `9 passed`. L'output deve contenere la riga `RESIDUI dopo cleanup: orders=0 order_items=0`.

Se un test fallisce, **non modificare il codice dell'app di tua iniziativa**: riporta il test fallito, il messaggio d'errore esatto e cosa hai osservato (è il motivo per cui esiste la verifica). Se fallisce per un problema dello script stesso (es. locator sbagliato), correggi lo script e riesegui, dichiarandolo nel report.

- [ ] **Step 4: Cancella lo script e ripulisci**

```bash
rm e2e/tmp-invia-anteprima.spec.ts
git status --short
```

Expected: `git status --short` non mostra nulla di tracciabile (né lo script, né altri file; `.env.local` è ignorato da git). Se compaiono altri file (es. `test-results/`, `playwright-report/`), verifica che siano ignorati e altrimenti cancellali.

- [ ] **Step 5: Report**

Nessun commit. Riporta: numero di test passati/falliti con i nomi, la riga `RESIDUI dopo cleanup: ...` così com'è stata stampata, e conferma che lo script è stato cancellato e `git status` è pulito.

---

## Dopo l'implementazione (fuori da questo piano)

Il controller (non l'implementatore), dopo il merge su `main`:
1. Verifica l'esito reale del Task 3 e aggiorna `CLAUDE.md` con la riga in "Decisioni chiave" (riquadro "Invia anteprima") e il bullet in Testing, con la data e l'esito effettivi.
2. Pusha su `origin/main` e controlla con `gh run watch` che la CI passi.
3. Verifica manuale dell'utente su un ordine vero: l'ordine in "Bozza grafica" mostra il riquadro, WhatsApp/Email aprono la chat/mail del cliente col testo pronto, e dopo il click la bozza risulta "Inviata".
