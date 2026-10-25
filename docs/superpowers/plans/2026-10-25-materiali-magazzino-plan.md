# Materiali: magazzino, scorta minima e «Ho già ordinato» — Piano di implementazione

> **Per chi esegue (agenti):** SOTTO-SKILL OBBLIGATORIA: usare `superpowers:subagent-driven-development` (consigliata) oppure `superpowers:executing-plans`. I passi usano caselle (`- [ ]`).

**Obiettivo:** per i materiali scelti dalla titolare (opzione «Tieni in magazzino») tenere la giacenza caricata dalle fatture con correzione a mano, proteggere dai caricamenti doppi, segnalare «Da riordinare» sotto una scorta minima (anche nella pagina «Oggi») e permettere «Ho già ordinato» con pausa di 7 giorni.

**Architettura:** funzioni pure testate (`computeStock`, `rettificaPerGiacenza`, `reorderStatus`, `documentFingerprint`); la giacenza non è un contatore ma `carico_totale + rettifica − venduto` (`venduto` vale 0 finché il Lavoro 2 non collega gli ordini); caricamenti doppi riconosciuti da un'impronta SHA-256 registrata in `documenti_caricati`; UI che estende tabella di controllo, elenco, modulo di modifica e pagina «Oggi».

**Stack:** Next.js 16 (server actions), Supabase, Jest/ts-jest, Playwright (solo verifica temporanea).

**Design di riferimento:** `docs/superpowers/specs/2026-10-25-materiali-magazzino-design.md`.

**Come eseguire:** worktree da `main` (dopo il commit di spec e piano). Test sempre con il percorso PRIMA di `--roots`: `npx jest <file> --roots=src`. Commit con la riga finale `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nessun push senza richiesta.

**Scelte fissate nel piano (specializzano o correggono il design):**
- Nessuna `getStockOverview()` sul server: elenco e pagina «Oggi» usano direttamente le funzioni pure (`computeStock`, `reorderStatus`). Il Lavoro 2 passerà `venduto` agli stessi punti. (YAGNI.)
- Impronta calcolata in `src/lib/documentFingerprint.ts` (usa `node:crypto`) e **non** in `documentoFornitore.ts`, perché questo file è importato anche da un componente client.
- I nuovi campi di `saveMaterials` (`magazzino`, `carica`, `impronta`, `caricaComunque`) sono facoltativi e `quantitaSaltate` compare solo quando vale `true`: i test esistenti restano validi.
- `setStock` imposta solo la rettifica; la casella «Tieni in magazzino» si salva con `updateMaterial`.
- Un materiale già in magazzino che torna nella tabella di controllo parte con la casella accesa (valore preso dal materiale abbinato al momento della lettura).

---

## Mappa dei file

| File | Azione | Responsabilità |
|---|---|---|
| `supabase/migrations/20261025000001_add_magazzino.sql` | nuovo | colonne `in_magazzino`, `carico_totale`, `rettifica`, `soglia`, `ordinato_il`; tabella `documenti_caricati` |
| `src/lib/materiali.ts` | modifica | `computeStock`, `rettificaPerGiacenza`, `reorderStatus`, `daysBetween`, `formatQuantita`, tipo `DatiMagazzino` |
| `src/lib/__tests__/materiali.test.ts` | modifica | test delle funzioni nuove |
| `src/lib/documentFingerprint.ts` | nuovo | `documentFingerprint` (SHA-256) |
| `src/lib/__tests__/documentFingerprint.test.ts` | nuovo | test dell'impronta |
| `src/actions/materiali.ts` | riscritto | `Materiale` con campi nuovi, `saveMaterials` con magazzino/impronta, `updateMaterial` esteso, `setStock`, `markOrdered` |
| `src/actions/__tests__/materiali.test.ts` | modifica | fixture e test nuovi |
| `src/actions/materialiDocumento.ts` | modifica | `extractDocument` restituisce `impronta` e `giaCaricato` |
| `src/actions/__tests__/materialiDocumento.test.ts` | modifica | test aggiornati |
| `src/components/OrdinatoButton.tsx` | nuovo | pulsante «Ho già ordinato» |
| `src/components/StockInfo.tsx` | nuovo | riga «In magazzino» + avviso + pulsante |
| `src/components/MaterialiImport.tsx` | modifica | colonne Magazzino/Carica, avviso «già caricato» |
| `src/components/MaterialeRowActions.tsx` | modifica | casella magazzino, giacenza attuale, scorta minima |
| `src/app/(dashboard)/materiali/page.tsx` | modifica | mostra `StockInfo`, passa `giacenza` |
| `src/app/api/dashboard/today/route.ts` | modifica | lista `riordino` |
| `src/app/api/dashboard/today/__tests__/route.test.ts` | modifica | test di `riordino` |
| `src/components/TodayBoard.tsx` | modifica | sezione «Da riordinare» |
| `CLAUDE.md` | modifica | decisione, migration, testing |

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261025000001_add_magazzino.sql`

- [ ] **Step 1: Scrivere la migration**

```sql
-- Magazzino dei materiali: giacenza = carico_totale + rettifica − venduto (il venduto lo porterà il
-- collegamento con gli ordini). Solo per i materiali con in_magazzino = true.
-- soglia = scorta minima (avviso «Da riordinare» quando la giacenza è uguale o inferiore).
-- ordinato_il = data di «Ho già ordinato» (pausa dell'avviso per 7 giorni).

alter table public.materiali
  add column in_magazzino boolean not null default false,
  add column carico_totale numeric(12,3) not null default 0,
  add column rettifica numeric(12,3) not null default 0,
  add column soglia numeric(12,3) check (soglia >= 0),
  add column ordinato_il date;

-- Impronte dei documenti già caricati: servono solo ad evitare di sommare due volte le quantità.
-- Non contengono nulla di leggibile e non sono mostrate da nessuna parte.
create table public.documenti_caricati (
  id uuid primary key default gen_random_uuid(),
  impronta text not null unique,
  created_at timestamptz not null default now()
);

alter table public.documenti_caricati enable row level security;
create policy "auth_all" on public.documenti_caricati for all using (auth.uid() is not null);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261025000001_add_magazzino.sql
git commit -m "feat(magazzino): migration di giacenza, scorta minima e impronte dei documenti

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Nota:** non ancora applicata. Si applica a mano (Task 10, passo 1), **prima** di qualsiasi deploy.

---

### Task 2: Funzioni pure del magazzino

**Files:**
- Modify: `src/lib/materiali.ts`
- Test: `src/lib/__tests__/materiali.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/lib/__tests__/materiali.test.ts`, nell'import da `"../materiali"` aggiungere i nomi nuovi (dopo `formatDiscounts,`):

```ts
  formatDiscounts,
  computeStock,
  rettificaPerGiacenza,
  reorderStatus,
  daysBetween,
  formatQuantita,
  GIORNI_ATTESA_ORDINE,
```

e in fondo al file aggiungere:

```ts
describe("computeStock", () => {
  it("somma carico e rettifica", () => {
    expect(computeStock({ carico_totale: 50, rettifica: 0 })).toBe(50)
    expect(computeStock({ carico_totale: 50, rettifica: -3 })).toBe(47)
  })

  it("toglie il venduto quando c'è", () => {
    expect(computeStock({ carico_totale: 50, rettifica: -3 }, 4)).toBe(43)
  })

  it("non accumula errori di virgola mobile", () => {
    expect(computeStock({ carico_totale: 0.1, rettifica: 0.2 })).toBe(0.3)
  })
})

describe("rettificaPerGiacenza", () => {
  it("calcola la rettifica che porta la giacenza al valore contato", () => {
    expect(rettificaPerGiacenza(47, { carico_totale: 50 })).toBe(-3)
    expect(rettificaPerGiacenza(60, { carico_totale: 50 })).toBe(10)
  })

  it("tiene conto del venduto, così la giacenza risultante è quella contata", () => {
    const rettifica = rettificaPerGiacenza(47, { carico_totale: 50 }, 4)
    expect(rettifica).toBe(1)
    expect(computeStock({ carico_totale: 50, rettifica }, 4)).toBe(47)
  })
})

describe("daysBetween", () => {
  it("conta i giorni di calendario", () => {
    expect(daysBetween("2026-10-25", "2026-10-25")).toBe(0)
    expect(daysBetween("2026-10-25", "2026-11-01")).toBe(7)
  })

  it("non è sfalsato dal cambio dell'ora legale", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2)
  })
})

describe("formatQuantita", () => {
  it("toglie gli zeri inutili e usa la virgola", () => {
    expect(formatQuantita(50)).toBe("50")
    expect(formatQuantita(12.5)).toBe("12,5")
    expect(formatQuantita(0.25)).toBe("0,25")
    expect(formatQuantita(0)).toBe("0")
  })
})

