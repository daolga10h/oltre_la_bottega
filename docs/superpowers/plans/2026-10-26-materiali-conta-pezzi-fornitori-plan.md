# Materiali: si contano i pezzi di tutto, fornitori unificati — Progetto e piano

Data: 2026-10-26. Modifica del magazzino (`2026-10-25-materiali-magazzino-*`) dopo la prova d'uso.

## Cosa è emerso dall'uso

1. **Fornitori scritti in modo diverso.** Lo stesso fornitore comparve due volte («Eljte» e «eljte di Morsia Carlo»): il
   fornitore fa parte della chiave con cui si riconosce un materiale, quindi ogni scrittura diversa creava doppioni.
2. **La casella «Magazzino» su ogni riga è scomoda e il nome non è chiaro.** Decisione dell'utente: **si contano i pezzi di
   tutto, per tutti i fornitori; quello che non serve lo toglie lei** da «Modifica». I prezzi di targhe, astucci ecc. restano
   comunque nell'elenco, contati o no.

## Decisioni

| Tema | Decisione |
|---|---|
| Quali materiali si contano | **Tutti** per impostazione. Nuovi materiali: `in_magazzino = true`. Un materiale con `in_magazzino = false` è «escluso» dall'utente: le quantità dei documenti non lo toccano e la giacenza non si mostra |
| Interfaccia | Via la colonna/casella «Magazzino» dalla tabella di controllo. Resta la colonna **«Carica»** (quantità letta, modificabile, vuota = non caricare). In «Modifica» la casella si chiama **«Conta i pezzi di questo materiale»** |
| Materiali già esistenti | Migration: `in_magazzino` diventa `true` per tutti e il valore predefinito della colonna è `true` |
| Rosso | «In magazzino: N» è in terracotta solo se **negativo** (non più a zero: con tutto contato, tanti zeri appena dopo la migration sarebbero rumore). L'avviso «Da riordinare» resta legato alla scorta minima |
| Riconoscere il fornitore | Chiave del nome: minuscole, senza punti, altra punteggiatura trasformata in spazio, senza forme societarie (spa, srl, srls, snc, sas, sapa, gmbh, ag, ltd, llc, inc, sa, sarl, bv). Due nomi sono lo **stesso fornitore** se i token del più corto sono l'inizio di quelli del più lungo («Eljte» = «eljte di Morsia Carlo»; «Casa di Carta» ≠ «Casa di Legno») |
| Dove si applica | `matchMaterial` (abbinamento materiali) e un nome «canonico» scelto tra i fornitori esistenti: nella tabella di controllo il campo Fornitore si precompila col nome già in elenco con una nota, ed è un campo con suggerimenti (`datalist`); in `saveMaterials` i materiali nuovi usano sempre il nome canonico |
| Dati esistenti | Già unificato a mano il 2026-10-26 («eljte di Morsia Carlo» → «Eljte», 9 materiali, nessun conflitto) |

Fuori scope: schermata per unire fornitori già in elenco (si rinomina con un aggiornamento mirato quando serve), suggerimenti
a metà digitazione più sofisticati del `datalist`.

## Come eseguire

Worktree `.claude/worktrees/conta-pezzi` (ramo `feature/conta-pezzi`). Test sempre con il percorso PRIMA di `--roots`:
`npx jest <file> --roots=src`. Commit con la riga finale `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nessun push.

---

### Task 1: Riconoscimento dei fornitori e conta di default (logica, migration, azioni)

**Files:**
- Modify: `src/lib/materiali.ts`, `src/lib/__tests__/materiali.test.ts`
- Create: `supabase/migrations/20261026000001_conta_pezzi_di_default.sql`
- Modify: `src/actions/materiali.ts`, `src/actions/__tests__/materiali.test.ts`

- [ ] **Step 1: Test dei fornitori (falliscono)**

In `src/lib/__tests__/materiali.test.ts` aggiungere agli import da `"../materiali"`: `supplierKey, sameSupplier, canonicalSupplier,` e in fondo:

```ts
describe("supplierKey", () => {
  it("toglie punti, punteggiatura, maiuscole e forme societarie", () => {
    expect(supplierKey("CAIMI LUIGI E FIGLIO S.p.A.")).toEqual(["caimi", "luigi", "e", "figlio"])
    expect(supplierKey("F.B. s.n.c. di Busato Martino e Matteo")).toEqual(["fb", "di", "busato", "martino", "e", "matteo"])
    expect(supplierKey("Munari snc di Munari Pier Domenico & C.")).toEqual(["munari", "di", "munari", "pier", "domenico", "c"])
    expect(supplierKey("Trodat GmbH")).toEqual(["trodat"])
  })

  it("gestisce valori vuoti", () => {
    expect(supplierKey(null)).toEqual([])
    expect(supplierKey("  ")).toEqual([])
  })
})

