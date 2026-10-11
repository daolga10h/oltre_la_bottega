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

/**
 * Cancella una cartella riprovando qualche volta: su Windows un antivirus può
 * tenere per un istante un file del video appena scritto, e la prima
 * cancellazione fallisce con EPERM anche se il file non è più in uso.
 */
export async function rimuoviConReprove(cartella: string, tentativi = 5): Promise<void> {
  for (let i = 1; i <= tentativi; i++) {
    try {
      rmSync(cartella, { recursive: true, force: true })
      return
    } catch (errore) {
      if (i === tentativi) throw errore
      await attendi(500 * i)
    }
  }
}

// ---------------------------------------------------------------- preparazione

export function rinfrescaDemo(): void {
  console.log("→ Rinfresco dei dati demo (npm run demo:reset)…")
  // Ambiente del processo così com'è: il controllo di sicurezza dello script
  // confronta l'indirizzo demo con quello vero di .env.local.
  const esito = spawnSync("npx tsx scripts/demo-reset.ts", { cwd: radice, stdio: "inherit", shell: true })
  if (esito.status !== 0) throw new Error("Il rinfresco dei dati demo non è riuscito: mi fermo.")
}

export function leggiDemo() {
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
export function ambienteApp(demo: ReturnType<typeof leggiDemo>): NodeJS.ProcessEnv {
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

export async function portaLibera(): Promise<boolean> {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return false
  } catch {
    return true
  }
}

export function costruisciApp(env: NodeJS.ProcessEnv): void {
  console.log("→ Build di produzione (next build), qualche minuto…")
  const esito = spawnSync(process.execPath, [BIN_NEXT, "build"], { cwd: radice, env, stdio: "inherit" })
  if (esito.status !== 0) throw new Error("next build non è riuscito.")
}

export async function avviaServer(env: NodeJS.ProcessEnv): Promise<ChildProcess> {
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

export function fermaServer(server: ChildProcess | null): void {
  if (!server?.pid || server.exitCode !== null) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    server.kill("SIGTERM")
  }
}

// ------------------------------------------------------------------ login

/** Login con il PIN in un contesto che NON registra, poi controllo che sia la demo. */
export async function accedi(browser: Browser, demo: ReturnType<typeof leggiDemo>) {
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

export class Regia {
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

export async function didascalia(page: Page, testo: string | null): Promise<void> {
  await page.evaluate((t) => (window as unknown as { __setCaption: (t: string | null) => void }).__setCaption(t), testo)
}
