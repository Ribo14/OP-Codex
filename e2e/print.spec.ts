import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'
import sharp from 'sharp'
import { linkFromEmail } from './mailpit.ts'

// Stampa delle carte (RIB-80) sul Supabase locale: dal mazzo (mancanti, copie, variante, PDF) e
// dal dettaglio di una carta (1-4 copie). Le immagini delle carte non sono nello storage locale:
// le serve il test, come JPEG generati al volo.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const run = crypto.randomUUID().replaceAll('-', '')
const email = `e2e-print-${run}@example.com`
const username = `print_${run}`.slice(0, 20)
const password = `Una frase lunga per la stampa ${crypto.randomUUID()}`
const SERIES = 970000 + Math.floor(Math.random() * 9000)
const PREFIX = `XP${String(SERIES % 100).padStart(2, '0')}`
const TAG = run.slice(0, 6)
const LEADER = { code: `${PREFIX}-001`, name: `Leader stampa ${TAG}` }
const ALPHA = { code: `${PREFIX}-002`, name: `Alfa stampa ${TAG}` }

// Senza service worker: le immagini le chiederebbe lui, e il test non potrebbe servirle.
test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })

/** Le immagini delle carte: un JPEG pieno, con l'intestazione CORS come lo storage vero. */
async function serveCardImages(page: Page) {
  const body = await sharp({
    create: { width: 60, height: 84, channels: 3, background: '#c33' },
  })
    .jpeg()
    .toBuffer()
  await page.route(/\/storage\/v1\/object\/public\/card-images\//, (route) =>
    route.fulfill({
      body,
      contentType: 'image/jpeg',
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  )
}

/** Crea il PDF, lo scarica e ne restituisce il testo. */
async function downloadPdf(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Crea il PDF' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Scarica il PDF' }).click()
  const download = await downloading
  return (await readFile(await download.path())).toString('latin1')
}

test('Stampa: dal mazzo le mancanti, dal dettaglio da 1 a 4 copie', async ({ page, baseURL }) => {
  test.setTimeout(120_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, ${`${PREFIX}-SET`}, 'Set di prova E2E')`
    await sql`
      insert into public.cards (card_code, name, category, cost, colors)
      values (${LEADER.code}, ${LEADER.name}, 'Leader', null, '{Red}'),
             (${ALPHA.code}, ${ALPHA.name}, 'Character', 2, '{Red}')
    `
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity, image_synced_at)
      values (${LEADER.code}, ${LEADER.code}, ${SERIES}, 'L', now()),
             (${ALPHA.code}, ${ALPHA.code}, ${SERIES}, 'C', now()),
             (${`${ALPHA.code}_p1`}, ${ALPHA.code}, ${SERIES}, 'SR', now())
    `
    await serveCardImages(page)

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

    // Un mazzo con il Leader e 4 Alfa; la Collection è vuota, quindi mancano 5 carte.
    const [deck] = await sql<{ id: string }[]>`
      insert into public.decks (user_id, name, leader_code)
      select id, 'Mazzo da stampare', ${LEADER.code} from auth.users where email = ${email}
      returning id
    `
    await sql`insert into public.deck_cards (deck_id, card_code, quantity) values (${deck?.id ?? ''}, ${ALPHA.code}, 4)`

    await page.goto(`/mazzi/${deck?.id ?? ''}`)
    await page.getByRole('button', { name: 'Ti mancano 5 carte' }).click()
    await page.getByRole('link', { name: 'Stampa le mancanti' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Stampa carte' })).toBeVisible()
    await expect(page.getByText('5 carte · 1 foglio A4')).toBeVisible()

    // Una copia in meno e la variante SR per Alfa; l'anteprima ha un foglio.
    await page.getByRole('button', { name: `Una copia in meno di ${ALPHA.name}` }).click()
    await expect(page.getByText('4 carte · 1 foglio A4')).toBeVisible()
    await page.getByLabel(`Variante da stampare per ${ALPHA.name}`).selectOption(`${ALPHA.code}_p1`)
    await expect(
      page.getByRole('list', { name: 'Anteprima dei fogli' }).getByRole('listitem'),
    ).toHaveCount(1)
    await page.getByRole('button', { name: 'Bianco e nero' }).click()

    const deckPdf = await downloadPdf(page)
    expect(deckPdf.startsWith('%PDF-1.4')).toBe(true)
    expect(deckPdf).toContain('/Count 1')
    // Due immagini (Leader e Alfa SR), quattro carte disegnate.
    expect(deckPdf.match(/\/Subtype \/Image/g)).toHaveLength(2)
    expect(deckPdf.match(/ re S/g)).toHaveLength(4)

    // Dal dettaglio della carta: 4 copie della Printing mostrata.
    await page.goto(`/carta/${ALPHA.code}`)
    await page.getByRole('button', { name: 'Stampa', exact: true }).click()
    await page.getByRole('button', { name: '×4' }).click()
    await expect(page.getByText('4 carte · 1 foglio A4')).toBeVisible()
    const cardPdf = await downloadPdf(page)
    expect(cardPdf.match(/\/Subtype \/Image/g)).toHaveLength(1)
    expect(cardPdf.match(/ re S/g)).toHaveLength(4)
  } finally {
    await sql`delete from auth.users where email = ${email}`
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code like ${`${PREFIX}-%`}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
