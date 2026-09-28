import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Amici (RIB-71) nel browser vero, con tre account: Anna trova Bruno per Username e gli chiede
// l'amicizia; Bruno vede il badge e accetta. Carla arriva dal link di invito di Anna.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

test.use({ viewport: { width: 390, height: 844 } })

interface Account {
  email: string
  username: string
  page: Page
}

/** Account nuovo con Username, in un contesto del browser tutto suo. */
async function account(browser: Browser, baseURL: string, name: string): Promise<Account> {
  const run = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
  const email = `e2e-amici-${name}-${run}@example.com`
  const username = `${name}_${run}`.slice(0, 20)
  const redirect = new URLSearchParams({ redirect_to: `${baseURL}/account/conferma` })
  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup?${redirect.toString()}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: `Una frase lunga per gli amici ${crypto.randomUUID()}`,
      gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' },
    }),
  })
  expect(signup.ok).toBe(true)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  await page.goto(await linkFromEmail(email, /Conferma/, '/account/conferma'))
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Conferma' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()
  return { email, username, page }
}

test('amicizia per Username e con il link di invito', async ({ browser, baseURL }) => {
  test.setTimeout(150_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  const accounts: Account[] = []
  try {
    const anna = await account(browser, baseURL ?? '', 'anna')
    const bruno = await account(browser, baseURL ?? '', 'bruno')
    const carla = await account(browser, baseURL ?? '', 'carla')
    accounts.push(anna, bruno, carla)

    // Anna: dal Profilo agli Amici; le prime lettere non bastano, lo Username intero sì.
    await anna.page.getByRole('link', { name: 'Amici' }).click()
    await expect(anna.page.getByRole('heading', { level: 1, name: 'Amici' })).toBeVisible()
    const search = anna.page.getByLabel('Username del tuo amico')
    await search.fill(bruno.username.slice(0, 8))
    await anna.page.getByRole('button', { name: 'Cerca' }).click()
    await expect(anna.page.getByText('Nessun utente con questo Username.')).toBeVisible()
    await search.fill(bruno.username.toUpperCase())
    await anna.page.getByRole('button', { name: 'Cerca' }).click()
    await anna.page.getByRole('button', { name: `Chiedi l'amicizia a @${bruno.username}` }).click()
    await expect(anna.page.getByText('Richiesta inviata, in attesa di risposta')).toBeVisible()
    await expect(anna.page.getByText('1 richiesta inviata')).toBeVisible()

    // Bruno: il pallino sul Profilo, poi accetta.
    await bruno.page.goto('/')
    const profile = bruno.page.getByRole('link', {
      name: 'Profilo · 1 richiesta di amicizia da vedere',
    })
    await expect(profile).toBeVisible()
    await profile.click()
    await bruno.page.getByRole('link', { name: /Amici/ }).click()
    await bruno.page
      .getByRole('button', { name: `Accetta la richiesta di @${anna.username}` })
      .click()
    await expect(bruno.page.getByText('1 amico', { exact: true })).toBeVisible()
    await expect(bruno.page.getByText(`@${anna.username}`)).toBeVisible()
    await expect(bruno.page.getByRole('link', { name: 'Profilo', exact: true })).toBeVisible()

    // Anna: il suo link di invito, aperto da Carla.
    await anna.page.reload()
    await expect(anna.page.getByText('1 amico', { exact: true })).toBeVisible()
    await anna.page.getByText('Oppure mandagli il tuo link di invito').click()
    const link = anna.page.getByText(/\/amici\/invito\//)
    await expect(link).toBeVisible()
    const url = new URL((await link.textContent()) ?? '')
    await carla.page.goto(url.pathname)
    await expect(
      carla.page.getByText(`@${anna.username} ti ha invitato a diventare amici su OP-Codex.`),
    ).toBeVisible()
    await carla.page.getByRole('button', { name: "Chiedi l'amicizia" }).click()
    await expect(
      carla.page.getByText(`Richiesta inviata: quando @${anna.username} la accetta, sarete amici.`),
    ).toBeVisible()

    // Anna rigenera il link: quello vecchio non vale più.
    await anna.page.getByRole('button', { name: 'Nuovo link' }).click()
    await anna.page.getByRole('button', { name: 'Sì, crea un nuovo link' }).click()
    await expect(anna.page.getByText(url.href)).toBeHidden()
    await carla.page.reload()
    await expect(
      carla.page.getByText('Questo link di invito non vale più', { exact: false }),
    ).toBeVisible()

    // Nel database: una amicizia e una richiesta in attesa.
    const [counts] = await sql<{ friends: number; requests: number }[]>`
      select
        (select count(*)::int from public.friendships f
          join auth.users u on u.id in (f.user_a, f.user_b) where u.email = ${anna.email}) as friends,
        (select count(*)::int from public.friend_requests r
          join auth.users u on u.id = r.to_user where u.email = ${anna.email}) as requests
    `
    expect(counts).toEqual({ friends: 1, requests: 1 })

    // RIB-72: Anna blocca Carla dalla richiesta ricevuta; Carla non la trova più.
    await anna.page.reload()
    await anna.page.getByRole('button', { name: `Altre azioni per @${carla.username}` }).click()
    await anna.page.getByRole('button', { name: 'Blocca' }).click()
    await anna.page.getByRole('button', { name: 'Sì, blocca' }).click()
    await expect(anna.page.getByText('1 utente bloccato')).toBeVisible()
    await expect(anna.page.getByText('1 richiesta ricevuta')).toBeHidden()
    await carla.page.goto('/amici')
    await carla.page.getByLabel('Username del tuo amico').fill(anna.username)
    await carla.page.getByRole('button', { name: 'Cerca' }).click()
    await expect(carla.page.getByText('Nessun utente con questo Username.')).toBeVisible()
    // Carla non sa di essere bloccata: la sua richiesta è sparita come se fosse stata rifiutata.
    await expect(carla.page.getByText('1 richiesta inviata')).toBeHidden()

    // Anna sblocca Carla e rimuove Bruno dagli amici.
    await anna.page.getByRole('button', { name: `Sblocca @${carla.username}` }).click()
    await expect(anna.page.getByText('1 utente bloccato')).toBeHidden()
    await anna.page.getByRole('button', { name: `Altre azioni per @${bruno.username}` }).click()
    await anna.page.getByRole('button', { name: 'Rimuovi dagli amici' }).click()
    await anna.page.getByRole('button', { name: 'Sì, rimuovi' }).click()
    await expect(anna.page.getByText('0 amici', { exact: true })).toBeVisible()
    await bruno.page.reload()
    await expect(bruno.page.getByText('0 amici', { exact: true })).toBeVisible()
  } finally {
    for (const a of accounts) await a.page.context().close()
    await sql`delete from auth.users where email like 'e2e-amici-%'`
    await sql.end()
  }
})
