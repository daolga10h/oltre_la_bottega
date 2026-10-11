# Materiale in russo per la presentazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produrre video dimostrativo con didascalie in russo, sei schermate dell'app con scritte in russo e la presentazione commerciale in russo (HTML + PDF) con quelle schermate dentro, lasciando l'app e la demo in italiano.

**Architecture:** Le didascalie russe sono dati puri (`SCENE_RU`, `SCHERMATE_RU`) testati con Jest. Lo script del video guadagna l'opzione `--lang=ru`; le funzioni di preparazione (build, server, login, regia del mouse) vengono spostate in un modulo condiviso `scripts/demo-common.ts`, riusato da un nuovo script di schermate. La presentazione russa è una copia dell'HTML originale con testi tradotti e quattro `<figure>`; il PDF lo genera uno script Playwright.

**Tech Stack:** TypeScript, tsx, Playwright (già nel progetto), Jest, HTML/CSS statico. Nessuna dipendenza nuova (per il video serve `ffmpeg-static`, già installato a mano con `npm install --no-save`, vedere Task 6).

Design: `docs/superpowers/specs/2026-10-11-presentazione-russa-design.md`. Lavoro sul ramo `feature/sito-vetrina` (dove già vive il codice del video). Non unire a `main` senza chiedere.

---

## Struttura dei file

- Modify: `src/lib/demo/videoScenes.ts` — `Lingua`, `SCENE_RU`, `scenePerLingua`, `parseLingua`.
- Modify: `src/lib/demo/__tests__/videoScenes.test.ts` — test della serie russa e di `parseLingua`.
- Create: `src/lib/demo/schermate.ts` — `SCHERMATE_RU` (una didascalia russa per schermata).
- Create: `src/lib/demo/__tests__/schermate.test.ts`.
- Create: `scripts/demo-common.ts` — preparazione condivisa, spostata da `run.ts`.
- Modify: `scripts/demo-video/run.ts` — usa il modulo condiviso, accetta `--lang`.
- Create: `scripts/demo-screenshots/run.ts` — scatta le sei schermate.
- Create: `scripts/presentazione/pdf.ts` — genera il PDF della presentazione russa.
- Create: `docs/presentazione-commerciale-ru.html`, poi `docs/presentazione-commerciale-ru.pdf`.
- Create: `docs/demo/materiale-in-russo.md` — i tre comandi, per Olga.
- Modify: `package.json` (script), `.gitignore`, `CLAUDE.md`.

---

### Task 1: Didascalie russe del video e scelta della lingua

**Files:**
- Modify: `src/lib/demo/videoScenes.ts`
- Test: `src/lib/demo/__tests__/videoScenes.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/lib/demo/__tests__/videoScenes.test.ts` sostituire la prima riga di import con:

```ts
import {
  CONTATTO_WHATSAPP,
  SCENE,
  SCENE_RU,
  conContatto,
  durataPianificata,
  parseLingua,
  scenePerLingua,
  tempoInScena,
  tempoLettura,
} from "../videoScenes"
```

e aggiungere in fondo al file:

```ts
describe("scene del video in russo", () => {
  const didascalieRu = () => SCENE_RU.flatMap((s) => s.didascalie)

  it("hanno le stesse scene, nello stesso ordine, di quelle italiane", () => {
    expect(SCENE_RU.map((s) => s.id)).toEqual(SCENE.map((s) => s.id))
  })

  it("ogni scena ha lo stesso numero di didascalie e gli stessi secondi extra", () => {
    SCENE.forEach((scena, i) => {
      expect(SCENE_RU[i].didascalie).toHaveLength(scena.didascalie.length)
      SCENE_RU[i].didascalie.forEach((d, j) => expect(d.secondiExtra).toBe(scena.didascalie[j].secondiExtra))
    })
  })

  it("ogni didascalia è non vuota, in cirillico e non più lunga di 95 caratteri", () => {
    for (const d of didascalieRu()) {
      expect(d.testo.trim().length).toBeGreaterThan(0)
      expect(d.testo.length).toBeLessThanOrEqual(95)
      expect(d.testo).toMatch(/[\u0400-\u04FF]/)
    }
  })

  it("il numero WhatsApp compare solo nell'ultima didascalia", () => {
    const didascalie = didascalieRu()
    expect(didascalie[didascalie.length - 1].testo).toContain(CONTATTO_WHATSAPP)
    for (const d of didascalie.slice(0, -1)) expect(d.testo).not.toContain(CONTATTO_WHATSAPP)
  })

  it("la durata pianificata sta tra 120 e 200 secondi", () => {
    const totale = durataPianificata(SCENE_RU)
    expect(totale).toBeGreaterThanOrEqual(120)
    expect(totale).toBeLessThanOrEqual(200)
  })
})

describe("scenePerLingua", () => {
  it("restituisce la serie della lingua richiesta", () => {
    expect(scenePerLingua("it")).toBe(SCENE)
    expect(scenePerLingua("ru")).toBe(SCENE_RU)
  })
})

describe("parseLingua", () => {
  it("senza opzione sceglie l'italiano", () => {
    expect(parseLingua([])).toBe("it")
    expect(parseLingua(["--altro"])).toBe("it")
  })

  it("legge --lang=ru e --lang=it", () => {
    expect(parseLingua(["--lang=ru"])).toBe("ru")
    expect(parseLingua(["x", "--lang=it"])).toBe("it")
  })

  it("rifiuta una lingua non supportata", () => {
    expect(() => parseLingua(["--lang=fr"])).toThrow(/Lingua non supportata/)
  })
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx jest --roots=src src/lib/demo/__tests__/videoScenes.test.ts`
Expected: FAIL (`SCENE_RU`, `parseLingua`, `scenePerLingua` non esistono — errore di compilazione TypeScript).

- [ ] **Step 3: Implementare**

In `src/lib/demo/videoScenes.ts`, cambiare il commento del campo `testo` di `Didascalia` da `/** Testo in italiano, al massimo circa 90 caratteri. */` a `/** Testo nella lingua della serie, al massimo circa 90 caratteri. */`, poi aggiungere subito dopo la costante `SCENE` (prima di `tempoLettura`):

