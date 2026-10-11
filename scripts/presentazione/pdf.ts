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
