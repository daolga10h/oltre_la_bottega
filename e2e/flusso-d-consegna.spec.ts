import { test, expect } from "@playwright/test"
import { getTestAuthCookies, deleteTestOrder } from "./helpers/auth"

// Richiede NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY in .env.local. Gira contro lo stesso progetto
// Supabase dell'app (anche in produzione): l'ordine creato viene sempre
// cancellato in afterEach, indipendentemente dall'esito del test.
test.describe("Flusso D — Consegna, pagamento e follow-up", () => {
  let orderId: string | undefined

  test.beforeEach(async ({ context }) => {
    const cookies = await getTestAuthCookies()
    await context.addCookies(cookies)
  })

  test.afterEach(async () => {
    if (orderId) {
      await deleteTestOrder(orderId).catch(() => {})
      orderId = undefined
    }
  })

  test("crea ordine, aggiorna pagamento, attiva follow-up recensione e consegna", async ({ page }) => {
    const nomeCliente = `E2E Test FlussoD ${Date.now()}`

    await page.goto("/orders/new")
    await page.getByLabel("Nome *").fill(nomeCliente)
    await page.getByLabel("Cosa ordinato *").fill("Targa incisa — test E2E")
    await page.getByLabel("Prezzo €").fill("50")
    await page.getByRole("button", { name: "Crea ordine" }).click()

    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
    orderId = new URL(page.url()).pathname.split("/").pop()

    // Aggiornamento pagamento (acconto) + attivazione follow-up recensione
    await page.goto(`/orders/${orderId}/edit`)
    await page.getByLabel("Acconto €").fill("20")
    await page.getByRole("button", { name: "Chiedere recensione" }).click()
    await page.getByRole("button", { name: "Salva modifiche" }).click()
    await page.waitForURL(`**/orders/${orderId}`)

    await expect(page.getByText("€30.00")).toBeVisible() // saldo residuo = 50 - 20

    // Consegna
    await page.getByRole("button", { name: "Consegnato", exact: true }).click()
    await expect(page.getByText("Consegnato il")).toBeVisible()

    // Follow-up: un ordine consegnato con "chiedere recensione" attivo appare in Recensioni
    await page.goto("/recensioni")
    await expect(page.getByRole("link", { name: nomeCliente })).toBeVisible()
  })
})