describe("reorderStatus", () => {
  const m = { in_magazzino: true, soglia: 10, ordinato_il: null as string | null }
  const oggi = "2026-10-25"

  it("ok se non è in magazzino o non ha scorta minima", () => {
    expect(reorderStatus({ ...m, in_magazzino: false }, 0, oggi)).toBe("ok")
    expect(reorderStatus({ ...m, soglia: null }, 0, oggi)).toBe("ok")
  })

  it("ok sopra la scorta minima", () => {
    expect(reorderStatus(m, 11, oggi)).toBe("ok")
  })

  it("da riordinare quando è uguale o sotto la scorta minima", () => {
    expect(reorderStatus(m, 10, oggi)).toBe("da_riordinare")
    expect(reorderStatus(m, 5, oggi)).toBe("da_riordinare")
    expect(reorderStatus(m, 0, oggi)).toBe("da_riordinare")
  })

  it("dopo «Ho già ordinato» l'avviso è sospeso per 7 giorni", () => {
    const ordinato = { ...m, ordinato_il: "2026-10-25" }
    expect(reorderStatus(ordinato, 5, "2026-10-25")).toBe("ordinato")
    expect(reorderStatus(ordinato, 5, "2026-10-31")).toBe("ordinato")
  })

  it("dopo 7 giorni senza carico l'avviso riparte", () => {
    const ordinato = { ...m, ordinato_il: "2026-10-25" }
    expect(reorderStatus(ordinato, 5, "2026-11-01")).toBe("ordinato_scaduto")
    expect(reorderStatus(ordinato, 5, "2026-11-10")).toBe("ordinato_scaduto")
  })

  it("se la giacenza è tornata sopra la scorta minima non c'è nessun avviso, anche con una data di ordine", () => {
    expect(reorderStatus({ ...m, ordinato_il: "2026-10-25" }, 20, oggi)).toBe("ok")
  })

  it("la pausa dura 7 giorni", () => {
    expect(GIORNI_ATTESA_ORDINE).toBe(7)
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest src/lib/__tests__/materiali.test.ts --roots=src`
Expected: FAIL (le funzioni importate non esistono ancora).

- [ ] **Step 3: Implementare**

In `src/lib/materiali.ts`, subito dopo il tipo `StatoRiga` aggiungere:

```ts
/** Campi del magazzino di un materiale (vedi migration 20261025000001). */
export type DatiMagazzino = {
  in_magazzino: boolean
  carico_totale: number
  rettifica: number
  soglia: number | null // scorta minima
  ordinato_il: string | null // AAAA-MM-GG, data di «Ho già ordinato»
}

export type StatoScorta = "ok" | "da_riordinare" | "ordinato" | "ordinato_scaduto"

/** Giorni in cui «Ho già ordinato» sospende l'avviso «Da riordinare». */
export const GIORNI_ATTESA_ORDINE = 7
```

e in fondo al file aggiungere:

```ts
/**
 * Giacenza: non è un contatore ma si calcola ogni volta (carico + rettifica − venduto).
 * `venduto` vale 0 finché gli ordini non sono collegati ai materiali.
 */
export function computeStock(m: Pick<DatiMagazzino, "carico_totale" | "rettifica">, venduto = 0): number {
  return round3(m.carico_totale + m.rettifica - venduto)
}

/** La rettifica che, con questo carico e questo venduto, porta la giacenza al valore realmente contato. */
export function rettificaPerGiacenza(reale: number, m: Pick<DatiMagazzino, "carico_totale">, venduto = 0): number {
  return round3(reale - m.carico_totale + venduto)
}

/** Giorni di calendario tra due date AAAA-MM-GG. */
export function daysBetween(da: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000)
}

/** 50 · 12,5 · 0,25 (virgola, senza zeri inutili). */
export function formatQuantita(value: number): string {
  return String(round3(value)).replace(".", ",")
}

/**
 * Stato dell'avviso di riordino. `oggi` è AAAA-MM-GG (calendario di Roma, vedi `todayIso`).
 * - ok: non in magazzino, senza scorta minima, o giacenza sopra la scorta minima;
 * - da_riordinare: giacenza uguale o sotto la scorta minima;
 * - ordinato: come sopra ma «Ho già ordinato» è di meno di 7 giorni fa (avviso sospeso);
 * - ordinato_scaduto: «Ho già ordinato» da 7 giorni o più e la merce non è arrivata (l'avviso riparte).
 */
export function reorderStatus(
  m: Pick<DatiMagazzino, "in_magazzino" | "soglia" | "ordinato_il">,
  giacenza: number,
  oggi: string
): StatoScorta {
  if (!m.in_magazzino || m.soglia === null || giacenza > m.soglia) return "ok"
  if (m.ordinato_il === null) return "da_riordinare"
  return daysBetween(m.ordinato_il, oggi) < GIORNI_ATTESA_ORDINE ? "ordinato" : "ordinato_scaduto"
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest src/lib/__tests__/materiali.test.ts --roots=src`
Expected: PASS. Poi `npx tsc --noEmit` pulito.

- [ ] **Step 5: Commit**

```bash
git add src/lib/materiali.ts src/lib/__tests__/materiali.test.ts
git commit -m "feat(magazzino): giacenza, scorta minima e stato di riordino (funzioni pure)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Impronta dei documenti

**Files:**
- Create: `src/lib/documentFingerprint.ts`
- Test: `src/lib/__tests__/documentFingerprint.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/__tests__/documentFingerprint.test.ts`:

```ts
import { documentFingerprint } from "../documentFingerprint"
import type { DocumentoLetto } from "../documentoFornitore"

const doc: DocumentoLetto = {
  fornitore: "Trodat GmbH",
  data: "2026-06-17",
  righe: [
    { codice: "111383", nome: "8913 IMPRINT 2.0, NERO", unita: "PZ", quantita: 50, prezzo: 4.65, sconti: [], importo: 232.5 },
    { codice: "111640", nome: "8913 IMPRINT 2.0, BLU", unita: "PZ", quantita: 50, prezzo: 4.65, sconti: [], importo: 232.5 },
  ],
}

describe("documentFingerprint", () => {
  it("è un SHA-256 esadecimale", () => {
    expect(documentFingerprint(doc)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("lo stesso documento dà sempre la stessa impronta", () => {
    expect(documentFingerprint(doc)).toBe(documentFingerprint({ ...doc, righe: [...doc.righe] }))
  })

  it("non dipende dall'ordine delle righe", () => {
    expect(documentFingerprint(doc)).toBe(documentFingerprint({ ...doc, righe: [...doc.righe].reverse() }))
  })

  it("non dipende da maiuscole e spazi in fornitore, codice e nome", () => {
    const quasi: DocumentoLetto = {
      ...doc,
      fornitore: "  trodat   gmbh ",
      righe: doc.righe.map((r) => ({ ...r, nome: `  ${r.nome.toLowerCase()} `, codice: ` ${r.codice} ` })),
    }
    expect(documentFingerprint(quasi)).toBe(documentFingerprint(doc))
  })

  it("cambia se cambia una quantità, un prezzo, uno sconto o la data", () => {
    const base = documentFingerprint(doc)
    const conRiga = (patch: object) => ({ ...doc, righe: [{ ...doc.righe[0], ...patch }, doc.righe[1]] })
    expect(documentFingerprint(conRiga({ quantita: 51 }))).not.toBe(base)
    expect(documentFingerprint(conRiga({ prezzo: 4.7 }))).not.toBe(base)
    expect(documentFingerprint(conRiga({ sconti: [10] }))).not.toBe(base)
    expect(documentFingerprint({ ...doc, data: "2026-06-18" })).not.toBe(base)
  })

  it("gestisce quantità e importo mancanti e un documento senza righe", () => {
    expect(documentFingerprint({ fornitore: "X", data: null, righe: [] })).toMatch(/^[0-9a-f]{64}$/)
    const senza = { ...doc, righe: [{ ...doc.righe[0], quantita: null, importo: null }] }
    expect(documentFingerprint(senza)).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest src/lib/__tests__/documentFingerprint.test.ts --roots=src`
Expected: FAIL con `Cannot find module '../documentFingerprint'`.

- [ ] **Step 3: Implementare**

Creare `src/lib/documentFingerprint.ts`:

```ts
import { createHash } from "node:crypto"
import { normalizeText } from "@/lib/materiali"
import type { DocumentoLetto } from "@/lib/documentoFornitore"

// Solo lato server (usa node:crypto): per questo non sta in documentoFornitore.ts, che è importato anche da un componente client.

function num(v: number | null): string {
  return v === null ? "" : v.toFixed(3)
}

/**
 * Impronta del documento così come è stato LETTO (non come l'ha corretto l'utente), per riconoscere un
 * documento già caricato e non sommare due volte le quantità. Non dipende dall'ordine delle righe né da
 * maiuscole e spazi. Non contiene nulla di leggibile.
 */
export function documentFingerprint(doc: DocumentoLetto): string {
  const righe = doc.righe
    .map((r) =>
      [
        normalizeText(r.codice),
        normalizeText(r.nome),
        num(r.quantita),
        num(r.prezzo),
        r.sconti.map((s) => s.toFixed(3)).join("+"),
        num(r.importo),
      ].join("|")
    )
    .sort()
  const testo = [normalizeText(doc.fornitore), doc.data ?? "", ...righe].join("\n")
  return createHash("sha256").update(testo).digest("hex")
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest src/lib/__tests__/documentFingerprint.test.ts --roots=src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentFingerprint.ts src/lib/__tests__/documentFingerprint.test.ts
git commit -m "feat(magazzino): impronta dei documenti per evitare i caricamenti doppi

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Azioni del magazzino (riscrittura di `src/actions/materiali.ts`)

**Files:**
- Modify: `src/actions/materiali.ts` (sostituzione completa)
- Modify: `src/lib/materiali.ts` (tipo `Materiale`)
- Modify: `src/lib/__tests__/materiali.test.ts` (fixture `base`)
- Test: `src/actions/__tests__/materiali.test.ts`

- [ ] **Step 1: Estendere il tipo `Materiale` e la fixture**

In `src/lib/materiali.ts` sostituire la definizione:

```ts
export type Materiale = {
  id: string
  fornitore: string
  codice: string | null
  nome: string
  unita: string | null
  prezzo_attuale: number
  data_acquisto_attuale: string // AAAA-MM-GG
  prezzo_precedente: number | null
  data_acquisto_precedente: string | null
}
```

con:

```ts
export type Materiale = {
  id: string
  fornitore: string
  codice: string | null
  nome: string
  unita: string | null
  prezzo_attuale: number
  data_acquisto_attuale: string // AAAA-MM-GG
  prezzo_precedente: number | null
  data_acquisto_precedente: string | null
} & DatiMagazzino
```

(`DatiMagazzino` è definito più sotto nello stesso file: i tipi si possono usare prima della dichiarazione.)

In `src/lib/__tests__/materiali.test.ts`, nella costante `base: Materiale`, aggiungere dopo `data_acquisto_precedente: null,`:

```ts
  data_acquisto_precedente: null,
  in_magazzino: false,
  carico_totale: 0,
  rettifica: 0,
  soglia: null,
  ordinato_il: null,
```

- [ ] **Step 2: Scrivere i test che falliscono**

In `src/actions/__tests__/materiali.test.ts`:

1. Nell'import cambiare la riga in:

```ts
import { getMaterials, saveMaterials, updateMaterial, deleteMaterial, setStock, markOrdered } from "../materiali"
```

2. Nella funzione `riga` (righe grezze del database) aggiungere dopo `data_acquisto_precedente: null,`:

```ts
  data_acquisto_precedente: null,
  in_magazzino: false,
  carico_totale: "0.000",
  rettifica: "0.000",
  soglia: null,
  ordinato_il: null,
```

3. In fondo al file aggiungere:

```ts
describe("getMaterials — campi del magazzino", () => {
  afterEach(() => jest.clearAllMocks())

  it("converte giacenza, scorta minima e data di ordine", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        materiali: [{ data: [riga({ in_magazzino: true, carico_totale: "50.000", rettifica: "-3.000", soglia: "10.000", ordinato_il: "2026-10-25" })], error: null }],
      })
    )
    const [m] = await getMaterials()
    expect(m).toMatchObject({ in_magazzino: true, carico_totale: 50, rettifica: -3, soglia: 10, ordinato_il: "2026-10-25" })
  })
})