```ts
export type Lingua = "it" | "ru"

/**
 * Stesso copione di `SCENE` in russo, per la presentazione. Stesse scene, stesso
 * numero di scritte e stessi `secondiExtra` (è il tempo dell'azione sullo
 * schermo, non dipende dalla lingua). L'app nel video resta in italiano.
 */
export const SCENE_RU: Scena[] = [
  {
    id: "apertura",
    didascalie: [
      { testo: "Я Ольга, у меня мастерская. Я сделала приложение, чтобы не держать всё в голове.", secondiExtra: 2 },
      { testo: "Каждое утро я открываю эту страницу и знаю, что нужно сделать сегодня.", secondiExtra: 3 },
    ],
  },
  {
    id: "oggi",
    didascalie: [{ testo: "Выдачи на сегодня, готовые заказы для оповещения клиентов, напоминания.", secondiExtra: 12 }],
  },
  {
    id: "nuovo-ordine",
    didascalie: [
      { testo: "Клиент вернулся: его данные заполняются сами.", secondiExtra: 12 },
      { testo: "Новый заказ я оформляю меньше чем за минуту.", secondiExtra: 14 },
    ],
  },
  {
    id: "bacheca",
    didascalie: [{ testo: "«Bacheca» — моя рабочая доска: каждая колонка — один этап работы.", secondiExtra: 12 }],
  },
  {
    id: "avvisa",
    didascalie: [
      { testo: "Когда заказ готов, сообщение клиенту уже написано: отправляю его в WhatsApp…", secondiExtra: 9 },
      { testo: "…или по электронной почте, с тем же готовым текстом.", secondiExtra: 7 },
    ],
  },
  {
    id: "foglio",
    didascalie: [{ testo: "На обычном принтере печатаю лист, который кладу вместе с работой.", secondiExtra: 9 }],
  },
  {
    id: "clienti",
    didascalie: [{ testo: "Когда клиент возвращается, я сразу вижу всё, что он уже заказывал.", secondiExtra: 12 }],
  },
  {
    id: "chiusura",
    didascalie: [
      { testo: "Всё просто, потому что я делала её для тех, кто работает в мастерской.", secondiExtra: 1 },
      { testo: "Если не продлевать подписку, приложение продолжает работать.", secondiExtra: 1 },
      { testo: `Напишите мне — покажу вживую · WhatsApp ${CONTATTO_WHATSAPP}`, secondiExtra: 5 },
    ],
  },
]

export function scenePerLingua(lingua: Lingua): Scena[] {
  return lingua === "ru" ? SCENE_RU : SCENE
}

/** Legge `--lang=it|ru` dagli argomenti dello script; senza opzione vale "it". */
export function parseLingua(argomenti: string[]): Lingua {
  const argomento = argomenti.find((a) => a.startsWith("--lang="))
  if (!argomento) return "it"
  const valore = argomento.slice("--lang=".length)
  if (valore === "it" || valore === "ru") return valore
  throw new Error(`Lingua non supportata: "${valore}" (usare --lang=it oppure --lang=ru).`)
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx jest --roots=src src/lib/demo/__tests__/videoScenes.test.ts`
Expected: PASS (tutti i test, vecchi e nuovi).

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/videoScenes.ts src/lib/demo/__tests__/videoScenes.test.ts
git commit -m "feat(demo): didascalie del video in russo e scelta della lingua

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Didascalie russe delle schermate

**Files:**
- Create: `src/lib/demo/schermate.ts`
- Test: `src/lib/demo/__tests__/schermate.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/lib/demo/__tests__/schermate.test.ts`:

```ts
import { SCHERMATE_RU } from "../schermate"

describe("schermate per la presentazione in russo", () => {
  it("sono sei, nell'ordine previsto dal design", () => {
    expect(SCHERMATE_RU.map((s) => s.id)).toEqual(["oggi", "nuovo-ordine", "bacheca", "avvisa", "foglio", "cliente"])
  })

  it("ogni didascalia è non vuota, in cirillico e non più lunga di 95 caratteri", () => {
    for (const s of SCHERMATE_RU) {
      expect(s.didascalia.trim().length).toBeGreaterThan(0)
      expect(s.didascalia.length).toBeLessThanOrEqual(95)
      expect(s.didascalia).toMatch(/[\u0400-\u04FF]/)
    }
  })

  it("gli identificativi non si ripetono (servono per i nomi dei file)", () => {
    const id = SCHERMATE_RU.map((s) => s.id)
    expect(new Set(id).size).toBe(id.length)
  })
})
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx jest --roots=src src/lib/demo/__tests__/schermate.test.ts`
Expected: FAIL (modulo `../schermate` inesistente).

- [ ] **Step 3: Implementare**

Creare `src/lib/demo/schermate.ts`:

```ts
// Schermate della demo per la presentazione in russo (npm run demo:screenshots).
// Solo dati: lo script scripts/demo-screenshots/run.ts le scatta e ci scrive
// sopra la didascalia. Design: docs/superpowers/specs/2026-10-11-presentazione-russa-design.md

export type SchermataId = "oggi" | "nuovo-ordine" | "bacheca" | "avvisa" | "foglio" | "cliente"

export type Schermata = {
  id: SchermataId
  /** Didascalia in russo, al massimo circa 90 caratteri. */
  didascalia: string
}

export const SCHERMATE_RU: Schermata[] = [
  { id: "oggi", didascalia: "Страница «Oggi»: выдачи, готовые заказы и напоминания — на одном экране" },
  { id: "nuovo-ordine", didascalia: "Новый заказ меньше чем за минуту: данные вернувшегося клиента заполняются сами" },
  { id: "bacheca", didascalia: "«Bacheca»: каждая колонка — этап работы, заказ переносится одним касанием" },
  { id: "avvisa", didascalia: "Готово? Сообщение клиенту уже написано — WhatsApp или e-mail в один клик" },
  { id: "foglio", didascalia: "Рабочий лист для обычного принтера: кладётся вместе с работой" },
  { id: "cliente", didascalia: "Карточка клиента: вся история его заказов перед глазами" },
]
```

