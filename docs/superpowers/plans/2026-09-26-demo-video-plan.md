# Demo privata con dati finti e video — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire gli strumenti per una copia privata dell'app (livello base) con clienti e ordini inventati: uno script che la riempie di dati finti sempre "freschi" con protezioni contro lo svuotamento del database vero, la guida per configurarla, e la scaletta del video dimostrativo.

**Architecture:** Tre pezzi puri e testati in `src/lib/demo/` (lettura di un file `.env`, controllo di sicurezza sul database di destinazione, costruzione dei dati finti con date relative a oggi) e due script in `scripts/` (uno genera il file SQL dello schema da incollare nel SQL Editor di Supabase, uno svuota e riempie la demo). Nessuna modifica all'app né al database vero.

**Tech Stack:** TypeScript, Jest (`ts-jest`), `tsx` (nuova dipendenza di sviluppo, per eseguire lo script), `@supabase/supabase-js` (già presente), Playwright (verifica reale).

**Riferimento:** `docs/superpowers/specs/2026-09-26-demo-video-design.md`

---

## Note per chi esegue

- **Attribuzione dei commit:** ogni commit termina con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (`git commit -m "titolo" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`). Nessun altro nome di modello.
- **Lingua:** commenti, messaggi di errore, commit e documenti in italiano.
- **Comandi di verifica:** `npx jest --roots=src` (mai `npx jest` da solo) e `npx tsc --noEmit`. Per lanciare un solo file di test: `npx jest --roots=src --testPathPatterns=<parte-del-nome>` (passare il percorso subito dopo `--roots=src` non funziona).
- **Sicurezza:** nessun test e nessuno script di questo piano deve mai toccare il database vero della bottega. Il progetto vero è quello di `.env.local`; il progetto demo è quello di `.env.demo.local`. Non stampare mai chiavi o password.
- **Il PIN del login accetta al massimo 6 cifre** (campo con `maxLength={6}`) e Supabase vuole almeno 6 caratteri: il PIN della demo è quindi di **esattamente 6 cifre**.
- **Prima parte (Task 1-5, 7):** solo codice e documenti, non serve nessun progetto Supabase. **Task 6** richiede che l'utente abbia già configurato la demo (guida in `docs/demo/configurazione-demo.md`, scritta nel Task 5).

## Mappa dei file

| File | Azione | Responsabilità |
|---|---|---|
| `src/lib/demo/envFile.ts` | crea | Legge il contenuto di un file `.env` |
| `src/lib/demo/safety.ts` | crea | Rifiuta di lavorare sul database vero |
| `src/lib/demo/demoData.ts` | crea | Costruisce clienti, ordini e promemoria finti con date relative a oggi |
| `src/lib/demo/__tests__/envFile.test.ts` | crea | Test di `envFile.ts` |
| `src/lib/demo/__tests__/safety.test.ts` | crea | Test di `safety.ts` |
| `src/lib/demo/__tests__/demoData.test.ts` | crea | Test di `demoData.ts` |
| `scripts/demo-schema.mjs` | crea | Concatena le migration in `demo-schema.sql` |
| `scripts/demo-reset.ts` | crea | Svuota e riempie la demo |
| `.env.demo.example` | crea | Modello delle chiavi della demo |
| `.gitignore` | modifica | Ignora `demo-schema.sql` |
| `package.json` | modifica | `tsx` e gli script `demo:schema`, `demo:reset` |
| `docs/demo/configurazione-demo.md` | crea | Guida passo passo per Supabase e Vercel |
| `docs/demo/video-scaletta.md` | crea | Scaletta e testo del video |
| `playwright.demo.config.ts`, `e2e/tmp-demo-check.spec.ts` | crea e poi cancella | Prova reale sulla demo (temporanea) |
| `CLAUDE.md` | modifica | Decisione e stato dei test |

---

### Task 0: Preparare l'ambiente di lavoro

**Files:** nessuno.

- [ ] **Step 1: Usare il worktree già creato**

Il lavoro si fa sul ramo `feature/demo-video`, nel worktree `D:\Documenti\Projects\oltre_la_bottega\.claude\worktrees\demo-video` (creato dal ramo `feature/livello-base`, così contiene già il livello base). Verificare:

```bash
cd D:/Documenti/Projects/oltre_la_bottega/.claude/worktrees/demo-video
git branch --show-current
git log --oneline -3
```

Expected: ramo `feature/demo-video`, l'ultimo commit è il piano (`docs: piano di implementazione della demo e del video`) o successivo.

- [ ] **Step 2: Installare le dipendenze e copiare le credenziali**

```bash
npm ci
cp ../../../.env.local .env.local
```

`.env.local` è ignorato da git: non va committato.

- [ ] **Step 3: Verificare la base di partenza**

```bash
npx jest --roots=src
npx tsc --noEmit
```

Expected: 19 suite / 188 test verdi, `tsc` pulito. Se qualcosa fallisce già ora, fermarsi e segnalarlo.

---

### Task 1: Lettura di un file `.env` (`envFile.ts`)

**Files:**
- Create: `src/lib/demo/envFile.ts`
- Test: `src/lib/demo/__tests__/envFile.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/demo/__tests__/envFile.test.ts`:

```ts
import { parseEnvFile } from "../envFile"

describe("parseEnvFile", () => {
  it("legge coppie CHIAVE=valore", () => {
    expect(parseEnvFile("A=uno\nB=due")).toEqual({ A: "uno", B: "due" })
  })

  it("ignora righe vuote e commenti", () => {
    const testo = "# commento\n\nA=uno\n   # altro commento\nB=due\n"
    expect(parseEnvFile(testo)).toEqual({ A: "uno", B: "due" })
  })

  it("toglie le virgolette intorno al valore", () => {
    expect(parseEnvFile('A="uno"\nB=\'due\'')).toEqual({ A: "uno", B: "due" })
  })

  it("gestisce i file con fine riga di Windows", () => {
    expect(parseEnvFile("A=uno\r\nB=due\r\n")).toEqual({ A: "uno", B: "due" })
  })

  it("usa solo il primo = come separatore (le chiavi finiscono spesso con =)", () => {
    expect(parseEnvFile("KEY=abc==")).toEqual({ KEY: "abc==" })
  })

  it("toglie gli spazi intorno a chiave e valore", () => {
    expect(parseEnvFile("  A  =  uno  ")).toEqual({ A: "uno" })
  })

  it("ignora le righe senza =", () => {
    expect(parseEnvFile("solo testo\nA=uno")).toEqual({ A: "uno" })
  })

  it("un valore vuoto resta una stringa vuota", () => {
    expect(parseEnvFile("A=")).toEqual({ A: "" })
  })

  it("accetta il prefisso export davanti alla chiave", () => {
    expect(parseEnvFile("export A=uno")).toEqual({ A: "uno" })
  })

  it("taglia il commento in coda a un valore senza virgolette", () => {
    expect(parseEnvFile("A=https://x.supabase.co # vero")).toEqual({ A: "https://x.supabase.co" })
  })

  it("taglia il commento in coda a un valore tra virgolette", () => {
    expect(parseEnvFile('A="uno" # c')).toEqual({ A: "uno" })
    expect(parseEnvFile("B='due' # c")).toEqual({ B: "due" })
  })

  it("un # dentro il valore (senza spazio prima) non è un commento", () => {
    expect(parseEnvFile("A=pa#ss")).toEqual({ A: "pa#ss" })
  })

  it("con virgolette non chiuse prende il testo dopo la virgoletta di apertura", () => {
    expect(parseEnvFile('A="uno')).toEqual({ A: "uno" })
  })

  it("ignora il BOM a inizio file", () => {
    expect(parseEnvFile("﻿A=uno")).toEqual({ A: "uno" })
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest --roots=src --testPathPatterns=envFile`
Expected: FAIL con `Cannot find module '../envFile'`.

- [ ] **Step 3: Implementare**

Creare `src/lib/demo/envFile.ts`:

```ts
/**
 * Legge il contenuto di un file .env: coppie CHIAVE=valore, righe vuote e
 * commenti (#) ignorati, prefisso `export` e virgolette facoltativi, commenti in
 * coda alla riga tagliati come fanno Next.js e dotenv. Serve agli script della
 * demo, che leggono `.env.demo.local` senza dipendenze in più.
 */
export function parseEnvFile(testo: string): Record<string, string> {
  const risultato: Record<string, string> = {}
  for (const rigaGrezza of testo.split(/\r?\n/)) {
    const riga = rigaGrezza.trim()
    if (!riga || riga.startsWith("#")) continue
    const uguale = riga.indexOf("=")
    if (uguale <= 0) continue
    const chiave = riga
      .slice(0, uguale)
      .trim()
      .replace(/^export\s+/, "")
    if (!chiave) continue
    const grezzo = riga.slice(uguale + 1).trim()
    const apertura = grezzo[0]
    let valore: string
    if (apertura === '"' || apertura === "'") {
      // Tra virgolette: si prende il testo fino alla virgoletta di chiusura, il resto è un commento.
      const chiusura = grezzo.indexOf(apertura, 1)
      valore = chiusura === -1 ? grezzo.slice(1) : grezzo.slice(1, chiusura)
    } else {
      // Senza virgolette: un commento inizia al primo `#` preceduto da uno spazio.
      valore = grezzo.split(/\s+#/)[0].trim()
    }
    risultato[chiave] = valore
  }
  return risultato
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest --roots=src --testPathPatterns=envFile`
Expected: PASS (14 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/envFile.ts src/lib/demo/__tests__/envFile.test.ts
git commit -m "feat: lettura dei file .env per gli script della demo" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Protezione contro il database vero (`safety.ts`)

**Files:**
- Create: `src/lib/demo/safety.ts`
- Test: `src/lib/demo/__tests__/safety.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/demo/__tests__/safety.test.ts`:

```ts
import { assertSafeTarget, hostOf } from "../safety"