describe("sameSupplier", () => {
  it("riconosce lo stesso fornitore scritto in modi diversi", () => {
    expect(sameSupplier("Eljte", "eljte di Morsia Carlo")).toBe(true)
    expect(sameSupplier("Munari", "Munari snc di Munari Pier Domenico & C.")).toBe(true)
    expect(sameSupplier("F.B.", "F.B. s.n.c. di Busato Martino e Matteo")).toBe(true)
    expect(sameSupplier("  FB   Targhe ", "fb targhe")).toBe(true)
    expect(sameSupplier("Trodat", "TRODAT GmbH")).toBe(true)
  })

  it("non unisce fornitori diversi", () => {
    expect(sameSupplier("Casa di Carta", "Casa di Legno")).toBe(false)
    expect(sameSupplier("Eljte", "Caimi")).toBe(false)
    expect(sameSupplier("Targhe Rossi", "Rossi Targhe")).toBe(false)
  })

  it("un nome vuoto non coincide con niente", () => {
    expect(sameSupplier("", "Eljte")).toBe(false)
    expect(sameSupplier("   ", "   ")).toBe(false)
  })
})

describe("canonicalSupplier", () => {
  it("usa il nome già in elenco se il fornitore c'è già", () => {
    expect(canonicalSupplier("eljte di Morsia Carlo", ["Caimi", "Eljte"])).toBe("Eljte")
  })

  it("tra più nomi simili sceglie il più corto", () => {
    expect(canonicalSupplier("Eljte srl", ["eljte di Morsia Carlo", "Eljte"])).toBe("Eljte")
  })

  it("se non c'è nessun fornitore simile tiene il nome scritto, senza spazi ai lati", () => {
    expect(canonicalSupplier("  Nuovo Fornitore ", ["Eljte"])).toBe("Nuovo Fornitore")
  })
})

describe("matchMaterial — fornitore scritto in modo diverso", () => {
  it("abbina un materiale anche se il nome del fornitore sul documento è più lungo", () => {
    const m = { ...base, fornitore: "Eljte", codice: "24079" }
    expect(matchMaterial([m], "eljte di Morsia Carlo", { codice: "24079", nome: "altro" })?.id).toBe("m1")
  })
})
```

Run: `npx jest src/lib/__tests__/materiali.test.ts --roots=src` — Expected: FAIL (funzioni mancanti).

- [ ] **Step 2: Implementare i fornitori in `src/lib/materiali.ts`**

Dopo `normalizeText` aggiungere:

```ts
const FORME_SOCIETARIE = new Set(["spa", "srl", "srls", "snc", "sas", "sapa", "gmbh", "ag", "ltd", "llc", "inc", "sa", "sarl", "bv"])

/**
 * Parole che identificano un fornitore, per riconoscerlo anche se sul documento è scritto in modo diverso:
 * minuscole, punti tolti ("F.B." → "fb", "S.p.A." → "spa"), altra punteggiatura trasformata in spazio, forme societarie tolte.
 */