- [ ] **Step 4: Verificare che passi**

Run: `npx jest --roots=src src/lib/demo/__tests__/schermate.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/schermate.ts src/lib/demo/__tests__/schermate.test.ts
git commit -m "feat(demo): didascalie russe per le schermate della presentazione

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Spostare la preparazione condivisa in `scripts/demo-common.ts`

Refactor puro: nessun cambiamento di comportamento. Si sposta codice **così com'è** da `scripts/demo-video/run.ts` a un nuovo modulo, aggiungendo `export`.

**Files:**
- Create: `scripts/demo-common.ts`
- Modify: `scripts/demo-video/run.ts`

- [ ] **Step 1: Creare `scripts/demo-common.ts`**

Il file ha questa intestazione (import e costanti), seguita dai blocchi spostati da `scripts/demo-video/run.ts` (numeri di riga del file **prima** di qualsiasi modifica), ciascuno con `export` davanti a `const`/`function`/`async function`/`class`:

```ts
// Preparazione condivisa dagli script che usano la demo: video (demo-video) e
// schermate per la presentazione (demo-screenshots). Rinfresca i dati, costruisce
// e avvia l'app collegata al progetto demo, esegue il login con il PIN.
import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import type { Browser, Locator, Page } from "@playwright/test"
import { parseEnvFile } from "../src/lib/demo/envFile"

export const radice = process.cwd()
export const PORTA = 3300
export const BASE_URL = `http://localhost:${PORTA}`
export const LARGHEZZA = 1280
export const ALTEZZA = 720
const BIN_NEXT = path.join(radice, "node_modules", "next", "dist", "bin", "next")

export const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms))
```

Poi, in quest'ordine, copiare da `run.ts`:
1. righe 26–41 (`rimuoviConReprove`, con il suo commento) — aggiungere `export`;
2. righe 43–231 (da `// ---- preparazione` fino alla fine della classe `Regia`: `rinfrescaDemo`, `leggiDemo`, `ambienteApp`, `portaLibera`, `costruisciApp`, `avviaServer`, `fermaServer`, `accedi`, `Regia`) — aggiungere `export` a ciascuna funzione e alla classe;
3. righe 236–238 (la funzione `didascalia(page, testo)`) — aggiungere `export`.

Nel nuovo file `accedi` e `Regia` riferiscono `LARGHEZZA`, `ALTEZZA`, `BASE_URL`, `attendi`, che ora sono definiti sopra. Il tipo `Browser` serve a `accedi`, `Locator` e `Page` a `Regia`/`didascalia`.

- [ ] **Step 2: Aggiornare `scripts/demo-video/run.ts`**

Cancellare da `run.ts` i blocchi spostati: righe 13–17 (`radice`, `PORTA`, `BASE_URL`, `LARGHEZZA`, `ALTEZZA`), riga 22 (`BIN_NEXT`), riga 24 (`attendi`), righe 26–41, righe 43–231, righe 236–238. Restano: `CARTELLA_VIDEO`, `CARTELLA_TMP_RIPRESE`, `FILE_WEBM`, `FILE_MP4` (righe 18–21, modificate nel Task 4), `contattoWhatsApp` (righe 233–234), `conDidascalia`, `scena`, `fraGiorni`, `gira`, `percorsoFfmpeg`, `convertiInMp4`, `durataVideo`, `main`.

Sostituire il blocco di import in testa (righe 4–11) con:

```ts
import { spawnSync, type ChildProcess } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { chromium, type Browser, type Page } from "@playwright/test"
import { SCENE, conContatto, tempoInScena, type Scena } from "../../src/lib/demo/videoScenes"
import {
  ALTEZZA,
  BASE_URL,
  LARGHEZZA,
  Regia,
  accedi,
  ambienteApp,
  attendi,
  avviaServer,
  costruisciApp,
  didascalia,
  fermaServer,
  leggiDemo,
  portaLibera,
  radice,
  rimuoviConReprove,
  rinfrescaDemo,
} from "../demo-common"
import { OVERLAY_SCRIPT } from "./overlay"
```

- [ ] **Step 3: Verificare tipi e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npx eslint scripts`
Expected: nessun errore (se segnala import inutilizzati in `run.ts`, toglierli).

- [ ] **Step 4: Verificare che i test restino verdi**

Run: `npx jest --roots=src`
Expected: tutte le suite verdi (23 suite + la nuova di Task 2, tutti i test passano).

- [ ] **Step 5: Commit**

```bash
git add scripts/demo-common.ts scripts/demo-video/run.ts
git commit -m "refactor(demo): preparazione condivisa tra video e schermate in demo-common

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `--lang=ru` nello script del video

**Files:**
- Modify: `scripts/demo-video/run.ts`
- Modify: `package.json`

- [ ] **Step 1: Import e file di uscita**

In `run.ts` cambiare l'import da `videoScenes` in:

```ts
import { conContatto, parseLingua, scenePerLingua, tempoInScena, type Lingua, type Scena } from "../../src/lib/demo/videoScenes"
```

Sostituire le due costanti `FILE_WEBM` e `FILE_MP4` con:

```ts
/** Il video italiano mantiene il nome di sempre; quello russo ha il suffisso -ru. */
const nomeFile = (lingua: Lingua, estensione: "webm" | "mp4") =>
  path.join(CARTELLA_VIDEO, `oltre-la-bottega-demo${lingua === "it" ? "" : `-${lingua}`}.${estensione}`)
```

- [ ] **Step 2: Scene attive**

Sopra la funzione `scena` sostituire

```ts
function scena(id: Scena["id"]): Scena {
  const s = SCENE.find((x) => x.id === id)
```

con

```ts
let sceneAttive: Scena[] = scenePerLingua("it")

function scena(id: Scena["id"]): Scena {
  const s = sceneAttive.find((x) => x.id === id)
```

- [ ] **Step 3: Conversione con i nomi giusti**

Cambiare la firma e il corpo di `convertiInMp4`:

