# Materiali con lettura automatica dei documenti — Piano di implementazione

> **Per chi esegue (agenti):** SOTTO-SKILL OBBLIGATORIA: usare `superpowers:subagent-driven-development` (consigliata) oppure `superpowers:executing-plans` per eseguire questo piano task per task. I passi usano la sintassi con caselle (`- [ ]`) per tenere traccia dell'avanzamento.

**Obiettivo:** una pagina "Materiali" (solo livello completo) con il listino dei costi di acquisto, che si riempie caricando un PDF o una foto del fornitore (lettura automatica con Claude, controllo umano, poi salvataggio) oppure a mano.

**Architettura:** funzioni pure e testate (`src/lib/materiali.ts`, `src/lib/documentoFornitore.ts`) per abbinamento, storico prezzi e validazione; server action per leggere il documento (`extractDocument`, non salva nulla) e per salvare (`saveMaterials`); una tabella `materiali` senza storico completo (solo prezzo attuale e precedente con le rispettive date); UI con tabella di controllo prima del salvataggio.

**Stack:** Next.js 16 (server actions), Supabase, Jest/ts-jest, Playwright (solo verifica temporanea), `@anthropic-ai/sdk` (unica dipendenza nuova).

**Design di riferimento:** `docs/superpowers/specs/2026-10-24-materiali-lettura-documenti-design.md`.

**Come eseguire:** il piano si esegue in un worktree creato da `main` (dopo il commit di spec e piano). I test unitari si lanciano **sempre** con `npx jest --roots=src ...` (il `jest` senza scoping raccoglie anche gli spec Playwright, vedere CLAUDE.md).

**Scelte fissate nel piano (aggiornano il design, riportate anche lì):**
- Il salvataggio non può essere una transazione unica con il client Supabase (un `insert` e un `upsert`, due chiamate). È però **idempotente**: se la seconda chiamata fallisce, rilanciare lo stesso salvataggio dà "Invariato" per le righe già scritte e completa le altre.
- La modifica a mano di un materiale è una **correzione diretta** dei campi (nome, unità, prezzo attuale, prezzo precedente), senza logica di storico: serve a correggere errori di battitura, non a registrare un acquisto.
- La voce di menu "Materiali" compare **solo nella barra laterale** (tablet/PC). La barra in basso del telefono ha già 8 voci e resta com'è.

---

## Mappa dei file