describe("hostOf", () => {
  it("estrae l'host da un indirizzo completo", () => {
    expect(hostOf("https://abc.supabase.co/rest/v1?x=1")).toBe("abc.supabase.co")
  })

  it("accetta anche l'indirizzo senza https:// (come in .env.example)", () => {
    expect(hostOf("abc.supabase.co")).toBe("abc.supabase.co")
  })

  it("ignora maiuscole, spazi e barra finale", () => {
    expect(hostOf("  HTTPS://ABC.Supabase.co/ ")).toBe("abc.supabase.co")
  })

  it("ignora credenziali, porta e frammento", () => {
    expect(hostOf("https://u:p@VERO.supabase.co:443/x#y")).toBe("vero.supabase.co")
  })

  it("ignora il punto finale del nome host", () => {
    expect(hostOf("vero.supabase.co.")).toBe("vero.supabase.co")
  })

  it("restituisce null se manca", () => {
    expect(hostOf(undefined)).toBeNull()
    expect(hostOf("")).toBeNull()
    expect(hostOf("   ")).toBeNull()
  })
})

describe("assertSafeTarget", () => {
  const base = {
    demoUrl: "https://demo.supabase.co",
    prodUrls: ["https://vero.supabase.co", undefined],
    existingOrderCount: 0,
    existingUserCount: 0,
    hasDemoMarkerUser: false,
  }

  it("non fa niente per un database demo vuoto (prima esecuzione)", () => {
    expect(() => assertSafeTarget(base)).not.toThrow()
  })

  it("non fa niente per un database demo già usato (contiene l'utente marcato)", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 25, existingUserCount: 1, hasDemoMarkerUser: true })).not.toThrow()
  })

  it("rifiuta se manca l'indirizzo della demo", () => {
    expect(() => assertSafeTarget({ ...base, demoUrl: undefined })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "" })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "   " })).toThrow(/non tocco niente/)
  })

  it("rifiuta se l'indirizzo è quello del progetto vero, anche scritto in modo diverso", () => {
    expect(() => assertSafeTarget({ ...base, demoUrl: "https://vero.supabase.co" })).toThrow(/bottega vera/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "VERO.supabase.co/" })).toThrow(/bottega vera/)
  })

  it("rifiuta se un qualunque indirizzo 'vero' coincide", () => {
    expect(() =>
      assertSafeTarget({ ...base, prodUrls: [undefined, "https://demo.supabase.co"] })
    ).toThrow(/bottega vera/)
  })

  it("rifiuta un database con ordini ma senza l'utente marcato demo", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 3, hasDemoMarkerUser: false })).toThrow(
      /non sembra il progetto demo/
    )
  })

  it("rifiuta un database senza ordini ma con utenti e senza l'utente marcato demo", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 0, existingUserCount: 1, hasDemoMarkerUser: false })).toThrow(
      /non sembra il progetto demo/
    )
  })

  it("non fa niente per un database completamente vuoto (prima esecuzione)", () => {
    expect(() =>
      assertSafeTarget({ ...base, existingOrderCount: 0, existingUserCount: 0, hasDemoMarkerUser: false })
    ).not.toThrow()
  })

  it("rifiuta se l'indirizzo del progetto vero non è noto (fail-closed)", () => {
    expect(() => assertSafeTarget({ ...base, prodUrls: [undefined, ""] })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, prodUrls: [undefined, ""] })).toThrow(/progetto vero/)
    expect(() => assertSafeTarget({ ...base, prodUrls: [] })).toThrow(/progetto vero/)
  })

  it("l'utente marcato demo non basta se l'indirizzo è quello del progetto vero", () => {
    expect(() =>
      assertSafeTarget({
        ...base,
        demoUrl: "https://vero.supabase.co",
        existingOrderCount: 10,
        existingUserCount: 1,
        hasDemoMarkerUser: true,
      })
    ).toThrow(/bottega vera/)
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest --roots=src --testPathPatterns=safety`
Expected: FAIL con `Cannot find module '../safety'`.

- [ ] **Step 3: Implementare**

Creare `src/lib/demo/safety.ts`:

```ts
/**
 * Host di un indirizzo Supabase, in minuscolo, con o senza `https://`; null se manca.
 * Usa il parser URL standard, così credenziali, porta, frammento e punto finale
 * non possono mascherare un indirizzo uguale a quello vero.
 */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null
  const testo = url.trim()
  if (!testo) return null
  try {
    const conSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(testo) ? testo : `https://${testo}`
    return new URL(conSchema).hostname.replace(/\.$/, "") || null
  } catch {
    return testo.toLowerCase()
  }
}

export type SafeTargetInput = {
  /** Indirizzo del progetto che lo script sta per svuotare (DEMO_SUPABASE_URL). */
  demoUrl: string | undefined
  /** Indirizzi del progetto vero della bottega (da `.env.local` e dall'ambiente). */
  prodUrls: Array<string | undefined>
  /** Quanti ordini contiene già il database di destinazione. */
  existingOrderCount: number
  /** Quanti utenti (Auth) contiene già il database di destinazione. */
  existingUserCount: number
  /** Il database contiene l'utente marcato `demo: true`. */
  hasDemoMarkerUser: boolean
}

/**
 * Lo script che svuota la demo si deve rifiutare di partire se il database di
 * destinazione potrebbe essere quello della bottega vera. Lancia un errore
 * (in italiano) prima che qualunque scrittura sia stata fatta.
 */
export function assertSafeTarget({
  demoUrl,
  prodUrls,
  existingOrderCount,
  existingUserCount,
  hasDemoMarkerUser,
}: SafeTargetInput): void {
  const demoHost = hostOf(demoUrl)
  if (!demoHost) {
    throw new Error("DEMO_SUPABASE_URL manca: non so quale database svuotare, non tocco niente.")
  }

  const prodHosts = prodUrls.map(hostOf).filter((h): h is string => h !== null)
  if (prodHosts.length === 0) {
    throw new Error(
      "Non trovo l'indirizzo del progetto vero (NEXT_PUBLIC_SUPABASE_URL in .env.local): non posso escludere che sia lui, non tocco niente."
    )
  }
  if (prodHosts.includes(demoHost)) {
    throw new Error(
      `DEMO_SUPABASE_URL (${demoHost}) è lo stesso progetto della bottega vera: mi fermo, non tocco niente.`
    )
  }

  // Un'istanza vera ha sempre almeno un utente; una demo appena creata non ne ha.
  if ((existingOrderCount > 0 || existingUserCount > 0) && !hasDemoMarkerUser) {
    throw new Error(
      "Il database contiene già ordini o utenti ma non l'utente marcato come demo: non sembra il progetto demo, mi fermo, non tocco niente."
    )
  }
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest --roots=src --testPathPatterns=safety`
Expected: PASS (16 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/safety.ts src/lib/demo/__tests__/safety.test.ts
git commit -m "feat: controllo di sicurezza sul database di destinazione della demo" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: I dati finti (`demoData.ts`)

**Files:**
- Create: `src/lib/demo/demoData.ts`
- Test: `src/lib/demo/__tests__/demoData.test.ts`

Nei file di `src/lib/demo/` usare **import relativi** (`../orderItems`), non l'alias `@/`, così gli stessi file funzionano sia con Jest sia con `tsx`.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/demo/__tests__/demoData.test.ts`:

```ts
import { buildDemoData, giorno, type DemoOrder } from "../demoData"
import { computeOrderSummary } from "../../orderItems"
import { computeSaldo } from "../../orderConstants"

const OGGI = new Date("2026-09-30T10:00:00Z")
const STATI_BASE = ["preventivo", "da_fare", "in_lavorazione", "pronto", "consegnato"]

function ordini(oggi: Date = OGGI): DemoOrder[] {
  return buildDemoData(oggi).orders
}

describe("giorno", () => {
  it("calcola giorni relativi a oggi", () => {
    expect(giorno(OGGI, 0)).toBe("2026-09-30")
    expect(giorno(OGGI, 1)).toBe("2026-10-01")
    expect(giorno(OGGI, -30)).toBe("2026-08-31")
  })

  it("attraversa correttamente i cambi di mese e di anno", () => {
    expect(giorno(new Date("2026-01-01T12:00:00Z"), -1)).toBe("2025-12-31")
    expect(giorno(new Date("2026-12-31T12:00:00Z"), 1)).toBe("2027-01-01")
  })
})

describe("buildDemoData — la giornata di oggi", () => {
  const conta = (oggi: Date, filtro: (o: DemoOrder) => boolean) => ordini(oggi).filter(filtro).length

  it("ha 2 lavori da consegnare oggi (non ancora consegnati)", () => {
    const oggi = giorno(OGGI, 0)
    expect(conta(OGGI, (o) => o.order.data_consegna === oggi && o.order.status !== "consegnato")).toBe(2)
  })

  it("ha 1 lavoro consegnato oggi", () => {
    const oggi = giorno(OGGI, 0)
    expect(conta(OGGI, (o) => o.order.data_consegnato === oggi)).toBe(1)
  })

  it("ha 3 ordini pronti da avvisare", () => {
    expect(conta(OGGI, (o) => o.order.status === "pronto" && !o.order.msg_pronto_inviato)).toBe(3)
  })

  it("ha 2 ordini in ritardo", () => {
    const oggi = giorno(OGGI, 0)
    expect(
      conta(OGGI, (o) => !!o.order.data_consegna && o.order.data_consegna < oggi && o.order.status !== "consegnato")
    ).toBe(2)
  })

  it("ha 3 preventivi, da inviare o inviati", () => {
    const preventivi = ordini().filter((o) => o.order.status === "preventivo")
    expect(preventivi).toHaveLength(3)
    for (const p of preventivi) expect(["da_inviare", "inviato"]).toContain(p.order.preventivo)
  })

  it("ha almeno una recensione da chiedere", () => {
    expect(
      conta(OGGI, (o) => o.order.status === "consegnato" && o.order.chiedere_recensione && !o.order.recensione_ricevuta)
    ).toBeGreaterThanOrEqual(1)
  })

  it("la giornata resta la stessa cambiando il giorno di esecuzione", () => {
    const altro = new Date("2027-03-15T08:00:00Z")
    const oggi = giorno(altro, 0)
    expect(conta(altro, (o) => o.order.data_consegna === oggi && o.order.status !== "consegnato")).toBe(2)
    expect(conta(altro, (o) => o.order.data_consegnato === oggi)).toBe(1)
    expect(conta(altro, (o) => o.order.status === "pronto" && !o.order.msg_pronto_inviato)).toBe(3)
  })
})

describe("buildDemoData — coerenza dei dati", () => {
  it("ha circa 20 ordini e 15 clienti diversi", () => {
    const lista = ordini()
    expect(lista.length).toBeGreaterThanOrEqual(18)
    expect(lista.length).toBeLessThanOrEqual(22)
    const clienti = new Set(lista.map((o) => o.order.telefono))
    expect(clienti.size).toBe(15)
  })

  it("ogni ordine ha una sola riga articolo (il livello base non ha il multi-riga)", () => {
    for (const o of ordini()) expect(o.items).toHaveLength(1)
  })

  it("cosa_ordinato, prezzo e saldo sono coerenti con le righe", () => {
    for (const o of ordini()) {
      const { cosaOrdinato, prezzo } = computeOrderSummary(o.items)
      expect(o.order.cosa_ordinato).toBe(cosaOrdinato)
      expect(o.order.prezzo).toBe(prezzo)
      expect(o.order.saldo).toBe(computeSaldo(prezzo, o.order.acconto))
    }
  })

  it("usa solo gli stati del livello base e nessun sottostato avanzato", () => {
    for (const o of ordini()) {
      expect(STATI_BASE).toContain(o.order.status)
      expect(o.order.bozza_grafica).toBe("non_serve")
      expect(o.order.materiale).toBe("non_serve")
    }
  })

  it("gli ordini consegnati hanno data di consegna effettiva, saldo zero e un evento in cronologia", () => {
    for (const o of ordini().filter((x) => x.order.status === "consegnato")) {
      expect(o.order.data_consegnato).not.toBeNull()
      expect(o.order.saldo).toBe(0)
      expect(o.events.map((e) => e.event_type)).toEqual(["created", "status_change"])
    }
  })

  it("gli ordini non consegnati non hanno data di consegna effettiva", () => {
    for (const o of ordini().filter((x) => x.order.status !== "consegnato")) {
      expect(o.order.data_consegnato).toBeNull()
      expect(o.events.map((e) => e.event_type)).toEqual(["created"])
    }
  })

  it("un cliente torna più volte (storico): almeno 3 ordini con lo stesso telefono", () => {
    const perTelefono = new Map<string, number>()
    for (const o of ordini()) perTelefono.set(o.order.telefono, (perTelefono.get(o.order.telefono) ?? 0) + 1)
    expect(Math.max(...perTelefono.values())).toBeGreaterThanOrEqual(3)
  })

  it("i clienti ente hanno cognome e azienda vuoti, un referente e nessuna recensione da chiedere", () => {
    const enti = ordini().filter((o) => o.order.is_ente)
    expect(enti.length).toBeGreaterThanOrEqual(2)
    for (const o of enti) {
      expect(o.order.cognome).toBeNull()
      expect(o.order.azienda).toBeNull()
      expect(o.order.referente).toBeTruthy()
      expect(o.order.chiedere_recensione).toBe(false)
    }
  })

  it("i telefoni sono tutti inventati (333 0000xxx) e le email usano il dominio riservato example.com", () => {
    for (const o of ordini()) {
      expect(o.order.telefono).toMatch(/^333 0000\d{3}$/)
      if (o.order.email_cliente) expect(o.order.email_cliente).toMatch(/@example\.com$/)
    }
  })

  it("un ordine con canale 'mail' ha l'email del cliente", () => {
    for (const o of ordini().filter((x) => x.order.canale === "mail")) {
      expect(o.order.email_cliente).toBeTruthy()
    }
  })

  it("è deterministico: lo stesso giorno produce gli stessi dati", () => {
    expect(JSON.stringify(buildDemoData(OGGI))).toBe(JSON.stringify(buildDemoData(OGGI)))
  })
})

describe("buildDemoData — promemoria", () => {
  const { reminders } = buildDemoData(OGGI)

  it("ha 3 promemoria attivi e 1 completato oggi", () => {
    expect(reminders.filter((r) => r.status === "attivo")).toHaveLength(3)
    const completati = reminders.filter((r) => r.status === "completato")
    expect(completati).toHaveLength(1)
    expect(completati[0].completed_at?.startsWith("2026-09-30")).toBe(true)
  })

  it("gli attivi scadono oggi o prima (compaiono nella pagina Oggi)", () => {
    for (const r of reminders.filter((x) => x.status === "attivo")) {
      expect(r.due_at.slice(0, 10) <= "2026-09-30").toBe(true)
    }
  })

  it("un solo promemoria attivo è in ritardo; quelli di oggi scadono più tardi nella giornata", () => {
    const attivi = reminders.filter((r) => r.status === "attivo")
    const inRitardo = attivi.filter((r) => new Date(r.due_at).getTime() < OGGI.getTime())
    expect(inRitardo).toHaveLength(1)
    expect(inRitardo[0].due_at.slice(0, 10)).toBe("2026-09-29")
    const diOggi = attivi.filter((r) => r.due_at.slice(0, 10) === "2026-09-30")
    expect(diOggi).toHaveLength(2)
    for (const r of diOggi) expect(new Date(r.due_at).getTime()).toBeGreaterThan(OGGI.getTime())
  })
})

describe("buildDemoData — nessun istante di oggi nel futuro", () => {
  const momenti = [OGGI, new Date("2026-09-30T00:10:00Z")]

  it.each(momenti.map((m) => [m.toISOString(), m] as const))("con generazione alle %s", (_etichetta, adesso) => {
    const limite = adesso.getTime()
    const dati = buildDemoData(adesso)
    for (const o of dati.orders) {
      expect(new Date(o.order.created_at).getTime()).toBeLessThanOrEqual(limite)
      expect(new Date(o.order.updated_at).getTime()).toBeLessThanOrEqual(limite)
      for (const e of o.events) expect(new Date(e.created_at).getTime()).toBeLessThanOrEqual(limite)
    }
    for (const r of dati.reminders) {
      if (r.completed_at) expect(new Date(r.completed_at).getTime()).toBeLessThanOrEqual(limite)
    }
    expect(JSON.stringify(buildDemoData(adesso))).toBe(JSON.stringify(dati))
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest --roots=src --testPathPatterns=demoData`
Expected: FAIL con `Cannot find module '../demoData'`.

- [ ] **Step 3: Implementare**

Creare `src/lib/demo/demoData.ts`:

```ts
import { computeOrderSummary, type OrderItemInput } from "../orderItems"
import { computeSaldo } from "../orderConstants"

// Dati INVENTATI per la copia demo: nessun nome o numero appartiene a persone
// vere. I telefoni seguono il modello "333 0000xxx" e le email usano il dominio
// riservato example.com, così non possono raggiungere nessuno.

export type DemoOrderRow = {
  nome: string
  cognome: string | null
  is_ente: boolean
  azienda: string | null
  referente: string | null
  telefono: string
  email_cliente: string | null
  canale: string
  data_ordine: string
  data_consegna: string | null
  data_consegnato: string | null
  cosa_ordinato: string
  prezzo: number
  acconto: number
  saldo: number
  status: string
  preventivo: string
  bozza_grafica: string
  materiale: string
  consenso_marketing: boolean
  chiedere_recensione: boolean
  recensione_richiesta: boolean
  recensione_ricevuta: boolean
  msg_pronto_inviato: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export type DemoEvent = { event_type: string; note: string; created_at: string }
export type DemoOrder = { order: DemoOrderRow; items: OrderItemInput[]; events: DemoEvent[] }
export type DemoReminder = {
  title: string
  due_at: string
  status: "attivo" | "completato"
  completed_at: string | null
}
export type DemoData = { orders: DemoOrder[]; reminders: DemoReminder[] }

const GIORNO_MS = 86_400_000

/** Giorno "AAAA-MM-GG" a `offset` giorni da oggi (stessa convenzione dell'app: data UTC di toISOString). */
export function giorno(oggi: Date, offset: number): string {
  const base = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate())
  return new Date(base + offset * GIORNO_MS).toISOString().slice(0, 10)
}

/** Un istante di oggi non può stare nel futuro rispetto al momento in cui si genera la demo. */
function nonFuturo(oggi: Date, iso: string): string {
  return new Date(iso).getTime() > oggi.getTime() ? oggi.toISOString() : iso
}

type Cliente = {
  nome: string
  cognome: string | null
  /** Presente = cliente ente/azienda con questo referente. */
  ente?: { referente: string }
  telefono: string
  email?: string
  canale: string
}

const CLIENTI = {
  giulia: { nome: "Giulia", cognome: "Ferri", telefono: "333 0000101", canale: "negozio" },
  marco: { nome: "Marco", cognome: "Neri", telefono: "333 0000102", canale: "telefono" },
  anna: { nome: "Anna", cognome: "Bellini", telefono: "333 0000103", canale: "WhatsApp" },
  luca: { nome: "Luca", cognome: "Conti", telefono: "333 0000104", canale: "negozio" },
  sara: { nome: "Sara", cognome: "Moretti", telefono: "333 0000105", canale: "negozio" },
  paolo: { nome: "Paolo", cognome: "Riva", telefono: "333 0000106", canale: "telefono" },
  elena: { nome: "Elena", cognome: "Costa", telefono: "333 0000107", canale: "WhatsApp" },
  davide: { nome: "Davide", cognome: "Serra", telefono: "333 0000108", canale: "negozio" },
  chiara: { nome: "Chiara", cognome: "Fontana", telefono: "333 0000109", canale: "mail", email: "chiara.fontana@example.com" },
  franco: { nome: "Franco", cognome: "Greco", telefono: "333 0000110", canale: "negozio" },
  marta: { nome: "Marta", cognome: "Leone", telefono: "333 0000111", canale: "WhatsApp" },
  andrea: { nome: "Andrea", cognome: "Sala", telefono: "333 0000112", canale: "negozio" },
  officina: { nome: "Officina Bianchi", cognome: null, ente: { referente: "Roberto Bianchi" }, telefono: "333 0000113", canale: "telefono" },
  faro: { nome: "Associazione Il Faro", cognome: null, ente: { referente: "Silvia Marchi" }, telefono: "333 0000114", canale: "negozio" },
  trattoria: { nome: "Trattoria Da Rosa", cognome: null, ente: { referente: "Rosa Lombardi" }, telefono: "333 0000115", canale: "WhatsApp" },
} satisfies Record<string, Cliente>

type Specifica = {
  cliente: Cliente
  articolo: string
  testo?: string
  quantita: number
  prezzoUnitario: number
  status: "preventivo" | "da_fare" | "in_lavorazione" | "pronto" | "consegnato"
  /** Giorni rispetto a oggi. */
  ordine: number
  consegna: number
  /** Solo per gli ordini consegnati. */
  consegnato?: number
  acconto?: number
  preventivo?: "da_inviare" | "inviato"
  recensioneDaChiedere?: boolean
  consenso?: boolean
}

function costruisci(oggi: Date, s: Specifica): DemoOrder {
  const items: OrderItemInput[] = [
    {
      cosa_ordinato: s.articolo,
      testo_da_scrivere: s.testo ?? null,
      quantita: s.quantita,
      prezzo_unitario: s.prezzoUnitario,
    },
  ]
  const { cosaOrdinato, prezzo } = computeOrderSummary(items)
  const consegnato = s.status === "consegnato"
  const acconto = consegnato ? prezzo : s.acconto ?? 0
  const dataOrdine = giorno(oggi, s.ordine)
  const dataConsegnato = consegnato && s.consegnato !== undefined ? giorno(oggi, s.consegnato) : null
  const creato = nonFuturo(oggi, `${dataOrdine}T09:00:00Z`)
  const chiuso = dataConsegnato ? nonFuturo(oggi, `${dataConsegnato}T16:00:00Z`) : creato
  const ente = s.cliente.ente

  const events: DemoEvent[] = [{ event_type: "created", note: "Ordine creato", created_at: creato }]
  if (dataConsegnato) {
    events.push({ event_type: "status_change", note: "Consegnato al cliente", created_at: chiuso })
  }

  return {
    order: {
      nome: s.cliente.nome,
      cognome: s.cliente.cognome,
      is_ente: Boolean(ente),
      azienda: null,
      referente: ente ? ente.referente : null,
      telefono: s.cliente.telefono,
      email_cliente: s.cliente.email ?? null,
      canale: s.cliente.canale,
      data_ordine: dataOrdine,
      data_consegna: giorno(oggi, s.consegna),
      data_consegnato: dataConsegnato,
      cosa_ordinato: cosaOrdinato,
      prezzo,
      acconto,
      saldo: computeSaldo(prezzo, acconto),
      status: s.status,
      preventivo: s.preventivo ?? "non_inviare",
      bozza_grafica: "non_serve",
      materiale: "non_serve",
      consenso_marketing: s.consenso ?? false,
      chiedere_recensione: !ente && Boolean(s.recensioneDaChiedere),
      recensione_richiesta: false,
      recensione_ricevuta: false,
      msg_pronto_inviato: false,
      note: null,
      created_at: creato,
      updated_at: chiuso,
    },
    items,
    events,
  }
}

/**
 * Costruisce clienti, ordini e promemoria finti con date relative a `oggi`:
 * la pagina Oggi è sempre viva (2 consegne oggi, 1 consegnato oggi, 3 pronti da
 * avvisare, 2 in ritardo, 3 preventivi, un cliente che torna, una recensione da
 * chiedere). Funzione pura: lo stesso giorno produce sempre gli stessi dati.
 */
export function buildDemoData(oggi: Date): DemoData {
  const C = CLIENTI
  const specifiche: Specifica[] = [
    // Da consegnare oggi
    { cliente: C.giulia, articolo: "Targa in plexiglass 30x10", testo: "Studio Ferri - Avvocato", quantita: 1, prezzoUnitario: 25, status: "in_lavorazione", ordine: -5, consegna: 0, acconto: 10 },
    { cliente: C.officina, articolo: "Targhe portamatricola", quantita: 2, prezzoUnitario: 18, status: "in_lavorazione", ordine: -6, consegna: 0, acconto: 15 },
    // Consegnato oggi (con recensione da chiedere)
    { cliente: C.marco, articolo: "Timbro automatico", quantita: 1, prezzoUnitario: 22, status: "consegnato", ordine: -4, consegna: 0, consegnato: 0, recensioneDaChiedere: true, consenso: true },
    // Pronti, da avvisare
    { cliente: C.anna, articolo: "Portachiavi inciso", testo: "Famiglia Bellini", quantita: 10, prezzoUnitario: 3.5, status: "pronto", ordine: -8, consegna: 1, acconto: 15 },
    { cliente: C.sara, articolo: "Coppa premiazione", quantita: 1, prezzoUnitario: 40, status: "pronto", ordine: -9, consegna: 1 },
    { cliente: C.trattoria, articolo: "Targhette tavoli numerate", quantita: 12, prezzoUnitario: 4, status: "pronto", ordine: -7, consegna: 2, acconto: 20 },
    // In ritardo
    { cliente: C.paolo, articolo: "Magliette personalizzate", quantita: 6, prezzoUnitario: 12, status: "in_lavorazione", ordine: -12, consegna: -2, acconto: 30 },
    { cliente: C.elena, articolo: "Targa in ottone", quantita: 1, prezzoUnitario: 55, status: "da_fare", ordine: -6, consegna: -1, acconto: 20 },
    // Preventivi
    { cliente: C.davide, articolo: "Insegna per negozio", quantita: 1, prezzoUnitario: 120, status: "preventivo", preventivo: "da_inviare", ordine: -1, consegna: 14 },
    { cliente: C.faro, articolo: "Coppe e medaglie", quantita: 20, prezzoUnitario: 6, status: "preventivo", preventivo: "inviato", ordine: -3, consegna: 10 },
    { cliente: C.chiara, articolo: "Bomboniere incise", quantita: 40, prezzoUnitario: 2.5, status: "preventivo", preventivo: "da_inviare", ordine: 0, consegna: 20 },
    // Da fare e in lavorazione
    { cliente: C.franco, articolo: "Timbro con logo", quantita: 1, prezzoUnitario: 28, status: "da_fare", ordine: -2, consegna: 3 },
    { cliente: C.marta, articolo: "Quadro inciso su legno", quantita: 1, prezzoUnitario: 65, status: "da_fare", ordine: -1, consegna: 5, acconto: 20 },
    { cliente: C.andrea, articolo: "Chiavi e targhetta", quantita: 1, prezzoUnitario: 18, status: "in_lavorazione", ordine: -3, consegna: 2 },
    // Un cliente che torna: Luca Conti, 3 ordini
    { cliente: C.luca, articolo: "Trofeo torneo", quantita: 1, prezzoUnitario: 45, status: "consegnato", ordine: -45, consegna: -40, consegnato: -40 },
    { cliente: C.luca, articolo: "Targa studio", quantita: 1, prezzoUnitario: 30, status: "consegnato", ordine: -22, consegna: -18, consegnato: -18 },
    { cliente: C.luca, articolo: "Timbro medico", quantita: 1, prezzoUnitario: 26, status: "da_fare", ordine: -1, consegna: 4, acconto: 10 },
    // Storico di altri clienti
    { cliente: C.giulia, articolo: "Portachiavi", quantita: 5, prezzoUnitario: 3.5, status: "consegnato", ordine: -30, consegna: -25, consegnato: -25 },
    { cliente: C.officina, articolo: "Etichette inventario", quantita: 1, prezzoUnitario: 60, status: "consegnato", ordine: -15, consegna: -12, consegnato: -12 },
  ]

  const reminders: DemoReminder[] = [
    { title: "Ordinare il cartoncino dal fornitore", due_at: `${giorno(oggi, 0)}T21:59:00Z`, status: "attivo", completed_at: null },
    { title: "Richiamare Anna Bellini: ordine pronto", due_at: `${giorno(oggi, 0)}T21:59:00Z`, status: "attivo", completed_at: null },
    { title: "Pagare la bolletta della luce", due_at: `${giorno(oggi, -1)}T09:00:00Z`, status: "attivo", completed_at: null },
    { title: "Chiamare il corriere", due_at: `${giorno(oggi, 0)}T08:00:00Z`, status: "completato", completed_at: nonFuturo(oggi, `${giorno(oggi, 0)}T08:30:00Z`) },
  ]

  return { orders: specifiche.map((s) => costruisci(oggi, s)), reminders }
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest --roots=src --testPathPatterns=demoData`
Expected: PASS (tutti i test). Se un conteggio non torna, correggere **i dati** in `buildDemoData` (non i test): i numeri (2 consegne oggi, 1 consegnato oggi, 3 da avvisare, 2 in ritardo, 3 preventivi, 15 clienti, 3 ordini per Luca) sono il requisito.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/demoData.ts src/lib/demo/__tests__/demoData.test.ts
git commit -m "feat: dati finti per la demo, con date relative a oggi" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Gli script (`demo-schema.mjs`, `demo-reset.ts`) e la configurazione

**Files:**
- Create: `scripts/demo-schema.mjs`, `scripts/demo-reset.ts`, `.env.demo.example`
- Modify: `.gitignore`, `package.json`

Non c'è un test automatico per gli script (toccano un database): la logica delicata è già in `safety.ts`, testata nel Task 2. La verifica reale è il Task 6.

- [ ] **Step 1: Script dello schema**

Creare `scripts/demo-schema.mjs`:

```js
// Concatena le migration in un unico file SQL da incollare nel SQL Editor del
// progetto Supabase DEMO. Uso: npm run demo:schema
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cartella = path.join(radice, "supabase", "migrations")
// Superata: la v2 cancella e ricrea tutte le tabelle, come già fatto per la bottega vera.
const SUPERATA = "20260625000001_initial_schema.sql"

const file = readdirSync(cartella)
  .filter((f) => f.endsWith(".sql") && f !== SUPERATA)
  .sort()

const righe = [
  "-- Schema completo per il progetto DEMO di Oltre la Bottega.",
  "-- Generato da scripts/demo-schema.mjs. Incollare tutto nel SQL Editor di Supabase ed eseguire,",
  "-- UNA SOLA VOLTA e SOLO su un progetto vuoto. La prima migration cancella e ricrea le tabelle:",
  "-- non eseguire mai questo file sul progetto della bottega vera.",
  "-- Il file si rifiuta da solo di partire su un progetto che ha già delle tabelle o degli utenti.",
  "",
  "do $$",
  "begin",
  "  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orders')",
  "     or exists (select 1 from auth.users) then",
  "    raise exception 'Questo progetto non è vuoto: schema demo NON applicato (nessuna modifica fatta).';",
  "  end if;",
  "end $$;",
  "",
]
for (const f of file) {
  righe.push(`-- ===== ${f} =====`, readFileSync(path.join(cartella, f), "utf-8").trim(), "")
}
righe.push(
  "-- Permessi sulle tabelle (di solito già concessi da Supabase; qui per sicurezza, solo per la demo).",
  "grant usage on schema public to anon, authenticated, service_role;",
  "grant all on all tables in schema public to anon, authenticated, service_role;",
  "grant all on all sequences in schema public to anon, authenticated, service_role;",
  ""
)

const destinazione = path.join(radice, "demo-schema.sql")
writeFileSync(destinazione, righe.join("\n"), "utf-8")
console.log(`Scritto ${destinazione} (${file.length} migration, da ${file[0]} a ${file[file.length - 1]}).`)
```

- [ ] **Step 2: Modello delle chiavi e `.gitignore`**

Creare `.env.demo.example`:

```
# Chiavi del progetto Supabase DEMO — mai quelle della bottega vera.
# Copiare questo file in .env.demo.local (ignorato da git) e compilare i valori.
DEMO_SUPABASE_URL=https://il-tuo-progetto-demo.supabase.co
DEMO_ANON_KEY=chiave-pubblica-anon-o-publishable
DEMO_SERVICE_ROLE_KEY=chiave-segreta-service-role-o-secret
DEMO_USER_EMAIL=demo@oltrelabottega.local
# Esattamente 6 cifre (il campo PIN del login ne accetta al massimo 6).
DEMO_PIN=246810
```

Aggiungere in fondo a `.gitignore`:

```
# schema della demo generato da scripts/demo-schema.mjs
demo-schema.sql
```

- [ ] **Step 3: Script che svuota e riempie la demo**

Creare `scripts/demo-reset.ts`:

```ts
// Svuota e riempie di dati finti il progetto Supabase DEMO.
// Uso: npm run demo:reset   (le chiavi stanno in .env.demo.local)
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { parseEnvFile } from "../src/lib/demo/envFile"
import { assertSafeTarget } from "../src/lib/demo/safety"
import { buildDemoData } from "../src/lib/demo/demoData"

const radice = process.cwd()

function leggiEnv(nomeFile: string): Record<string, string> {
  const file = path.join(radice, nomeFile)
  return existsSync(file) ? parseEnvFile(readFileSync(file, "utf-8")) : {}
}

function controlla<T extends { message: string } | null>(errore: T, contesto: string): void {
  if (errore) throw new Error(`${contesto}: ${errore.message}`)
}

async function main() {
  const demo = leggiEnv(".env.demo.local")
  const vero = leggiEnv(".env.local")

  const url = demo.DEMO_SUPABASE_URL
  const chiaveServizio = demo.DEMO_SERVICE_ROLE_KEY
  const email = demo.DEMO_USER_EMAIL
  const pin = demo.DEMO_PIN
  if (!url || !chiaveServizio || !email || !pin) {
    throw new Error(
      "Mancano dei valori in .env.demo.local (servono DEMO_SUPABASE_URL, DEMO_SERVICE_ROLE_KEY, DEMO_USER_EMAIL, DEMO_PIN). Vedere docs/demo/configurazione-demo.md."
    )
  }
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("DEMO_PIN deve essere di esattamente 6 cifre (il campo PIN del login ne accetta al massimo 6).")
  }

  const supabase = createClient(url.startsWith("http") ? url : `https://${url}`, chiaveServizio, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Solo letture, finché non abbiamo verificato che il database sia quello giusto.
  const { count, error: erroreConteggio } = await supabase.from("orders").select("id", { count: "exact" }).limit(1)
  controlla(
    erroreConteggio,
    "Non riesco a leggere il database demo (lo schema è stato creato? vedere docs/demo/configurazione-demo.md)"
  )
  const { data: elencoUtenti, error: erroreUtenti } = await supabase.auth.admin.listUsers({ perPage: 200 })
  controlla(erroreUtenti, "Non riesco a leggere gli utenti del database demo")
  const utenteDemo = elencoUtenti?.users.find((u) => u.user_metadata?.demo === true)

  assertSafeTarget({
    demoUrl: url,
    prodUrls: [vero.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL],
    existingOrderCount: count ?? 0,
    existingUserCount: elencoUtenti?.users.length ?? 0,
    hasDemoMarkerUser: Boolean(utenteDemo),
  })

  // Da qui in poi si scrive: il controllo di sicurezza è già passato.
  controlla((await supabase.from("reminders").delete().not("id", "is", null)).error, "Cancellazione promemoria")
  // order_items e order_events seguono con il cascade.
  controlla((await supabase.from("orders").delete().not("id", "is", null)).error, "Cancellazione ordini")

  const metadati = { shop_name: "Bottega di esempio", pin_set: true, demo: true }
  if (utenteDemo) {
    const { error } = await supabase.auth.admin.updateUserById(utenteDemo.id, {
      email,
      password: pin,
      email_confirm: true,
      user_metadata: metadati,
    })
    controlla(error, "Aggiornamento dell'utente demo")
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: metadati,
    })
    controlla(error, "Creazione dell'utente demo")
  }

  const dati = buildDemoData(new Date())
  for (const { order, items, events } of dati.orders) {
    const { data, error } = await supabase.from("orders").insert(order).select("id").single()
    controlla(error, `Inserimento ordine di ${order.nome}`)
    const idOrdine = data!.id
    controlla(
      (await supabase.from("order_items").insert(items.map((it, i) => ({ ...it, order_id: idOrdine, posizione: i })))).error,
      `Inserimento righe di ${order.nome}`
    )
    controlla(
      (await supabase.from("order_events").insert(events.map((e) => ({ ...e, order_id: idOrdine })))).error,
      `Inserimento cronologia di ${order.nome}`
    )
  }
  controlla((await supabase.from("reminders").insert(dati.reminders)).error, "Inserimento promemoria")

  const enti = dati.orders.filter((o) => o.order.is_ente).length
  console.log(
    `Demo rinfrescata: ${dati.orders.length} ordini (di cui ${enti} di enti/aziende), ${dati.reminders.length} promemoria.`
  )
  console.log(`Accesso: ${email} con il PIN scelto in .env.demo.local.`)
}

