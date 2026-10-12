import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Offline a freddo (RIB-27): l'app riaperta senza rete dopo più di un'ora, quando il token di
// accesso è scaduto e non si può rinnovare, resta collegata e mostra Collezione e mazzi dalla
// copia sul dispositivo. Prima mostrava "non hai fatto accesso".

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const run = crypto.randomUUID().replaceAll('-', '')
const email = `e2e-off-${run}@example.com`
const username = `off_${run}`.slice(0, 20)
const password = `Una frase lunga per l'offline ${crypto.randomUUID()}`
const SERIES = 950000 + Math.floor(Math.random() * 9000)
const PREFIX = `XO${String(SERIES % 100).padStart(2, '0')}`
const LEADER = { code: `${PREFIX}-001`, name: `Leader offline ${run.slice(0, 6)}` }
const CARD = { code: `${PREFIX}-002`, name: `Carta offline ${run.slice(0, 6)}` }

test.use({ viewport: { width: 390, height: 844 } })

test('offline dopo che il token è scaduto: si resta collegati, Collezione e mazzi dalla copia', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, ${`${PREFIX}-SET`}, 'Set di prova E2E')`
    await sql`
      insert into public.cards (card_code, name, category, cost, colors)
      values (${LEADER.code}, ${LEADER.name}, 'Leader', null, '{Red}'),
             (${CARD.code}, ${CARD.name}, 'Character', 2, '{Red}')
    `
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${LEADER.code}, ${LEADER.code}, ${SERIES}, 'L'), (${CARD.code}, ${CARD.code}, ${SERIES}, 'C')
    `

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

    // Una carta nella Collection e un mazzo, poi le due pagine online: si salvano le copie.
    await sql`
      insert into public.collection_entries (user_id, print_id, quantity)
      select id, ${CARD.code}, 3 from auth.users where email = ${email}
    `
    await sql`
      insert into public.decks (user_id, name, leader_code)
      select id, 'Mazzo offline', ${LEADER.code} from auth.users where email = ${email}
    `
    const nav = page.getByRole('navigation', { name: 'Sezioni' }).last()
    await nav.getByRole('link', { name: 'Collezione' }).click()
    await expect(page.getByText(CARD.name).first()).toBeVisible()
    await nav.getByRole('link', { name: 'Mazzi' }).click()
    await expect(page.getByText('Mazzo offline')).toBeVisible()
    // Il service worker deve controllare la pagina, se no offline l'app non si riapre.
    await page.evaluate('navigator.serviceWorker.ready.then(() => true)')

    // Un'ora dopo: il token di accesso è scaduto (la sessione resta salvata sul dispositivo).
    // (Codice come testo: il tsconfig dei test E2E non conosce le API del browser.)
    const expired = await page.evaluate(`(() => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
      if (!key) return false
      const session = JSON.parse(localStorage.getItem(key))
      session.expires_at = Math.floor(Date.now() / 1000) - 60
      localStorage.setItem(key, JSON.stringify(session))
      return true
    })()`)
    expect(expired).toBe(true)

    // Modalità aereo e app riaperta da zero.
    await page.context().setOffline(true)
    await page.reload()
    await expect(nav.getByRole('link', { name: 'Catalogo' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Collezione' })).toBeVisible({ timeout: 30_000 })
    await expect(nav.getByRole('link', { name: 'Accedi' })).toHaveCount(0)
    await nav.getByRole('link', { name: 'Collezione' }).click()
    await expect(page.getByText(CARD.name).first()).toBeVisible()
    await nav.getByRole('link', { name: 'Mazzi' }).click()
    await expect(page.getByText('Mazzo offline')).toBeVisible()
    // Dopo un po' non esce dall'account.
    await page.waitForTimeout(15_000)
    await expect(nav.getByRole('link', { name: 'Accedi' })).toHaveCount(0)
    await expect(page.getByText('Mazzo offline')).toBeVisible()

    // Torna la rete: il token si rinnova e l'app riprende a funzionare online.
    await page.context().setOffline(false)
    await expect(page.getByRole('link', { name: 'Nuovo mazzo' })).toBeVisible({ timeout: 60_000 })
  } finally {
    await sql`delete from auth.users where email = ${email}`
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code like ${`${PREFIX}-%`}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