describe("saveMaterials — magazzino", () => {
  afterEach(() => jest.clearAllMocks())

  // Con l'impronta la prima chiamata è su documenti_caricati: si cerca la n-esima chiamata di una tabella.
  const builderDi = (client: ReturnType<typeof createSupabaseMock>, table: string, n = 0) => {
    const indici = client.from.mock.calls.flatMap((c, i) => (c[0] === table ? [i] : []))
    return client.from.mock.results[indici[n]].value
  }

  const rigaMag = (over: Record<string, unknown> = {}) => ({
    codice: "111383", nome: "8913 IMPRINT NERO", unita: "PZ", prezzo: 4.65, magazzino: true, carica: 50, ...over,
  })

  it("rifiuta una quantità da caricare negativa o non numerica", async () => {
    expect((await saveMaterials(input([rigaMag({ carica: -1 })]))).ok).toBe(false)
    expect((await saveMaterials(input([rigaMag({ carica: Number.NaN })]))).ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("materiale nuovo in magazzino: parte dalla quantità caricata e registra l'impronta", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()], { impronta: "abc123" }))

    expect(r).toEqual({ ok: true, nuovi: 1, aggiornati: 0 })
    const inseriti = builderDi(client, "materiali", 1).insert.mock.calls[0][0]
    expect(inseriti[0]).toMatchObject({ in_magazzino: true, carico_totale: 50, rettifica: 0, soglia: null, ordinato_il: null })
    expect(builderDi(client, "documenti_caricati").insert).toHaveBeenCalledWith({ impronta: "abc123" })
  })

  it("materiale esistente: somma la quantità e cancella «Ho già ordinato»", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: true, carico_totale: "20.000", ordinato_il: "2026-10-20" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ carica: 30 })], { impronta: "abc123", data: "2025-10-29" }))

    const aggiornati = builderDi(client, "materiali", 1).upsert.mock.calls[0][0]
    expect(aggiornati[0]).toMatchObject({ carico_totale: 50, ordinato_il: null, in_magazzino: true })
  })

  it("documento già caricato: non somma le quantità e lo segnala, ma aggiorna i prezzi", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: true, carico_totale: "50.000" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag({ prezzo: 5.2 })], { impronta: "abc123", data: "2026-01-10" }))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1, quantitaSaltate: true })
    const aggiornati = builderDi(client, "materiali", 1).upsert.mock.calls[0][0]
    expect(aggiornati[0]).toMatchObject({ prezzo_attuale: 5.2, carico_totale: 50 })
  })

  it("«Carica comunque»: somma le quantità anche se l'impronta esiste già", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: true, carico_totale: "50.000" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()], { impronta: "abc123", caricaComunque: true, data: "2025-10-29" }))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1 })
    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ carico_totale: 100 })
  })

  it("casella spenta: la riga non entra in magazzino e le quantità non si sommano", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ magazzino: false })], { impronta: "abc123" }))

    expect(client.from.mock.calls.some((c) => c[0] === "documenti_caricati")).toBe(false)
    expect(builderDi(client, "materiali", 1).insert.mock.calls[0][0][0]).toMatchObject({ in_magazzino: false, carico_totale: 0 })
  })

  it("senza impronta (inserimento a mano) somma la quantità senza controllo dei doppi", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()]))

    expect(r).toEqual({ ok: true, nuovi: 1, aggiornati: 0 })
    expect(client.from.mock.calls.some((c) => c[0] === "documenti_caricati")).toBe(false)
    expect(builderDi(client, "materiali", 1).insert.mock.calls[0][0][0]).toMatchObject({ carico_totale: 50 })
  })

  it("se la scrittura dei materiali fallisce toglie l'impronta appena registrata", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: { message: "boom" } }],
      documenti_caricati: [{ data: null, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()], { impronta: "abc123" }))

    expect(r.ok).toBe(false)
    const rimozione = builderDi(client, "documenti_caricati", 1)
    expect(rimozione.delete).toHaveBeenCalled()
    expect(rimozione.eq).toHaveBeenCalledWith("impronta", "abc123")
  })

  it("stesso materiale due volte nello stesso documento: le quantità si sommano una volta per riga", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ carica: 20 }), rigaMag({ carica: 30 })], { impronta: "abc123" }))

    const inseriti = builderDi(client, "materiali", 1).insert.mock.calls[0][0]
    expect(inseriti).toHaveLength(1)
    expect(inseriti[0]).toMatchObject({ carico_totale: 50 })
  })
})

describe("updateMaterial — magazzino", () => {
  afterEach(() => jest.clearAllMocks())
  const campi = { nome: "Timbro", unita: "PZ", prezzo_attuale: 4.65, prezzo_precedente: null }

  it("salva la casella e la scorta minima quando sono indicate", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await updateMaterial("m1", { ...campi, in_magazzino: true, soglia: 10 })

    expect(r).toEqual({ ok: true })
    expect(client.from.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ in_magazzino: true, soglia: 10 })
    )
  })

  it("accetta una scorta minima vuota (null) e rifiuta una negativa", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: null }] }))
    expect((await updateMaterial("m1", { ...campi, soglia: null })).ok).toBe(true)
    expect((await updateMaterial("m1", { ...campi, soglia: -1 })).ok).toBe(false)
  })
})