main().catch((errore: unknown) => {
  console.error("ERRORE:", errore instanceof Error ? errore.message : errore)
  process.exit(1)
})
```

- [ ] **Step 4: `package.json`**

Aggiungere in `scripts`:

```json
    "demo:schema": "node scripts/demo-schema.mjs",
    "demo:reset": "tsx scripts/demo-reset.ts"
```

e installare `tsx` come dipendenza di sviluppo:

```bash
npm install --save-dev tsx
```

- [ ] **Step 5: Verifiche senza database**

```bash
npm run demo:schema
```

Expected: stampa `Scritto ...demo-schema.sql (11 migration, da 20260626000001_order_schema_v2.sql a 20260909000001_add_ente_referente.sql).` Controllare che il file esista, inizi con l'intestazione di avvertimento seguita, subito dopo, dal blocco di guardia `do $$ ... raise exception 'Questo progetto non è vuoto ...'`, finisca con le tre righe `grant ... to anon, authenticated, service_role;` (precedute dal commento sui permessi), **non** contenga `20260625000001_initial_schema` e che `git status` **non** lo mostri (è ignorato).

```bash
npm run demo:reset
```

Expected (nessun `.env.demo.local` ancora presente): esce con `ERRORE: Mancano dei valori in .env.demo.local ...` e codice di uscita 1, **senza** aver toccato nessun database. Questo conferma anche che `tsx` risolve gli import relativi.

```bash
npx tsc --noEmit
npx jest --roots=src
```

Expected: `tsc` pulito; tutte le suite verdi (19 + 3 nuove).

- [ ] **Step 6: Commit**

```bash
git add scripts .env.demo.example .gitignore package.json package-lock.json
git commit -m "feat: script per schema, dati finti e rinfresco della demo" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Guida di configurazione e scaletta del video