```ts
function convertiInMp4(ffmpeg: string, tagliaSecondi: number, fileWebm: string, fileMp4: string): void {
```

con `"-ss", tagliaSecondi.toFixed(2), "-i", fileWebm,` e, come ultimo argomento di ffmpeg, `fileMp4,` al posto di `FILE_WEBM`/`FILE_MP4`.

- [ ] **Step 4: `main`**

All'inizio di `main()`, prima di `const ffmpeg = percorsoFfmpeg()`, aggiungere:

```ts
  const lingua = parseLingua(process.argv.slice(2))
  sceneAttive = scenePerLingua(lingua)
  const fileWebm = nomeFile(lingua, "webm")
  const fileMp4 = nomeFile(lingua, "mp4")
  console.log(`→ Lingua delle didascalie: ${lingua}`)
```

e nel corpo: `copyFileSync(await video.path(), fileWebm)`, `convertiInMp4(ffmpeg, taglio, fileWebm, fileMp4)`, `statSync(fileMp4)`, e nei `console.log` finali `${fileMp4}`, `durataVideo(ffmpeg, fileMp4)`, `${fileWebm}`.

Aggiornare anche il commento di testata del file: `// Video dimostrativo automatico, muto con didascalie in italiano o in russo (--lang=ru).`

- [ ] **Step 5: Script npm**

In `package.json`, dopo `"demo:video": "tsx scripts/demo-video/run.ts"` aggiungere (con la virgola giusta):

```json
    "demo:video:ru": "tsx scripts/demo-video/run.ts --lang=ru",
    "demo:screenshots": "tsx scripts/demo-screenshots/run.ts",
    "presentazione:pdf": "tsx scripts/presentazione/pdf.ts"
```

- [ ] **Step 6: Verificare**

Run: `npx tsc --noEmit && npx eslint scripts && npx jest --roots=src`
Expected: tutto pulito/verde.

- [ ] **Step 7: Commit**

```bash
git add scripts/demo-video/run.ts package.json
git commit -m "feat(demo): video con didascalie in russo (--lang=ru, npm run demo:video:ru)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Script delle schermate

**Files:**
- Create: `scripts/demo-screenshots/run.ts`
- Modify: `.gitignore`

- [ ] **Step 1: `.gitignore`**

Dopo la riga `/.demo-video-tmp/` aggiungere:

```
# schermate per la presentazione generate da npm run demo:screenshots
/presentazione-img/
```

- [ ] **Step 2: Creare `scripts/demo-screenshots/run.ts`**

```ts
// Schermate della demo con didascalia in russo, per la presentazione.
// Uso: npm run demo:screenshots   (app in italiano, solo le scritte sono in russo)
// Design: docs/superpowers/specs/2026-10-11-presentazione-russa-design.md
import type { ChildProcess } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { chromium, type Page } from "@playwright/test"
import { SCHERMATE_RU, type SchermataId } from "../../src/lib/demo/schermate"
import { OVERLAY_SCRIPT } from "../demo-video/overlay"
import {
  ALTEZZA,
  BASE_URL,
  LARGHEZZA,
  accedi,
  ambienteApp,
  attendi,
  avviaServer,
  costruisciApp,
  didascalia,
  fermaServer,
  leggiDemo,
  portaLibera,
  radice,
  rinfrescaDemo,
} from "../demo-common"

const CARTELLA_IMG = path.join(radice, "presentazione-img")

/** Il cursore finto del video non deve comparire nelle immagini. */
const NASCONDI_CURSORE = "#__demo-cursore { display: none !important; }"

async function scatta(page: Page, id: SchermataId): Promise<void> {
  const schermata = SCHERMATE_RU.find((s) => s.id === id)
  if (!schermata) throw new Error(`Schermata mancante: ${id}`)
  await didascalia(page, schermata.didascalia)
  await attendi(900) // dissolvenza della barra
  const indice = String(SCHERMATE_RU.indexOf(schermata) + 1).padStart(2, "0")
  const file = path.join(CARTELLA_IMG, `${indice}-${id}.png`)
  await page.screenshot({ path: file, style: NASCONDI_CURSORE })
  console.log(`  ${file}`)
}

/** Va a una pagina togliendo prima la didascalia, che sopravvive alla navigazione. */
async function vai(page: Page, percorso: string): Promise<void> {
  await didascalia(page, null)
  await page.goto(percorso)
}