| File | Azione | Responsabilità |
|---|---|---|
| `src/lib/plan.ts` | modifica | nuova funzione `materiali` spenta nel base |
| `src/lib/__tests__/plan.test.ts` | modifica | la mappa `ALL_FEATURES_MAP` include `materiali` |
| `src/lib/materiali.ts` | nuovo | tipi, abbinamento, aggiornamento prezzo, controllo riga, variazione, parsing/format prezzi, ricerca, date |
| `src/lib/__tests__/materiali.test.ts` | nuovo | test delle funzioni sopra |
| `src/lib/documentoFornitore.ts` | nuovo | costanti dei file ammessi, tipo `DocumentoLetto`, `parseExtraction` (validazione dell'output di Claude) |
| `src/lib/__tests__/documentoFornitore.test.ts` | nuovo | test di `parseExtraction` |
| `supabase/migrations/20261024000001_add_materiali.sql` | nuovo | tabella `materiali`, indici, trigger, RLS |
| `src/lib/testUtils/supabaseMock.ts` | modifica | aggiunge `upsert` al finto query builder |
| `src/actions/materiali.ts` | nuovo | `getMaterials`, `saveMaterials`, `updateMaterial`, `deleteMaterial` |
| `src/actions/__tests__/materiali.test.ts` | nuovo | test delle azioni |
| `src/lib/documentReader.ts` | nuovo | chiamata a Claude (visione + schema fisso) |
| `src/actions/materialiDocumento.ts` | nuovo | `extractDocument` (validazione file, autenticazione, chiamata al lettore) |
| `src/actions/__tests__/materialiDocumento.test.ts` | nuovo | test di `extractDocument` col lettore finto |
| `src/lib/imageResize.ts` | nuovo | riduzione delle foto nel browser prima dell'invio |
| `next.config.ts` | modifica | `serverActions.bodySizeLimit` a 4 MB |
| `.env.example` | modifica | `ANTHROPIC_API_KEY`, `MATERIALI_MODEL` |
| `src/components/MaterialiImport.tsx` | nuovo | bottoni, caricamento, tabella di controllo, conferma |
| `src/components/MaterialeRowActions.tsx` | nuovo | modifica/elimina di un materiale |
| `src/app/(dashboard)/materiali/page.tsx` | nuovo | elenco con ricerca |
| `src/components/nav/Sidebar.tsx` | modifica | voce "Materiali" |
| `CLAUDE.md` | modifica | decisione, migration, testing |

---

### Task 1: Funzione `materiali` nel sistema dei livelli

**Files:**
- Modify: `src/lib/plan.ts`
- Test: `src/lib/__tests__/plan.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/lib/__tests__/plan.test.ts`, nella mappa `ALL_FEATURES_MAP`, aggiungere la riga dopo `calcolatrice: true,`:

```ts
  calcolatrice: true,
  materiali: true,
}
```

(La mappa è `Record<Feature, true>`: finché `materiali` non è nel tipo `Feature`, `ts-jest` segnala un errore di tipo.)

- [ ] **Step 2: Verificare che fallisca**

Run: `npx jest --roots=src src/lib/__tests__/plan.test.ts`
Expected: FAIL con un errore di tipo del tipo `Object literal may only specify known properties, and 'materiali' does not exist in type 'Record<Feature, true>'`.

- [ ] **Step 3: Implementare**

In `src/lib/plan.ts`, aggiungere al tipo `Feature` dopo `| "calcolatrice"`:

```ts
  | "calcolatrice"
  | "materiali" // pagina Materiali (listino costi con lettura dei documenti del fornitore)
```

e nell'insieme `OFF_IN_BASE` aggiungere `"materiali",` dopo `"calcolatrice",`:

```ts
  "calcolatrice",
  "materiali",
])
```

- [ ] **Step 4: Verificare che passi**

Run: `npx jest --roots=src src/lib/__tests__/plan.test.ts`
Expected: PASS (tutti i test, compresi "nel livello base ogni funzione avanzata è spenta" e "nel livello completo ogni funzione è attiva" che ora coprono anche `materiali`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan.ts src/lib/__tests__/plan.test.ts
git commit -m "feat(materiali): nuova funzione 'materiali' solo nel livello completo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regole di calcolo dei materiali (funzioni pure)

**Files:**
- Create: `src/lib/materiali.ts`
- Test: `src/lib/__tests__/materiali.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/__tests__/materiali.test.ts`:

```ts
import {
  normalizeText,
  matchMaterial,
  applyPriceUpdate,
  checkRow,
  priceVariation,
  classifyRow,
  parsePrice,
  formatPrezzo,
  matchesSearch,
  isValidIsoDate,
  todayIso,
  type Materiale,
} from "../materiali"

const base: Materiale = {
  id: "m1",
  fornitore: "FB Targhe",
  codice: "003553",
  nome: "Targa 003 Tutta Silver 20x15",
  unita: "Nr.",
  prezzo_attuale: 14.38,
  data_acquisto_attuale: "2025-10-29",
  prezzo_precedente: null,
  data_acquisto_precedente: null,
}

describe("normalizeText", () => {
  it("toglie maiuscole e spazi in eccesso", () => {
    expect(normalizeText("  FB   Targhe ")).toBe("fb targhe")
  })

  it("trasforma null e undefined in stringa vuota", () => {
    expect(normalizeText(null)).toBe("")
    expect(normalizeText(undefined)).toBe("")
  })
})

describe("matchMaterial", () => {
  it("abbina per fornitore + codice ignorando maiuscole e spazi", () => {
    const trovato = matchMaterial([base], " fb  targhe ", { codice: " 003553", nome: "altro nome" })
    expect(trovato?.id).toBe("m1")
  })

  it("non abbina lo stesso codice di un altro fornitore", () => {
    expect(matchMaterial([base], "Altro Fornitore", { codice: "003553", nome: base.nome })).toBeNull()
  })

  it("non abbina un codice diverso anche se il nome è uguale, quando il materiale ha già un codice", () => {
    expect(matchMaterial([base], "FB Targhe", { codice: "999999", nome: base.nome })).toBeNull()
  })

  it("abbina per nome se il materiale salvato non ha codice e la riga ne porta uno", () => {
    const senzaCodice: Materiale = { ...base, codice: null }
    expect(matchMaterial([senzaCodice], "FB Targhe", { codice: "003553", nome: base.nome })?.id).toBe("m1")
  })

  it("senza codice sulla riga abbina per nome", () => {
    expect(matchMaterial([base], "FB Targhe", { codice: null, nome: "TARGA 003  tutta silver 20x15" })?.id).toBe("m1")
  })

  it("senza codice e con nome diverso non abbina", () => {
    expect(matchMaterial([base], "FB Targhe", { codice: null, nome: "Targa 011" })).toBeNull()
  })
})

describe("applyPriceUpdate", () => {
  it("stesso prezzo e data più recente: avanza solo la data attuale, il precedente non cambia", () => {
    const m = { ...base, prezzo_precedente: 13.9, data_acquisto_precedente: "2025-05-12" }
    const r = applyPriceUpdate(m, { prezzo: 14.38, data: "2025-12-01" })
    expect(r.prezzo_attuale).toBe(14.38)
    expect(r.data_acquisto_attuale).toBe("2025-12-01")
    expect(r.prezzo_precedente).toBe(13.9)
    expect(r.data_acquisto_precedente).toBe("2025-05-12")
  })

  it("prezzo diverso e data più recente: l'attuale diventa precedente", () => {
    const r = applyPriceUpdate(base, { prezzo: 15.1, data: "2026-01-10" })
    expect(r).toEqual({
      prezzo_attuale: 15.1,
      data_acquisto_attuale: "2026-01-10",
      prezzo_precedente: 14.38,
      data_acquisto_precedente: "2025-10-29",
    })
  })

  it("prezzo diverso nello stesso giorno: l'attuale diventa precedente", () => {
    const r = applyPriceUpdate(base, { prezzo: 15, data: "2025-10-29" })
    expect(r.prezzo_attuale).toBe(15)
    expect(r.prezzo_precedente).toBe(14.38)
  })

  it("stesso prezzo e stessa data: nessuna modifica", () => {
    expect(applyPriceUpdate(base, { prezzo: 14.38, data: "2025-10-29" })).toEqual({
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2025-10-29",
      prezzo_precedente: null,
      data_acquisto_precedente: null,
    })
  })

  it("considera uguali prezzi che differiscono meno di mezzo millesimo", () => {
    const r = applyPriceUpdate(base, { prezzo: 14.3800001, data: "2025-10-29" })
    expect(r.prezzo_precedente).toBeNull()
  })

  it("data più vecchia e nessun precedente: il prezzo entra come precedente, l'attuale resta", () => {
    const r = applyPriceUpdate(base, { prezzo: 13.5, data: "2025-03-01" })
    expect(r.prezzo_attuale).toBe(14.38)
    expect(r.data_acquisto_attuale).toBe("2025-10-29")
    expect(r.prezzo_precedente).toBe(13.5)
    expect(r.data_acquisto_precedente).toBe("2025-03-01")
  })

  it("data più vecchia ma meno recente del precedente già presente: nessuna modifica", () => {
    const m = { ...base, prezzo_precedente: 13.9, data_acquisto_precedente: "2025-06-01" }
    expect(applyPriceUpdate(m, { prezzo: 12, data: "2025-02-01" })).toEqual({
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2025-10-29",
      prezzo_precedente: 13.9,
      data_acquisto_precedente: "2025-06-01",
    })
  })

  it("data più vecchia dell'attuale ma più recente del precedente: sostituisce il precedente", () => {
    const m = { ...base, prezzo_precedente: 13.9, data_acquisto_precedente: "2025-03-01" }
    const r = applyPriceUpdate(m, { prezzo: 14.1, data: "2025-08-01" })
    expect(r.prezzo_precedente).toBe(14.1)
    expect(r.data_acquisto_precedente).toBe("2025-08-01")
    expect(r.prezzo_attuale).toBe(14.38)
  })

  it("data più vecchia con prezzo uguale all'attuale: nessuna modifica", () => {
    const r = applyPriceUpdate(base, { prezzo: 14.38, data: "2025-03-01" })
    expect(r.prezzo_precedente).toBeNull()
  })
})

describe("checkRow", () => {
  it("true quando quantità × prezzo coincide con l'importo", () => {
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: 143.8 })).toBe(true)
    expect(checkRow({ quantita: 5, prezzo: 23.05, importo: 115.25 })).toBe(true)
  })

  it("false quando non coincide", () => {
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: 150 })).toBe(false)
  })

  it("tollera un centesimo di differenza ma non cinque", () => {
    expect(checkRow({ quantita: 10, prezzo: 14.381, importo: 143.8 })).toBe(true)
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: 143.85 })).toBe(false)
  })

  it("true quando mancano quantità o importo (nulla da controllare)", () => {
    expect(checkRow({ quantita: null, prezzo: 14.38, importo: 143.8 })).toBe(true)
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: null })).toBe(true)
  })
})

describe("priceVariation", () => {
  it("calcola la variazione percentuale con segno", () => {
    expect(priceVariation(15.1, 14.38)).toBeCloseTo(5.007, 2)
    expect(priceVariation(13, 14.38)).toBeCloseTo(-9.597, 2)
  })

  it("null se manca il precedente o è zero", () => {
    expect(priceVariation(15, null)).toBeNull()
    expect(priceVariation(15, 0)).toBeNull()
  })
})

describe("classifyRow", () => {
  const riga = { codice: "003553", nome: base.nome, unita: "Nr.", quantita: 10, prezzo: 14.38, importo: 143.8 }

  it("nuovo se non esiste ancora", () => {
    expect(classifyRow([], "FB Targhe", riga)).toEqual({ tipo: "nuovo" })
  })

  it("invariato se il prezzo è uguale all'attuale", () => {
    expect(classifyRow([base], "FB Targhe", riga)).toEqual({ tipo: "invariato" })
  })

  it("variato (con il prezzo di prima) se il prezzo è diverso", () => {
    expect(classifyRow([base], "FB Targhe", { ...riga, prezzo: 15.1 })).toEqual({ tipo: "variato", era: 14.38 })
  })
})

describe("parsePrice", () => {
  it("legge virgola e punto decimale", () => {
    expect(parsePrice("14,380")).toBeCloseTo(14.38, 5)
    expect(parsePrice("14.38")).toBeCloseTo(14.38, 5)
  })

  it("legge il formato italiano con le migliaia", () => {
    expect(parsePrice("1.234,56")).toBeCloseTo(1234.56, 5)
  })

  it("ignora spazi e simbolo dell'euro", () => {
    expect(parsePrice(" € 14,38 ")).toBeCloseTo(14.38, 5)
  })

  it("null per vuoto, testo o negativo", () => {
    expect(parsePrice("")).toBeNull()
    expect(parsePrice("abc")).toBeNull()
    expect(parsePrice("-3")).toBeNull()
  })
})

describe("formatPrezzo", () => {
  it("mostra almeno due decimali e al massimo tre, con la virgola", () => {
    expect(formatPrezzo(14.38)).toBe("14,38")
    expect(formatPrezzo(14.375)).toBe("14,375")
    expect(formatPrezzo(5)).toBe("5,00")
    expect(formatPrezzo(0.5)).toBe("0,50")
  })
})

describe("matchesSearch", () => {
  it("cerca in fornitore, codice e nome senza badare a maiuscole", () => {
    expect(matchesSearch(base, "fb")).toBe(true)
    expect(matchesSearch(base, "003553")).toBe(true)
    expect(matchesSearch(base, "SILVER")).toBe(true)
    expect(matchesSearch(base, "ottone")).toBe(false)
  })

  it("ricerca vuota: true", () => {
    expect(matchesSearch(base, "  ")).toBe(true)
  })
})

describe("isValidIsoDate", () => {
  it("accetta solo date vere in formato AAAA-MM-GG", () => {
    expect(isValidIsoDate("2025-10-29")).toBe(true)
    expect(isValidIsoDate("2025-13-45")).toBe(false)
    expect(isValidIsoDate("2025-02-30")).toBe(false)
    expect(isValidIsoDate("29/10/2025")).toBe(false)
    expect(isValidIsoDate("")).toBe(false)
  })
})

describe("todayIso", () => {
  it("usa il calendario di Roma, non quello UTC", () => {
    // 22:30 UTC del 24 ottobre 2026 = 00:30 del 25 a Roma (ora legale ancora attiva)
    expect(todayIso(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25")
    expect(todayIso(new Date("2026-10-24T12:00:00Z"))).toBe("2026-10-24")
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest --roots=src src/lib/__tests__/materiali.test.ts`
Expected: FAIL con `Cannot find module '../materiali'`.

- [ ] **Step 3: Implementare**

Creare `src/lib/materiali.ts`:

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

export type PrezziMateriale = Pick<
  Materiale,
  "prezzo_attuale" | "data_acquisto_attuale" | "prezzo_precedente" | "data_acquisto_precedente"
>

/** Una riga letta da un documento del fornitore (o scritta a mano). */
export type RigaDocumento = {
  codice: string | null
  nome: string
  unita: string | null
  quantita: number | null
  prezzo: number
  importo: number | null
}

export type StatoRiga =
  | { tipo: "nuovo" }
  | { tipo: "invariato" }
  | { tipo: "variato"; era: number }

const EPSILON_PREZZO = 0.0005

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Trova il materiale già salvato a cui corrisponde una riga: stesso fornitore e
 * stesso codice. Se la riga ha un codice ma nessun materiale lo ha, si prova per
 * nome tra quelli senza codice (inseriti a mano). Se la riga non ha codice, si
 * abbina per nome.
 */
export function matchMaterial(
  esistenti: Materiale[],
  fornitore: string,
  riga: Pick<RigaDocumento, "codice" | "nome">
): Materiale | null {
  const f = normalizeText(fornitore)
  const candidati = esistenti.filter((m) => normalizeText(m.fornitore) === f)
  const codice = normalizeText(riga.codice)
  const nome = normalizeText(riga.nome)
  if (codice) {
    return (
      candidati.find((m) => normalizeText(m.codice) === codice) ??
      candidati.find((m) => !normalizeText(m.codice) && normalizeText(m.nome) === nome) ??
      null
    )
  }
  return candidati.find((m) => normalizeText(m.nome) === nome) ?? null
}

function stessoPrezzo(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON_PREZZO
}

/**
 * Registra un nuovo acquisto sul materiale. L'attuale è sempre quello con la
 * data più recente: caricare una fattura vecchia dopo una nuova non sovrascrive
 * il prezzo attuale.
 */
export function applyPriceUpdate(
  m: PrezziMateriale,
  nuovo: { prezzo: number; data: string }
): PrezziMateriale {
  const { prezzo, data } = nuovo
  const uguale = stessoPrezzo(prezzo, m.prezzo_attuale)

  if (data >= m.data_acquisto_attuale) {
    if (uguale) return { ...pick(m), data_acquisto_attuale: data }
    return {
      prezzo_attuale: prezzo,
      data_acquisto_attuale: data,
      prezzo_precedente: m.prezzo_attuale,
      data_acquisto_precedente: m.data_acquisto_attuale,
    }
  }

  // Acquisto più vecchio di quello attuale: tocca al massimo il precedente.
  if (uguale) return pick(m)
  if (m.data_acquisto_precedente === null || data > m.data_acquisto_precedente) {
    return { ...pick(m), prezzo_precedente: prezzo, data_acquisto_precedente: data }
  }
  return pick(m)
}

function pick(m: PrezziMateriale): PrezziMateriale {
  return {
    prezzo_attuale: m.prezzo_attuale,
    data_acquisto_attuale: m.data_acquisto_attuale,
    prezzo_precedente: m.prezzo_precedente,
    data_acquisto_precedente: m.data_acquisto_precedente,
  }
}

/** true se quantità × prezzo coincide con l'importo (tolleranza 1 centesimo); true se manca un dato da confrontare. */
export function checkRow(riga: Pick<RigaDocumento, "quantita" | "prezzo" | "importo">): boolean {
  if (riga.quantita === null || riga.importo === null) return true
  return Math.abs(riga.quantita * riga.prezzo - riga.importo) <= 0.01 + 1e-9
}

/** Variazione percentuale tra precedente e attuale; null se non calcolabile. */
export function priceVariation(attuale: number, precedente: number | null): number | null {
  if (precedente === null || precedente === 0) return null
  return ((attuale - precedente) / precedente) * 100
}

export function classifyRow(
  esistenti: Materiale[],
  fornitore: string,
  riga: RigaDocumento
): StatoRiga {
  const m = matchMaterial(esistenti, fornitore, riga)
  if (!m) return { tipo: "nuovo" }
  if (stessoPrezzo(riga.prezzo, m.prezzo_attuale)) return { tipo: "invariato" }
  return { tipo: "variato", era: m.prezzo_attuale }
}

/** Legge un prezzo scritto da una persona ("14,380", "1.234,56", "€ 14.38"). null se non valido. */
export function parsePrice(value: string): number | null {
  let s = value.replace(/\s/g, "").replace("€", "")
  if (!s) return null
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Almeno 2 e al massimo 3 decimali, con la virgola: 14,38 · 14,375 · 5,00 */
export function formatPrezzo(value: number): string {
  return value.toFixed(3).replace(/0$/, "").replace(".", ",")
}

export function matchesSearch(m: Pick<Materiale, "fornitore" | "codice" | "nome">, query: string): boolean {
  const q = normalizeText(query)
  if (!q) return true
  return normalizeText(`${m.fornitore} ${m.codice ?? ""} ${m.nome}`).includes(q)
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Oggi nel calendario di Roma, come AAAA-MM-GG. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(now)
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest --roots=src src/lib/__tests__/materiali.test.ts`
Expected: PASS, tutti i test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/lib/materiali.ts src/lib/__tests__/materiali.test.ts
git commit -m "feat(materiali): regole di abbinamento e storico prezzi (funzioni pure)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Validazione dell'output di Claude e costanti dei file

**Files:**
- Create: `src/lib/documentoFornitore.ts`
- Test: `src/lib/__tests__/documentoFornitore.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/lib/__tests__/documentoFornitore.test.ts`:

```ts
import { parseExtraction, SUPPORTED_MEDIA_TYPES, MAX_FILE_BYTES } from "../documentoFornitore"

describe("costanti", () => {
  it("ammette PDF e immagini comuni", () => {
    expect(SUPPORTED_MEDIA_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"])
  })

  it("il limite sta sotto i 4,5 MB delle richieste Vercel", () => {
    expect(MAX_FILE_BYTES).toBeLessThan(4.5 * 1024 * 1024)
  })
})

describe("parseExtraction", () => {
  const valido = {
    fornitore: "F.B. s.n.c. di Busato Martino e Matteo",
    data: "2025-10-29",
    righe: [
      { codice: "003553", nome: "Targa 003 Tutta Silver 20x15", unita: "Nr.", quantita: 10, prezzo: 14.38, importo: 143.8 },
      { codice: "011502", nome: "Targa 011 Silver 17x12 cm", unita: "Nr.", quantita: 5, prezzo: 10.86, importo: 54.3 },
    ],
  }

  it("restituisce fornitore, data e righe quando tutto è corretto", () => {
    expect(parseExtraction(valido)).toEqual(valido)
  })

  it("scarta le righe senza nome o senza prezzo valido", () => {
    const r = parseExtraction({
      ...valido,
      righe: [
        { codice: "1", nome: "", prezzo: 5 },
        { codice: "2", nome: "Senza prezzo" },
        { codice: "3", nome: "Prezzo testo", prezzo: "5" },
        { codice: "4", nome: "Prezzo negativo", prezzo: -1 },
        { codice: "5", nome: "Buona", prezzo: 5 },
        "non un oggetto",
        null,
      ],
    })
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].nome).toBe("Buona")
  })

  it("trasforma campi mancanti o vuoti in null", () => {
    const r = parseExtraction({ fornitore: "X", data: null, righe: [{ nome: "A", prezzo: 1, codice: "  ", unita: "" }] })
    expect(r.righe[0]).toEqual({ codice: null, nome: "A", unita: null, quantita: null, prezzo: 1, importo: null })
  })

  it("accetta un codice scritto come numero", () => {
    const r = parseExtraction({ fornitore: "X", righe: [{ nome: "A", prezzo: 1, codice: 3553 }] })
    expect(r.righe[0].codice).toBe("3553")
  })

  it("data non valida diventa null", () => {
    expect(parseExtraction({ ...valido, data: "29/10/2025" }).data).toBeNull()
    expect(parseExtraction({ ...valido, data: "2025-13-45" }).data).toBeNull()
  })

  it("input non utilizzabile: documento vuoto", () => {
    const vuoto = { fornitore: "", data: null, righe: [] }
    expect(parseExtraction(null)).toEqual(vuoto)
    expect(parseExtraction("testo")).toEqual(vuoto)
    expect(parseExtraction({ righe: "no" })).toEqual(vuoto)
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest --roots=src src/lib/__tests__/documentoFornitore.test.ts`
Expected: FAIL con `Cannot find module '../documentoFornitore'`.

- [ ] **Step 3: Implementare**

Creare `src/lib/documentoFornitore.ts`:

```ts
import { isValidIsoDate, type RigaDocumento } from "@/lib/materiali"

export const SUPPORTED_MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number]

// Le richieste verso Vercel hanno un tetto di 4,5 MB: si resta sotto, lasciando margine al FormData.
export const MAX_FILE_BYTES = 4_000_000

export type DocumentoLetto = {
  fornitore: string
  data: string | null // AAAA-MM-GG
  righe: RigaDocumento[]
}

function toNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function toTextOrNull(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  if (typeof v !== "string") return null
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Convalida l'output di Claude: non ci si fida del formato. Scarta le righe
 * inutilizzabili e restituisce sempre un documento ben formato (al limite vuoto).
 */
export function parseExtraction(raw: unknown): DocumentoLetto {
  const vuoto: DocumentoLetto = { fornitore: "", data: null, righe: [] }
  if (!raw || typeof raw !== "object") return vuoto
  const r = raw as Record<string, unknown>

  const righe: RigaDocumento[] = []
  if (Array.isArray(r.righe)) {
    for (const item of r.righe) {
      if (!item || typeof item !== "object") continue
      const i = item as Record<string, unknown>
      const nome = toTextOrNull(i.nome)
      const prezzo = toNumberOrNull(i.prezzo)
      if (!nome || prezzo === null || prezzo < 0) continue
      righe.push({
        codice: toTextOrNull(i.codice),
        nome,
        unita: toTextOrNull(i.unita),
        quantita: toNumberOrNull(i.quantita),
        prezzo,
        importo: toNumberOrNull(i.importo),
      })
    }
  }

  const data = typeof r.data === "string" && isValidIsoDate(r.data) ? r.data : null
  return { fornitore: toTextOrNull(r.fornitore) ?? "", data, righe }
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest --roots=src src/lib/__tests__/documentoFornitore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentoFornitore.ts src/lib/__tests__/documentoFornitore.test.ts
git commit -m "feat(materiali): convalida dell'output di lettura dei documenti

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Migration della tabella `materiali`

**Files:**
- Create: `supabase/migrations/20261024000001_add_materiali.sql`

- [ ] **Step 1: Scrivere la migration**

```sql
-- Listino costi dei materiali: una riga per materiale, con prezzo attuale e
-- prezzo precedente (ciascuno con la data di acquisto). Nessuno storico completo,
-- nessuna tabella acquisti. Si riempie leggendo i documenti dei fornitori o a mano.

create table public.materiali (
  id uuid primary key default gen_random_uuid(),
  fornitore text not null,
  codice text,
  nome text not null,
  unita text,
  prezzo_attuale numeric(12,3) not null check (prezzo_attuale >= 0),
  data_acquisto_attuale date not null,
  prezzo_precedente numeric(12,3) check (prezzo_precedente >= 0),
  data_acquisto_precedente date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un codice è unico per fornitore (confronto senza maiuscole né spazi ai lati).
create unique index materiali_fornitore_codice_key
  on public.materiali (lower(btrim(fornitore)), lower(btrim(codice)))
  where codice is not null and btrim(codice) <> '';

create index materiali_nome_idx on public.materiali (lower(nome));

create trigger materiali_updated_at before update on public.materiali
  for each row execute function public.handle_updated_at();

alter table public.materiali enable row level security;
create policy "auth_all" on public.materiali for all using (auth.uid() is not null);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261024000001_add_materiali.sql
git commit -m "feat(materiali): migration della tabella materiali

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Nota:** la migration non è ancora applicata. L'applicazione su Supabase avviene a mano (Task 9, passo 1) e **deve essere fatta prima del deploy**: una colonna o tabella mancante ha già bloccato il salvataggio degli ordini per 5 giorni (vedere memoria `feedback_migration_before_deploy`).

---

### Task 5: Azioni di salvataggio, lettura, modifica ed eliminazione

**Files:**
- Modify: `src/lib/testUtils/supabaseMock.ts`
- Create: `src/actions/materiali.ts`
- Test: `src/actions/__tests__/materiali.test.ts`

- [ ] **Step 1: Aggiungere `upsert` al finto query builder**

In `src/lib/testUtils/supabaseMock.ts`, nell'elenco `CHAIN_METHODS`, aggiungere `"upsert"`:

```ts
const CHAIN_METHODS = [
  "select", "insert", "update", "delete", "upsert",
  "eq", "neq", "or", "lt", "lte", "gte", "not", "ilike", "order",
] as const
```

- [ ] **Step 2: Scrivere i test che falliscono**

Creare `src/actions/__tests__/materiali.test.ts`:

```ts
import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

import { getMaterials, saveMaterials, updateMaterial, deleteMaterial } from "../materiali"

const riga = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  fornitore: "FB Targhe",
  codice: "003553",
  nome: "Targa 003 Tutta Silver 20x15",
  unita: "Nr.",
  prezzo_attuale: "14.380", // Supabase può restituire i numeric come stringhe
  data_acquisto_attuale: "2025-10-29",
  prezzo_precedente: null,
  data_acquisto_precedente: null,
  ...over,
})

const input = (righe: Array<Record<string, unknown>>, over: Record<string, unknown> = {}) => ({
  fornitore: "FB Targhe",
  data: "2026-01-10",
  righe: righe.map((r) => ({ codice: null, unita: null, ...r })),
  ...over,
}) as Parameters<typeof saveMaterials>[0]

describe("getMaterials", () => {
  afterEach(() => jest.clearAllMocks())

  it("converte i prezzi in numeri", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ materiali: [{ data: [riga({ prezzo_precedente: "13.900", data_acquisto_precedente: "2025-05-12" })], error: null }] })
    )
    const [m] = await getMaterials()
    expect(m.prezzo_attuale).toBe(14.38)
    expect(m.prezzo_precedente).toBe(13.9)
  })

  it("lancia un errore generico se la query fallisce", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    await expect(getMaterials()).rejects.toThrow()
  })
})

describe("saveMaterials", () => {
  afterEach(() => jest.clearAllMocks())

  it("rifiuta dati non validi senza toccare il database", async () => {
    const r1 = await saveMaterials(input([{ nome: "A", prezzo: 1 }], { fornitore: "  " }))
    const r2 = await saveMaterials(input([{ nome: "A", prezzo: 1 }], { data: "10/01/2026" }))
    const r3 = await saveMaterials(input([]))
    const r4 = await saveMaterials(input([{ nome: " ", prezzo: 1 }]))
    const r5 = await saveMaterials(input([{ nome: "A", prezzo: -2 }]))
    for (const r of [r1, r2, r3, r4, r5]) expect(r.ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("rifiuta se non c'è un utente autenticato", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({}, { user: null }))
    const r = await saveMaterials(input([{ nome: "A", prezzo: 1 }]))
    expect(r.ok).toBe(false)
  })

  it("inserisce i materiali nuovi", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(
      input([
        { codice: "003553", nome: "Targa 003 20x15", unita: "Nr.", prezzo: 14.38 },
        { codice: "003554", nome: "Targa 003 24x18", unita: "Nr.", prezzo: 23.05 },
      ])
    )

    expect(r).toEqual({ ok: true, nuovi: 2, aggiornati: 0 })
    const inseriti = client.from.mock.results[1].value.insert.mock.calls[0][0]
    expect(inseriti).toHaveLength(2)
    expect(inseriti[0]).toMatchObject({
      fornitore: "FB Targhe",
      codice: "003553",
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2026-01-10",
      prezzo_precedente: null,
      data_acquisto_precedente: null,
    })
    expect(inseriti[0]).not.toHaveProperty("id")
  })

  it("aggiorna un materiale esistente con prezzo diverso e sposta l'attuale in precedente", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [riga()], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([{ codice: "003553", nome: "Targa 003 20x15", prezzo: 15.1 }]))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1 })
    expect(client.from).toHaveBeenCalledTimes(2) // lettura + upsert, nessun insert
    const aggiornati = client.from.mock.results[1].value.upsert.mock.calls[0][0]
    expect(aggiornati).toEqual([
      expect.objectContaining({
        id: "m1",
        prezzo_attuale: 15.1,
        data_acquisto_attuale: "2026-01-10",
        prezzo_precedente: 14.38,
        data_acquisto_precedente: "2025-10-29",
      }),
    ])
  })

  it("non scrive nulla se prezzo e data sono già quelli salvati (ricaricare lo stesso documento è sicuro)", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [riga()], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(
      input([{ codice: "003553", nome: "Targa 003 20x15", prezzo: 14.38 }], { data: "2025-10-29" })
    )

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 0 })
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it("completa il codice mancante di un materiale inserito a mano", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [riga({ codice: null })], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([{ codice: "003553", nome: "Targa 003 Tutta Silver 20x15", prezzo: 14.38 }], { data: "2025-10-29" }))

    const aggiornati = client.from.mock.results[1].value.upsert.mock.calls[0][0]
    expect(aggiornati[0]).toMatchObject({ id: "m1", codice: "003553" })
  })

  it("lo stesso codice due volte nello stesso documento dà un solo materiale", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(
      input([
        { codice: "A1", nome: "Articolo", prezzo: 10 },
        { codice: "A1", nome: "Articolo", prezzo: 12 },
      ])
    )

    expect(r).toEqual({ ok: true, nuovi: 1, aggiornati: 0 })
    const inseriti = client.from.mock.results[1].value.insert.mock.calls[0][0]
    expect(inseriti).toHaveLength(1)
    expect(inseriti[0]).toMatchObject({ prezzo_attuale: 12, prezzo_precedente: 10 })
  })

  it("restituisce un errore se l'inserimento fallisce", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        materiali: [{ data: [], error: null }, { data: null, error: { message: "boom" } }],
      })
    )
    const r = await saveMaterials(input([{ nome: "A", prezzo: 1 }]))
    expect(r.ok).toBe(false)
  })
})

