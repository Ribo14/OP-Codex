import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'

// Scanner (fase 4) nel browser vero: la fotocamera finta di Chromium mostra una carta disegnata
// da noi (e2e/fixtures/make-scanner-video.mjs) con il Card Code EB99-042. Si controlla tutto il
// giro: permesso, OCR sul dispositivo (file da /ocr/), carta trovata, scelta della Printing,
// dettaglio. Senza account: lo Scanner serve anche solo a consultare.

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SERIES = 989000 + Math.floor(Math.random() * 999)
const CODE = 'EB99-042'
const VIDEO = fileURLToPath(new URL('./fixtures/scanner-card.mjpeg', import.meta.url))

test.use({
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
})

test('Scanner: legge il Card Code dalla fotocamera e apre la stampa scelta', async ({ page }) => {
  test.setTimeout(120_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, 'EB-99', 'Set di prova Scanner')`
    await sql`
      insert into public.cards (card_code, name, category, cost, colors)
      values (${CODE}, 'Carta di prova Scanner', 'Character', 3, '{Red}')
      on conflict (card_code) do nothing
    `
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${CODE}, ${CODE}, ${SERIES}, 'SR'), (${`${CODE}_p1`}, ${CODE}, ${SERIES}, 'SR')
    `

    // Dal catalogo allo Scanner.
    await page.goto('/')
    await page.getByRole('link', { name: 'Scansiona' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Scanner' })).toBeVisible()

    await page.getByRole('button', { name: 'Avvia la fotocamera' }).click()
    const read = page.getByRole('button', { name: 'Leggi il codice' })
    await expect(read).toBeVisible()
    await read.click()

    // L'OCR (la prima volta scarica i suoi file) trova la carta: se ne sceglie la parallela.
    const found = page.getByRole('region', { name: 'Carta di prova Scanner' })
    await expect(found).toBeVisible({ timeout: 60_000 })
    await expect(found.getByText('Scegli la stampa giusta:')).toBeVisible()
    await found.getByRole('button', { name: `Apri ${CODE}_p1 · SR` }).click()

    await expect(page).toHaveURL(new RegExp(`/carta/${CODE}\\?stampa=${CODE}_p1$`))
    await expect(
      page.getByRole('heading', { level: 2, name: 'Carta di prova Scanner' }),
    ).toBeVisible()
  } finally {
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code = ${CODE}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})

test('Scanner: il codice si può scrivere a mano, anche con gli errori tipici', async ({ page }) => {
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  const series = SERIES + 1000
  try {
    await sql`insert into public.sets (series_id, code, name) values (${series}, 'EB-98', 'Set di prova Scanner 2')`
    await sql`
      insert into public.cards (card_code, name, category) values ('EB98-007', 'Carta scritta a mano', 'Event')
      on conflict (card_code) do nothing
    `
    await sql`insert into public.printings (print_id, card_code, series_id, rarity) values ('EB98-007', 'EB98-007', ${series}, 'C')`

    await page.goto('/scanner')
    await page.getByLabel('Oppure scrivi il codice').fill('eb98-0O7')
    await page.getByRole('button', { name: 'Apri', exact: true }).click()
    await expect(page).toHaveURL(/\/carta\/EB98-007$/)
    await expect(
      page.getByRole('heading', { level: 2, name: 'Carta scritta a mano' }),
    ).toBeVisible()
  } finally {
    await sql`delete from public.printings where series_id = ${series}`
    await sql`delete from public.cards where card_code = 'EB98-007'`
    await sql`delete from public.sets where series_id = ${series}`
    await sql.end()
  }
})
