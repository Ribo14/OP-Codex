import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Visibility Friends (RIB-73) nel browser vero: Anna mette un mazzo e la Collection su Amici;
// Bruno, suo amico, li vede dal profilo di Anna (senza valore stimato); Carla, non amica, no.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SERIES = 969000 + Math.floor(Math.random() * 999)
// EB-96: un Set di prova che nessun altro test usa (i test girano in parallelo).
const LEADER = { code: 'EB96-001', name: 'Leader degli amici' }
const CARD = { code: 'EB96-002', name: 'Carta degli amici' }

interface Account {
  email: string
  username: string
  page: Page
}

async function account(browser: Browser, baseURL: string, name: string): Promise<Account> {
  const run = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
  const email = `e2e-vis-${name}-${run}@example.com`
  const username = `${name}_${run}`.slice(0, 20)
  const redirect = new URLSearchParams({ redirect_to: `${baseURL}/account/conferma` })
  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup?${redirect.toString()}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: `Una frase lunga per la visibilità ${crypto.randomUUID()}`,
      gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' },
    }),
  })
  expect(signup.ok).toBe(true)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(await linkFromEmail(email, /Conferma/, '/account/conferma'))
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Conferma' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()
  return { email, username, page }
}

test('mazzi e Collection su Amici: li vede l’amico, non gli altri', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  const accounts: Account[] = []
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, 'EB-96', 'Set di prova amici')`
    await sql`
      insert into public.cards (card_code, name, category, cost, colors)
      values (${LEADER.code}, ${LEADER.name}, 'Leader', null, '{Red}'),
             (${CARD.code}, ${CARD.name}, 'Character', 2, '{Red}')
      on conflict (card_code) do nothing
    `
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${LEADER.code}, ${LEADER.code}, ${SERIES}, 'L'), (${CARD.code}, ${CARD.code}, ${SERIES}, 'C')
    `
    const anna = await account(browser, baseURL ?? '', 'anna')
    const bruno = await account(browser, baseURL ?? '', 'bruno')
    const carla = await account(browser, baseURL ?? '', 'carla')
    accounts.push(anna, bruno, carla)

    // Anna e Bruno amici; Anna ha un mazzo privato e un po' di Collection.
    await sql`
      insert into public.friendships (user_a, user_b)
      select least(a.id, b.id), greatest(a.id, b.id)
      from auth.users a, auth.users b where a.email = ${anna.email} and b.email = ${bruno.email}
    `
    const [deck] = await sql<{ id: string }[]>`
      insert into public.decks (user_id, name, leader_code)
      select id, 'Mazzo per gli amici', ${LEADER.code} from auth.users where email = ${anna.email}
      returning id
    `
    await sql`insert into public.deck_cards (deck_id, card_code, quantity) values (${deck?.id ?? ''}, ${CARD.code}, 4)`
    await sql`
      insert into public.collection_entries (user_id, print_id, language, quantity)
      select id, ${CARD.code}, 'EN', 3 from auth.users where email = ${anna.email}
    `

    // Finché è tutto privato Bruno vede il profilo di Anna, ma niente mazzi né carte.
    await bruno.page.goto(`/amici/${anna.username}`)
    await expect(
      bruno.page.getByRole('heading', { level: 1, name: `@${anna.username}` }),
    ).toBeVisible()
    await expect(bruno.page.getByText('Nessun mazzo condiviso con gli amici.')).toBeVisible()
    await expect(
      bruno.page.getByText(`@${anna.username} non condivide la sua collezione.`),
    ).toBeVisible()

    // Anna: il mazzo su Amici, la Collection su Amici.
    await anna.page.goto(`/mazzi/${deck?.id ?? ''}`)
    await anna.page.getByText('Condividi mazzo').click()
    await anna.page.getByRole('radio', { name: 'Amici' }).click()
    await expect(anna.page.getByRole('radio', { name: 'Amici' })).toBeChecked()
    await anna.page.goto('/collezione')
    await anna.page.getByRole('radio', { name: 'Amici' }).click()
    await expect(anna.page.getByRole('radio', { name: 'Amici' })).toBeChecked()

    // Bruno: dall'elenco amici al profilo di Anna; mazzo e carte, nessun valore in euro.
    await bruno.page.goto('/amici')
    await bruno.page.getByRole('link', { name: `@${anna.username}` }).click()
    await expect(bruno.page.getByText('1 mazzo condiviso')).toBeVisible()
    await expect(bruno.page.getByText(CARD.name).first()).toBeVisible()
    await expect(bruno.page.getByText('×3')).toBeVisible()
    await expect(bruno.page.getByText('€')).toHaveCount(0)
    await bruno.page.getByRole('link', { name: /Mazzo per gli amici/ }).click()
    await expect(
      bruno.page.getByRole('heading', { level: 1, name: 'Mazzo per gli amici' }),
    ).toBeVisible()
    await expect(bruno.page.getByText('Mazzo di un amico')).toBeVisible()

    // Carla non è amica: stesso messaggio di un profilo che non esiste; il mazzo non si apre.
    await carla.page.goto(`/amici/${anna.username}`)
    await expect(carla.page.getByText('Non trovi questo profilo', { exact: false })).toBeVisible()
    await carla.page.goto(`/amici/${anna.username}/mazzi/${deck?.id ?? ''}`)
    await expect(
      carla.page.getByText('Questo mazzo non è più visibile', { exact: false }),
    ).toBeVisible()
  } finally {
    for (const a of accounts) await a.page.context().close()
    await sql`delete from auth.users where email like 'e2e-vis-%'`
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code in (${LEADER.code}, ${CARD.code})`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