**Files:**
- Create: `docs/demo/configurazione-demo.md`
- Create: `docs/demo/video-scaletta.md`

Sono documenti per l'utente (titolare di bottega, non tecnica): parole semplici, passi numerati, nessun gergo non spiegato. Copiare il contenuto sotto **così com'è** (i blocchi con quattro apici sono solo i contenitori).

- [ ] **Step 1: Creare `docs/demo/configurazione-demo.md`**

````markdown
# Configurare la demo (una volta sola)

La demo è una copia dell'app con clienti e ordini **inventati**. Serve per registrare il video e per le dimostrazioni dal vivo. Non ha niente a che fare con i dati della tua bottega.

Ti servono due cose: un progetto **Supabase** (il database, l'hai già creato) e un progetto **Vercel** (il sito). Segui i passi in ordine.

> **Regola d'oro:** non incollare mai chiavi o password in una chat. Vanno solo nel file `.env.demo.local` sul tuo computer.

## Prima di cominciare

Apri in Esplora file la cartella `D:\Documenti\Projects\oltre_la_bottega\.claude\worktrees\demo-video`: è la cartella di lavoro della demo. Finché il lavoro non sarà unito al resto del progetto, i comandi di questa guida esistono solo lì (la cartella principale del progetto è sul ramo del sito e non li ha). Clicca sulla barra dell'indirizzo, scrivi `powershell` e premi Invio: si apre il terminale già nella cartella giusta. Scrivi `git branch --show-current`: deve rispondere `feature/demo-video`; se risponde altro, fermati e chiedimi. In questa cartella le dipendenze sono già installate e il file `.env.local` (quello di sempre, serve alla protezione per riconoscere il progetto vero) c'è già. Ogni volta che riapri il terminale, riparti da qui. Dopo l'unione in `main` potrai usare la cartella principale del progetto (in quel caso, la prima volta, scrivi `npm install` e aspetta la fine).

## A. Il database (Supabase)

1. Nella cartella del progetto, apri il terminale e scrivi `npm run demo:schema`. Crea un file `demo-schema.sql`.
2. Scrivi `notepad demo-schema.sql`, premi Ctrl+A e Ctrl+C, poi chiudi.
3. In Supabase apri il **progetto demo** (controlla il nome in alto a sinistra: deve essere quello nuovo, non quello della bottega!). Vai su **SQL Editor** → **New query**, incolla e premi **Run**. Deve comparire "Success". Se compare un errore, copiami il messaggio. Il file controlla da solo che il progetto sia vuoto: se ti dice 'Questo progetto non è vuoto', **non è un errore tuo**, vuol dire che sei nel progetto sbagliato (o in uno già usato): fermati e controlla il nome in alto. Supabase ti mostrerà un avviso giallo su operazioni che cancellano dati: è normale (lo schema ricrea le tabelle). Premi conferma **solo se il nome in alto è il progetto demo**.
4. Vai su **Project Settings → Data API** (oppure il bottone **Connect**) per l'indirizzo, e su **Settings → API Keys** per le chiavi. Ti servono tre valori:
   - l'indirizzo del progetto (Project URL);
   - la chiave pubblica (`anon` o `publishable`);
   - la chiave segreta (`service_role` o `secret`).

   Se vedi due schede di chiavi ('nuove' e 'legacy'), va bene una qualunque coppia purché sia dello **stesso progetto demo**.

## B. Il file con le chiavi

1. Nel terminale scrivi `copy .env.demo.example .env.demo.local`, poi `notepad .env.demo.local`.
2. Sostituisci i valori con i tre del punto A.4. Scegli un **PIN di 6 cifre** (esattamente 6) e un'email a piacere per l'utente demo (va bene quella già scritta). **Attenzione: copia questi valori solo dal progetto demo, controlla il nome del progetto in alto a sinistra. Quelli della bottega vera non vanno mai in questo file né in Vercel.**
3. Salva con Ctrl+S e chiudi. Controlla che il nome del file non finisca con `.txt`. Questo file **non** viene mai caricato su GitHub: resta solo sul tuo computer.

## C. I dati finti

Esegui questo passo subito dopo aver incollato lo schema (e aver compilato il file del punto B). **Non creare utenti a mano** nel progetto demo (né con 'Add user' né con un link via email), altrimenti la protezione si rifiuta di partire.

1. Nel terminale scrivi `npm run demo:reset`.
2. Deve rispondere `Demo rinfrescata: 19 ordini ...`. La prima volta crea anche l'utente demo.
3. Se rispondesse con un errore che dice "non tocco niente", **è la protezione che funziona**: leggi il messaggio e dimmelo, non aggiustare niente da sola.

## D. Il sito (Vercel)

1. Su vercel.com: **Add New… → Project** (o **New Project**), scegli il repository `oltre_la_bottega` e premi **Import**.
2. Chiama il progetto `oltre-la-bottega-demo`.
3. Apri **Environment Variables** e aggiungi **solo queste tre**:
   - `NEXT_PUBLIC_SUPABASE_URL` = l'indirizzo **completo** del progetto demo, che inizia con `https://` e finisce con `.supabase.co`;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la chiave **pubblica** della demo;
   - `NEXT_PUBLIC_PLAN` = `base`.

   Copia i valori solo dal progetto demo: quelli della bottega vera non vanno mai in Vercel. Non aggiungere nient'altro (in particolare niente chiave segreta e niente impostazioni della posta): così la demo non può inviare email. Inserisci le variabili **prima** di premere Deploy: i valori `NEXT_PUBLIC_` vengono fissati durante la pubblicazione; se le cambi dopo, devi fare **Redeploy**.
4. Premi **Deploy**. Se la Pull Request del livello base non è ancora unita in `main`, questo primo sito sarà la versione completa: va bene, si corregge subito.
5. Solo se la Pull Request non è ancora unita: nel progetto Vercel vai su **Settings → Environments → Production → Branch Tracking**, scrivi `feature/livello-base` e premi **Save**. Poi vai su **Deployments**, apri i tre puntini sull'ultimo deploy e scegli **Redeploy**. Quando la Pull Request sarà unita in `main`, rimetti `main`.
6. Alla fine copia l'indirizzo che finisce con `.vercel.app`.

## E. Ultimo ritocco in Supabase

Nel progetto demo vai su **Authentication → URL Configuration** e scrivi l'indirizzo della demo in **Site URL**; aggiungi lo stesso indirizzo seguito da `/**` in **Redirect URLs** (premi **Add URL** poi **Save**). Serve solo per il login con il link via email; il login con il PIN funziona anche senza.

## F. Prova

Apri l'indirizzo della demo, scegli la scheda **PIN**, scrivi l'email demo e il PIN. Devi entrare nella pagina **Oggi** e vedere consegne, ordini pronti da avvisare e promemoria.

Controlla due cose:

- Nel menu a sinistra NON devono comparire *Ordini*, *Da incassare*, *Riepilogo* (versione base). Se compaiono, il passo D.5 non è stato fatto.
- Nella pagina Oggi devi vedere clienti come *Giulia Ferri*, *Anna Bellini* e *Marco Neri* (*Luca Conti* lo trovi nella pagina **Clienti**). Se vedi i tuoi clienti veri, **fermati**: hai usato le chiavi sbagliate.

## Da ricordare

- **Prima di ogni registrazione o dimostrazione**, scrivi `npm run demo:reset`: rimette i dati con le date di oggi.
- Se Supabase mette in pausa la demo (dopo una settimana senza uso), nel pannello premi **Restore project** e aspetta un paio di minuti.
- Se la demo era in pausa: dopo **Restore project** aspetta che il pannello la mostri attiva, poi lancia `npm run demo:reset` (con il progetto in pausa lo script fallisce).
- Non lanciare `npm run demo:reset` tra mezzanotte e le 2 di notte: le date verrebbero calcolate sul giorno prima.
- Se PowerShell dice che "l'esecuzione di script è disabilitata", apri il terminale scrivendo `cmd` (al posto di `powershell`) nella barra dell'indirizzo di Esplora file.
- Il numero del telefono e le email dei clienti della demo sono inventati: non si può contattare nessuno per sbaglio.
- Facoltativo, più avanti: un indirizzo tutto tuo come `demo.oltrelabottega.it` (record DNS dal registrar, come già fatto per `app.`).
````

- [ ] **Step 2: Creare `docs/demo/video-scaletta.md`**

````markdown
# Video dimostrativo — scaletta e testo

Un video di circa **3 minuti** che racconta una giornata in bottega. Lo registri tu, con la tua voce, sulla demo con i dati finti. Il testo qui sotto è un punto di partenza: cambialo con parole tue.

## Prima di registrare

1. Nel terminale: `npm run demo:reset` (rimette i dati con le date di oggi).
2. Apri il browser in una **finestra in incognito** (Ctrl+Maiusc+N) oppure con un profilo vuoto: niente segnalibri, estensioni, email salvate o suggerimenti di password. Apri la demo e accedi con email e PIN **prima** di premere Registra.
3. Nel browser: zoom al 110-125% (il testo si legge meglio anche da telefono), chiudi le altre schede.
4. Spegni le notifiche di Windows (modalità "Non disturbare") e chiudi WhatsApp Web e la posta.
5. Programma di registrazione (gratuito):
   - **OBS** (microfono attivo): scegli "Cattura finestra" oppure metti il browser a schermo intero (F11), così non si vedono la barra di Windows e le icone vicino all'orologio.
   - **Win+G** (Xbox Game Bar) di Windows registra **una sola finestra di un programma**: funziona con una finestra di Chrome o Edge, non con il desktop né con Esplora file. Si avvia e si ferma con **Win+Alt+R**; il file finisce nella cartella `Video\Acquisizioni`. Controlla che il microfono sia acceso.
   - Fai una prova di 10 secondi e riascolta la voce.
6. Nel riquadro **Avvisa il cliente** **non cliccare su WhatsApp né su Email**: aprirebbero i tuoi programmi veri, con le tue chat, e segnerebbero l'ordine come già avvisato. Fai vedere il riquadro e premi **QR**: compare il codice da inquadrare con il telefono. **Non premere "Fatto"** e non inquadrare niente. Dopo la ripresa rilancia `npm run demo:reset`.
7. Registra a pezzi, una scena alla volta: se sbagli, rifai solo quella. Ogni volta che rifai una scena in cui crei un ordine, rilancia `npm run demo:reset`.
8. Suggerimento: puoi registrare la voce per ultima, sopra le riprese, così parli con calma.

## Scaletta

| Tempo | Cosa si vede | Cosa dici (esempio) |
|---|---|---|
| 0:00 | Pagina **Oggi** già aperta | "Ciao, sono Olga. Ho una bottega e mi sono costruita un'app per non tenere più tutto a mente. Si chiama Oltre la Bottega. Ti faccio vedere una giornata." |
| 0:20 | Ferma sui numeri e sulle liste di Oggi | "Ogni mattina apro questa pagina e so cosa devo fare: i lavori da consegnare oggi, quelli già pronti e i clienti da avvisare, quello che è in ritardo." |
| 0:45 | **Nuovo ordine** (bottone in alto su Oggi): scrivi *Luca*, scegli *Luca Conti* dai suggerimenti (nome, cognome e telefono si compilano); scrivi l'articolo ("Targa per condominio"), il prezzo unitario e la data di consegna → **Crea ordine** | "Se il cliente è già stato da me, i dati si compilano da soli. Registro un lavoro in meno di un minuto, anche con il cliente davanti." |
| 1:20 | **Bacheca**: sulla scheda di un lavoro *In lavorazione* apri il menu dello stato e scegli **Pronto** | "La Bacheca è la mia lavagna: ogni colonna è una fase del lavoro. Quando finisco, lo sposto in Pronto." |
| 1:40 | Apri un ordine *Pronto* (Anna Bellini) → riquadro **Avvisa il cliente** → premi **QR** (non WhatsApp, non Email, non Fatto) | "Quando un lavoro è pronto, il messaggio al cliente è già scritto: lo mando da WhatsApp o per email, oppure inquadro il codice col telefono." |
| 2:05 | Bottone **Foglio lavoro** → anteprima di stampa. Il foglio si apre in una nuova scheda e si apre da solo la finestra di stampa: mostrala un paio di secondi, poi premi **Esc** (non stampare) e **Ctrl+W** per chiudere la scheda. Se nell'elenco delle stampanti compare quella della bottega, scegli "Salva come PDF" prima di registrare. | "Con una stampante normale stampo un foglio da mettere insieme al lavoro, con il codice per riaprire la scheda dal telefono." |
| 2:30 | **Clienti** → *Luca Conti* | "Quando un cliente torna, vedo subito tutto quello che ha già ordinato." |
| 2:45 | Torna su **Oggi** | "È semplice, perché l'ho fatta per chi lavora in bottega. Se non rinnovi, l'app continua a funzionare. Se vuoi vederla dal vivo, scrivimi." *(mostra il contatto: WhatsApp o email da confermare)* |

## Dopo la registrazione

1. **Ritaglia** l'inizio e la fine (OBS e Windows lo permettono, oppure usa l'editor gratuito di YouTube).
2. Carica su **YouTube**: *Crea → Carica video*, visibilità **Non in elenco** (solo chi ha il link lo vede).
3. Attiva i **sottotitoli automatici in italiano** (YouTube Studio → Sottotitoli) e correggi le parole sbagliate: molte persone guardano senza audio.
4. Copia il link e mandalo su WhatsApp a una bottega, con una frase tua ("Ti mando un video di 3 minuti, dimmi cosa ne pensi").
5. Più avanti: pulsante **"Guarda come funziona"** nel sito vetrina, con il video incorporato.

