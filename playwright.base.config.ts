import { defineConfig, devices } from "@playwright/test"

// Il livello va impostato qui, nel processo che esegue i test (lo spec lo
// legge per decidere se girare), e non solo nell'ambiente del server web.
process.env.NEXT_PUBLIC_PLAN = "base"

// Avvia l'app con NEXT_PUBLIC_PLAN=base su una porta a parte e lancia solo lo
// spec del livello base. Uso: npx playwright test --config playwright.base.config.ts
export default defineConfig({
  testDir: "./e2e",
  testMatch: "livello-base.spec.ts",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_PLAN: "base" },
  },
})
