// Video dimostrativo automatico, muto con didascalie in italiano.
// Uso: npm run demo:video   (serve una volta: npm install --no-save ffmpeg-static)
// Design: docs/superpowers/specs/2026-09-26-video-automatico-design.md
import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { chromium, type Browser, type Locator, type Page } from "@playwright/test"
import { parseEnvFile } from "../../src/lib/demo/envFile"
import { SCENE, conContatto, tempoInScena, type Scena } from "../../src/lib/demo/videoScenes"
import { OVERLAY_SCRIPT } from "./overlay"

const radice = process.cwd()
const PORTA = 3300
const BASE_URL = `http://localhost:${PORTA}`
const LARGHEZZA = 1280
const ALTEZZA = 720
const CARTELLA_VIDEO = path.join(radice, "video")
const FILE_WEBM = path.join(CARTELLA_VIDEO, "oltre-la-bottega-demo.webm")
const FILE_MP4 = path.join(CARTELLA_VIDEO, "oltre-la-bottega-demo.mp4")
const BIN_NEXT = path.join(radice, "node_modules", "next", "dist", "bin", "next")

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- preparazione

function rinfrescaDemo(): void {
  console.log("→ Rinfresco dei dati demo (npm run demo:reset)…")
  // Ambiente del processo così com'è: il controllo di sicurezza dello script
  // confronta l'indirizzo demo con quello vero di .env.local.
  const esito = spawnSync("npx tsx scripts/demo-reset.ts", { cwd: radice, stdio: "inherit", shell: true })
  if (esito.status !== 0) throw new Error("Il rinfresco dei dati demo non è riuscito: mi fermo.")
}

function leggiDemo() {
  const file = path.join(radice, ".env.demo.local")
  if (!existsSync(file)) throw new Error("Manca .env.demo.local (vedere docs/demo/configurazione-demo.md).")
  const demo = parseEnvFile(readFileSync(file, "utf-8"))
  const { DEMO_SUPABASE_URL: url, DEMO_ANON_KEY: anon, DEMO_USER_EMAIL: email, DEMO_PIN: pin } = demo
  if (!url || !anon || !email || !pin) {
    throw new Error("Mancano dei valori in .env.demo.local (servono DEMO_SUPABASE_URL, DEMO_ANON_KEY, DEMO_USER_EMAIL, DEMO_PIN).")
  }
  return { url: url.startsWith("http") ? url : `https://${url}`, anon, email, pin, contatto: demo.DEMO_VIDEO_WHATSAPP }
}

/**
 * Ambiente per build e server: le variabili passate qui vincono sul `.env.local`
 * del progetto (quello della bottega vera). Le chiavi segrete che l'app legge da
 * lì vengono coperte con valori inutilizzabili, così il server del video non ha
 * mai in mano le chiavi vere.
 */
function ambienteApp(demo: ReturnType<typeof leggiDemo>): NodeJS.ProcessEnv {
  const disattivata = "disattivata-nel-video-demo"
  return {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: demo.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: demo.anon,
    NEXT_PUBLIC_PLAN: "base",
    SUPABASE_SERVICE_ROLE_KEY: disattivata,
    CRON_SECRET: disattivata,
    RESEND_API_KEY: disattivata,
    BACKUP_EMAIL_FROM: disattivata,
    BACKUP_EMAIL_TO: disattivata,
  }
}

async function portaLibera(): Promise<boolean> {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return false
  } catch {
    return true
  }
}

function costruisciApp(env: NodeJS.ProcessEnv): void {
  console.log("→ Build di produzione (next build), qualche minuto…")
  const esito = spawnSync(process.execPath, [BIN_NEXT, "build"], { cwd: radice, env, stdio: "inherit" })
  if (esito.status !== 0) throw new Error("next build non è riuscito.")
}

async function avviaServer(env: NodeJS.ProcessEnv): Promise<ChildProcess> {
  console.log(`→ Avvio dell'app su ${BASE_URL}…`)
  const server = spawn(process.execPath, [BIN_NEXT, "start", "-p", String(PORTA)], {
    cwd: radice,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  })
  const scadenza = Date.now() + 60_000
  while (Date.now() < scadenza) {
    if (server.exitCode !== null) throw new Error("Il server si è fermato subito dopo l'avvio.")
    try {
      const r = await fetch(`${BASE_URL}/login`, { signal: AbortSignal.timeout(3000) })
      if (r.ok) return server
    } catch {}
    await attendi(500)
  }
  throw new Error("Il server non risponde dopo 60 secondi.")
}

function fermaServer(server: ChildProcess | null): void {
  if (!server?.pid || server.exitCode !== null) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    server.kill("SIGTERM")
  }
}

// ------------------------------------------------------------------ login