export function supplierKey(name: string | null | undefined): string[] {
  return normalizeText(name)
    .replace(/\./g, "")
    .replace(/[,;:'"&()\-/]/g, " ")
    .split(/\s+/)
    .filter((t) => t !== "" && !FORME_SOCIETARIE.has(t))
}

/** Stesso fornitore se le parole del nome più corto sono l'inizio di quelle del più lungo («Eljte» = «eljte di Morsia Carlo»). */
export function sameSupplier(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = supplierKey(a)
  const kb = supplierKey(b)
  if (ka.length === 0 || kb.length === 0) return false
  const [corto, lungo] = ka.length <= kb.length ? [ka, kb] : [kb, ka]
  return corto.every((parola, i) => lungo[i] === parola)
}

/** Il nome da usare per un fornitore: quello già in elenco (il più corto, se più nomi coincidono), altrimenti quello scritto. */
export function canonicalSupplier(name: string, esistenti: string[]): string {
  const scritto = name.trim()
  const simili = esistenti.filter((e) => sameSupplier(e, scritto)).sort((x, y) => supplierKey(x).length - supplierKey(y).length)
  return simili[0] ?? scritto
}
```

In `matchMaterial` sostituire:

```ts
  const f = normalizeText(fornitore)
  const candidati = esistenti.filter((m) => normalizeText(m.fornitore) === f)
```

con:

```ts
  const candidati = esistenti.filter((m) => sameSupplier(m.fornitore, fornitore))
```

Run: `npx jest src/lib/__tests__/materiali.test.ts --roots=src` — Expected: PASS (anche i test preesistenti di `matchMaterial`).

- [ ] **Step 3: Migration**

Creare `supabase/migrations/20261026000001_conta_pezzi_di_default.sql`:

```sql
-- Si contano i pezzi di tutti i materiali: chi non serve lo esclude l'utente da «Modifica».
alter table public.materiali alter column in_magazzino set default true;
update public.materiali set in_magazzino = true;
```

- [ ] **Step 4: Test delle azioni (falliscono)**

In `src/actions/__tests__/materiali.test.ts`, nel describe `"saveMaterials — magazzino"`:

1. Nel helper `rigaMag` togliere `magazzino: true,` (resta `carica: 50`).
2. Sostituire il test `"casella spenta: la riga non entra in magazzino e le quantità non si sommano"` con:

```ts
  it("materiale escluso dall'utente (in_magazzino falso): le quantità non si sommano e resta escluso", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: false, carico_totale: "0.000" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ prezzo: 5.2 })], { impronta: "abc123", data: "2026-01-10" }))

    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ in_magazzino: false, carico_totale: 0 })
  })

  it("un materiale nuovo si conta sempre (in_magazzino vero) e parte dalla quantità caricata", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag()]))

    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ in_magazzino: true, carico_totale: 50 })
  })

  it("se la quantità è vuota non somma nulla e non registra l'impronta", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ carica: null })], { impronta: "abc123" }))

    expect(client.from.mock.calls.some((c) => c[0] === "documenti_caricati")).toBe(false)
    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ carico_totale: 0 })
  })

  it("usa il nome del fornitore già in elenco: un materiale nuovo di «eljte di Morsia Carlo» va sotto «Eljte»", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ fornitore: "Eljte", codice: "52079", nome: "MEDAGLIETTA" })], error: null },
        { data: null, error: null },
      ],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([{ codice: "24079", nome: "BRACCIALE", prezzo: 2.04 }], { fornitore: "eljte di Morsia Carlo" }))

    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ fornitore: "Eljte", codice: "24079" })
  })
```

3. Eliminare il test `"dal caricamento «magazzino» può solo accendere..."` se presente (quello del problema A della revisione: riga con `magazzino: false` su materiale tracciato), perché la casella per riga non esiste più. Nei test rimasti togliere ogni riferimento a `magazzino: true/false` dalle righe (`rigaMag(...)` non lo passa più). Il test `"rifiuta una quantità da caricare negativa o non numerica"` resta.

Run: `npx jest src/actions/__tests__/materiali.test.ts --roots=src` — Expected: FAIL.

- [ ] **Step 5: Implementare in `src/actions/materiali.ts`**

1. Import: aggiungere `canonicalSupplier` agli import da `@/lib/materiali`.
2. Nel tipo `RigaDaSalvare` togliere la riga `magazzino?: boolean ...` (resta `carica?: number | null`).
3. In `saveMaterials`: la costante iniziale diventa `const fornitoreLetto = input.fornitore.trim()` e la validazione usa `fornitoreLetto !== ""`. Subito dopo `loadAll` (dopo il blocco `try/catch` che ricarica gli esistenti) aggiungere:

```ts
  // Il fornitore può essere scritto in modo diverso sul documento: si usa il nome già in elenco.
  const fornitore = canonicalSupplier(fornitoreLetto, [...new Set(esistenti.map((m) => m.fornitore))])