## Da non dimenticare

- Nel video non deve comparire la tua bottega vera: usa solo la demo.
- Se cambia l'app in modo visibile (menu, colori), va rifatta la scena interessata.
- Il numero o l'email per contattarti vanno scelti e confermati prima di pubblicare.
````

- [ ] **Step 3: Controllare e fare il commit**

Rileggere i due file: nessun segnaposto rimasto, i comandi (`npm run demo:schema`, `npm run demo:reset`) coincidono con `package.json`, il numero di ordini nella guida ("19 ordini") coincide con quello prodotto da `buildDemoData` (19 specifiche). Poi:

```bash
git add docs/demo
git commit -m "docs: guida di configurazione della demo e scaletta del video" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Prova reale sulla demo (richiede la configurazione dell'utente)

**Prerequisiti:** l'utente ha eseguito i punti A e B di `docs/demo/configurazione-demo.md` (schema incollato nel SQL Editor del progetto demo e file `.env.demo.local` compilato nella cartella del progetto **principale**: copiarlo nel worktree di lavoro, senza committarlo). Se mancano, fermarsi e chiedere all'utente di completarli; non tentare di aggirarli.

**Files (temporanei, da cancellare a fine task):**
- Create: `scripts/tmp-verifica.ts`, `playwright.demo.config.ts`, `e2e/tmp-demo-check.spec.ts`

- [ ] **Step 1: Verificare le protezioni prima di scrivere qualunque cosa**

Creare lo script temporaneo `scripts/tmp-verifica.ts` (non committarlo, si cancella nello Step 5). Non stampa mai chiavi: solo i nomi degli host e dei conteggi.

```ts
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { parseEnvFile } from "../src/lib/demo/envFile"
import { hostOf } from "../src/lib/demo/safety"