/** Login con il PIN in un contesto che NON registra, poi controllo che sia la demo. */
async function accedi(browser: Browser, demo: ReturnType<typeof leggiDemo>) {
  const context = await browser.newContext({ baseURL: BASE_URL, locale: "it-IT" })
  try {
    const page = await context.newPage()
    await page.goto("/login")
    await page.getByRole("button", { name: "PIN", exact: true }).click()
    const campoEmail = page.locator("#pin-email")
    if (await campoEmail.isVisible()) await campoEmail.fill(demo.email)
    await page.locator("#pin").fill(demo.pin)
    await page.getByRole("button", { name: "Accedi" }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 }).catch(() => {
      throw new Error("Il login con il PIN demo non è riuscito: l'app non sembra collegata al progetto demo. Non registro niente.")
    })
    // Controllo di sicurezza: sulla pagina Oggi devono esserci i clienti finti.
    const clienteDemo = await page
      .getByText("Anna Bellini")
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    if (!clienteDemo) {
      throw new Error("Nella pagina Oggi non c'è il cliente demo \"Anna Bellini\": non registro niente.")
    }
    console.log("→ Login demo riuscito, dati demo visibili.")
    return await context.storageState()
  } finally {
    await context.close()
  }
}

// ------------------------------------------------------------ regia del mouse

class Regia {
  private x = LARGHEZZA / 2
  private y = ALTEZZA / 2
  constructor(private page: Page) {}

  async muoviA(x: number, y: number, passi = 28): Promise<void> {
    await this.page.mouse.move(x, y, { steps: passi })
    this.x = x
    this.y = y
  }

  /** Porta l'elemento al centro dello schermo con uno scorrimento morbido. */
  async mostraElemento(locator: Locator): Promise<void> {
    await locator.waitFor({ state: "visible" })
    const serveScorrere = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.top < 70 || r.bottom > window.innerHeight - 130
    })
    if (serveScorrere) {
      await locator.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }))
      await attendi(900)
    }
  }

  async centroDi(locator: Locator): Promise<{ x: number; y: number }> {
    await this.mostraElemento(locator)
    const box = await locator.boundingBox()
    if (!box) throw new Error("Elemento non visibile sullo schermo.")
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  async puntaA(locator: Locator): Promise<{ x: number; y: number }> {
    const c = await this.centroDi(locator)
    const distanza = Math.hypot(c.x - this.x, c.y - this.y)
    await this.muoviA(c.x, c.y, Math.max(12, Math.round(distanza / 18)))
    return c
  }

  async clicca(locator: Locator): Promise<void> {
    await this.puntaA(locator)
    await attendi(250)
    await this.page.mouse.down()
    await attendi(90)
    await this.page.mouse.up()
    await attendi(300)
  }

  /** Clic "finto" (solo il cerchio) su un link, senza lasciarlo aprire una nuova scheda. */
  async cliccaSoloEffetto(locator: Locator): Promise<void> {
    const c = await this.puntaA(locator)
    await attendi(250)
    await this.page.evaluate(([x, y]) => (window as unknown as { __ripple: (x: number, y: number) => void }).__ripple(x, y), [c.x, c.y])
    await attendi(400)
  }

  async scrivi(locator: Locator, testo: string): Promise<void> {
    await this.clicca(locator)
    await locator.pressSequentially(testo, { delay: 70 })
  }

  async scorri(pixel: number, passi = 12): Promise<void> {
    for (let i = 0; i < passi; i++) {
      await this.page.mouse.wheel(0, pixel / passi)
      await attendi(45)
    }
  }
}

/** Numero WhatsApp da mostrare nell'ultima scritta (da `.env.demo.local`, mai dal codice). */
let contattoWhatsApp: string | undefined

async function didascalia(page: Page, testo: string | null): Promise<void> {
  await page.evaluate((t) => (window as unknown as { __setCaption: (t: string | null) => void }).__setCaption(t), testo)
}

/**
 * Mostra la didascalia `indice` della scena ed esegue le azioni collegate; la
 * scritta resta in vista almeno per il tempo pianificato.
 */
async function conDidascalia(page: Page, scena: Scena, indice: number, azioni: () => Promise<void> = async () => {}) {
  const d = scena.didascalie[indice]
  const inizio = Date.now()
  await didascalia(page, conContatto(d.testo, contattoWhatsApp))
  await azioni()
  const resto = tempoInScena(d) * 1000 - (Date.now() - inizio)
  if (resto > 0) await attendi(resto)
}

function scena(id: Scena["id"]): Scena {
  const s = SCENE.find((x) => x.id === id)
  if (!s) throw new Error(`Scena mancante: ${id}`)
  return s
}

function fraGiorni(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const due = (v: number) => String(v).padStart(2, "0")
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
}