async function scattaTutte(page: Page): Promise<void> {
  // 1. Oggi
  await vai(page, "/dashboard")
  await page.getByText("Anna Bellini").first().waitFor()
  await attendi(800)
  await scatta(page, "oggi")

  // 2. Nuovo ordine di un cliente che torna (non si salva: nessun dato da pulire)
  await vai(page, "/orders/new")
  await page.locator("#nome").waitFor()
  await attendi(1200) // l'elenco clienti per i suggerimenti si carica all'apertura
  await page.locator("#nome").pressSequentially("Luca", { delay: 40 })
  const suggerimento = page.getByRole("button", { name: /Luca Conti/ })
  await suggerimento.waitFor()
  await suggerimento.click()
  await attendi(800)
  const riga = page.locator("div.rounded-lg.border-border.p-3").first()
  await riga.getByPlaceholder("Es. targa plexiglass, timbro, portachiavi inciso...").fill("Targa per condominio")
  await riga.locator('input[type="number"]').nth(1).fill("30")
  await attendi(500)
  await scatta(page, "nuovo-ordine")

  // 3. Bacheca
  await vai(page, "/kanban")
  await page.locator("div.rounded-lg.space-y-2").filter({ hasText: "Giulia Ferri" }).waitFor()
  await attendi(800)
  await scatta(page, "bacheca")

  // 4. Avvisa il cliente: scheda di Anna Bellini con l'anteprima del messaggio WhatsApp
  const schedaAnna = page.locator("div.rounded-lg.space-y-2").filter({ hasText: "Anna Bellini" })
  const indirizzoScheda = await schedaAnna.getByRole("link", { name: "Scheda" }).getAttribute("href")
  if (!indirizzoScheda) throw new Error("Link alla scheda di Anna Bellini non trovato.")
  await vai(page, indirizzoScheda)
  const box = page.locator("div.flex-wrap").filter({ hasText: "Avvisa il cliente:" })
  await box.waitFor()
  await box.scrollIntoViewIfNeeded()
  const indirizzoWa = await box.getByRole("link", { name: "WhatsApp" }).getAttribute("href")
  if (!indirizzoWa) throw new Error("Link WhatsApp non trovato sull'ordine di Anna Bellini.")
  const testoWa = new URL(indirizzoWa).searchParams.get("text") ?? ""
  await page.evaluate(
    ([testo, numero]) =>
      (window as unknown as { __mostraAnteprima: (c: string, t: string, d: string) => void }).__mostraAnteprima("whatsapp", testo, numero),
    [testoWa, "333 0000103"]
  )
  await attendi(700)
  await scatta(page, "avvisa")
  await page.evaluate(() => (window as unknown as { __nascondiAnteprima: () => void }).__nascondiAnteprima())
  await attendi(400)

  // 5. Foglio lavoro, aperto nella stessa scheda
  const indirizzoFoglio = await page.getByRole("link", { name: "Foglio lavoro" }).getAttribute("href")
  if (!indirizzoFoglio) throw new Error("Link al foglio lavoro non trovato.")
  await vai(page, indirizzoFoglio)
  await page.getByTestId("foglio-lavoro").waitFor()
  await attendi(800)
  await scatta(page, "foglio")

  // 6. Scheda cliente di Luca Conti
  await vai(page, "/customers")
  const indirizzoLuca = await page.getByRole("link", { name: "Luca Conti" }).getAttribute("href")
  if (!indirizzoLuca) throw new Error("Link al profilo di Luca Conti non trovato.")
  await vai(page, indirizzoLuca)
  await page.waitForURL(/\/customers\/profilo/)
  await attendi(1200)
  await scatta(page, "cliente")
}

async function main() {
  const demo = leggiDemo()
  if (!(await portaLibera())) throw new Error("La porta 3300 è già occupata: chiudere il programma che la usa (per esempio il video).")

  rinfrescaDemo()

  let server: ChildProcess | null = null
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    const env = ambienteApp(demo)
    costruisciApp(env)
    server = await avviaServer(env)

    browser = await chromium.launch()
    const sessione = await accedi(browser, demo)

    console.log("→ Schermate…")
    mkdirSync(CARTELLA_IMG, { recursive: true })
    const context = await browser.newContext({
      baseURL: BASE_URL,
      locale: "it-IT",
      viewport: { width: LARGHEZZA, height: ALTEZZA },
      deviceScaleFactor: 2,
      storageState: sessione,
    })
    await context.addInitScript(OVERLAY_SCRIPT)
    const page = await context.newPage()
    await scattaTutte(page)
    await context.close()

    console.log(`\nSchermate pronte in ${CARTELLA_IMG}`)
  } finally {
    await browser?.close().catch(() => {})
    fermaServer(server)
  }
}

