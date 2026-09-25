import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Collection (RIB-20) sul Supabase locale: navigazione senza account, +/− dal dettaglio Card con
// lingue diverse, pagina Collezione con i totali.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
// Database del Supabase locale (lo stesso in CI): qui si aggiunge una Card di prova al catalogo.
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const run = crypto.randomUUID().replaceAll('-', '')
const email = `e2e-col-${run}@example.com`
const username = `col_${run}`.slice(0, 20)
const password = `Una frase lunga per la Collection ${crypto.randomUUID()}`
const SERIES = 990000 + Math.floor(Math.random() * 9000)
const CODE = `ZZ${String(SERIES % 100).padStart(2, '0')}-${String(SERIES % 1000).padStart(3, '0')}`
const NAME = `Carta di prova ${run.slice(0, 6)}`

// Schermo da telefono: barra in basso e dettaglio a tutto schermo.
test.use({ viewport: { width: 390, height: 844 } })

test('Collection: +/− dal dettaglio, lingue separate, totali nella pagina', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, ${`ZZ-${String(SERIES)}`}, 'Set di prova E2E')`
    await sql`insert into public.cards (card_code, name, category) values (${CODE}, ${NAME}, 'Character')`
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${CODE}, ${CODE}, ${SERIES}, 'C'), (${`${CODE}_p1`}, ${CODE}, ${SERIES}, 'SR')
    `

    // Senza account: la barra non mostra Collezione e il dettaglio invita ad accedere.
    await page.goto(`/carta/${CODE}`)
    const phoneNav = page.getByRole('navigation', { name: 'Sezioni' }).last()
    await expect(phoneNav.getByRole('link', { name: 'Accedi' })).toBeVisible()
    await expect(phoneNav.getByRole('link', { name: 'Collezione' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Accedi per registrare/ })).toBeVisible()

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
    await expect(page).toHaveURL(/\/profilo/)

    // Dettaglio Card: 2 copie EN e 1 JP della base, 1 EN della parallel.
    await page.goto(`/carta/${CODE}`)
    const controls = page.getByRole('region', { name: 'Nella tua Collection' })
    const add = controls.getByRole('button', { name: /Aggiungi una copia/ })
    await add.click()
    await add.click()
    await add.click()
    await controls.getByRole('button', { name: /Togli una copia/ }).click()
    await expect(controls.getByText('2 copie di questa stampa')).toBeVisible()
    await controls.getByRole('radio', { name: /Giapponese/ }).click()
    await add.click()
    await expect(controls.getByText('3 copie di questa stampa')).toBeVisible()
    await page.getByRole('radio', { name: new RegExp(`${CODE}_p1`) }).click()
    await expect(controls.getByText('0 copie di questa stampa')).toBeVisible()
    await controls.getByRole('radio', { name: /Inglese/ }).click()
    await add.click()
    await expect(controls.getByText('1 copia di questa stampa')).toBeVisible()

    // Dopo il ricaricamento i numeri vengono dal database.
    await page.reload()
    await expect(
      page
        .getByRole('region', { name: 'Nella tua Collection' })
        .getByText('1 copia di questa stampa'),
    ).toBeVisible()

    // Pagina Collezione: 4 copie, 1 Card diversa, due tessere.
    await page.goto('/collezione')
    await expect(page.getByText('4 carte in tutto · 1 Card diverse')).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(NAME) })).toHaveCount(2)
    await page.getByLabel('Ordina per').selectOption('quantity')
    await expect(page.getByRole('listitem').first()).toContainText('EN 2 · JP 1')

    // Portando tutto a 0 la Printing sparisce.
    await page
      .getByRole('link', { name: new RegExp(NAME) })
      .last()
      .click()
    const detail = page.getByRole('region', { name: 'Nella tua Collection' })
    await detail.getByRole('button', { name: /Togli una copia/ }).click()
    await expect(detail.getByText('0 copie di questa stampa')).toBeVisible()
    await page.goto('/collezione')
    await expect(page.getByText('3 carte in tutto · 1 Card diverse')).toBeVisible()
  } finally {
    await sql`delete from auth.users where email = ${email}`
    await sql`delete from public.printings where card_code = ${CODE}`
    await sql`delete from public.cards where card_code = ${CODE}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
