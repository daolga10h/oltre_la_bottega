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
  PORTA,
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
  if (!(await portaLibera())) throw new Error(`La porta ${PORTA} è già occupata: chiudere il programma che la usa (per esempio il video).`)

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