main().catch((errore: unknown) => {
  console.error("ERRORE:", errore instanceof Error ? (errore.stack ?? errore.message) : errore)
  process.exit(1)
})
```

- [ ] **Step 3: Verificare tipi e lint**

Run: `npx tsc --noEmit && npx eslint scripts`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add scripts/demo-screenshots/run.ts .gitignore
git commit -m "feat(demo): script che scatta le schermate con didascalie in russo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Esecuzione reale — schermate e video

Verifica con l'app vera (stessa cartella, `.env.demo.local` e `.env.local` presenti). Ogni esecuzione fa una build di produzione: qualche minuto. Non lanciare le due insieme (stessa porta 3300).

- [ ] **Step 1: Controllare ffmpeg**

Run: `node -e "require('ffmpeg-static')" || npm install --no-save ffmpeg-static`
Expected: nessun errore (o installazione completata).

- [ ] **Step 2: Scattare le schermate**

Run: `npm run demo:screenshots`
Expected: stampa "Login demo riuscito" e sei righe con i percorsi `presentazione-img/01-oggi.png` … `06-cliente.png`, poi "Schermate pronte". Se Playwright rifiuta l'opzione `style` di `screenshot` (versione vecchia), sostituire con `await page.addStyleTag({ content: NASCONDI_CURSORE })` prima di `page.screenshot` e togliere `style`.

- [ ] **Step 3: Guardare le sei immagini**

Aprire ciascun PNG con lo strumento Read. Per ognuna controllare: cirillico leggibile e non tagliato, barra della didascalia non copre la parte importante (campi del nuovo ordine, riquadro "Avvisa il cliente"), nessun cursore finto, dati demo coerenti (Luca Conti, Anna Bellini, Giulia Ferri). Se una didascalia copre contenuti essenziali o va su tre righe, accorciarla in `src/lib/demo/schermate.ts` e rilanciare il Task 2 step 4 e questo task.

- [ ] **Step 4: Registrare il video russo**

Run: `npm run demo:video:ru`
Expected: "Lingua delle didascalie: ru", poi "Video pronto" con `video/oltre-la-bottega-demo-ru.mp4`, durata circa 2:50.

- [ ] **Step 5: Controllare il video**

Estrarre alcuni fotogrammi con ffmpeg (percorso in `require('ffmpeg-static')`) a 5, 40, 80, 120 e 160 secondi, per esempio:

```bash
FF=$(node -p "require('ffmpeg-static')")
mkdir -p "$TEMP/ru-frames"
for t in 5 40 80 120 160; do "$FF" -y -loglevel error -ss $t -i video/oltre-la-bottega-demo-ru.mp4 -frames:v 1 "$TEMP/ru-frames/f$t.png"; done
```

Aprirli con Read: la didascalia russa è presente e leggibile. Nell'ultimo fotogramma deve comparire il contatto WhatsApp se `DEMO_VIDEO_WHATSAPP` è impostato in `.env.demo.local`, altrimenti il segnaposto `[numero WhatsApp]` (da segnalare a Olga).

- [ ] **Step 6: Nessun commit** (le uscite sono in cartelle ignorate da git). Verificare: `git status --short` non mostra `video/` né `presentazione-img/`.

---

### Task 7: Presentazione in russo (HTML)

**Files:**
- Create: `docs/presentazione-commerciale-ru.html`

- [ ] **Step 1: Scrivere il markup russo nel file temporaneo**

Scrivere in `$TEMP/pagine-ru.html` (cartella temporanea di sessione) il contenuto qui sotto. Sono le 12 sezioni, con la parte tra `<div class="deck" id="deck">` e il suo `</div>` di chiusura esclusi.

```html

  <section class="page page-title">
    <div class="page-content">
      <p class="eyebrow">Настоящая история, а не демо</p>
      <h1>Oltre la Bottega</h1>
      <p class="subtitle">Создано в мастерской, чтобы меньше чем за минуту отвечать на один вопрос: что мне нужно сделать сегодня?</p>
      <p class="lede">Это не очередная CRM из каталога управленческого ПО. Это инструмент, который я создала для своей мастерской — для прилавка, клиента, который ждёт, и рук, ещё занятых предыдущей работой. А не для письменного стола.</p>
    </div>
    <div class="brand-corner"><span class="ob-mark">OB</span> Oltre la Bottega</div>
  </section>

  <section class="page">
    <div class="page-content">
      <p class="eyebrow">Каждый день, до девяти утра</p>
      <blockquote class="big-quote">Что мне нужно сделать сегодня?</blockquote>
      <p class="resolution" style="margin-top:28px;">За этим вопросом всегда стоят одни и те же три мысли.</p>
    </div>
  </section>

  <section class="page page-prima">
    <div class="page-content">
      <p class="mini-label prima">Раньше — 1 из 3</p>
      <h2>Сколько заказов у вас сейчас в голове?</h2>
      <p>Клиент сказал «в следующий четверг» — это помните вы, а не система. Вы записали это на листке, который оказался под другими листками, или в тетради, открытой не на той странице. Это работает, пока работает — пока срок не всплывает только потому, что клиент сам звонит и спрашивает.</p>
      <p class="consequence">Это не просто досадная неожиданность: это невыполненное обещание перед человеком, который его прекрасно помнил.</p>
    </div>
  </section>

  <section class="page page-prima page-with-shot">
    <div class="page-content">
      <div class="text">
        <p class="mini-label prima">Раньше — 2 из 3</p>
        <h2>Клиент, которого вы уже забыли</h2>
        <p>К прилавку подходит клиент, которого вы знаете в лицо. Что он заказывал в прошлый раз? Вы уже просили у него отзыв? Осталось ли что-то незавершённое? Всё это должно быть в голове — но в голове всё теряется, особенно в напряжённые дни.</p>
        <p class="consequence">Клиент не скажет этого вслух, но почувствует: если вас не помнят, значит, вы недостаточно важны, чтобы вас запомнить. И в следующий раз он, возможно, не вернётся.</p>
      </div>
      <figure class="shot"><img src="../presentazione-img/06-cliente.png" alt="Карточка клиента с историей его заказов"></figure>
    </div>
  </section>

  <section class="page page-prima">
    <div class="page-content">
      <p class="mini-label prima">Раньше — 3 из 3</p>
      <h2>Дела, которые вечно откладываются</h2>
      <p>Попросить отзыв, перезвонить поставщику, сообщить тем, кто ждёт: вы знаете, что всё это нужно сделать, — но в нужный момент, у прилавка, при клиенте, свободной минуты нет. Это не лень: настоящая работа всегда на первом месте.</p>
      <p class="consequence">В итоге мастерская работает хорошо, но за её стенами остаётся незаметной — а тот, кто работает хуже вас, зато всегда просит отзыв, заметен больше.</p>
    </div>
  </section>

  <section class="page page-with-shot">
    <div class="page-content">
      <div class="text">
        <p class="mini-label dopo">После</p>
        <blockquote class="big-quote" style="font-size:clamp(26px,4vw,44px);">Что мне нужно сделать сегодня?</blockquote>
        <p class="resolution">Oltre la Bottega отвечает на этот вопрос меньше чем за минуту. Обещания остаются записанными, клиенты не теряются из виду, а просьба об отзыве превращается в один клик вместо лишней мысли. Приложение не управляет компанией на 50 сотрудников — оно управляет вашим днём.</p>
      </div>
      <figure class="shot"><img src="../presentazione-img/01-oggi.png" alt="Страница «Oggi» со всеми делами на сегодня"></figure>
    </div>
  </section>

  <section class="page page-entry">
    <span class="entry-watermark" aria-hidden="true">01</span>
    <div class="page-content">
      <p class="entry-eyebrow">Пункт 01</p>
      <h2>Рождено из реальной проблемы, а не из списка функций</h2>
      <p>Каждая функция — от «кто принял заказ» до напоминания о материале, которого не хватает у поставщика, и кнопки для просьбы об отзыве — появилась из того, что действительно случилось у прилавка, а не на мозговом штурме за столом. Из-за заказа без сохранённого номера телефона нельзя было отправить сообщение «готово к выдаче»: теперь телефон — обязательное поле. Отзывы никто не просил — не из лени, а потому что в момент выдачи нет свободной минуты: теперь достаточно одной кнопки, которая сама готовит сообщение в WhatsApp.</p>
      <p class="caption">Детали, которые замечает только тот, кто действительно работает в мастерской.</p>
    </div>
  </section>

  <section class="page page-entry">
    <span class="entry-watermark" aria-hidden="true">02</span>
    <div class="page-content">
      <p class="entry-eyebrow">Пункт 02</p>
      <h2>Ваши данные остаются вашими</h2>
      <p>Вы не делите пространство с тысячей других предприятий: у вашей мастерской свой отдельный уголок, и никто не может изменить правила игры в один день или лишить вас доступа к вашим данным.</p>
    </div>
  </section>

  <section class="page page-entry page-with-shot">
    <span class="entry-watermark" aria-hidden="true">03</span>
    <div class="page-content">
      <div class="text">
        <p class="entry-eyebrow">Пункт 03</p>
        <h2>Один вопрос на экран: что делать сегодня</h2>
        <p>Не десятки меню, которые нужно выучить наизусть. Любое частое действие — новый заказ, смена статуса — требует не больше 3–4 шагов.</p>
      </div>
      <figure class="shot"><img src="../presentazione-img/02-nuovo-ordine.png" alt="Новый заказ: данные вернувшегося клиента заполняются сами"></figure>
    </div>
  </section>

  <section class="page page-entry page-with-shot">
    <span class="entry-watermark" aria-hidden="true">04</span>
    <div class="page-content">
      <div class="text">
        <p class="entry-eyebrow">Пункт 04</p>
        <h2>Говорит на языке мастерской, а не офиса</h2>
        <p>Готовые сообщения для WhatsApp, этикетки с QR-кодом, которые клеятся прямо на изделия, и планшет на прилавке — а не стол с двумя мониторами.</p>
      </div>
      <figure class="shot"><img src="../presentazione-img/04-avvisa.png" alt="Готовое сообщение клиенту в WhatsApp"></figure>
    </div>
  </section>

  <section class="page">
    <div class="page-content">
      <p class="eyebrow">Кому это нужно</p>
      <h2 class="who-heading">Для кого</h2>
      <p class="who-body">Ремесленные мастерские и микробизнес от 1 до 5 человек, которые сегодня ведут заказы вручную или с помощью инструментов, созданных совсем для другого.</p>
      <p class="highlight-line">Если вы узнаёте себя в вопросе «что мне нужно сделать сегодня?», этот инструмент создан именно для вас.</p>
    </div>
  </section>

  <section class="page page-closing">
    <div class="page-content">
      <h2>Он создан,<br>потому что нужен был мне.</h2>
      <div class="stamp">
        <span class="mark">OB</span>
        <span class="word">Oltre la Bottega</span>
      </div>
      <p class="closing-note">Давайте поговорим, когда вам удобно.</p>
    </div>
  </section>