describe("updateMaterial", () => {
  afterEach(() => jest.clearAllMocks())
  const campi = { nome: "Targa", unita: "Nr.", prezzo_attuale: 15, prezzo_precedente: 14 }

  it("rifiuta nome vuoto o prezzi non validi", async () => {
    expect((await updateMaterial("m1", { ...campi, nome: " " })).ok).toBe(false)
    expect((await updateMaterial("m1", { ...campi, prezzo_attuale: -1 })).ok).toBe(false)
    expect((await updateMaterial("m1", { ...campi, prezzo_precedente: -1 })).ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("corregge i campi direttamente", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await updateMaterial("m1", campi)

    expect(r).toEqual({ ok: true })
    const builder = client.from.mock.results[0].value
    expect(builder.update).toHaveBeenCalledWith({ nome: "Targa", unita: "Nr.", prezzo_attuale: 15, prezzo_precedente: 14 })
    expect(builder.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("togliendo il prezzo precedente azzera anche la sua data", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterial("m1", { ...campi, prezzo_precedente: null })

    expect(client.from.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ prezzo_precedente: null, data_acquisto_precedente: null })
    )
  })
})

describe("deleteMaterial", () => {
  afterEach(() => jest.clearAllMocks())

  it("elimina per id", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    expect(await deleteMaterial("m1")).toEqual({ ok: true })
    const builder = client.from.mock.results[0].value
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("restituisce un errore se la cancellazione fallisce", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    expect((await deleteMaterial("m1")).ok).toBe(false)
  })
})
```

- [ ] **Step 3: Verificare che falliscano**

Run: `npx jest --roots=src src/actions/__tests__/materiali.test.ts`
Expected: FAIL con `Cannot find module '../materiali'`.

- [ ] **Step 4: Implementare**

Creare `src/actions/materiali.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { USER_MESSAGES } from "@/lib/errors"
import { applyPriceUpdate, isValidIsoDate, matchMaterial, type Materiale } from "@/lib/materiali"

// NOTE: in un file "use server" si possono esportare solo funzioni async: i tipi
// usati dai componenti (Materiale, RigaDocumento) si importano da @/lib/materiali.

type RigaDaSalvare = {
  codice: string | null
  nome: string
  unita: string | null
  prezzo: number
}

type SalvataggioResult =
  | { ok: true; nuovi: number; aggiornati: number }
  | { ok: false; error: string }

type EsitoSemplice = { ok: true } | { ok: false; error: string }

const COLUMNS =
  "id, fornitore, codice, nome, unita, prezzo_attuale, data_acquisto_attuale, prezzo_precedente, data_acquisto_precedente"
const NUOVO_PREFIX = "nuovo-"

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
  }
}

