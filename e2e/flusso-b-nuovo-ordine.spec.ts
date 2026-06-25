import { test, expect } from "@playwright/test"

test.describe("Flusso B — Nuovo ordine", () => {
  test("unauthenticated: /orders/new redirects to /login", async ({ page }) => {
    await page.goto("/orders/new")
    await expect(page).toHaveURL(/\/login/)
  })

  test("unauthenticated: /orders redirects to /login", async ({ page }) => {
    await page.goto("/orders")
    await expect(page).toHaveURL(/\/login/)
  })
})
