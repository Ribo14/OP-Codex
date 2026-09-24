import { defineConfig, devices } from '@playwright/test'

// Test end-to-end (RIB-14): l'app di produzione (vite build + preview) contro il Supabase
// locale, con la chiave di prova di Turnstile e le email lette da Mailpit.
// In locale: `npx supabase start`, poi `npm run test:e2e` (valori da .env.local).

const PORT = 4173

// In locale gli stessi valori dell'app (URL e chiave pubblica del Supabase locale); in CI
// arrivano dall'ambiente del job.
try {
  process.loadEnvFile('.env.local')
} catch {
  /* nessun .env.local */
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    locale: 'it-IT',
    trace: 'retain-on-failure',
    // In locale si può usare Chrome già installato: PW_CHANNEL=chrome npm run test:e2e
    channel: process.env.PW_CHANNEL,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
