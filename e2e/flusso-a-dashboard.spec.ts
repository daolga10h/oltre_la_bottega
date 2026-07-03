import { test, expect } from "@playwright/test"

test.describe("Flusso A — Avvio giornata", () => {
  test("GET / redirects somewhere (auth or dashboard)", async ({ page }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBeLessThan(500)
  })

  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("/login page renders the form", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText(/Oltre la Bottega/i).first()).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /Invia link di accesso/i })).toBeVisible()
  })

  test("login form shows message on submit", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/Email/i).fill("test@example.com")
    await page.getByRole("button", { name: /Invia link di accesso/i }).click()
    // Wait for either success or error message
    await expect(
      page.getByText(/controlla|errore/i)
    ).toBeVisible({ timeout: 10_000 })
  })
})
