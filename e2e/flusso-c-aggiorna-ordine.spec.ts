import { test, expect } from "@playwright/test"

test.describe("Flusso C — Aggiornamento ordine", () => {
  test("unauthenticated: /orders/<id> redirects to /login", async ({ page }) => {
    await page.goto("/orders/non-existent-id")
    await expect(page).toHaveURL(/\/login/)
  })

  test("unauthenticated: /customers redirects to /login", async ({ page }) => {
    await page.goto("/customers")
    await expect(page).toHaveURL(/\/login/)
  })

  test("unauthenticated: /agenda redirects to /login", async ({ page }) => {
    await page.goto("/agenda")
    await expect(page).toHaveURL(/\/login/)
  })
})
