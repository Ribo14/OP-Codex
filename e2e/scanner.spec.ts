import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Scanner (fase 4) nel browser vero: la fotocamera finta di Chromium mostra una carta disegnata
// da noi (e2e/fixtures/make-scanner-video.mjs) con il Card Code EB99-042. Si controlla tutto il
// giro: permesso, OCR sul dispositivo (file da /ocr/), carta trovata, scelta della Printing,
// dettaglio. Senza account: lo Scanner serve anche solo a consultare.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
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

test('Burst Scan: le carte lette finiscono nella Collection senza lasciare lo Scanner', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  const series = SERIES + 2000
  const run = crypto.randomUUID().replaceAll('-', '')
  const email = `e2e-burst-${run}@example.com`
  const username = `burst_${run}`.slice(0, 20)
  const password = `Una frase lunga per il Burst Scan ${crypto.randomUUID()}`
  try {
    await sql`insert into public.sets (series_id, code, name) values (${series}, 'EB-99', 'Set di prova Burst')`
    await sql`
      insert into public.cards (card_code, name, category, cost, colors)
      values (${CODE}, 'Carta di prova Scanner', 'Character', 3, '{Red}')
      on conflict (card_code) do nothing
    `
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${CODE}, ${CODE}, ${series}, 'SR'), (${`${CODE}_p1`}, ${CODE}, ${series}, 'SR')
    `

    // Account con Username.
    const redirect = new URLSearchParams({ redirect_to: `${baseURL ?? ''}/account/conferma` })
    const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup?${redirect.toString()}`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' },
      }),
    })
    expect(signup.ok).toBe(true)
    await page.goto(await linkFromEmail(email, /Conferma/, '/account/conferma'))
    await page.getByLabel('Username').fill(username)
    await page.getByRole('button', { name: 'Conferma' }).click()
    await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()

    // Scanner con "Aggiungi alla collezione", in giapponese.
    await page.goto('/scanner')
    await page.getByRole('switch', { name: 'Aggiungi alla collezione' }).check()
    await page.getByLabel('Lingua').selectOption('JP')
    await page.getByRole('button', { name: 'Avvia la fotocamera' }).click()

    // Due letture della stessa carta: +1 sulla parallela e poi sulla base.
    const found = page.getByRole('region', { name: 'Carta di prova Scanner' })
    await page.getByRole('button', { name: 'Leggi il codice' }).click()
    await found
      .getByRole('button', {
        name: `Aggiungi una copia di ${CODE}_p1 (Carta di prova Scanner) alla collezione`,
      })
      .click({ timeout: 60_000 })
    await expect(page.getByText('1 carta aggiunta in questa sessione')).toBeVisible()
    await page.getByRole('button', { name: 'Leggi il codice' }).click()
    await found
      .getByRole('button', {
        name: `Aggiungi una copia di ${CODE} (Carta di prova Scanner) alla collezione`,
      })
      .click()
    await expect(page.getByText('2 carte aggiunte in questa sessione')).toBeVisible()
    // Sempre sullo Scanner.
    await expect(page).toHaveURL(/\/scanner$/)

    const entries = await sql<{ print_id: string; language: string; quantity: number }[]>`
      select c.print_id, c.language, c.quantity from public.collection_entries c
      join auth.users u on u.id = c.user_id
      where u.email = ${email} order by c.print_id
    `
    expect(entries).toEqual([
      { print_id: CODE, language: 'JP', quantity: 1 },
      { print_id: `${CODE}_p1`, language: 'JP', quantity: 1 },
    ])
  } finally {
    await sql`delete from auth.users where email = ${email}`
    await sql`delete from public.printings where series_id = ${series}`
    await sql`delete from public.cards where card_code = ${CODE}`
    await sql`delete from public.sets where series_id = ${series}`
    await sql.end()
  }
})