// ------------------------------------------------------------------- scene

async function gira(page: Page): Promise<void> {
  const regia = new Regia(page)
  const menu = (voce: string) => page.locator("aside").getByRole("link", { name: voce, exact: true })

  // 1. Apertura, su Oggi
  const apertura = scena("apertura")
  await conDidascalia(page, apertura, 0, async () => {
    await attendi(1200)
    await regia.muoviA(760, 300, 40)
  })
  await conDidascalia(page, apertura, 1, async () => {
    await regia.muoviA(560, 220, 30)
  })

  // 2. Oggi: scorre sulle sezioni
  await conDidascalia(page, scena("oggi"), 0, async () => {
    await regia.muoviA(700, 380, 20)
    for (let i = 0; i < 4; i++) {
      await regia.scorri(260)
      await attendi(1500)
    }
    await attendi(800)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }))
    await attendi(1200)
  })

  // 3. Nuovo ordine per un cliente che torna
  const nuovo = scena("nuovo-ordine")
  await conDidascalia(page, nuovo, 0, async () => {
    await regia.clicca(page.getByRole("link", { name: "Nuovo ordine" }).first())
    await page.waitForURL(/\/orders\/new/)
    await page.locator("#nome").waitFor()
    await attendi(1200) // l'elenco clienti per i suggerimenti si carica all'apertura
    await regia.scrivi(page.locator("#nome"), "Luca")
    const suggerimento = page.getByRole("button", { name: /Luca Conti/ })
    await suggerimento.waitFor()
    await attendi(900)
    await regia.clicca(suggerimento)
    await attendi(1000)
    await regia.puntaA(page.locator("#telefono"))
  })
  await conDidascalia(page, nuovo, 1, async () => {
    const riga = page.locator("div.rounded-lg.border-border.p-3").first()
    await regia.scrivi(riga.getByPlaceholder("Es. targa plexiglass, timbro, portachiavi inciso..."), "Targa per condominio")
    await attendi(400)
    await regia.scrivi(riga.locator('input[type="number"]').nth(1), "30")
    await attendi(400)
    const data = page.locator("#data_consegna")
    await regia.clicca(data)
    await data.fill(fraGiorni(7))
    await page.keyboard.press("Tab")
    await attendi(700)
    await regia.clicca(page.getByRole("button", { name: "Crea ordine" }))
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    await attendi(1200)
  })

  // 4. Bacheca: il lavoro di Giulia Ferri (da consegnare oggi) passa da In lavorazione a Pronto
  await conDidascalia(page, scena("bacheca"), 0, async () => {
    await regia.clicca(menu("Bacheca"))
    await page.waitForURL(/\/kanban/)
    const scheda = page.locator("div.rounded-lg.space-y-2").filter({ hasText: "Giulia Ferri" })
    await scheda.waitFor()
    await attendi(1200)
    await regia.clicca(scheda.locator('[data-slot="select-trigger"]'))
    const pronto = page.getByRole("option", { name: "Pronto" })
    await pronto.waitFor()
    await attendi(700)
    await regia.clicca(pronto)
    await attendi(1500)
  })

  // 5. Avvisa il cliente: ordine Pronto di Anna Bellini, pulsante QR
  await conDidascalia(page, scena("avvisa"), 0, async () => {
    const scheda = page.locator("div.rounded-lg.space-y-2").filter({ hasText: "Anna Bellini" })
    await regia.clicca(scheda.getByRole("link", { name: "Scheda" }))
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
    const avvisa = page.getByText("Avvisa il cliente:")
    await avvisa.waitFor()
    await attendi(800)
    await regia.puntaA(avvisa)
    await attendi(900)
    await regia.clicca(page.getByRole("button", { name: "QR" }))
    await attendi(1200)
    await regia.muoviA(900, 420, 25)
  })

  // 6. Foglio lavoro, nella stessa scheda (nessuna nuova scheda = un solo file video)
  await conDidascalia(page, scena("foglio"), 0, async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }))
    await attendi(700)
    const link = page.getByRole("link", { name: "Foglio lavoro" })
    const indirizzo = await link.getAttribute("href")
    if (!indirizzo) throw new Error("Link al foglio lavoro non trovato.")
    await regia.cliccaSoloEffetto(link)
    await page.goto(indirizzo)
    await page.getByTestId("foglio-lavoro").waitFor()
    await attendi(1500)
    await regia.muoviA(560, 420, 30)
  })

  // 7. Clienti: il profilo di Luca Conti con i suoi ordini
  await conDidascalia(page, scena("clienti"), 0, async () => {
    await page.goBack()
    await page.locator("aside").waitFor()
    await regia.clicca(menu("Clienti"))
    await page.waitForURL(/\/customers/)
    const luca = page.getByRole("link", { name: "Luca Conti" })
    await luca.waitFor()
    await attendi(1200)
    await regia.clicca(luca)
    await page.waitForURL(/\/customers\/profilo/)
    await attendi(1800)
    await regia.muoviA(700, 420, 20)
    await regia.scorri(240)
  })

  // 8. Chiusura, su Oggi
  const chiusura = scena("chiusura")
  await conDidascalia(page, chiusura, 0, async () => {
    await regia.clicca(menu("Oggi"))
    await page.waitForURL(/\/dashboard/)
    await regia.muoviA(900, 300, 30)
  })
  await conDidascalia(page, chiusura, 1)
  await conDidascalia(page, chiusura, 2)
}