async function main() {
  const demo = parseEnvFile(readFileSync(".env.demo.local", "utf-8"))
  const vero = parseEnvFile(readFileSync(".env.local", "utf-8"))
  const hostDemo = hostOf(demo.DEMO_SUPABASE_URL)
  const hostVero = hostOf(vero.NEXT_PUBLIC_SUPABASE_URL)
  console.log("host demo :", hostDemo)
  console.log("host vero :", hostVero)
  if (!hostDemo || hostDemo === hostVero) {
    console.log("ATTENZIONE: uguali o mancanti, FERMARSI")
    process.exit(1)
  }
  console.log("diversi: ok")

  if (process.argv.includes("--conteggi")) {
    const url = demo.DEMO_SUPABASE_URL
    const c = createClient(url.startsWith("http") ? url : `https://${url}`, demo.DEMO_SERVICE_ROLE_KEY)
    const conta = async (tabella: string) =>
      (await c.from(tabella).select("id", { count: "exact", head: true })).count
    console.log("ordini", await conta("orders"), "righe", await conta("order_items"), "promemoria", await conta("reminders"))
  }
}

main()
```

Lanciarlo:

```bash
npx tsx scripts/tmp-verifica.ts
```

Expected: due host diversi e `diversi: ok`. Se stampa `ATTENZIONE`, **fermarsi e avvisare l'utente**.

- [ ] **Step 2: Lanciare il rinfresco e verificare i conteggi**

```bash
npm run demo:reset
```

Se `npm run demo:reset` fallisce con `permission denied for table ...`, i permessi (`grant`) in fondo allo schema non sono stati applicati: riferirlo all'utente invece di improvvisare.

Expected: `Demo rinfrescata: 19 ordini (di cui 4 di enti/aziende), 4 promemoria.` Rilanciarlo una seconda volta: stesso messaggio, nessun errore (ripetibilità, nessun dato duplicato). Poi:

```bash
npx tsx scripts/tmp-verifica.ts --conteggi
```

Expected: `ordini 19 righe 19 promemoria 4`.

- [ ] **Step 3: Configurazione temporanea di Playwright puntata sulla demo**

Creare `playwright.demo.config.ts` (legge le chiavi solo dal file e le passa al server web; il server usa **il database demo**, mai quello vero):

```ts
import { defineConfig, devices } from "@playwright/test"
import { readFileSync } from "fs"