```

(Le schermate 03 «bacheca» e 05 «foglio» restano disponibili in `presentazione-img/` ma non sono inserite: nel deck non c'è una pagina in cui servano. Olga può aggiungerle alle slide.)

- [ ] **Step 2: Assemblare il file**

```bash
O=docs/presentazione-commerciale.html
R=docs/presentazione-commerciale-ru.html
head -n 380 "$O" > "$R"
cat "$TEMP/pagine-ru.html" >> "$R"
tail -n +492 "$O" >> "$R"
```

(`head -n 380` termina con `<div class="deck" id="deck">`; `tail -n +492` riparte dal `</div>` che chiude il deck.)

- [ ] **Step 3: Intestazione, lingua, stili delle immagini, etichette**

In `docs/presentazione-commerciale-ru.html` applicare queste modifiche con Edit:

1. Sostituire `<title>Oltre la Bottega</title>` con:

```html
<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Oltre la Bottega</title>
```

2. Subito prima di `  @media (max-width:640px){` inserire:

```css
  /* Pagine con una schermata dell'app accanto al testo */
  .page-with-shot .page-content{
    max-width:none;
    display:grid;
    grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);
    gap:clamp(24px,4vw,56px);
    align-items:center;
  }
  .page-with-shot .text{ position:relative; }
  figure.shot{ margin:0; }
  figure.shot img{
    display:block;
    width:100%;
    max-height:60vh;
    object-fit:contain;
    object-position:center;
    border-radius:10px;
    border:1px solid var(--linen);
    box-shadow:0 8px 24px var(--shadow);
    background:var(--paper);
  }
  @media (max-width:900px){
    .page-with-shot .page-content{ grid-template-columns:1fr; }
    figure.shot img{ max-height:40vh; }
  }

```

3. Etichette di navigazione: `aria-label="Navigazione pagine"` → `aria-label="Навигация по страницам"`; `aria-label="Pagina precedente"` → `aria-label="Предыдущая страница"`; `aria-label="Pagina successiva"` → `aria-label="Следующая страница"`; nello script `'Vai alla pagina '` → `'Перейти на страницу '`.

- [ ] **Step 4: Verificare che non resti italiano**

Run: `grep -nE "Pagina|Vai alla|Voce 0|Prima —|Dopo<" docs/presentazione-commerciale-ru.html`
Expected: nessuna riga.

- [ ] **Step 5: Commit**

```bash
git add docs/presentazione-commerciale-ru.html
git commit -m "docs: presentazione commerciale in russo con le schermate dell'app

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: PDF della presentazione russa

**Files:**
- Create: `scripts/presentazione/pdf.ts`
- Create: `docs/presentazione-commerciale-ru.pdf`

- [ ] **Step 1: Creare lo script**

`scripts/presentazione/pdf.ts`:

```ts
// PDF della presentazione commerciale in russo: una pagina per sezione.
// Uso: npm run presentazione:pdf   (prima: npm run demo:screenshots, per le immagini)
import { existsSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "@playwright/test"

const radice = process.cwd()
const HTML = path.join(radice, "docs", "presentazione-commerciale-ru.html")
const PDF = path.join(radice, "docs", "presentazione-commerciale-ru.pdf")
const IMMAGINI = ["01-oggi", "02-nuovo-ordine", "04-avvisa", "06-cliente"].map((n) => path.join(radice, "presentazione-img", `${n}.png`))

async function main() {
  const mancanti = IMMAGINI.filter((f) => !existsSync(f))
  if (mancanti.length > 0) throw new Error(`Mancano le schermate (lanciare npm run demo:screenshots):\n${mancanti.join("\n")}`)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" })
    await page.evaluate(() => document.fonts.ready)
    await page.emulateMedia({ media: "print" })
    await page.pdf({ path: PDF, width: "1280px", height: "720px", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } })
    console.log(`PDF pronto: ${PDF}`)
  } finally {
    await browser.close()
  }
}

main().catch((errore: unknown) => {
  console.error("ERRORE:", errore instanceof Error ? (errore.stack ?? errore.message) : errore)
  process.exit(1)
})
```