// -------------------------------------------------------------- conversione

function percorsoFfmpeg(): string {
  try {
    const richiedi = createRequire(path.join(radice, "package.json"))
    const percorso = richiedi("ffmpeg-static") as string | null
    if (percorso && existsSync(percorso)) return percorso
  } catch {}
  throw new Error("ffmpeg non trovato: installarlo una volta con  npm install --no-save ffmpeg-static")
}

function convertiInMp4(ffmpeg: string, tagliaSecondi: number): void {
  console.log("→ Conversione in MP4…")
  const esito = spawnSync(
    ffmpeg,
    [
      "-y", "-hide_banner", "-loglevel", "error",
      "-ss", tagliaSecondi.toFixed(2), "-i", FILE_WEBM,
      "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "22",
      "-pix_fmt", "yuv420p", "-r", "25", "-movflags", "+faststart",
      FILE_MP4,
    ],
    { stdio: "inherit" }
  )
  if (esito.status !== 0) throw new Error("La conversione con ffmpeg non è riuscita.")
}

function durataVideo(ffmpeg: string, file: string): string {
  const esito = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf-8" })
  return /Duration: (\d+:\d+:\d+\.\d+)/.exec(esito.stderr ?? "")?.[1] ?? "sconosciuta"
}

// --------------------------------------------------------------------- main

async function main() {
  const ffmpeg = percorsoFfmpeg()
  const demo = leggiDemo()
  contattoWhatsApp = demo.contatto
  if (!(await portaLibera())) throw new Error(`La porta ${PORTA} è già occupata: chiudere il programma che la usa.`)

  rinfrescaDemo()

  let server: ChildProcess | null = null
  let browser: Browser | null = null
  const cartellaRiprese = mkdtempSync(path.join(os.tmpdir(), "demo-video-"))
  try {
    const env = ambienteApp(demo)
    costruisciApp(env)
    server = await avviaServer(env)

    browser = await chromium.launch()
    const sessione = await accedi(browser, demo)

    console.log("→ Registrazione…")
    const context = await browser.newContext({
      baseURL: BASE_URL,
      locale: "it-IT",
      viewport: { width: LARGHEZZA, height: ALTEZZA },
      storageState: sessione,
      recordVideo: { dir: cartellaRiprese, size: { width: LARGHEZZA, height: ALTEZZA } },
    })
    await context.addInitScript(OVERLAY_SCRIPT)
    const inizioRiprese = Date.now()
    const page = await context.newPage()
    await page.goto("/dashboard")
    await page.getByText("Anna Bellini").first().waitFor()
    await attendi(600)
    // Tutto ciò che precede questo istante (pagina bianca, caricamento) si taglia.
    const taglio = Math.max(0, (Date.now() - inizioRiprese) / 1000 - 0.3)
    await gira(page)
    await didascalia(page, null)
    await attendi(600)
    const video = page.video()
    await context.close()
    if (!video) throw new Error("Nessun video registrato.")

    mkdirSync(CARTELLA_VIDEO, { recursive: true })
    copyFileSync(await video.path(), FILE_WEBM)
    convertiInMp4(ffmpeg, taglio)

    const mb = (statSync(FILE_MP4).size / 1024 / 1024).toFixed(1)
    console.log("\nVideo pronto:")
    console.log(`  ${FILE_MP4}`)
    console.log(`  durata ${durataVideo(ffmpeg, FILE_MP4)}, ${mb} MB (anche il WebM originale: ${FILE_WEBM})`)
  } finally {
    await browser?.close().catch(() => {})
    fermaServer(server)
    rmSync(cartellaRiprese, { recursive: true, force: true })
    // Le riprese hanno creato un ordine e spostato un lavoro: dati di nuovo puliti.
    try {
      rinfrescaDemo()
    } catch (errore) {
      console.error("ATTENZIONE:", errore instanceof Error ? errore.message : errore, "Lanciare a mano: npm run demo:reset")
    }
  }
}

main().catch((errore: unknown) => {
  console.error("ERRORE:", errore instanceof Error ? errore.message : errore)
  process.exit(1)
})