```

4. Sostituire `const daSommare = input.righe.some((r) => r.magazzino === true && (r.carica ?? 0) > 0)` con:

```ts
  const daSommare = input.righe.some((r) => (r.carica ?? 0) > 0)
```

5. Nel ciclo delle righe sostituire `const aggiungi = sommaQuantita && r.magazzino === true ? Math.max(r.carica ?? 0, 0) : 0` con:

```ts
    const richiesta = sommaQuantita ? Math.max(r.carica ?? 0, 0) : 0
```

e nel ramo `if (trovato) {` calcolare `const aggiungi = trovato.in_magazzino ? richiesta : 0` e usare:

```ts
        in_magazzino: trovato.in_magazzino,
        carico_totale: round3(trovato.carico_totale + aggiungi),
        ordinato_il: aggiungi > 0 ? null : trovato.ordinato_il,
```

(togliere la riga `in_magazzino: trovato.in_magazzino || r.magazzino === true`); nel ramo dei materiali nuovi usare `in_magazzino: true` e `carico_totale: round3(richiesta)`.
6. Aggiornare il commento della funzione: «Si contano i pezzi di tutti i materiali; chi è escluso (`in_magazzino` falso) non viene toccato dalle quantità».

Run: `npx jest src/actions/__tests__/materiali.test.ts --roots=src` — Expected: PASS. Poi `npx tsc --noEmit` (se compare un errore per `r.magazzino` in `MaterialiImport.tsx`, si sistema nel Task 2: il tipo `RigaDaSalvare` non è esportato, quindi l'errore compare solo come proprietà in eccesso nella chiamata) e `npx jest --roots=src`.

- [ ] **Step 6: Commit**

```bash
git add src/lib src/actions supabase/migrations/20261026000001_conta_pezzi_di_default.sql docs/superpowers/plans/2026-10-26-materiali-conta-pezzi-fornitori-plan.md
git commit -m "feat(materiali): fornitori riconosciuti anche se scritti in modo diverso, si contano i pezzi di tutto

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Interfaccia

**Files:**
- Modify: `src/components/MaterialiImport.tsx`, `src/components/MaterialeRowActions.tsx`, `src/components/StockInfo.tsx`

Nessun test Jest nuovo (componenti): si verifica con `tsc`, `eslint` e la prova reale. Leggere ogni file prima di modificarlo.

- [ ] **Step 1: `MaterialiImport.tsx`**

1. Togliere `magazzino: boolean` da `RigaForm` e `magazzino: false` da `nuovaRiga`. Togliere dall'import `matchMaterial` e, nella lettura delle righe, la proprietà `magazzino: matchMaterial(...)`. `carica` resta (precompilata con la quantità letta).
2. Togliere la colonna **Magazzino** (la `<th>` con `title="Tieni questo materiale in magazzino"` e la `<td>` con la casella `aria-label="Magazzino"`). La colonna **Carica** resta sempre visibile: l'`Input` con `aria-label="Carica"` non è più dentro `{r.magazzino && (...)}`; la sua `<th>` ha `title="Quantità da aggiungere al magazzino (vuoto = non caricare)"`.
3. In `conferma`: la riga da salvare diventa `{ codice, nome, unita, prezzo, carica }` con `carica = r.carica.trim() !== "" ? parsePrice(r.carica) : null` (senza condizione su `r.magazzino`); il controllo `caricaNonValida` non guarda più `r.magazzino`.
4. Importare `canonicalSupplier` da `@/lib/materiali`. Calcolare in cima al componente `const nomiFornitori = [...new Set(esistenti.map((m) => m.fornitore))]`. Aggiungere uno stato `notaFornitore: string | null`. In `onFile`, al posto di `fornitore: documento.fornitore` passare a `apriControllo` il nome `canonicalSupplier(documento.fornitore, nomiFornitori)` e, se è diverso dal nome letto, una nota `Fornitore già presente nell'elenco: «${canonico}» (sul documento: «${documento.fornitore}»)`; `apriControllo` accetta `notaFornitore` e la salva (azzerata nelle altre aperture). Mostrare la nota sotto il campo Fornitore come `<p className="text-xs text-muted-foreground">`.
5. Il campo Fornitore: `list="fornitori-esistenti"` e subito dopo l'`<Input>` un `<datalist id="fornitori-esistenti">` con una `<option value={nome} />` per ogni `nomiFornitori`.

- [ ] **Step 2: `MaterialeRowActions.tsx`**

L'etichetta della casella nel modulo di modifica diventa `Conta i pezzi di questo materiale` (era `Tieni in magazzino`). Nient'altro.

- [ ] **Step 3: `StockInfo.tsx`**

Nella riga «In magazzino: …» la classe `giacenza <= 0 && "text-terracotta"` diventa `giacenza < 0 && "text-terracotta"`.

- [ ] **Step 4: Verificare**

Run: `npx tsc --noEmit` (pulito), `npx eslint src/components/MaterialiImport.tsx src/components/MaterialeRowActions.tsx src/components/StockInfo.tsx` (nessun errore nuovo), `npx jest --roots=src` (tutto verde).

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat(materiali): niente casella Magazzino, fornitore unificato nella tabella di controllo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Prova reale e documentazione

- [ ] **Step 1: Migration.** L'utente la applica a mano (SQL Editor, **solo il testo**, non il percorso del file) sul database vero; verificare poi che nessun materiale abbia `in_magazzino` falso (`node --env-file=.env.local -e ...`, solo lettura).
- [ ] **Step 2: Prova con la fattura FB Targhe** (script Playwright temporaneo, stesso schema di `e2e/tmp-magazzino.spec.ts` della feature precedente, cancellato a fine prova): caricare la fattura → nessuna casella Magazzino, colonna Carica con 10/5/10/5 → conferma → «In magazzino: 10 / 5 / 10 / 5»; ricarica → avviso «già caricato», quantità non sommate; da «Modifica» togliere «Conta i pezzi» a un materiale → ricaricando con «Carica comunque» la sua giacenza non cambia. **Ripristino a fine prova**: `carico_totale = 0`, `rettifica = 0`, `soglia = null`, `ordinato_il = null`, `in_magazzino = true` sui materiali FB, e rimozione delle impronte create dalla prova (verifica con una query indipendente).
- [ ] **Step 3: `CLAUDE.md`**: riga di decisione «Si contano i pezzi di tutto, fornitori unificati (2026-10-26)» (cosa è emerso, regole del nome del fornitore, migration 14, dati già unificati a mano, rosso solo se negativo, limiti), punto in Testing con i risultati reali, voce 14 nell'elenco delle migration. Commit `docs: ...`.

---

### Task 1b: Il documento doppio va sempre riconosciuto

**Perché.** L'utente ha caricato due volte la stessa fattura e l'app non ha avvisato. Prova (2026-10-26): rileggendo tre volte lo stesso file Munari, l'impronta del contenuto è uscita uguale due volte e diversa una (l'AI legge qualche dettaglio in modo leggermente diverso: prezzi, sconti, importi), quindi il doppio può sfuggire. In più oggi l'impronta si registra solo se si sommano quantità.