const testo = readFileSync(".env.demo.local", "utf-8")
const valore = (k: string) => testo.match(new RegExp(`^${k}=(.*?)\\r?$`, "m"))?.[1].trim() ?? ""
const url = valore("DEMO_SUPABASE_URL")

process.env.DEMO_EMAIL = valore("DEMO_USER_EMAIL")
process.env.DEMO_PIN = valore("DEMO_PIN")

export default defineConfig({
  testDir: "./e2e",
  testMatch: "tmp-demo-check.spec.ts",
  reporter: "list",
  use: { baseURL: "http://localhost:3200" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npx next dev -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: url.startsWith("http") ? url : `https://${url}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: valore("DEMO_ANON_KEY"),
      NEXT_PUBLIC_PLAN: "base",
    },
  },
})
```

Creare `e2e/tmp-demo-check.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

const CARTELLA = process.env.DEMO_SHOTS ?? "."

test("la demo si apre, mostra una giornata viva nel livello base", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "PIN", exact: true }).click()
  const campoEmail = page.locator("#pin-email")
  if (await campoEmail.isVisible().catch(() => false)) await campoEmail.fill(process.env.DEMO_EMAIL!)
  await page.locator("#pin").fill(process.env.DEMO_PIN!)
  await page.getByRole("button", { name: "Accedi", exact: true }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })

  // Oggi: le sezioni della giornata viva
  await expect(page.getByText("Da consegnare oggi")).toBeVisible()
  await expect(page.getByText("Da avvisare")).toBeVisible()
  await expect(page.getByText("Consegnati oggi")).toBeVisible()
  await expect(page.getByText("Promemoria di oggi")).toBeVisible()
  await expect(page.getByText("Materiale da ordinare")).toHaveCount(0)
  await page.screenshot({ path: `${CARTELLA}/demo-oggi.png`, fullPage: true })

  // Menu del livello base
  await expect(page.locator("aside a")).toHaveText(["Oggi", "Bacheca", "Agenda", "Recensioni", "Clienti", "Impostazioni"])

  // Bacheca: 4 colonne, nessuna Bozza grafica
  await page.goto("/kanban")
  for (const titolo of ["Preventivo", "Da fare", "In lavorazione", "Pronto"]) {
    await expect(page.getByText(titolo, { exact: true }).first()).toBeVisible()
  }
  await expect(page.getByText("Bozza grafica", { exact: true })).toHaveCount(0)
  await page.screenshot({ path: `${CARTELLA}/demo-bacheca.png`, fullPage: true })

  // Recensioni: il cliente consegnato oggi
  await page.goto("/recensioni")
  await expect(page.getByText("Marco Neri")).toBeVisible()

  // Clienti: Luca Conti (3 ordini) e un cliente ente con referente
  await page.goto("/customers")
  await expect(page.getByText("Luca Conti")).toBeVisible()
  await expect(page.getByText("Officina Bianchi")).toBeVisible()
  await page.screenshot({ path: `${CARTELLA}/demo-clienti.png`, fullPage: true })
})
```

Se un selettore non corrisponde al testo reale dell'app (per esempio il nome del pulsante di accesso), leggere `src/app/(auth)/login/page.tsx` e adattare **solo il selettore**, non indebolire i controlli.

- [ ] **Step 4: Eseguire la prova**

Verificare prima che le porte 3200 (e nessun altro `next dev` nella cartella) siano libere. Poi:

```bash
DEMO_SHOTS="<cartella temporanea dello scratchpad>" npx playwright test --config playwright.demo.config.ts
```

Expected: 1 test passato. Guardare gli screenshot generati (`demo-oggi.png`, `demo-bacheca.png`, `demo-clienti.png`) e descrivere in una riga cosa mostrano (sezioni visibili, colonne, nomi).

- [ ] **Step 5: Ripulire**

```bash
rm playwright.demo.config.ts e2e/tmp-demo-check.spec.ts scripts/tmp-verifica.ts
git status --short
```

Expected: `git status` vuoto (nessun file temporaneo, `.env.demo.local` e `demo-schema.sql` ignorati). Nessun server `next dev` rimasto in esecuzione.

Questo task non produce un commit.

---

### Task 7: Verifica finale e documentazione

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verifiche complete**

```bash
npx jest --roots=src
npx tsc --noEmit
npx eslint src/lib/demo scripts
```

Expected: tutte le suite verdi (19 esistenti + 3 nuove), `tsc` pulito, nessun errore lint nei file nuovi.

- [ ] **Step 2: Aggiornare `CLAUDE.md`**

Nella tabella "Decisioni chiave e motivazioni", in fondo, aggiungere una riga:

```
| Demo privata con dati finti e video dimostrativo (2026-09-26) | Le vendite sono assistite e locali (setup a mano, installazione singola per bottega): serve una dimostrazione credibile, non un servizio pubblico da difendere. Scelte: demo **privata** (la usa la titolare, dal vivo o per registrare), **video** di circa 2 minuti con la sua voce, livello **base**. Una copia separata dell'app (progetto Supabase gratuito + progetto Vercel con `NEXT_PUBLIC_PLAN=base`, senza chiave segreta né impostazioni della posta, quindi il backup non può partire), mai collegata ai dati veri. `npm run demo:reset` (`scripts/demo-reset.ts`, con `tsx`) svuota e riempie la demo con ~19 ordini e 15 clienti inventati (telefoni `333 0000xxx`, email `example.com`) con date relative a oggi, così la pagina Oggi è sempre viva; **si rifiuta di partire** (`assertSafeTarget`, `src/lib/demo/safety.ts`) se `DEMO_SUPABASE_URL` coincide con il progetto vero o se il database contiene ordini ma non l'utente marcato `demo: true`. Chiavi in `.env.demo.local` (ignorato da git, modello `.env.demo.example`). Il PIN della demo è di **6 cifre** (il campo PIN del login ha `maxLength={6}`). Lo schema si crea una volta incollando `demo-schema.sql` (da `npm run demo:schema`: le migration dalla v2 in poi) nel SQL Editor. Guida in `docs/demo/configurazione-demo.md`, scaletta del video in `docs/demo/video-scaletta.md`. Demo pubblica interattiva e pulsante nel sito vetrina restano fuori scope. Design in `docs/superpowers/specs/2026-09-26-demo-video-design.md`, piano in `docs/superpowers/plans/2026-09-26-demo-video-plan.md` |
```

Nella sezione "Testing", aggiungere un punto:

```
- **Feature (2026-09-26)**: demo privata con dati finti — vedere riga corrispondente in Decisioni chiave. Funzioni pure testate in `src/lib/demo/__tests__/` (`envFile`, `safety`, `demoData`: conteggi della giornata viva, coerenza prezzo/saldo/righe, telefoni inventati, cliente che torna, protezioni contro il database vero). Prova reale sulla demo con uno script Playwright temporaneo (accesso con PIN, Oggi, menu del base, Bacheca a 4 colonne, Recensioni, Clienti), poi cancellato.
```

Aggiornare il conteggio nella riga "Stato al ..." solo se cambiato (suite e test in più).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: demo con dati finti e video nel CLAUDE.md" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Chiusura**

Il lavoro è pronto per una Pull Request (ramo `feature/demo-video`, costruito sopra `feature/livello-base`: se la Pull Request #1 non è ancora unita, aprire questa con base `feature/livello-base`, oppure attendere l'unione e ribasarla su `main`). Usare `superpowers:finishing-a-development-branch`.

---

## Autoverifica del piano rispetto al documento di progetto

- **Copia demo (Supabase, Vercel, base, un utente con PIN, nessuna variabile di posta)** → Task 4 (script, utente `demo: true` con PIN da 6 cifre) e Task 5 (guida). Passi manuali (schema nel SQL Editor, progetto Vercel, Auth URL) nella guida, non codice, come da spec.
- **Dati finti, giornata viva, funzione pura testata** → Task 3 (conteggi: 2 consegne oggi, 1 consegnato oggi, 3 da avvisare, 2 in ritardo, 3 preventivi, cliente che torna, recensione da chiedere, promemoria).
- **Comando di rinfresco ripetibile** → Task 4 (`demo:reset`), verificato due volte di seguito nel Task 6.
- **Protezioni** → Task 2 (`assertSafeTarget` testata nei tre casi) e Task 4 (chiamata prima di qualunque scrittura).
- **Schema in un file da incollare** → Task 4 (`demo-schema.mjs`, esclude `20260625000001_initial_schema.sql`).
- **Video: scaletta, testo, registrazione, YouTube non in elenco** → Task 5.
- **Prova reale su accesso con PIN, Oggi, base** → Task 6.
- **Fuori scope** (demo pubblica, pulsante nel sito, montaggio, automazione) → nessun task, come da spec.
- Nota: il documento di progetto dice "3 promemoria in Agenda"; il piano ne crea 3 attivi più 1 completato oggi (mostra anche il comportamento dei completati). Coerente con "almeno 3".