- [ ] **Step 2: Generare il PDF**

Run: `npm run presentazione:pdf`
Expected: "PDF pronto: …\docs\presentazione-commerciale-ru.pdf".

- [ ] **Step 3: Controllare le pagine**

Con lo strumento Read, aprire il PDF (`pages: "1-6"`, poi `"7-12"`). Atteso: 12 pagine, una per sezione, testo russo leggibile, nessun testo italiano residuo, le quattro schermate visibili accanto al testo e non tagliate, nessuna pagina in più per overflow. Se una pagina con immagine trabocca su una seconda pagina, ridurre `max-height` di `figure.shot img` (per esempio a `50vh`) nel CSS dell'HTML e rigenerare. Se il PDF ha più di 12 pagine per altri motivi, investigare prima di proseguire.

- [ ] **Step 4: Commit**

```bash
git add scripts/presentazione/pdf.ts docs/presentazione-commerciale-ru.html docs/presentazione-commerciale-ru.pdf
git commit -m "feat(docs): PDF della presentazione in russo e script per generarlo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentazione

**Files:**
- Create: `docs/demo/materiale-in-russo.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Guida per Olga**

`docs/demo/materiale-in-russo.md`:

```markdown
# Materiale in russo per la presentazione

L'app e la demo restano in italiano. In russo ci sono solo: le didascalie del video, le scritte sulle schermate e la presentazione.

Esegui i comandi dalla cartella del progetto (`D:\Documenti\Projects\oltre_la_bottega`). Ognuno costruisce l'app, quindi ci vogliono alcuni minuti. **Non lanciarne due insieme.**

| Cosa | Comando | Dove trovi il risultato |
|---|---|---|
| Video con didascalie in russo | `npm run demo:video:ru` | `video\oltre-la-bottega-demo-ru.mp4` |
| Sei schermate con scritte in russo | `npm run demo:screenshots` | cartella `presentazione-img\` |
| PDF della presentazione | `npm run presentazione:pdf` | `docs\presentazione-commerciale-ru.pdf` |

Ordine: prima le schermate, poi il PDF (il PDF le usa). Il video è indipendente.

Per cambiare un testo russo: didascalie del video in `src/lib/demo/videoScenes.ts` (`SCENE_RU`), scritte sulle schermate in `src/lib/demo/schermate.ts`, testo della presentazione in `docs/presentazione-commerciale-ru.html`. Poi rilancia il comando corrispondente.

Il numero WhatsApp nell'ultima scritta del video viene da `DEMO_VIDEO_WHATSAPP` in `.env.demo.local`; se manca, compare `[numero WhatsApp]`.

Il messaggio WhatsApp/email che si vede per qualche secondo nel video e in una schermata è il testo vero dell'app, quindi resta in italiano.
```

- [ ] **Step 2: `CLAUDE.md`**

Nella tabella "Decisioni chiave" aggiungere, dopo la riga "Demo privata con dati finti e video dimostrativo", una riga:

```
| Materiale per la presentazione in russo, senza cambio lingua nell'app (2026-10-11) | Olga deve presentare in russo. L'interfaccia tradotta avrebbe richiesto una seconda istanza demo (i dati demo stanno in un solo database) e non c'è più spazio per un altro progetto gratuito, quindi app e demo restano in italiano e si traducono solo i materiali: `npm run demo:video:ru` (stesso copione del video, `SCENE_RU` in `src/lib/demo/videoScenes.ts`, uscita `video/oltre-la-bottega-demo-ru.mp4`), `npm run demo:screenshots` (sei schermate 1280×720 @2x con barra di didascalia russa in `presentazione-img/`, ignorata da git) e `docs/presentazione-commerciale-ru.html`/`.pdf` (copia tradotta della presentazione commerciale con quattro schermate; `npm run presentazione:pdf`). La preparazione della demo (build, server, login, regia del mouse) è stata estratta in `scripts/demo-common.ts` e usata da video e schermate. Il testo del messaggio WhatsApp/email mostrato nel video viene dall'app vera e resta in italiano. Testi russi scritti da Claude, da rileggere da Olga. Il cambio lingua dentro l'app resta un'idea futura, non decisa. Design in `docs/superpowers/specs/2026-10-11-presentazione-russa-design.md`, piano in `docs/superpowers/plans/2026-10-11-presentazione-russa-plan.md`, uso in `docs/demo/materiale-in-russo.md` |
```

Nella sezione Testing aggiungere un punto "Feature (2026-10-11)" che riporta l'esito reale delle verifiche (suite/test verdi, schermate e video generati e controllati, PDF di 12 pagine controllato) — compilarlo con i numeri veri misurati nei Task 6 e 8, non con valori presunti.

- [ ] **Step 3: Verifica finale**

Run: `npx jest --roots=src && npx tsc --noEmit && npx eslint scripts src/lib/demo`
Expected: tutto verde/pulito.

- [ ] **Step 4: Commit**

```bash
git add docs/demo/materiale-in-russo.md CLAUDE.md
git commit -m "docs: materiale in russo per la presentazione (guida e CLAUDE.md)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review rispetto al design

- Video in russo (`--lang=ru`, `SCENE_RU`, nome file `-ru`, test di parità): Task 1 e 4, eseguito davvero nel Task 6.
- Schermate con didascalia russa, modulo condiviso estratto, `deviceScaleFactor: 2`, cartella ignorata da git: Task 2, 3, 5, 6.
- Presentazione russa con quattro schermate e PDF: Task 7 e 8. Il design diceva "non più del 45% dell'altezza"; il piano usa 60vh con layout affiancato (testo e immagine su due colonne), perché al 45% le scritte nell'immagine diventano troppo piccole. Corretto anche nel design.
- Documentazione e `CLAUDE.md`: Task 9.
- Nomi coerenti: `SCENE_RU`, `scenePerLingua`, `parseLingua`, `Lingua`, `SCHERMATE_RU`, `SchermataId`, `nomeFile`, `sceneAttive`, `demo-common.ts` sono usati con la stessa grafia in tutti i task.