function uguali(a: Materiale, b: Materiale): boolean {
  return (
    a.codice === b.codice &&
    a.unita === b.unita &&
    a.prezzo_attuale === b.prezzo_attuale &&
    a.data_acquisto_attuale === b.data_acquisto_attuale &&
    a.prezzo_precedente === b.prezzo_precedente &&
    a.data_acquisto_precedente === b.data_acquisto_precedente
  )
}

/**
 * Salva le righe confermate di un documento. Non è una transazione (due chiamate:
 * inserimenti e aggiornamenti), ma è idempotente: rilanciare lo stesso salvataggio
 * dopo un errore dà "invariato" per ciò che è già scritto e completa il resto.
 */
export async function saveMaterials(input: {
  fornitore: string
  data: string
  righe: RigaDaSalvare[]
}): Promise<SalvataggioResult> {
  const fornitore = input.fornitore.trim()
  const valido =
    fornitore !== "" &&
    isValidIsoDate(input.data) &&
    input.righe.length > 0 &&
    input.righe.every((r) => r.nome.trim() !== "" && Number.isFinite(r.prezzo) && r.prezzo >= 0)
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

  const lavoro = new Map<string, Materiale>(esistenti.map((m) => [m.id, m]))
  const toccati = new Set<string>()
  let contatore = 0

  for (const r of input.righe) {
    const pulita = { codice: pulisci(r.codice), nome: r.nome.trim(), unita: pulisci(r.unita), prezzo: r.prezzo }
    const trovato = matchMaterial([...lavoro.values()], fornitore, pulita)

    if (trovato) {
      const aggiornato: Materiale = {
        ...trovato,
        ...applyPriceUpdate(trovato, { prezzo: pulita.prezzo, data: input.data }),
        codice: trovato.codice ?? pulita.codice,
        unita: trovato.unita ?? pulita.unita,
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
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }
  if (daAggiornare.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("materiali").upsert(daAggiornare)
    if (error) {
      logError("saveMaterials.upsert", error)
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }

  revalidatePath("/materiali")
  return { ok: true, nuovi: daInserire.length, aggiornati: daAggiornare.length }
}

/** Correzione diretta dei campi di un materiale (non registra un acquisto: nessuna logica di storico). */
export async function updateMaterial(
  id: string,
  dati: { nome: string; unita: string | null; prezzo_attuale: number; prezzo_precedente: number | null }
): Promise<EsitoSemplice> {
  const nome = dati.nome.trim()
  const valido =
    nome !== "" &&
    Number.isFinite(dati.prezzo_attuale) &&
    dati.prezzo_attuale >= 0 &&
    (dati.prezzo_precedente === null || (Number.isFinite(dati.prezzo_precedente) && dati.prezzo_precedente >= 0))
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
    })
    .eq("id", id)
  if (error) {
    logError("updateMaterial", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
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
  return { ok: true }
}
```

Nota: `updateMaterial` con `nome` e `prezzo_precedente: null` nel test "corregge i campi direttamente" usa `prezzo_precedente: 14`, quindi il payload non contiene `data_acquisto_precedente`, come asserito dal test.

- [ ] **Step 5: Verificare che passino**

Run: `npx jest --roots=src src/actions/__tests__/materiali.test.ts`
Expected: PASS. Poi `npx tsc --noEmit` pulito.

- [ ] **Step 6: Commit**

```bash
git add src/lib/testUtils/supabaseMock.ts src/actions/materiali.ts src/actions/__tests__/materiali.test.ts
git commit -m "feat(materiali): azioni di salvataggio, lettura, modifica ed eliminazione

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Lettura del documento con Claude

**Files:**
- Create: `src/lib/documentReader.ts`
- Create: `src/actions/materialiDocumento.ts`
- Test: `src/actions/__tests__/materialiDocumento.test.ts`
- Modify: `package.json`, `package-lock.json` (dipendenza)

- [ ] **Step 1: Installare l'SDK**

Run: `npm install @anthropic-ai/sdk`
Expected: aggiunge `@anthropic-ai/sdk` a `dependencies`.

- [ ] **Step 2: Scrivere i test che falliscono**

Creare `src/actions/__tests__/materialiDocumento.test.ts`:

```ts
import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

const mockRead = jest.fn()
jest.mock("@/lib/documentReader", () => ({
  readSupplierDocument: (...args: unknown[]) => mockRead(...args),
}))

import { extractDocument } from "../materialiDocumento"
import { MAX_FILE_BYTES } from "@/lib/documentoFornitore"

function formDataWith(file: File | string | null): FormData {
  const fd = new FormData()
  if (file !== null) fd.append("file", file)
  return fd
}

const pdf = () => new File(["%PDF-1.4 finto"], "fattura.pdf", { type: "application/pdf" })

describe("extractDocument", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "chiave-di-prova"
    mockCreateClient.mockResolvedValue(createSupabaseMock({}))
  })

  afterEach(() => {
    jest.clearAllMocks()
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
  })

  it("rifiuta se non c'è un utente autenticato", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({}, { user: null }))
    const r = await extractDocument(formDataWith(pdf()))
    expect(r.ok).toBe(false)
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rifiuta con un messaggio chiaro se la chiave non è configurata", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const r = await extractDocument(formDataWith(pdf()))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("non è configurata") })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rifiuta se manca il file", async () => {
    const r = await extractDocument(formDataWith(null))
    expect(r.ok).toBe(false)
  })

  it("rifiuta un formato non supportato", async () => {
    const r = await extractDocument(formDataWith(new File(["x"], "a.docx", { type: "application/msword" })))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Formato non supportato") })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rifiuta un file troppo grande", async () => {
    const grande = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "grande.pdf", { type: "application/pdf" })
    const r = await extractDocument(formDataWith(grande))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("troppo grande") })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("passa al lettore il file in base64 col suo tipo e restituisce il documento", async () => {
    const documento = { fornitore: "FB", data: "2025-10-29", righe: [] }
    mockRead.mockResolvedValue(documento)

    const r = await extractDocument(formDataWith(pdf()))

    expect(r).toEqual({ ok: true, documento })
    expect(mockRead).toHaveBeenCalledWith(Buffer.from("%PDF-1.4 finto").toString("base64"), "application/pdf")
  })

  it("se il lettore fallisce restituisce un messaggio che propone l'inserimento a mano", async () => {
    mockRead.mockRejectedValue(new Error("timeout"))
    const r = await extractDocument(formDataWith(pdf()))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("a mano") })
  })
})
```

- [ ] **Step 3: Verificare che falliscano**

Run: `npx jest --roots=src src/actions/__tests__/materialiDocumento.test.ts`
Expected: FAIL con `Cannot find module '../materialiDocumento'`.

- [ ] **Step 4: Implementare il lettore**

Creare `src/lib/documentReader.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import { parseExtraction, type DocumentoLetto, type SupportedMediaType } from "@/lib/documentoFornitore"

// Modello con visione. Cambiabile da MATERIALI_MODEL senza toccare il codice.
const DEFAULT_MODEL = "claude-sonnet-5-5"

const PROMPT = `Questo è un documento di un fornitore (fattura, DDT, listino o preventivo), \
in PDF o in foto, anche ruotato o storto. Leggilo e registra i dati con lo strumento registra_documento.

Regole:
- "fornitore" è chi EMETTE il documento (l'intestazione in alto), non il destinatario.
- "data" è la data del documento in formato AAAA-MM-GG, non la data di un ordine richiamato nel testo. Se non la leggi, null.
- Una riga per ogni articolo. Includi tutte le righe di merce o servizio, comprese eventuali spese (trasporto, imballo): le toglierà una persona.
- "prezzo" è il prezzo unitario SENZA IVA, in euro, come numero con il punto decimale (14.380 → 14.38). Se il prezzo unitario non c'è, la riga va comunque registrata solo se puoi ricavarlo con certezza da importo e quantità.
- "importo" è l'importo di riga senza IVA, come scritto sul documento. "quantita" è la quantità.
- Non inventare nulla: se un dato non si legge, usa null. Non calcolare totali del documento.`

const TOOL: Anthropic.Tool = {
  name: "registra_documento",
  description: "Registra fornitore, data e righe lette dal documento.",
  input_schema: {
    type: "object",
    properties: {
      fornitore: { type: "string", description: "Ragione sociale di chi emette il documento" },
      data: { type: ["string", "null"], description: "Data del documento, AAAA-MM-GG, oppure null" },
      righe: {
        type: "array",
        items: {
          type: "object",
          properties: {
            codice: { type: ["string", "null"], description: "Codice articolo del fornitore" },
            nome: { type: "string", description: "Descrizione dell'articolo" },
            unita: { type: ["string", "null"], description: "Unità di misura (Nr., pz, m, kg…)" },
            quantita: { type: ["number", "null"] },
            prezzo: { type: "number", description: "Prezzo unitario senza IVA, in euro" },
            importo: { type: ["number", "null"], description: "Importo di riga senza IVA" },
          },
          required: ["nome", "prezzo"],
        },
      },
    },
    required: ["fornitore", "righe"],
  },
}

/** Manda il file a Claude e restituisce le righe lette. Non salva nulla. */
export async function readSupplierDocument(
  base64: string,
  mediaType: SupportedMediaType
): Promise<DocumentoLetto> {
  // Timeout sotto i 60 s di maxDuration della pagina Materiali.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 55_000, maxRetries: 1 })

  const fileBlock: Anthropic.ContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }

  const response = await client.messages.create({
    model: process.env.MATERIALI_MODEL || DEFAULT_MODEL,
    max_tokens: 8000,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
  })

  const risposta = response.content.find((b) => b.type === "tool_use")
  return parseExtraction(risposta && risposta.type === "tool_use" ? risposta.input : null)
}
```

- [ ] **Step 5: Implementare l'azione**

Creare `src/actions/materialiDocumento.ts`:

```ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { USER_MESSAGES } from "@/lib/errors"
import { readSupplierDocument } from "@/lib/documentReader"
import {
  MAX_FILE_BYTES,
  SUPPORTED_MEDIA_TYPES,
  type DocumentoLetto,
  type SupportedMediaType,
} from "@/lib/documentoFornitore"

type LetturaResult = { ok: true; documento: DocumentoLetto } | { ok: false; error: string }

const MSG_NO_KEY = "La lettura automatica non è configurata. Puoi inserire le righe a mano."
const MSG_NO_FILE = "Nessun file ricevuto."
const MSG_FORMAT = "Formato non supportato: carica un PDF o una foto (JPG, PNG, WebP)."
const MSG_TOO_BIG = "Il file è troppo grande (massimo 4 MB). Per le foto riprova: l'app le riduce da sola."
const MSG_READ_FAILED = "Non sono riuscito a leggere il documento. Puoi inserire le righe a mano."

/** Legge un documento del fornitore con Claude. Non salva nulla: restituisce le righe da controllare. */
export async function extractDocument(formData: FormData): Promise<LetturaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: MSG_NO_KEY }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: MSG_NO_FILE }
  if (!(SUPPORTED_MEDIA_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: MSG_FORMAT }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: MSG_TOO_BIG }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    const documento = await readSupplierDocument(base64, file.type as SupportedMediaType)
    return { ok: true, documento }
  } catch (error) {
    logError("extractDocument", error)
    return { ok: false, error: MSG_READ_FAILED }
  }
}
```

- [ ] **Step 6: Verificare test e tipi**

Run: `npx jest --roots=src src/actions/__tests__/materialiDocumento.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: pulito. Se `documentReader.ts` dà errori di tipo (tipi dell'SDK installato leggermente diversi da quelli attesi, per esempio sui blocchi `document`/`image` o su `input_schema`), leggere i tipi in `node_modules/@anthropic-ai/sdk` e adattare **solo** la forma degli oggetti, non la logica.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/documentReader.ts src/actions/materialiDocumento.ts src/actions/__tests__/materialiDocumento.test.ts
git commit -m "feat(materiali): lettura dei documenti del fornitore con Claude

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Riduzione foto, limite di dimensione, variabili d'ambiente

**Files:**
- Create: `src/lib/imageResize.ts`
- Modify: `next.config.ts`
- Modify: `.env.example`

Nota: `imageResize.ts` usa API del browser (canvas): non ha test Jest in questo codebase (nessuna infrastruttura per codice browser). Si verifica nel Task 9 con una foto vera.

- [ ] **Step 1: Creare `src/lib/imageResize.ts`**

```ts
/**
 * Riduce una foto prima dell'invio: le foto da telefono pesano 3–8 MB e Vercel
 * rifiuta richieste sopra i 4,5 MB. Il lato lungo scende a 2000 px (restano
 * leggibili anche i caratteri piccoli di una fattura) e il file diventa un JPEG.
 * Se qualcosa non funziona restituisce il file originale: sarà il server a
 * decidere se è utilizzabile.
 */
export async function resizeImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}
```

- [ ] **Step 2: Alzare il limite delle server action**

In `next.config.ts` aggiungere dentro `nextConfig`, dopo `devIndicators`:

```ts
  experimental: {
    // Il caricamento di un documento del fornitore (PDF o foto ridotta) passa da una
    // server action: il limite predefinito di 1 MB è troppo basso. 4 MB resta sotto
    // il tetto di 4,5 MB delle richieste Vercel.
    serverActions: { bodySizeLimit: "4mb" },
  },
```

- [ ] **Step 3: Documentare le variabili d'ambiente**

In `.env.example`, aggiungere in fondo:

```
# Lettura automatica dei documenti del fornitore (pagina Materiali, solo livello completo).
# Senza chiave la lettura è disattivata e restano l'inserimento a mano.
ANTHROPIC_API_KEY=your-anthropic-api-key
# Facoltativa: modello con visione da usare (predefinito nel codice: claude-sonnet-5-5).
MATERIALI_MODEL=
```

- [ ] **Step 4: Verificare**

Run: `npx tsc --noEmit`
Expected: pulito.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageResize.ts next.config.ts .env.example
git commit -m "feat(materiali): riduzione delle foto, limite di 4 MB e variabili d'ambiente

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Schermate (elenco, tabella di controllo, menu)

**Files:**
- Create: `src/components/MaterialiImport.tsx`
- Create: `src/components/MaterialeRowActions.tsx`
- Create: `src/app/(dashboard)/materiali/page.tsx`
- Modify: `src/components/nav/Sidebar.tsx`

Nota: in questo codebase non c'è infrastruttura di test per componenti e pagine (stessa convenzione di `/pagamenti` e `/riepilogo`): si verifica con `tsc`, `eslint` e la prova reale del Task 9.

- [ ] **Step 1: Creare `src/components/MaterialiImport.tsx`**

```tsx
"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorMessage } from "@/components/ErrorMessage"
import { extractDocument } from "@/actions/materialiDocumento"
import { saveMaterials } from "@/actions/materiali"
import { resizeImage } from "@/lib/imageResize"
import { MAX_FILE_BYTES } from "@/lib/documentoFornitore"
import {
  checkRow,
  classifyRow,
  formatPrezzo,
  parsePrice,
  todayIso,
  type Materiale,
  type RigaDocumento,
} from "@/lib/materiali"
import { cn } from "@/lib/utils"

type RigaForm = {
  key: number
  codice: string
  nome: string
  unita: string
  quantita: number | null // solo per il controllo, non si salva
  prezzo: string
  importo: number | null // solo per il controllo, non si salva
}

type Fase = "chiusa" | "lettura" | "controllo"

const MSG_LETTURA_FALLITA = "Non sono riuscito a leggere il documento. Puoi inserire le righe a mano."

export function MaterialiImport({ esistenti }: { esistenti: Materiale[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const prossimaChiave = useRef(1)
  const [fase, setFase] = useState<Fase>("chiusa")
  const [errore, setErrore] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [fornitore, setFornitore] = useState("")
  const [data, setData] = useState(todayIso())
  const [righe, setRighe] = useState<RigaForm[]>([])
  const [salvataggio, setSalvataggio] = useState(false)

  function nuovaRiga(): RigaForm {
    return { key: prossimaChiave.current++, codice: "", nome: "", unita: "", quantita: null, prezzo: "", importo: null }
  }

  function apriControllo(opzioni: { fornitore?: string; data?: string; righe?: RigaForm[]; errore?: string | null }) {
    setFornitore(opzioni.fornitore ?? "")
    setData(opzioni.data ?? todayIso())
    setRighe(opzioni.righe && opzioni.righe.length > 0 ? opzioni.righe : [nuovaRiga()])
    setErrore(opzioni.errore ?? null)
    setMessaggio(null)
    setFase("controllo")
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const originale = e.target.files?.[0]
    e.target.value = ""
    if (!originale) return

    setErrore(null)
    setMessaggio(null)
    setFase("lettura")

    try {
      const file = originale.type.startsWith("image/") ? await resizeImage(originale) : originale
      if (file.size > MAX_FILE_BYTES) {
        apriControllo({ errore: "Il file è troppo grande (massimo 4 MB). Puoi inserire le righe a mano." })
        return
      }
      const fd = new FormData()
      fd.append("file", file)
      const risultato = await extractDocument(fd)
      if (!risultato.ok) {
        apriControllo({ errore: risultato.error })
        return
      }
      const { documento } = risultato
      const lette: RigaForm[] = documento.righe.map((r) => ({
        key: prossimaChiave.current++,
        codice: r.codice ?? "",
        nome: r.nome,
        unita: r.unita ?? "",
        quantita: r.quantita,
        prezzo: formatPrezzo(r.prezzo),
        importo: r.importo,
      }))
      apriControllo({
        fornitore: documento.fornitore,
        data: documento.data ?? todayIso(),
        righe: lette,
        errore: lette.length === 0 ? "Non ho trovato righe nel documento. Puoi aggiungerle a mano." : null,
      })
    } catch {
      apriControllo({ errore: MSG_LETTURA_FALLITA })
    }
  }

  function aggiorna(key: number, campo: keyof RigaForm, valore: string) {
    setRighe((rs) => rs.map((r) => (r.key === key ? { ...r, [campo]: valore } : r)))
  }

  function toRigaDocumento(r: RigaForm): RigaDocumento | null {
    const prezzo = parsePrice(r.prezzo)
    if (prezzo === null || !r.nome.trim()) return null
    return {
      codice: r.codice.trim() || null,
      nome: r.nome.trim(),
      unita: r.unita.trim() || null,
      quantita: r.quantita,
      prezzo,
      importo: r.importo,
    }
  }

  async function conferma() {
    setErrore(null)
    if (!fornitore.trim()) {
      setErrore("Scrivi il nome del fornitore.")
      return
    }
    const daSalvare = righe.flatMap((r) => {
      const riga = toRigaDocumento(r)
      return riga ? [{ codice: riga.codice, nome: riga.nome, unita: riga.unita, prezzo: riga.prezzo }] : []
    })
    if (daSalvare.length === 0) {
      setErrore("Aggiungi almeno un materiale con nome e prezzo.")
      return
    }

    setSalvataggio(true)
    try {
      const esito = await saveMaterials({ fornitore, data, righe: daSalvare })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      setFase("chiusa")
      setMessaggio(`Salvato: ${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati.`)
      router.refresh()
    } catch {
      setErrore("Impossibile salvare i dati. Controlla la connessione e riprova.")
    } finally {
      setSalvataggio(false)
    }
  }

  if (fase === "lettura") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Sto leggendo il documento…
      </div>
    )
  }

  if (fase === "chiusa") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" /> Carica documento
          </Button>
          <Button variant="outline" onClick={() => apriControllo({})}>
            <Plus className="w-4 h-4" /> Aggiungi a mano
          </Button>
        </div>
        {messaggio && <p className="text-sm text-bark">{messaggio}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {errore && <ErrorMessage message={errore} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fornitore">Fornitore</Label>
          <Input id="fornitore" value={fornitore} onChange={(e) => setFornitore(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="data-acquisto">Data acquisto</Label>
          <Input id="data-acquisto" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <th className="px-2 py-2">Codice</th>
              <th className="px-2 py-2">Materiale</th>
              <th className="px-2 py-2">Unità</th>
              <th className="px-2 py-2">Prezzo € (senza IVA)</th>
              <th className="px-2 py-2">Controllo</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => {
              const riga = toRigaDocumento(r)
              const stato = riga ? classifyRow(esistenti, fornitore, riga) : null
              const torna = riga ? checkRow(riga) : true
              return (
                <tr key={r.key} className="border-b last:border-0 align-top">
                  <td className="px-2 py-2 w-28">
                    <Input value={r.codice} onChange={(e) => aggiorna(r.key, "codice", e.target.value)} aria-label="Codice" />
                  </td>
                  <td className="px-2 py-2 min-w-48">
                    <Input value={r.nome} onChange={(e) => aggiorna(r.key, "nome", e.target.value)} aria-label="Materiale" />
                  </td>
                  <td className="px-2 py-2 w-20">
                    <Input value={r.unita} onChange={(e) => aggiorna(r.key, "unita", e.target.value)} aria-label="Unità" />
                  </td>
                  <td className="px-2 py-2 w-32">
                    <Input
                      inputMode="decimal"
                      value={r.prezzo}
                      onChange={(e) => aggiorna(r.key, "prezzo", e.target.value)}
                      aria-label="Prezzo"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-start gap-1">
                      {stato?.tipo === "nuovo" && <Etichetta className="bg-linen text-bark">Nuovo</Etichetta>}
                      {stato?.tipo === "invariato" && <Etichetta className="bg-muted text-muted-foreground">Invariato</Etichetta>}
                      {stato?.tipo === "variato" && (
                        <Etichetta className="bg-linen text-espresso font-semibold">Variato (era {formatPrezzo(stato.era)})</Etichetta>
                      )}
                      {!torna && (
                        <Etichetta className="bg-honey text-espresso">
                          Non torna: {riga?.quantita} × {riga ? formatPrezzo(riga.prezzo) : ""} ≠ {riga?.importo}
                        </Etichetta>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Togli riga"
                      onClick={() => setRighe((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setRighe((rs) => [...rs, nuovaRiga()])}>
          <Plus className="w-4 h-4" /> Aggiungi riga
        </Button>
        <Button onClick={conferma} disabled={salvataggio}>
          {salvataggio ? "Salvo…" : "Conferma e salva"}
        </Button>
        <Button variant="outline" onClick={() => setFase("chiusa")} disabled={salvataggio}>
          Annulla
        </Button>
      </div>
    </div>
  )
}

function Etichetta({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-block rounded px-2 py-0.5 text-xs", className)}>{children}</span>
}
```

- [ ] **Step 2: Creare `src/components/MaterialeRowActions.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { deleteMaterial, updateMaterial } from "@/actions/materiali"
import { formatPrezzo, parsePrice, type Materiale } from "@/lib/materiali"

export function MaterialeRowActions({ materiale }: { materiale: Materiale }) {
  const router = useRouter()
  const [modifica, setModifica] = useState(false)
  const [nome, setNome] = useState(materiale.nome)
  const [unita, setUnita] = useState(materiale.unita ?? "")
  const [attuale, setAttuale] = useState(formatPrezzo(materiale.prezzo_attuale))
  const [precedente, setPrecedente] = useState(
    materiale.prezzo_precedente === null ? "" : formatPrezzo(materiale.prezzo_precedente)
  )
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState(false)

  async function salva() {
    setErrore(null)
    const prezzoAttuale = parsePrice(attuale)
    const prezzoPrecedente = precedente.trim() === "" ? null : parsePrice(precedente)
    if (prezzoAttuale === null || (precedente.trim() !== "" && prezzoPrecedente === null)) {
      setErrore("Controlla i prezzi.")
      return
    }
    setOccupato(true)
    try {
      const esito = await updateMaterial(materiale.id, {
        nome,
        unita: unita.trim() || null,
        prezzo_attuale: prezzoAttuale,
        prezzo_precedente: prezzoPrecedente,
      })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      setModifica(false)
      router.refresh()
    } catch {
      setErrore("Impossibile salvare i dati. Controlla la connessione e riprova.")
    } finally {
      setOccupato(false)
    }
  }

  async function elimina() {
    if (!window.confirm("Eliminare questo materiale dall'elenco?")) return
    setOccupato(true)
    try {
      const esito = await deleteMaterial(materiale.id)
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      router.refresh()
    } catch {
      setErrore("Impossibile eliminare. Riprova.")
    } finally {
      setOccupato(false)
    }
  }

  if (!modifica) {
    return (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => setModifica(true)}>
          Modifica
        </Button>
        <Button variant="outline" size="sm" onClick={elimina} disabled={occupato}>
          Elimina
        </Button>
        {errore && <ErrorMessage message={errore} className="ml-2" />}
      </div>
    )
  }

  return (
    <div className="space-y-2 min-w-56">
      {errore && <ErrorMessage message={errore} />}
      <Input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Materiale" />
      <div className="grid grid-cols-3 gap-2">
        <Input value={unita} onChange={(e) => setUnita(e.target.value)} placeholder="Unità" aria-label="Unità" />
        <Input inputMode="decimal" value={attuale} onChange={(e) => setAttuale(e.target.value)} placeholder="Attuale" aria-label="Prezzo attuale" />
        <Input inputMode="decimal" value={precedente} onChange={(e) => setPrecedente(e.target.value)} placeholder="Precedente" aria-label="Prezzo precedente" />
      </div>
      <div className="flex gap-1">
        <Button size="sm" onClick={salva} disabled={occupato}>
          Salva
        </Button>
        <Button variant="outline" size="sm" onClick={() => setModifica(false)} disabled={occupato}>
          Annulla
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Creare la pagina `src/app/(dashboard)/materiali/page.tsx`**

```tsx
import { notFound } from "next/navigation"
import { ArrowDown, ArrowUp } from "lucide-react"
import { getMaterials } from "@/actions/materiali"
import { toUserMessage } from "@/lib/errors"
import { ErrorMessage } from "@/components/ErrorMessage"
import { MaterialiImport } from "@/components/MaterialiImport"
import { MaterialeRowActions } from "@/components/MaterialeRowActions"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatDate, cn } from "@/lib/utils"
import { hasFeature } from "@/lib/plan"
import { formatPrezzo, matchesSearch, priceVariation, type Materiale } from "@/lib/materiali"

// La lettura di un documento (server action chiamata da questa pagina) può durare qualche secondo.
export const maxDuration = 60

const TH = "text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest"

function Variazione({ attuale, precedente }: { attuale: number; precedente: number | null }) {
  const v = priceVariation(attuale, precedente)
  if (v === null || Math.abs(v) < 0.05) return null
  const su = v > 0
  const Icona = su ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs",
        su ? "bg-terracotta/15 text-terracotta" : "bg-sage text-espresso"
      )}
    >
      <Icona className="w-3 h-3" />
      {su ? "+" : "−"}
      {Math.abs(v).toFixed(1).replace(".", ",")}%
    </span>
  )
}

export default async function MaterialiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!hasFeature("materiali")) notFound()
  const { q } = await searchParams

  let tutti: Materiale[] = []
  let errorMsg: string | null = null
  try {
    tutti = await getMaterials()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }
  const mostrati = q ? tutti.filter((m) => matchesSearch(m, q)) : tutti

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Materiali</h1>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      <MaterialiImport esistenti={tutti} />

      <form method="get" className="flex gap-2 max-w-md">
        <Input name="q" defaultValue={q ?? ""} placeholder="Cerca fornitore, codice o materiale" aria-label="Cerca" />
        <Button type="submit" variant="outline">
          Cerca
        </Button>
      </form>

      {mostrati.length === 0 && !errorMsg && (
        <p className="text-muted-foreground text-sm">
          {tutti.length === 0
            ? "Nessun materiale. Carica un documento del fornitore o aggiungi i materiali a mano."
            : "Nessun materiale corrisponde alla ricerca."}
        </p>
      )}

      {mostrati.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background">
                <th className={TH}>Fornitore</th>
                <th className={TH}>Materiale</th>
                <th className={TH}>Prezzo attuale</th>
                <th className={TH}>Data acquisto attuale</th>
                <th className={TH}>Prezzo precedente</th>
                <th className={TH}>Data acquisto precedente</th>
                <th className={TH}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {mostrati.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40 align-top">
                  <td className="px-4 py-3">{m.fornitore}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{m.nome}</p>
                    {(m.codice || m.unita) && (
                      <p className="text-xs text-muted-foreground">
                        {[m.codice, m.unita].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">
                    €{formatPrezzo(m.prezzo_attuale)}
                    <Variazione attuale={m.prezzo_attuale} precedente={m.prezzo_precedente} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(m.data_acquisto_attuale)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.prezzo_precedente === null ? "—" : `€${formatPrezzo(m.prezzo_precedente)}`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.data_acquisto_precedente ? formatDate(m.data_acquisto_precedente) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <MaterialeRowActions materiale={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Aggiungere la voce di menu**

In `src/components/nav/Sidebar.tsx`:

1. Nell'import da `lucide-react` aggiungere `Package`:

```tsx
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Settings, Euro, ClipboardList, Package } from "lucide-react"
```

2. In `managementLinks`, dopo la riga di `Riepilogo`, aggiungere:

```tsx
  { href: "/materiali", label: "Materiali", icon: Package, feature: "materiali" },
```

`BottomNav.tsx` **non si modifica** (scelta fissata nel piano: 8 voci sono già il massimo).

- [ ] **Step 5: Verificare**

Run: `npx tsc --noEmit`
Expected: pulito.

Run: `npx eslint src/components/MaterialiImport.tsx src/components/MaterialeRowActions.tsx "src/app/(dashboard)/materiali" src/components/nav/Sidebar.tsx src/actions/materiali.ts src/actions/materialiDocumento.ts src/lib/documentReader.ts src/lib/materiali.ts src/lib/documentoFornitore.ts src/lib/imageResize.ts`
Expected: nessun errore (i commenti `eslint-disable` per i cast `any` sono già nel codice).

Run: `npx jest --roots=src`
Expected: tutte le suite verdi (le 24 preesistenti più le 4 nuove).

- [ ] **Step 6: Commit**

```bash
git add src/components/MaterialiImport.tsx src/components/MaterialeRowActions.tsx "src/app/(dashboard)/materiali" src/components/nav/Sidebar.tsx
git commit -m "feat(materiali): pagina Materiali con tabella di controllo e voce di menu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verifica reale con la fattura vera

Questo task richiede la collaborazione dell'utente (migration e chiave API). **Fermarsi e chiedere** ai passi 1 e 2 prima di proseguire.

- [ ] **Step 1: Far applicare la migration**

Chiedere all'utente di incollare il contenuto di `supabase/migrations/20261024000001_add_materiali.sql` nel **SQL Editor** del progetto Supabase **vero** (e, se vuole usarla anche lì, della demo) ed eseguirlo. Poi verificare che la tabella esista:

Run: `node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).from('materiali').select('id',{count:'exact',head:true}).then(r=>console.log(JSON.stringify({error:r.error&&r.error.message,count:r.count})))"`
Expected: `{"count":0}` (nessun errore). Se compare un errore su tabella inesistente, la migration non è stata applicata: non proseguire.

- [ ] **Step 2: Far aggiungere la chiave API**

Chiedere all'utente di creare una chiave su console.anthropic.com e di inserirla in `.env.local` come `ANTHROPIC_API_KEY=...` (e, quando si farà il deploy, anche tra le variabili d'ambiente di Vercel, seguita da un nuovo deploy). La chiave non va mai incollata in chat né committata.

- [ ] **Step 3: Scrivere uno spec Playwright temporaneo**

Creare `e2e/tmp-materiali.spec.ts` (da cancellare a fine verifica; **non** fa parte della suite permanente). Il file della fattura sta fuori dal repository (contiene codice fiscale e indirizzo, il repo è pubblico): usare il percorso `C:\Users\Olga\AppData\Local\Temp\claude\d--Documenti-Projects-oltre-la-bottega\67daec99-3cbb-40ba-b4d8-afbacde2436e\images\1.jpg` oppure chiedere all'utente un altro file.

```ts
import { test, expect } from "@playwright/test"
import { getTestAuthCookies } from "./helpers/auth"

const FATTURA = process.env.FATTURA_PROVA!

test.describe("Materiali — prova reale (temporanea)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies(await getTestAuthCookies())
  })

  test("carica la fattura, controlla le righe, salva e ricarica", async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto("/materiali")
    await expect(page.getByRole("heading", { name: "Materiali" })).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles(FATTURA)
    await expect(page.getByText("Sto leggendo il documento")).toBeVisible()
    await expect(page.getByLabel("Fornitore")).not.toHaveValue("", { timeout: 90_000 })
    await page.screenshot({ path: "test-results/materiali-controllo.png", fullPage: true })

    // 4 righe attese: 003553, 003554, 011503, 011502
    await expect(page.getByLabel("Materiale")).toHaveCount(4)

    await page.getByRole("button", { name: "Conferma e salva" }).click()
    await expect(page.getByText(/Salvato: 4 nuovi, 0 aggiornati/)).toBeVisible()
    await page.screenshot({ path: "test-results/materiali-elenco.png", fullPage: true })

    // Secondo giro con lo stesso documento: tutto "Invariato", nessuna scrittura.
    await page.locator('input[type="file"]').setInputFiles(FATTURA)
    await expect(page.getByLabel("Fornitore")).not.toHaveValue("", { timeout: 90_000 })
    await expect(page.getByText("Invariato")).toHaveCount(4)
    await page.getByRole("button", { name: "Conferma e salva" }).click()
    await expect(page.getByText(/Salvato: 0 nuovi, 0 aggiornati/)).toBeVisible()
  })

  test("aggiungi a mano, modifica ed elimina", async ({ page }) => {
    await page.goto("/materiali")
    await page.getByRole("button", { name: "Aggiungi a mano" }).click()
    await page.getByLabel("Fornitore").fill("E2E Fornitore Prova")
    await page.getByLabel("Materiale").first().fill("E2E Materiale Prova")
    await page.getByLabel("Prezzo").first().fill("3,5")
    await page.getByRole("button", { name: "Conferma e salva" }).click()
    await expect(page.getByText(/Salvato: 1 nuovi/)).toBeVisible()

    const riga = page.getByRole("row").filter({ hasText: "E2E Materiale Prova" })
    await expect(riga).toContainText("€3,50")
    page.once("dialog", (d) => d.accept())
    await riga.getByRole("button", { name: "Elimina" }).click()
    await expect(page.getByText("E2E Materiale Prova")).toHaveCount(0)
  })
})
```

- [ ] **Step 4: Eseguirlo**

Run (da bash, un solo `next dev` attivo nella cartella): `FATTURA_PROVA="C:\Users\Olga\AppData\Local\Temp\claude\d--Documenti-Projects-oltre-la-bottega\67daec99-3cbb-40ba-b4d8-afbacde2436e\images\1.jpg" npx playwright test e2e/tmp-materiali.spec.ts --project=chromium`
Expected: entrambi i test passano. Guardare **a occhio** gli screenshot `test-results/materiali-controllo.png` e `test-results/materiali-elenco.png`: le 4 righe della fattura FB Targhe con codici 003553, 003554, 011503, 011502, prezzi 14,38 · 23,05 · 13,40 · 10,86, fornitore F.B. s.n.c., data 29/10/2025.

Se la lettura sbaglia righe o prezzi, **non correggere il codice a caso**: riportare cosa ha letto e cosa era giusto (può servire una modifica al prompt in `src/lib/documentReader.ts`).

- [ ] **Step 5: Controllare a mano la foto da tablet/telefono**

Chiedere all'utente di provare "Carica documento" da tablet con una foto scattata sul momento (verifica la riduzione dell'immagine e il limite di 4 MB, che i test non coprono).

- [ ] **Step 6: Pulizia e dati di prova**

Cancellare `e2e/tmp-materiali.spec.ts` e la cartella `test-results/` se non era già ignorata. Il secondo test ha già cancellato il suo materiale. **Chiedere all'utente** se tenere le 4 righe della fattura FB Targhe nell'elenco (sono dati veri) o eliminarle dalla pagina Materiali con "Elimina".

Verifica indipendente dei residui: `node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).from('materiali').select('fornitore,nome').ilike('fornitore','E2E%').then(r=>console.log(JSON.stringify(r.data)))"`
Expected: `[]`.

---

### Task 10: Documentazione

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Aggiornare `CLAUDE.md`**

1. Nell'elenco delle migration, dopo la voce 11, aggiungere: `12. \`20261024000001_add_materiali.sql\` — tabella \`materiali\` (listino costi) (applicata il <data in cui l'utente la applica>)`.
2. In "Struttura Next.js reale" aggiungere `│   │   ├── materiali/page.tsx       # Listino costi dei materiali (solo livello completo)` e in `actions/` aggiungere `materiali.ts` e `materialiDocumento.ts`.
3. In "Decisioni chiave e motivazioni" aggiungere una riga: "Materiali con lettura automatica dei documenti del fornitore (2026-10-24)" con: problema (prezzi di acquisto mai scritti), scelta di un listino costi e non di un inventario (nessun carico/scarico), tabella `materiali` con prezzo attuale/precedente e date, abbinamento fornitore + codice, file scartato dopo la lettura, nessuna tabella acquisti, chiave `ANTHROPIC_API_KEY` solo della bottega dell'utente per ora (alternative future: chiave per installazione o chiave unica con limite), salvataggio idempotente, modifica a mano come correzione diretta, voce di menu solo in sidebar, preventivi fuori scope, rimando a spec e piano.
4. In "Testing" aggiungere un punto "Feature (2026-10-24)" con i risultati reali (numero di suite/test da `npx jest --roots=src`, `tsc` pulito, esito della prova reale sulla fattura FB Targhe e dei controlli fatti).
5. In `.env.example` descritto in "Hardening" non serve altro; menzionare le due variabili nuove nella riga della decisione.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: materiali con lettura automatica dei documenti

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Auto-revisione (copertura del design)

| Requisito del design | Task |
|---|---|
| Solo livello completo, voce `materiali` | 1, 8 (pagina `notFound()` nel base, menu con `feature`) |
| Tabella `materiali` con prezzo attuale/precedente e date, indici, RLS | 4 |
| `matchMaterial`, `applyPriceUpdate` (date fuori ordine), `checkRow`, `priceVariation` | 2 |
| Lettura con Claude, schema fisso, non salva, modello da `MATERIALI_MODEL` | 6 |
| Convalida dell'output, file ammessi, limite dimensione | 3, 6 |
| Riduzione foto nel browser, limite 4 MB, `maxDuration` 60 | 7, 8 (`maxDuration` nella pagina) |
| `saveMaterials` (abbinamento, aggiornamento, inserimento) | 5 |
| Modifica ed eliminazione a mano | 5, 8 |
| Pagina: elenco con ricerca, frecce ↑↓ e %, bottoni, tabella di controllo con etichette, righe eliminabili | 8 |
| Errori: chiave mancante, errore API, formato/dimensione, nessuna riga | 6, 8 |
| Test unitari + prova reale sulla fattura FB Targhe fuori dal repo + Playwright temporaneo | 2, 3, 5, 6, 9 |
| Migration applicata prima del deploy | 4 (nota), 9 (passo 1) |
| Documentazione | 10 |

**Deviazioni dal design, già annotate nell'intestazione del piano e da riportare nel design:** salvataggio idempotente invece di "tutto o niente"; modifica a mano come correzione diretta senza storico; voce di menu solo in sidebar; l'etichetta "Non torna" usa il colore `honey`, "Variato" è neutra.