**Decisioni:**
- Ogni documento letto da un file ha **due impronte**: (1) lo SHA-256 dei **byte del file** ricevuto (cattura il file caricato due volte, indipendente dall'AI); (2) un'impronta del contenuto **più grossolana**: prima parola del fornitore (`supplierKey(fornitore)[0]`), data, e i codici ordinati (`normalizeText(codice) || normalizeText(nome)`), **senza** quantità, prezzi, sconti e importi (che sono quelli che variano a ogni lettura).
- Le impronte si registrano **sempre** al salvataggio di un documento letto da un file (non solo quando si sommano quantità). Un documento è «già caricato» se **una qualsiasi** delle due esiste. Due fatture diverse dello stesso fornitore con la stessa data e gli stessi codici daranno un falso avviso: si risolve con «Carica comunque».

**Files:** `src/lib/documentFingerprint.ts` (+ test), `src/lib/testUtils/supabaseMock.ts`, `src/actions/materialiDocumento.ts` (+ test), `src/actions/materiali.ts` (+ test).

- [ ] **Step 1: `documentFingerprint.ts` e test (TDD).** Cambiare `documentFingerprint(doc)` come sopra (contenuto grossolano) e aggiungere `export function fileFingerprint(bytes: Uint8Array): string` (SHA-256 esadecimale dei byte). Aggiornare `src/lib/__tests__/documentFingerprint.test.ts`: l'impronta del contenuto **non** cambia se cambiano quantità, prezzi, sconti, importi, né maiuscole/spazi/ordine delle righe, né se il fornitore è scritto più lungo («Munari» = «Munari snc di Munari Pier Domenico & C.»); **cambia** se cambia la data, se si aggiunge o toglie un codice o cambia la prima parola del fornitore; senza codice conta il nome. Test di `fileFingerprint`: stessi byte → stessa impronta, un byte diverso → impronta diversa, 64 caratteri esadecimali.
- [ ] **Step 2: mock.** In `src/lib/testUtils/supabaseMock.ts` aggiungere `"in"` all'elenco `CHAIN_METHODS`.
- [ ] **Step 3: `extractDocument` e test.** Calcolare `fileFingerprint(new Uint8Array(buffer))` dai byte del file ricevuto e `documentFingerprint(documento)`; restituire `{ ok: true, documento, impronte: [filehash, contenuto], giaCaricato }` (al posto di `impronta`). `giaCaricato` è vero se **una qualsiasi** esiste in `documenti_caricati` (`.select("id").in("impronta", impronte)`; un errore nel controllo non blocca: `false`). Aggiornare i test: il risultato ha `impronte` (array di 2 stringhe esadecimali) e `giaCaricato`; caso «già caricato» con la tabella che restituisce una riga; caso errore del controllo.
- [ ] **Step 4: `saveMaterials` e test.** L'input prende `impronte?: string[]` (al posto di `impronta?: string`). Se `impronte` è presente e non vuoto, **sempre** (anche senza quantità da sommare) provare `insert(impronte.map((impronta) => ({ impronta })))` in UNA chiamata su `documenti_caricati`: ok = registrate (`improntaRegistrata = true`); errore `23505` = documento già caricato → le quantità si saltano salvo `caricaComunque`; altro errore = `saveFailed`. `quantitaSaltate` solo se c'erano quantità da sommare e sono state saltate. Se la scrittura dei materiali fallisce e le impronte erano state registrate, toglierle con `.delete().in("impronta", impronte)`. Aggiornare i test esistenti (`impronta: "abc123"` → `impronte: ["abc123"]`; `insert` chiamato con `[{ impronta: "abc123" }]`; la rimozione verifica `.in("impronta", ["abc123"])`) e aggiungere: due impronte registrate in una sola chiamata; documento senza quantità registra comunque le impronte (cambia il test «se la quantità è vuota … non registra l'impronta»: ora le registra); documento già caricato senza quantità non dà `quantitaSaltate`.
- [ ] **Step 5: verifiche e commit.** `npx jest --roots=src` verde, `npx tsc --noEmit` (può segnalare solo `MaterialiImport.tsx` che usa ancora `impronta`: lo sistema il Task 2), `npx eslint` sui file toccati. Commit `fix(materiali): il documento doppio si riconosce anche se l'AI legge in modo diverso` + riga `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

Nel **Task 2** si aggiunge per `MaterialiImport.tsx`: lo stato `impronta: string | null` diventa `impronte: string[]` (da `risultato.impronte`) e a `saveMaterials` si passa `impronte` al posto di `impronta`.