describe("setStock", () => {
  afterEach(() => jest.clearAllMocks())

  it("rifiuta un valore non valido senza toccare il database", async () => {
    expect((await setStock("m1", -1)).ok).toBe(false)
    expect((await setStock("m1", Number.NaN)).ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("calcola la rettifica che porta la giacenza al valore contato", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: { carico_totale: "50.000" }, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await setStock("m1", 47)

    expect(r).toEqual({ ok: true })
    expect(client.from.mock.results[1].value.update).toHaveBeenCalledWith({ rettifica: -3 })
    expect(client.from.mock.results[1].value.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("errore se il materiale non si legge", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    expect((await setStock("m1", 5)).ok).toBe(false)
  })
})

describe("markOrdered", () => {
  afterEach(() => jest.clearAllMocks())

  it("scrive la data di oggi (calendario di Roma)", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    expect(await markOrdered("m1")).toEqual({ ok: true })
    const payload = client.from.mock.results[0].value.update.mock.calls[0][0]
    expect(payload.ordinato_il).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(client.from.mock.results[0].value.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("restituisce un errore se la scrittura fallisce", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    expect((await markOrdered("m1")).ok).toBe(false)
  })
})
```

Nota: la funzione di test `input(...)` già esistente accetta un secondo argomento `over` che viene fuso nell'oggetto (`fornitore`, `data`, `righe`): usarla anche per `impronta` e `caricaComunque`.

- [ ] **Step 3: Verificare che falliscano**

Run: `npx jest src/actions/__tests__/materiali.test.ts --roots=src`
Expected: FAIL (`setStock`/`markOrdered` non esistono, i campi del magazzino non vengono letti né scritti).

- [ ] **Step 4: Sostituire `src/actions/materiali.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { USER_MESSAGES } from "@/lib/errors"
import {
  applyPriceUpdate,
  isValidIsoDate,
  matchMaterial,
  rettificaPerGiacenza,
  round3,
  todayIso,
  type Materiale,
} from "@/lib/materiali"

// NOTE: in un file "use server" si possono esportare solo funzioni async: i tipi
// usati dai componenti (Materiale, RigaDocumento) si importano da @/lib/materiali.

type RigaDaSalvare = {
  codice: string | null
  nome: string
  unita: string | null
  prezzo: number
  magazzino?: boolean // casella «Tieni in magazzino»; assente = non cambia
  carica?: number | null // quantità da sommare alla giacenza (solo se magazzino)
}

type SalvataggioResult =
  | { ok: true; nuovi: number; aggiornati: number; quantitaSaltate?: true }
  | { ok: false; error: string }

type EsitoSemplice = { ok: true } | { ok: false; error: string }

const COLUMNS =
  "id, fornitore, codice, nome, unita, prezzo_attuale, data_acquisto_attuale, prezzo_precedente, data_acquisto_precedente, in_magazzino, carico_totale, rettifica, soglia, ordinato_il"
const NUOVO_PREFIX = "nuovo-"
const VIOLAZIONE_UNICITA = "23505"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMateriale(row: any): Materiale {
  return {
    id: row.id,
    fornitore: row.fornitore,
    codice: row.codice ?? null,
    nome: row.nome,
    unita: row.unita ?? null,
    prezzo_attuale: Number(row.prezzo_attuale),
    data_acquisto_attuale: row.data_acquisto_attuale,
    prezzo_precedente: row.prezzo_precedente === null || row.prezzo_precedente === undefined ? null : Number(row.prezzo_precedente),
    data_acquisto_precedente: row.data_acquisto_precedente ?? null,
    in_magazzino: Boolean(row.in_magazzino),
    carico_totale: Number(row.carico_totale ?? 0),
    rettifica: Number(row.rettifica ?? 0),
    soglia: row.soglia === null || row.soglia === undefined ? null : Number(row.soglia),
    ordinato_il: row.ordinato_il ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAll(supabase: any): Promise<Materiale[]> {
  const { data, error } = await supabase
    .from("materiali")
    .select(COLUMNS)
    .order("fornitore", { ascending: true })
    .order("nome", { ascending: true })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => toMateriale(r))
}

export async function getMaterials(): Promise<Materiale[]> {
  const supabase = await createClient()
  try {
    return await loadAll(supabase)
  } catch (error) {
    logError("getMaterials", error)
    throw new Error(USER_MESSAGES.generic)
  }
}

function pulisci(value: string | null): string | null {
  const t = value?.trim() ?? ""
  return t === "" ? null : t
}

function campi(m: Materiale) {
  return {
    fornitore: m.fornitore,
    codice: m.codice,
    nome: m.nome,
    unita: m.unita,
    prezzo_attuale: m.prezzo_attuale,
    data_acquisto_attuale: m.data_acquisto_attuale,
    prezzo_precedente: m.prezzo_precedente,
    data_acquisto_precedente: m.data_acquisto_precedente,
    in_magazzino: m.in_magazzino,
    carico_totale: m.carico_totale,
    rettifica: m.rettifica,
    soglia: m.soglia,
    ordinato_il: m.ordinato_il,
  }
}

function uguali(a: Materiale, b: Materiale): boolean {
  return (
    a.codice === b.codice &&
    a.unita === b.unita &&
    a.prezzo_attuale === b.prezzo_attuale &&
    a.data_acquisto_attuale === b.data_acquisto_attuale &&
    a.prezzo_precedente === b.prezzo_precedente &&
    a.data_acquisto_precedente === b.data_acquisto_precedente &&
    a.in_magazzino === b.in_magazzino &&
    a.carico_totale === b.carico_totale &&
    a.ordinato_il === b.ordinato_il
  )
}

/**
 * Salva le righe confermate di un documento.
 *
 * Quantità in magazzino: si sommano solo per le righe con `magazzino` vero e `carica` > 0. Se c'è
 * un'`impronta` si registra PRIMA di scrivere i materiali (il vincolo di unicità la rende atomica): se esiste
 * già il documento è stato caricato e le quantità si saltano, salvo `caricaComunque`. Se poi la scrittura dei
 * materiali fallisce l'impronta si toglie, così un nuovo tentativo parte pulito. I prezzi restano idempotenti.
 * Non è una transazione (un `insert` e un `upsert`): rilanciare dopo un errore completa il resto.
 */
export async function saveMaterials(input: {
  fornitore: string
  data: string
  righe: RigaDaSalvare[]
  impronta?: string
  caricaComunque?: boolean
}): Promise<SalvataggioResult> {
  const fornitore = input.fornitore.trim()
  const valido =
    fornitore !== "" &&
    isValidIsoDate(input.data) &&
    input.righe.length > 0 &&
    input.righe.every(
      (r) =>
        r.nome.trim() !== "" &&
        Number.isFinite(r.prezzo) &&
        r.prezzo >= 0 &&
        (r.carica === undefined || r.carica === null || (Number.isFinite(r.carica) && r.carica >= 0))
    )
  if (!valido) return { ok: false, error: USER_MESSAGES.validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  let esistenti: Materiale[]
  try {
    esistenti = await loadAll(supabase)
  } catch (error) {
    logError("saveMaterials", error)
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }

  const daSommare = input.righe.some((r) => r.magazzino === true && (r.carica ?? 0) > 0)
  let sommaQuantita = daSommare
  let improntaRegistrata = false
  if (input.impronta && daSommare) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("documenti_caricati").insert({ impronta: input.impronta })
    if (!error) {
      improntaRegistrata = true
    } else if (error.code === VIOLAZIONE_UNICITA) {
      if (!input.caricaComunque) sommaQuantita = false
    } else {
      logError("saveMaterials.impronta", error)
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }
  const quantitaSaltate = daSommare && !sommaQuantita

  async function annullaImpronta() {
    if (!improntaRegistrata) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("documenti_caricati").delete().eq("impronta", input.impronta)
  }

  const lavoro = new Map<string, Materiale>(esistenti.map((m) => [m.id, m]))
  const toccati = new Set<string>()
  let contatore = 0

  for (const r of input.righe) {
    const pulita = { codice: pulisci(r.codice), nome: r.nome.trim(), unita: pulisci(r.unita), prezzo: r.prezzo }
    const aggiungi = sommaQuantita && r.magazzino === true ? Math.max(r.carica ?? 0, 0) : 0
    const trovato = matchMaterial([...lavoro.values()], fornitore, pulita)

    if (trovato) {
      const aggiornato: Materiale = {
        ...trovato,
        ...applyPriceUpdate(trovato, { prezzo: pulita.prezzo, data: input.data }),
        codice: trovato.codice ?? pulita.codice,
        unita: trovato.unita ?? pulita.unita,
        in_magazzino: r.magazzino ?? trovato.in_magazzino,
        carico_totale: round3(trovato.carico_totale + aggiungi),
        ordinato_il: aggiungi > 0 ? null : trovato.ordinato_il,
      }
      if (!uguali(aggiornato, trovato)) {
        lavoro.set(trovato.id, aggiornato)
        toccati.add(trovato.id)
      }
    } else {
      contatore++
      const id = `${NUOVO_PREFIX}${contatore}`
      lavoro.set(id, {
        id,
        fornitore,
        codice: pulita.codice,
        nome: pulita.nome,
        unita: pulita.unita,
        prezzo_attuale: pulita.prezzo,
        data_acquisto_attuale: input.data,
        prezzo_precedente: null,
        data_acquisto_precedente: null,
        in_magazzino: r.magazzino === true,
        carico_totale: round3(aggiungi),
        rettifica: 0,
        soglia: null,
        ordinato_il: null,
      })
      toccati.add(id)
    }
  }

  const daInserire: ReturnType<typeof campi>[] = []
  const daAggiornare: Array<{ id: string } & ReturnType<typeof campi>> = []
  for (const id of toccati) {
    const m = lavoro.get(id)!
    if (id.startsWith(NUOVO_PREFIX)) daInserire.push(campi(m))
    else daAggiornare.push({ id: m.id, ...campi(m) })
  }

  if (daInserire.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("materiali").insert(daInserire)
    if (error) {
      logError("saveMaterials.insert", error)
      await annullaImpronta()
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }
  if (daAggiornare.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("materiali").upsert(daAggiornare)
    if (error) {
      logError("saveMaterials.upsert", error)
      await annullaImpronta()
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }

  revalidatePath("/materiali")
  return {
    ok: true,
    nuovi: daInserire.length,
    aggiornati: daAggiornare.length,
    ...(quantitaSaltate ? { quantitaSaltate: true as const } : {}),
  }
}

/** Correzione diretta dei campi di un materiale (non registra un acquisto: nessuna logica di storico). */
export async function updateMaterial(
  id: string,
  dati: {
    nome: string
    unita: string | null
    prezzo_attuale: number
    prezzo_precedente: number | null
    in_magazzino?: boolean
    soglia?: number | null // scorta minima; null = nessuna
  }
): Promise<EsitoSemplice> {
  const nome = dati.nome.trim()
  const valido =
    nome !== "" &&
    Number.isFinite(dati.prezzo_attuale) &&
    dati.prezzo_attuale >= 0 &&
    (dati.prezzo_precedente === null || (Number.isFinite(dati.prezzo_precedente) && dati.prezzo_precedente >= 0)) &&
    (dati.soglia === undefined || dati.soglia === null || (Number.isFinite(dati.soglia) && dati.soglia >= 0))
  if (!valido) return { ok: false, error: USER_MESSAGES.validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("materiali")
    .update({
      nome,
      unita: pulisci(dati.unita),
      prezzo_attuale: dati.prezzo_attuale,
      prezzo_precedente: dati.prezzo_precedente,
      ...(dati.prezzo_precedente === null ? { data_acquisto_precedente: null } : {}),
      ...(dati.in_magazzino !== undefined ? { in_magazzino: dati.in_magazzino } : {}),
      ...(dati.soglia !== undefined ? { soglia: dati.soglia } : {}),
    })
    .eq("id", id)
  if (error) {
    logError("updateMaterial", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * «Correggi giacenza»: si scrive quanti pezzi ci sono davvero e l'app calcola la rettifica.
 * Il venduto vale 0 finché gli ordini non sono collegati ai materiali (Lavoro 2: andrà passato qui).
 */
export async function setStock(id: string, reale: number): Promise<EsitoSemplice> {
  if (!Number.isFinite(reale) || reale < 0) return { ok: false, error: USER_MESSAGES.validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: readError } = await (supabase as any).from("materiali").select("carico_totale").eq("id", id).single()
  if (readError || !data) {
    logError("setStock.read", readError ?? new Error("materiale non trovato"), { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }

  const rettifica = rettificaPerGiacenza(reale, { carico_totale: Number(data.carico_totale) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("materiali").update({ rettifica }).eq("id", id)
  if (error) {
    logError("setStock.update", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
  return { ok: true }
}

/** «Ho già ordinato»: segna la data di oggi; per 7 giorni l'avviso «Da riordinare» è sospeso. */
export async function markOrdered(id: string): Promise<EsitoSemplice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("materiali").update({ ordinato_il: todayIso() }).eq("id", id)
  if (error) {
    logError("markOrdered", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function deleteMaterial(id: string): Promise<EsitoSemplice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("materiali").delete().eq("id", id)
  if (error) {
    logError("deleteMaterial", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
  return { ok: true }
}
```

- [ ] **Step 5: Verificare**

Run: `npx jest src/actions/__tests__/materiali.test.ts src/lib/__tests__/materiali.test.ts --roots=src`
Expected: PASS (i test preesistenti restano verdi: i nuovi campi di `saveMaterials` sono facoltativi e `quantitaSaltate` compare solo quando vale `true`).

Run: `npx tsc --noEmit` — Expected: pulito. Se compare un errore su `Materiale` in altri file (es. `MaterialiImport.tsx`, `MaterialeRowActions.tsx`, pagina) significa che costruiscono oggetti `Materiale` a mano: non succede oggi (li ricevono dalle azioni), quindi l'errore andrebbe riportato.

Run: `npx jest --roots=src` — Expected: tutte le suite verdi.

- [ ] **Step 6: Commit**

```bash
git add src/actions/materiali.ts src/actions/__tests__/materiali.test.ts src/lib/materiali.ts src/lib/__tests__/materiali.test.ts
git commit -m "feat(magazzino): giacenza, scorta minima e «Ho già ordinato» nelle azioni dei materiali

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `extractDocument` riconosce i documenti già caricati

**Files:**
- Modify: `src/actions/materialiDocumento.ts`
- Test: `src/actions/__tests__/materialiDocumento.test.ts`

- [ ] **Step 1: Aggiornare i test**

In `src/actions/__tests__/materialiDocumento.test.ts`:

1. Sostituire il test `"passa al lettore il file in base64 col suo tipo e restituisce il documento"` con:

```ts
  it("passa al lettore il file in base64 col suo tipo e restituisce documento, impronta e stato di caricamento", async () => {
    const documento = { fornitore: "FB", data: "2025-10-29", righe: [] }
    mockRead.mockResolvedValue(documento)

    const r = await extractDocument(formDataWith(pdf()))

    expect(r).toEqual({ ok: true, documento, impronta: expect.stringMatching(/^[0-9a-f]{64}$/), giaCaricato: false })
    expect(mockRead).toHaveBeenCalledWith(Buffer.from("%PDF-1.4 finto").toString("base64"), "application/pdf")
  })

  it("segnala un documento già caricato quando l'impronta è già registrata", async () => {
    mockRead.mockResolvedValue({ fornitore: "FB", data: "2025-10-29", righe: [] })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ documenti_caricati: [{ data: [{ id: "d1" }], error: null }] }))

    const r = await extractDocument(formDataWith(pdf()))

    expect(r).toMatchObject({ ok: true, giaCaricato: true })
  })

  it("se non riesce a controllare le impronte non blocca la lettura", async () => {
    mockRead.mockResolvedValue({ fornitore: "FB", data: "2025-10-29", righe: [] })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ documenti_caricati: [{ data: null, error: { message: "boom" } }] }))

    const r = await extractDocument(formDataWith(pdf()))

    expect(r).toMatchObject({ ok: true, giaCaricato: false })
  })
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest src/actions/__tests__/materialiDocumento.test.ts --roots=src`
Expected: FAIL (mancano `impronta` e `giaCaricato`).

- [ ] **Step 3: Implementare**

In `src/actions/materialiDocumento.ts`:

1. Aggiungere agli import:

```ts
import { documentFingerprint } from "@/lib/documentFingerprint"
```

2. Cambiare il tipo del risultato:

```ts
type LetturaResult =
  | { ok: true; documento: DocumentoLetto; impronta: string; giaCaricato: boolean }
  | { ok: false; error: string }
```

3. Sostituire il blocco `try { ... }` con:

```ts
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    const documento = await readSupplierDocument(base64, file.type as SupportedMediaType)
    const impronta = documentFingerprint(documento)
    return { ok: true, documento, impronta, giaCaricato: await giaCaricato(supabase, impronta) }
  } catch (error) {
    logError("extractDocument", error)
    return { ok: false, error: MSG_READ_FAILED }
  }
```

4. In fondo al file aggiungere:

```ts
// Un errore nel controllo non deve bloccare la lettura: nel dubbio si tratta il documento come nuovo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function giaCaricato(supabase: any, impronta: string): Promise<boolean> {
  const { data, error } = await supabase.from("documenti_caricati").select("id").eq("impronta", impronta)
  if (error) {
    logError("extractDocument.impronta", error)
    return false
  }
  return Array.isArray(data) && data.length > 0
}
```

(Le funzioni non esportate sono ammesse in un file `"use server"`: solo gli export devono essere async.)

- [ ] **Step 4: Verificare**

Run: `npx jest src/actions/__tests__/materialiDocumento.test.ts --roots=src` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: pulito (se `MaterialiImport.tsx` non compila perché il tipo del risultato è cambiato, si sistema nel Task 6: in tal caso l'errore atteso riguarda solo l'uso di `risultato`, che continua a funzionare perché il nuovo tipo è un'estensione).

- [ ] **Step 5: Commit**

```bash
git add src/actions/materialiDocumento.ts src/actions/__tests__/materialiDocumento.test.ts
git commit -m "feat(magazzino): la lettura segnala i documenti già caricati

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tabella di controllo con Magazzino e Carica

**Files:**
- Modify: `src/components/MaterialiImport.tsx`

Nessun test Jest (componente, stessa convenzione del progetto): si verifica con `tsc`, `eslint` e la prova reale del Task 10. Le sostituzioni sotto vanno applicate sul testo ESATTO attuale del file.

- [ ] **Step 1: Import**

Sostituire:

```tsx
import {
  checkRow,
  classifyRow,
  formatDiscounts,
  formatPrezzo,
  netPrice,
  parseDiscounts,
  parsePrice,
  round3,
  todayIso,
  type Materiale,
  type RigaDocumento,
} from "@/lib/materiali"
```

con:

```tsx
import {
  checkRow,
  classifyRow,
  formatDiscounts,
  formatPrezzo,
  formatQuantita,
  matchMaterial,
  netPrice,
  parseDiscounts,
  parsePrice,
  round3,
  todayIso,
  type Materiale,
  type RigaDocumento,
} from "@/lib/materiali"
```

- [ ] **Step 2: Tipo della riga**

Sostituire:

```tsx
  sconti: string // "50 + 20": sconti a cascata in percentuale
  importo: number | null // solo per il controllo, non si salva
}
```

con:

```tsx
  sconti: string // "50 + 20": sconti a cascata in percentuale
  importo: number | null // solo per il controllo, non si salva
  magazzino: boolean // «Tieni in magazzino»
  carica: string // quantità da sommare alla giacenza (solo con magazzino)
}
```

- [ ] **Step 3: Stato del documento**

Dopo la riga `const [salvataggio, setSalvataggio] = useState(false)` aggiungere:

```tsx
  const [impronta, setImpronta] = useState<string | null>(null)
  const [giaCaricato, setGiaCaricato] = useState(false)
  const [caricaComunque, setCaricaComunque] = useState(false)
```

- [ ] **Step 4: Nuova riga e apertura della tabella**

Sostituire `nuovaRiga` con:

```tsx
  function nuovaRiga(): RigaForm {
    return {
      key: prossimaChiave.current++,
      codice: "",
      nome: "",
      unita: "",
      quantita: null,
      prezzo: "",
      sconti: "",
      importo: null,
      magazzino: false,
      carica: "",
    }
  }
```

e `apriControllo` con:

```tsx
  function apriControllo(opzioni: {
    fornitore?: string
    data?: string
    righe?: RigaForm[]
    errore?: string | null
    impronta?: string | null
    giaCaricato?: boolean
  }) {
    setFornitore(opzioni.fornitore ?? "")
    setData(opzioni.data ?? todayIso())
    setRighe(opzioni.righe && opzioni.righe.length > 0 ? opzioni.righe : [nuovaRiga()])
    setErrore(opzioni.errore ?? null)
    setImpronta(opzioni.impronta ?? null)
    setGiaCaricato(opzioni.giaCaricato ?? false)
    setCaricaComunque(false)
    setMessaggio(null)
    setFase("controllo")
  }
```

- [ ] **Step 5: Righe lette dal documento**

In `onFile`, sostituire il blocco che costruisce `lette` e chiama `apriControllo` con:

```tsx
      const { documento } = risultato
      const lette: RigaForm[] = documento.righe.map((r) => ({
        key: prossimaChiave.current++,
        codice: r.codice ?? "",
        nome: r.nome,
        unita: r.unita ?? "",
        quantita: r.quantita,
        prezzo: formatPrezzo(r.prezzo),
        sconti: formatDiscounts(r.sconti),
        importo: r.importo,
        // se il materiale è già in magazzino la casella parte accesa
        magazzino: matchMaterial(esistenti, documento.fornitore, r)?.in_magazzino ?? false,
        carica: r.quantita === null ? "" : formatQuantita(r.quantita),
      }))
      apriControllo({
        fornitore: documento.fornitore,
        data: documento.data ?? todayIso(),
        righe: lette,
        errore: lette.length === 0 ? "Non ho trovato righe nel documento. Puoi aggiungerle a mano." : null,
        impronta: risultato.impronta,
        giaCaricato: risultato.giaCaricato,
      })
```

- [ ] **Step 6: Aggiornare le righe (`aggiorna`) per la casella**

Sostituire:

```tsx
  function aggiorna(key: number, campo: keyof RigaForm, valore: string) {
    setRighe((rs) => rs.map((r) => (r.key === key ? { ...r, [campo]: valore } : r)))
  }
```

con:

```tsx
  function aggiorna(key: number, campo: keyof RigaForm, valore: string | boolean) {
    setRighe((rs) => rs.map((r) => (r.key === key ? { ...r, [campo]: valore } : r)))
  }
```

Nota: se `tsc` si lamenta del tipo restituito da `aggiorna` (chiave calcolata con valore `string | boolean`), aggiungere `as RigaForm` all'oggetto: `{ ...r, [campo]: valore } as RigaForm`.

- [ ] **Step 7: Conferma**

Sostituire il blocco da `const daSalvare = righe.flatMap(` fino alla chiamata `saveMaterials(...)` e al messaggio finale (cioè tutto da `const daSalvare` a `setMessaggio(...)`) con:

```tsx
    const daSalvare = righe.flatMap((r) => {
      const riga = toRigaDocumento(r)
      if (!riga) return []
      const carica = r.magazzino && r.carica.trim() !== "" ? parsePrice(r.carica) : null
      return [{ codice: riga.codice, nome: riga.nome, unita: riga.unita, prezzo: riga.prezzo, magazzino: r.magazzino, carica }]
    })
    if (daSalvare.length === 0) {
      setErrore("Aggiungi almeno un materiale con nome e prezzo.")
      return
    }
    const caricaNonValida = righe.some((r) => r.magazzino && r.carica.trim() !== "" && parsePrice(r.carica) === null)
    if (caricaNonValida) {
      setErrore("Controlla le quantità da caricare in magazzino: devono essere numeri.")
      return
    }

    setSalvataggio(true)
    try {
      const esito = await saveMaterials({
        fornitore,
        data,
        righe: daSalvare,
        impronta: impronta ?? undefined,
        caricaComunque,
      })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      setFase("chiusa")
      setMessaggio(
        `Salvato: ${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati.` +
          (esito.quantitaSaltate ? " Documento già caricato: le quantità non sono state sommate." : "")
      )
```

(La riga successiva esistente, `router.refresh()`, e il `catch`/`finally` restano invariati.)

- [ ] **Step 8: Avviso «già caricato»**

Subito dopo `{errore && <ErrorMessage message={errore} />}` (nella schermata di controllo) aggiungere:

```tsx
      {giaCaricato && (
        <div role="status" className="rounded-md border border-gold/40 bg-honey px-4 py-3 text-sm text-espresso space-y-2">
          <p>Questo documento sembra già caricato: le quantità non verranno sommate al magazzino.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={caricaComunque} onChange={(e) => setCaricaComunque(e.target.checked)} />
            Carica comunque le quantità
          </label>
        </div>
      )}
```

- [ ] **Step 9: Colonne Magazzino e Carica**

Nell'intestazione, dopo `<th className="px-2 py-2">Controllo</th>` aggiungere:

```tsx
              <th className="px-2 py-2" title="Tieni questo materiale in magazzino">Magazzino</th>
              <th className="px-2 py-2" title="Quantità da sommare alla giacenza">Carica</th>
```

Nelle righe, dopo la cella `Controllo` (il `<td className="px-2 py-2">` che contiene `<div className="flex flex-col items-start gap-1">...</div>`) e prima della cella con il cestino, aggiungere:

```tsx
                  <td className="px-2 py-2 w-24">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={r.magazzino}
                        onChange={(e) => aggiorna(r.key, "magazzino", e.target.checked)}
                        aria-label="Magazzino"
                      />
                      Sì
                    </label>
                  </td>
                  <td className="px-2 py-2 w-24">
                    {r.magazzino && (
                      <Input
                        inputMode="decimal"
                        value={r.carica}
                        onChange={(e) => aggiorna(r.key, "carica", e.target.value)}
                        aria-label="Carica"
                      />
                    )}
                  </td>
```

- [ ] **Step 10: Verificare**

Run: `npx tsc --noEmit` — Expected: pulito.
Run: `npx eslint src/components/MaterialiImport.tsx` — Expected: nessun errore.
Run: `npx jest --roots=src` — Expected: tutto verde.

- [ ] **Step 11: Commit**

```bash
git add src/components/MaterialiImport.tsx
git commit -m "feat(magazzino): colonne Magazzino e Carica e avviso di documento già caricato

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pulsante «Ho già ordinato», riga di giacenza e modulo di modifica

**Files:**
- Create: `src/components/OrdinatoButton.tsx`
- Create: `src/components/StockInfo.tsx`
- Modify: `src/components/MaterialeRowActions.tsx`
- Modify: `src/app/(dashboard)/materiali/page.tsx`

- [ ] **Step 1: `OrdinatoButton.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { markOrdered } from "@/actions/materiali"

/** «Ho già ordinato»: sospende per 7 giorni l'avviso «Da riordinare». `onDone` sostituisce il refresh della pagina. */
export function OrdinatoButton({ id, onDone }: { id: string; onDone?: () => void }) {
  const router = useRouter()
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function click() {
    setOccupato(true)
    setErrore(null)
    try {
      const esito = await markOrdered(id)
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      if (onDone) onDone()
      else router.refresh()
    } catch {
      setErrore("Impossibile salvare. Riprova.")
    } finally {
      setOccupato(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={click} disabled={occupato}>
        {occupato ? "Salvo…" : "Ho già ordinato"}
      </Button>
      {errore && <span className="text-xs text-destructive">{errore}</span>}
    </span>
  )
}
```

- [ ] **Step 2: `StockInfo.tsx`**

```tsx
import { OrdinatoButton } from "@/components/OrdinatoButton"
import { cn, formatDate } from "@/lib/utils"
import { computeStock, daysBetween, formatQuantita, reorderStatus, type Materiale } from "@/lib/materiali"

/** Giacenza di un materiale in magazzino, con avviso «Da riordinare» e pulsante «Ho già ordinato». `oggi` è AAAA-MM-GG. */
export function StockInfo({ materiale, oggi }: { materiale: Materiale; oggi: string }) {
  if (!materiale.in_magazzino) return null
  const giacenza = computeStock(materiale)
  const stato = reorderStatus(materiale, giacenza, oggi)

  return (
    <div className="space-y-1 text-sm">
      <p className={cn("font-semibold", giacenza <= 0 && "text-terracotta")}>
        In magazzino: {formatQuantita(giacenza)}
        {materiale.soglia !== null && (
          <span className="font-normal text-muted-foreground"> (minimo {formatQuantita(materiale.soglia)})</span>
        )}
      </p>
      {stato === "da_riordinare" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta">Da riordinare</span>
          <OrdinatoButton id={materiale.id} />
        </div>
      )}
      {stato === "ordinato" && materiale.ordinato_il && (
        <p className="text-xs text-muted-foreground">Ordinato il {formatDate(materiale.ordinato_il)} – in attesa</p>
      )}
      {stato === "ordinato_scaduto" && materiale.ordinato_il && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta">
            Ordinato da {daysBetween(materiale.ordinato_il, oggi)} giorni, non è arrivato
          </span>
          <OrdinatoButton id={materiale.id} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `MaterialeRowActions.tsx`**

1. Cambiare l'import da `@/actions/materiali` e da `@/lib/materiali`:

```tsx
import { deleteMaterial, setStock, updateMaterial } from "@/actions/materiali"
import { computeStock, formatPrezzo, formatQuantita, parsePrice, type Materiale } from "@/lib/materiali"
```

2. Dopo la riga `const [precedente, setPrecedente] = useState(...)` (tutto lo `useState` su più righe) aggiungere:

```tsx
  const [inMagazzino, setInMagazzino] = useState(materiale.in_magazzino)
  const [giacenza, setGiacenza] = useState(formatQuantita(computeStock(materiale)))
  const [soglia, setSoglia] = useState(materiale.soglia === null ? "" : formatQuantita(materiale.soglia))
```

3. In `apri()`, prima di `setErrore(null)` aggiungere:

```tsx
    setInMagazzino(materiale.in_magazzino)
    setGiacenza(formatQuantita(computeStock(materiale)))
    setSoglia(materiale.soglia === null ? "" : formatQuantita(materiale.soglia))
```

4. In `salva()`, sostituire tutto il corpo della funzione che segue `setErrore(null)` (dalla riga `const prezzoAttuale = parsePrice(attuale)` fino alla `}` che chiude `salva`, compresi `catch` e `finally`) con:

```tsx
    const prezzoAttuale = parsePrice(attuale)
    const prezzoPrecedente = precedente.trim() === "" ? null : parsePrice(precedente)
    if (prezzoAttuale === null || (precedente.trim() !== "" && prezzoPrecedente === null)) {
      setErrore("Controlla i prezzi.")
      return
    }
    const scortaMinima = soglia.trim() === "" ? null : parsePrice(soglia)
    if (inMagazzino && soglia.trim() !== "" && scortaMinima === null) {
      setErrore("La scorta minima deve essere un numero.")
      return
    }
    const giacenzaContata = giacenza.trim() === "" ? null : parsePrice(giacenza)
    if (inMagazzino && giacenza.trim() !== "" && giacenzaContata === null) {
      setErrore("La giacenza deve essere un numero.")
      return
    }
    setOccupato(true)
    try {
      const esito = await updateMaterial(materiale.id, {
        nome,
        unita: unita.trim() || null,
        prezzo_attuale: prezzoAttuale,
        prezzo_precedente: prezzoPrecedente,
        in_magazzino: inMagazzino,
        soglia: inMagazzino ? scortaMinima : null,
      })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      // «Correggi giacenza»: solo se il valore scritto è diverso da quello calcolato
      if (inMagazzino && giacenzaContata !== null && giacenzaContata !== computeStock(materiale)) {
        const stock = await setStock(materiale.id, giacenzaContata)
        if (!stock.ok) {
          setErrore(stock.error)
          return
        }
      }
      setModifica(false)
      router.refresh()
    } catch {
      setErrore("Impossibile salvare i dati. Controlla la connessione e riprova.")
    } finally {
      setOccupato(false)
    }
  }
```

(Il blocco `async function elimina()` che segue resta invariato.)

5. Nel modulo di modifica (il `return` finale), dopo il `<div className="grid grid-cols-3 gap-2">...</div>` dei tre campi e prima di `<div className="flex gap-1">` dei pulsanti, aggiungere:

```tsx
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inMagazzino} onChange={(e) => setInMagazzino(e.target.checked)} />
        Tieni in magazzino
      </label>
      {inMagazzino && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            inputMode="decimal"
            value={giacenza}
            onChange={(e) => setGiacenza(e.target.value)}
            placeholder="Giacenza attuale"
            aria-label="Giacenza attuale"
          />
          <Input
            inputMode="decimal"
            value={soglia}
            onChange={(e) => setSoglia(e.target.value)}
            placeholder="Scorta minima"
            aria-label="Scorta minima"
          />
        </div>
      )}
```

- [ ] **Step 4: Pagina Materiali**

In `src/app/(dashboard)/materiali/page.tsx`:

1. Import: aggiungere `import { StockInfo } from "@/components/StockInfo"` e cambiare l'import da `@/lib/materiali` in:

```tsx
import { formatPrezzo, matchesSearch, priceVariation, todayIso, type Materiale } from "@/lib/materiali"
```

2. Dopo `const mostrati = q ? ... : tutti` aggiungere:

```tsx
  const oggi = todayIso()
```

3. Nella **scheda** (blocco `xl:hidden`), subito dopo il `</div>` che chiude il `<div className="grid grid-cols-2 gap-3 text-sm">` e prima di `<MaterialeRowActions materiale={m} />`, aggiungere:

```tsx
              <StockInfo materiale={m} oggi={oggi} />
```

4. Nella **tabella**, nella cella del materiale (dopo il paragrafo con codice e unità, dentro lo stesso `<td className="px-4 py-3">`), aggiungere:

```tsx
                    <StockInfo materiale={m} oggi={oggi} />
```

(Nel secondo caso va dentro il `<td>` che contiene `<p className="font-semibold">{m.nome}</p>`, dopo il blocco `{(m.codice || m.unita) && (...)}`.)

- [ ] **Step 5: Verificare**

Run: `npx tsc --noEmit` — Expected: pulito.
Run: `npx eslint src/components/OrdinatoButton.tsx src/components/StockInfo.tsx src/components/MaterialeRowActions.tsx "src/app/(dashboard)/materiali/page.tsx"` — Expected: nessun errore.
Run: `npx jest --roots=src` — Expected: tutto verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/OrdinatoButton.tsx src/components/StockInfo.tsx src/components/MaterialeRowActions.tsx "src/app/(dashboard)/materiali/page.tsx"
git commit -m "feat(magazzino): giacenza, scorta minima e «Ho già ordinato» nell'elenco materiali

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sezione «Da riordinare» nella pagina «Oggi»

**Files:**
- Modify: `src/app/api/dashboard/today/route.ts`
- Test: `src/app/api/dashboard/today/__tests__/route.test.ts`
- Modify: `src/components/TodayBoard.tsx`

- [ ] **Step 1: Test della route**

In `src/app/api/dashboard/today/__tests__/route.test.ts`, in fondo al `describe("GET /api/dashboard/today", ...)` (prima dell'ultima `})` del file) aggiungere:

```ts
  describe("riordino materiali", () => {
    const materiale = (over: Record<string, unknown> = {}) => ({
      id: "m1", fornitore: "Trodat", nome: "8913 IMPRINT NERO", in_magazzino: true,
      carico_totale: "20.000", rettifica: "-12.000", soglia: "10.000", ordinato_il: null, ...over,
    })

    function conMateriali(rows: unknown[]) {
      const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [])
      const originale = client.from.getMockImplementation()!
      client.from.mockImplementation((table: string) =>
        table === "materiali" ? createSupabaseMock({ materiali: [{ data: rows, error: null }] }).from("materiali") : originale(table)
      )
      mockCreateClient.mockResolvedValue(client)
    }

    it("elenca i materiali con giacenza uguale o sotto la scorta minima", async () => {
      conMateriali([materiale(), materiale({ id: "m2", nome: "Penna blu", carico_totale: "50.000", rettifica: "0.000" })])

      const body = await (await GET()).json()

      expect(body.riordino).toHaveLength(1)
      expect(body.riordino[0]).toMatchObject({ id: "m1", fornitore: "Trodat", giacenza: 8, soglia: 10, stato: "da_riordinare" })
    })

    it("non elenca i materiali con «Ho già ordinato» da meno di 7 giorni", async () => {
      const oggi = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date())
      conMateriali([materiale({ ordinato_il: oggi })])

      const body = await (await GET()).json()

      expect(body.riordino).toEqual([])
    })

    it("rielenca un materiale ordinato da 7 giorni o più", async () => {
      conMateriali([materiale({ ordinato_il: "2020-01-01" })])

      const body = await (await GET()).json()

      expect(body.riordino).toHaveLength(1)
      expect(body.riordino[0].stato).toBe("ordinato_scaduto")
    })

    it("ignora i materiali non in magazzino o senza scorta minima", async () => {
      conMateriali([materiale({ in_magazzino: false }), materiale({ id: "m3", soglia: null })])

      const body = await (await GET()).json()

      expect(body.riordino).toEqual([])
    })

    it("senza materiali la lista è vuota", async () => {
      mockCreateClient.mockResolvedValue(mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], []))

      const body = await (await GET()).json()

      expect(body.riordino).toEqual([])
    })
  })
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest src/app/api/dashboard/today/__tests__/route.test.ts --roots=src`
Expected: FAIL (`body.riordino` è `undefined`).

- [ ] **Step 3: Implementare la route**

In `src/app/api/dashboard/today/route.ts`:

1. Aggiungere agli import:

```ts
import { hasFeature } from "@/lib/plan"
import { computeStock, reorderStatus, todayIso } from "@/lib/materiali"
```

2. Nel destructuring del `Promise.all`, aggiungere `materialiRes` dopo `remindersRes`:

```ts
    const [openRes, urgentRes, overdueRes, todayRes, deliveredRes, materialeDaOrdinareRes, materialeOrdinatoOggiRes, daAvvisareRes, remindersRes, materialiRes] = await Promise.all([
```

3. Come ultimo elemento dell'array del `Promise.all` (dopo la query `reminders`, aggiungendo una virgola) inserire:

```ts
      // Materiali in magazzino per l'avviso «Da riordinare» (solo livello completo)
      hasFeature("materiali")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (supabase as any)
            .from("materiali")
            .select("id, fornitore, nome, in_magazzino, carico_totale, rettifica, soglia, ordinato_il")
            .eq("in_magazzino", true)
        : Promise.resolve({ data: [] }),
```

4. Prima del `return NextResponse.json({`, aggiungere:

```ts
    const oggiRoma = todayIso()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const riordino = ((materialiRes.data ?? []) as any[])
      .flatMap((row) => {
        const soglia = row.soglia === null || row.soglia === undefined ? null : Number(row.soglia)
        const giacenza = computeStock({ carico_totale: Number(row.carico_totale ?? 0), rettifica: Number(row.rettifica ?? 0) })
        const stato = reorderStatus({ in_magazzino: Boolean(row.in_magazzino), soglia, ordinato_il: row.ordinato_il ?? null }, giacenza, oggiRoma)
        return stato === "da_riordinare" || stato === "ordinato_scaduto"
          ? [{ id: row.id, nome: row.nome, fornitore: row.fornitore, giacenza, soglia, stato, ordinato_il: row.ordinato_il ?? null }]
          : []
      })
      .sort((a, b) => a.nome.localeCompare(b.nome))
```

5. Nell'oggetto restituito aggiungere `riordino,` dopo `daAvvisare: daAvvisareRes.data ?? [],`.

- [ ] **Step 4: Verificare la route**

Run: `npx jest src/app/api/dashboard/today/__tests__/route.test.ts --roots=src`
Expected: PASS (nuovi e preesistenti).

- [ ] **Step 5: `TodayBoard.tsx`**

1. Import: sostituire `import { useEffect, useState, type ComponentType } from "react"` con:

```tsx
import { useCallback, useEffect, useState, type ComponentType } from "react"
```

e aggiungere:

```tsx
import { OrdinatoButton } from "@/components/OrdinatoButton"
import { formatQuantita, daysBetween, todayIso } from "@/lib/materiali"
```

2. Dopo l'interfaccia `OrderSummary` aggiungere:

```tsx
interface Riordino {
  id: string
  nome: string
  fornitore: string
  giacenza: number
  soglia: number | null
  stato: "da_riordinare" | "ordinato_scaduto"
  ordinato_il: string | null
}
```

3. In `DashboardData` aggiungere `riordino: Riordino[]` dopo `daAvvisare: OrderSummary[]`.

4. Sostituire l'`useEffect` con una funzione ricaricabile:

```tsx
  const carica = useCallback(() => {
    fetch("/api/dashboard/today")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json: DashboardData) => {
        setData(json)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(toUserMessage(err))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    carica()
  }, [carica])
```

5. Nel destructuring `const { kpi, todayOrders, ... } = data!` aggiungere `riordino`:

```tsx
  const { kpi, todayOrders, deliveredToday, materialeDaOrdinare, materialeOrdinatoOggi, daAvvisare, riordino, reminders } = data!
```

6. Dopo il `DashboardListCard` di «Materiale ordinato oggi» e prima del blocco `{reminders.length > 0 && (`, aggiungere:

```tsx
      <RiordinoCard items={riordino} onDone={carica} />
```

7. Nella condizione del messaggio «Nessuna scadenza per oggi», aggiungere `riordino.length === 0 &&` dopo `daAvvisare.length === 0 &&`.

8. In fondo al file (prima di `function KpiCard`) aggiungere:

```tsx
function RiordinoCard({ items, onDone }: { items: Riordino[]; onDone: () => void }) {
  if (items.length === 0) return null
  const oggi = todayIso()

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Da riordinare</CardTitle>
        <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 border bg-terracotta/15 border-terracotta/30 text-terracotta">
          {items.length}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 bg-background rounded-lg px-4 py-3">
            <Link href={`/materiali?q=${encodeURIComponent(m.nome)}`} className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{m.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.fornitore}</p>
              <p className="text-xs text-muted-foreground">
                In magazzino: {formatQuantita(m.giacenza)}
                {m.soglia !== null && ` (minimo ${formatQuantita(m.soglia)})`}
              </p>
              {m.stato === "ordinato_scaduto" && m.ordinato_il && (
                <p className="text-xs text-terracotta">
                  Ordinato da {daysBetween(m.ordinato_il, oggi)} giorni, non è arrivato
                </p>
              )}
            </Link>
            <OrdinatoButton id={m.id} onDone={onDone} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Verificare**

Run: `npx tsc --noEmit` — Expected: pulito.
Run: `npx eslint src/app/api/dashboard/today/route.ts src/components/TodayBoard.tsx` — Expected: nessun errore nuovo (il progetto ha errori `any` preesistenti altrove, non in questi file).
Run: `npx jest --roots=src` — Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/dashboard/today/route.ts src/app/api/dashboard/today/__tests__/route.test.ts src/components/TodayBoard.tsx
git commit -m "feat(magazzino): sezione «Da riordinare» nella pagina Oggi

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentazione

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Aggiornare `CLAUDE.md`**

1. Nell'elenco delle migration, dopo la voce 12, aggiungere: `13. \`20261025000001_add_magazzino.sql\` — giacenza, scorta minima e impronte dei documenti dei materiali (applicata il <data in cui l'utente la applica>)`.
2. In «Decisioni chiave e motivazioni» aggiungere una riga «Magazzino dei materiali: giacenza, scorta minima, «Ho già ordinato» (2026-10-25)» con: motivo (la titolare vuole sapere quanti pezzi ha dei prodotti rivenduti uno a uno, non di tutti i materiali; i totali di fine anno non si potevano ricavare dal testo libero delle righe ordine), le scelte (opzione «Tieni in magazzino» per materiale; giacenza **calcolata** = carico + rettifica − venduto e non un contatore; carico dalle fatture con colonna «Carica» modificabile; caricamenti doppi riconosciuti da un'impronta SHA-256 invisibile registrata prima di scrivere e tolta se la scrittura fallisce; «Correggi giacenza»; scorta minima con «Da riordinare» in elenco e in «Oggi»; «Ho già ordinato» = pausa di 7 giorni poi l'avviso riparte), cosa resta fuori (scarico dagli ordini = Lavoro 2, riepilogo di fine anno = Lavoro 3), rimando a spec e piano.
3. In «Testing» aggiungere un punto «Feature (2026-10-25)» con i risultati reali (numeri da `npx jest --roots=src`, `tsc`, esito della prova reale del Task 10).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: magazzino dei materiali (giacenza, scorta minima, Ho già ordinato)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verifica reale

Questo task richiede la collaborazione dell'utente (migration). **Fermarsi e chiedere** al passo 1.

- [ ] **Step 1: Far applicare la migration**

Chiedere all'utente di incollare il contenuto di `supabase/migrations/20261025000001_add_magazzino.sql` nel **SQL Editor** del progetto Supabase **vero** (non il percorso del file: solo il SQL, a partire dalla riga `alter table public.materiali`). Poi verificare:

Run: `node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);Promise.all([c.from('materiali').select('in_magazzino,carico_totale,rettifica,soglia,ordinato_il').limit(1),c.from('documenti_caricati').select('id',{count:'exact',head:true})]).then(([a,b])=>console.log(JSON.stringify({materiali:a.error&&a.error.message,documenti:b.error&&b.error.message})))"`
Expected: `{"materiali":null,"documenti":null}`. Se compare un errore su colonna o tabella inesistente la migration non è applicata: non proseguire.

(`.env.local` non è nel worktree: copiarlo dalla cartella principale prima, senza stamparlo.)

- [ ] **Step 2: Spec Playwright temporaneo**

Creare `e2e/tmp-magazzino.spec.ts` (da cancellare a fine verifica). Usa la fattura FB Targhe già usata per la verifica dei materiali (foto fuori dal repository, contiene dati personali) e **ripristina lo stato** dei materiali FB e delle impronte a fine prova, perché sono dati veri.

```ts
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { getTestAuthCookies } from "./helpers/auth"

const FATTURA = process.env.FATTURA_PROVA!
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

let impronteDiPrima: string[] = []

test.use({ viewport: { width: 1400, height: 900 } })

test.beforeAll(async () => {
  const { data } = await admin().from("documenti_caricati").select("impronta")
  impronteDiPrima = (data ?? []).map((r) => r.impronta)
})

test.afterAll(async () => {
  const db = admin()
  await db.from("materiali").update({ in_magazzino: false, carico_totale: 0, rettifica: 0, soglia: null, ordinato_il: null }).ilike("fornitore", "F.B. s.n.c.%")
  const { data } = await db.from("documenti_caricati").select("impronta")
  for (const r of data ?? []) if (!impronteDiPrima.includes(r.impronta)) await db.from("documenti_caricati").delete().eq("impronta", r.impronta)
})

test.beforeEach(async ({ context }) => {
  await context.addCookies(await getTestAuthCookies())
})

test("carico, documento doppio, scorta minima, già ordinato e sezione Oggi", async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto("/materiali")

  // 1. Carico: caselle Magazzino accese con le quantità del documento (10, 5, 10, 5)
  await page.locator('input[type="file"]').setInputFiles(FATTURA)
  await expect(page.getByLabel("Fornitore")).not.toHaveValue("", { timeout: 100_000 })
  await expect(page.getByText("sembra già caricato")).toHaveCount(0)
  const caselle = page.getByLabel("Magazzino")
  await expect(caselle).toHaveCount(4)
  for (let i = 0; i < 4; i++) await caselle.nth(i).check()
  await expect(page.getByLabel("Carica")).toHaveCount(4)
  await page.getByRole("button", { name: "Conferma e salva" }).click()
  await expect(page.getByText(/Salvato:/)).toBeVisible()
  await expect(page.locator("table").getByText("In magazzino: 10").first()).toBeVisible()
  await page.screenshot({ path: "test-results/magazzino-carico.png", fullPage: true })

  // 2. Lo stesso documento: avviso e nessuna somma
  await page.locator('input[type="file"]').setInputFiles(FATTURA)
  await expect(page.getByLabel("Fornitore")).not.toHaveValue("", { timeout: 100_000 })
  await expect(page.getByText("sembra già caricato")).toBeVisible()
  await page.getByRole("button", { name: "Conferma e salva" }).click()
  await expect(page.getByText(/le quantità non sono state sommate/)).toBeVisible()
  await expect(page.locator("table").getByText("In magazzino: 20")).toHaveCount(0)

  // 3. Scorta minima 10 sul primo materiale: giacenza 10 → «Da riordinare»
  const riga = page.locator("table tbody tr").filter({ hasText: "Targa 003 Tutta Silver 20" }).first()
  await riga.getByRole("button", { name: "Modifica" }).click()
  await riga.getByLabel("Scorta minima").fill("10")
  await riga.getByRole("button", { name: "Salva" }).click()
  await expect(page.locator("table").getByText("Da riordinare").first()).toBeVisible()

  // 4. «Oggi» mostra la sezione
  await page.goto("/dashboard")
  await expect(page.getByText("Da riordinare", { exact: true })).toBeVisible()
  await page.screenshot({ path: "test-results/magazzino-oggi.png", fullPage: true })

  // 5. «Ho già ordinato» da «Oggi»: il materiale sparisce dalla sezione
  await page.getByRole("button", { name: "Ho già ordinato" }).first().click()
  await expect(page.getByText("Da riordinare", { exact: true })).toHaveCount(0)

  // 6. In elenco compare la nota «Ordinato il…»
  await page.goto("/materiali")
  await expect(page.locator("table").getByText(/Ordinato il .* in attesa/).first()).toBeVisible()

  // 7. Dopo 8 giorni l'avviso riparte
  const db = admin()
  const otto = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
  await db.from("materiali").update({ ordinato_il: otto }).ilike("fornitore", "F.B. s.n.c.%").eq("codice", "003553")
  await page.goto("/materiali")
  await expect(page.locator("table").getByText(/Ordinato da \d+ giorni, non è arrivato/).first()).toBeVisible()
  await page.goto("/dashboard")
  await expect(page.getByText(/Ordinato da \d+ giorni, non è arrivato/)).toBeVisible()
})

test("correggi giacenza", async ({ page }) => {
  await page.goto("/materiali")
  const riga = page.locator("table tbody tr").filter({ hasText: "Targa 011 Silver 20" }).first()
  await riga.getByRole("button", { name: "Modifica" }).click()
  await riga.getByLabel("Giacenza attuale").fill("7")
  await riga.getByRole("button", { name: "Salva" }).click()
  await expect(page.locator("table").getByText("In magazzino: 7").first()).toBeVisible()
})
```

Nota: se `process.env.NEXT_PUBLIC_SUPABASE_URL` risultasse vuoto nello spec, caricare l'ambiente come fa `e2e/helpers/auth.ts`. Se i selettori non trovano gli elementi perché in DOM esistono sia la tabella sia le schede (le schede sono `xl:hidden`), restare nella tabella come sopra (viewport 1400 px).

- [ ] **Step 3: Eseguirlo**

Run (da bash, un solo `next dev` attivo, porta 3000 libera): `FATTURA_PROVA="C:/Users/Olga/AppData/Local/Temp/claude/d--Documenti-Projects-oltre-la-bottega/67daec99-3cbb-40ba-b4d8-afbacde2436e/images/1.jpg" npx playwright test e2e/tmp-magazzino.spec.ts --project=chromium`
Expected: entrambi i test passano. Guardare **a occhio** gli screenshot in `test-results/`: nell'elenco «In magazzino: 10 / 5 / 10 / 5»; in «Oggi» la sezione «Da riordinare» con il materiale, la giacenza e «(minimo 10)».

Se un passaggio fallisce, **non correggere a caso**: riportare cosa ha mostrato la pagina.

- [ ] **Step 4: Pulizia e controllo dei residui**

Cancellare `e2e/tmp-magazzino.spec.ts` e `test-results/`. Il ripristino automatico (`afterAll`) riporta i materiali FB Targhe a «non in magazzino». Verifica indipendente:

Run: `node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);Promise.all([c.from('materiali').select('nome,in_magazzino,carico_totale,rettifica,soglia,ordinato_il').or('in_magazzino.eq.true,carico_totale.neq.0,rettifica.neq.0,soglia.not.is.null,ordinato_il.not.is.null'),c.from('documenti_caricati').select('id',{count:'exact',head:true})]).then(([a,b])=>console.log(JSON.stringify({materialiConMagazzino:a.data,impronte:b.count})))"`
Expected: `{"materialiConMagazzino":[],"impronte":0}`.

- [ ] **Step 5: Aggiornare la riga «Testing» di `CLAUDE.md`** con l'esito reale di questa verifica e fare un commit `docs: esito della verifica del magazzino`.

---

## Auto-revisione (copertura del design)

| Requisito del design | Task |
|---|---|
| Opzione «Tieni in magazzino» per materiale | 1, 4 (`in_magazzino`), 6 (casella), 7 (modulo di modifica) |
| Giacenza calcolata (carico + rettifica − venduto) | 2 (`computeStock`), 4 |
| Carico dalla tabella di controllo, colonna «Carica» modificabile | 6 |
| Caricamenti doppi: impronta, avviso, «Carica comunque», prezzi aggiornati comunque | 1, 3, 4, 5, 6 |
| Ordine delle operazioni (impronta prima, tolta se la scrittura fallisce) | 4 |
| «Correggi giacenza» | 2 (`rettificaPerGiacenza`), 4 (`setStock`), 7 |
| Scorta minima + stato «Da riordinare» | 1, 2 (`reorderStatus`), 4 (`soglia`), 7 |
| «Ho già ordinato»: 7 giorni, poi l'avviso riparte, si cancella al carico | 2, 4 (`markOrdered`, azzeramento al carico), 7, 8 |
| Elenco Materiali (tabella e schede) con «In magazzino» e avviso | 7 |
| Sezione «Da riordinare» in «Oggi» | 8 |
| Errori e validazione | 4 (validazione `carica`, `soglia`, `setStock`), 6 |
| Test Jest + prova reale con ripristino | 2–5, 8, 10 |
| Migration prima del deploy | 1 (nota), 10 (passo 1) |

**Deviazioni dal design, già dichiarate nell'intestazione:** nessuna `getStockOverview()`; impronta in un file separato lato server; campi nuovi di `saveMaterials` facoltativi.
