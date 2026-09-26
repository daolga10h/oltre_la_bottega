import { test, expect, type Page } from "@playwright/test"
import { getTestAuthCookies, deleteTestOrder } from "./helpers/auth"

// Gira solo con NEXT_PUBLIC_PLAN=base (vedere playwright.base.config.ts);
// con la configurazione normale (livello completo) viene saltato.
test.skip(process.env.NEXT_PUBLIC_PLAN !== "base", "richiede NEXT_PUBLIC_PLAN=base")

test.describe("Livello base", () => {
  const orderIds: string[] = []

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies(await getTestAuthCookies())
    // window.print() aprirebbe la finestra di stampa: nei test non serve.
    await page.addInitScript(() => {
      window.print = () => {}
    })
  })

  test.afterEach(async () => {
    while (orderIds.length > 0) {
      await deleteTestOrder(orderIds.pop()!).catch(() => {})
    }
  })

  async function compilaOrdineBase(page: Page, nome: string) {
    await page.goto("/orders/new")
    await page.locator("#nome").fill(nome)
    await page.locator("#cognome").fill("E2E")
    await page.locator("#telefono").fill("3331234567")
    await page.locator("#data_consegna").fill("2026-12-15")
    const riga1 = page.locator("div.rounded-lg.border-border.p-3").first()
    await riga1.getByPlaceholder("Es. targa plexiglass, timbro, portachiavi inciso...").fill("Targa base — test E2E")
    await riga1.locator('input[type="number"]').nth(1).fill("40")
  }

  async function creaEAnnota(page: Page) {
    await page.getByRole("button", { name: "Crea ordine" }).click()
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
    const id = new URL(page.url()).pathname.split("/").pop()!
    orderIds.push(id)
    return id
  }

  test("il menu ha solo le voci del livello base", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.locator("aside a")).toHaveText([
      "Oggi",
      "Bacheca",
      "Agenda",
      "Recensioni",
      "Clienti",
      "Impostazioni",
    ])
  })

  test("le pagine fuori livello rispondono 404", async ({ page }) => {
    for (const path of ["/pagamenti", "/riepilogo"]) {
      await page.goto(path)
      await expect(page.getByText("This page could not be found")).toBeVisible()
    }
  })

  test("Impostazioni non mostra gli operatori", async ({ page }) => {
    await page.goto("/impostazioni")
    await expect(page.getByText("Accesso con PIN")).toBeVisible()
    await expect(page.getByText("Operatori", { exact: true })).toHaveCount(0)
  })

  test("il form ordine ha solo i campi del livello", async ({ page }) => {
    await page.goto("/orders/new")
    for (const selector of ["#is_ente", "#operatore", "#bozza_grafica", "#materiale", "#tipo_lavorazione", "#dettagli_grafici", "#file_cliente", "#foto_oggetto"]) {
      await expect(page.locator(selector)).toHaveCount(0)
    }
    await expect(page.getByRole("button", { name: "+ Aggiungi articolo" })).toHaveCount(0)
    await expect(page.locator("#preventivo")).toBeVisible()
    await expect(page.getByRole("button", { name: "Crea ordine" })).toBeEnabled()
  })

  test("ordine senza preventivo: parte da Da fare e arriva a Consegnato", async ({ page }) => {
    await compilaOrdineBase(page, `E2E Base ${Date.now()}`)
    await creaEAnnota(page)

    await expect(page.getByRole("button", { name: "Bozza grafica" })).toHaveCount(0)
    await expect(page.locator("form button.bg-espresso")).toHaveText("Da fare")
    // Senza elenco Ordini, la freccia indietro porta alla Bacheca.
    await expect(page.locator("main").getByRole("link", { name: "Bacheca" })).toHaveAttribute("href", "/kanban")

    await page.getByRole("button", { name: "In lavorazione", exact: true }).click()
    await expect(page.locator("form button.bg-espresso")).toHaveText("In lavorazione")

    await page.getByRole("button", { name: "Pronto", exact: true }).click()
    await expect(page.getByText("Avvisa il cliente:")).toBeVisible()

    await page.getByRole("button", { name: "Consegnato", exact: true }).click()
    await expect(page.getByText("Consegnato il")).toBeVisible()
  })

  test("ordine con preventivo: passa a Da fare quando viene approvato", async ({ page }) => {
    await compilaOrdineBase(page, `E2E BasePrev ${Date.now()}`)
    await page.locator("#preventivo").click()
    await page.getByRole("option", { name: "Da inviare" }).click()
    await creaEAnnota(page)

    await expect(page.locator("form button.bg-espresso")).toHaveText("Preventivo")
    await page.getByRole("button", { name: "Approvato" }).click()
    await expect(page.locator("form button.bg-espresso")).toHaveText("Da fare")
  })

  test("la scheda ordine offre solo il foglio lavoro e la stampa mostra il foglio", async ({ page }) => {
    const nome = `E2E BaseStampa ${Date.now()}`
    await compilaOrdineBase(page, nome)
    const id = await creaEAnnota(page)

    await expect(page.getByRole("link", { name: "Etichetta" })).toHaveCount(0)
    const foglio = page.getByRole("link", { name: "Foglio lavoro" })
    await expect(foglio).toHaveAttribute("href", `/orders/${id}/print?formato=foglio`)

    // Anche aprendo a mano l'indirizzo dell'etichetta si vede il foglio.
    await page.goto(`/orders/${id}/print`)
    const fogliolavoro = page.getByTestId("foglio-lavoro")
    await expect(fogliolavoro).toBeVisible()
    await expect(fogliolavoro).toContainText(nome)
    await expect(fogliolavoro).toContainText("Da pagare: €40.00")
  })

  test("la bacheca ha 4 colonne, senza Bozza grafica", async ({ page }) => {
    await page.goto("/kanban")
    for (const titolo of ["Preventivo", "Da fare", "In lavorazione", "Pronto"]) {
      await expect(page.getByText(titolo, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText("Bozza grafica", { exact: true })).toHaveCount(0)
  })
})
