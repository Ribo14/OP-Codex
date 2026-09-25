import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Deck builder (RIB-21) sul Supabase locale, su schermo da telefono: nuovo Deck con Leader, carte
// dalla scheda "Aggiungi carte", Printing mostrata, riapertura, duplica, rinomina, elimina.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
// Database del Supabase locale (lo stesso in CI): qui si aggiungono Card di prova al catalogo.
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const run = crypto.randomUUID().replaceAll('-', '')
const email = `e2e-deck-${run}@example.com`
const username = `deck_${run}`.slice(0, 20)
const password = `Una frase lunga per i mazzi ${crypto.randomUUID()}`
const SERIES = 980000 + Math.floor(Math.random() * 9000)
const PREFIX = `YY${String(SERIES % 100).padStart(2, '0')}`
const TAG = run.slice(0, 6)
const LEADER = { code: `${PREFIX}-001`, name: `Leader ${TAG}` }
const ALPHA = { code: `${PREFIX}-002`, name: `Alfa ${TAG}` }
const BETA = { code: `${PREFIX}-003`, name: `Beta ${TAG}` }

// Permessi degli appunti: servono per leggere cosa ha copiato "Copia lista".
test.use({
  viewport: { width: 390, height: 844 },
  permissions: ['clipboard-read', 'clipboard-write'],
})

test('Deck builder: crea, aggiungi carte, riapri, duplica, rinomina, elimina', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, ${`${PREFIX}-SET`}, 'Set di prova E2E')`
    await sql`
      insert into public.cards (card_code, name, category, cost, colors)
      values (${LEADER.code}, ${LEADER.name}, 'Leader', null, '{Blue}'),
             (${ALPHA.code}, ${ALPHA.name}, 'Character', 2, '{Blue}'),
             (${BETA.code}, ${BETA.name}, 'Event', 1, '{Blue}')
    `
    await sql`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${LEADER.code}, ${LEADER.code}, ${SERIES}, 'L'),
             (${ALPHA.code}, ${ALPHA.code}, ${SERIES}, 'C'),
             (${`${ALPHA.code}_p1`}, ${ALPHA.code}, ${SERIES}, 'SR'),
             (${BETA.code}, ${BETA.code}, ${SERIES}, 'C')
    `
    // Ban List (RIB-29): Alfa e Beta sono una coppia bandita, in vigore da ieri.
    await sql`
      insert into public.ban_list_entries (card_code, kind, pair_code, effective_from, source)
      values (${ALPHA.code}, 'pair', ${BETA.code}, current_date - 1, 'E2E')
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
    // Il profilo compare solo a Username salvato: da qui si può cambiare pagina.
    await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()

    // Nuovo mazzo: si sceglie il Leader, il mazzo prende il suo nome.
    await page
      .getByRole('navigation', { name: 'Sezioni' })
      .last()
      .getByRole('link', { name: 'Mazzi' })
      .click()
    await page.getByRole('link', { name: 'Nuovo mazzo' }).click()
    await page.getByPlaceholder('Cerca un Leader per nome o codice').fill(TAG)
    await page.getByRole('button', { name: new RegExp(LEADER.name) }).click()
    await expect(page).toHaveURL(/\/mazzi\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: LEADER.name })).toBeVisible()

    // Carte correlate al Leader (RIB-41): si apre "Aggiungi carte" coi filtri del Leader (Blu).
    await page.getByRole('button', { name: 'Carte correlate al Leader' }).click()
    await expect(page.getByRole('tab', { name: 'Aggiungi carte' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page).toHaveURL(/colore=Blue/)

    // Aggiungi carte: 4 Alfa e 2 Beta; il Leader non è tra le carte aggiungibili.
    await page.getByPlaceholder(/Cerca per nome/).fill(TAG)
    await expect(
      page.locator('#pannello-add').getByText(LEADER.code, { exact: false }),
    ).toHaveCount(0)
    const addAlpha = page.getByRole('button', { name: `Aggiungi una copia di ${ALPHA.name}` })
    for (let i = 0; i < 4; i++) await addAlpha.click()
    const addBeta = page.getByRole('button', { name: `Aggiungi una copia di ${BETA.name}` })
    await addBeta.click()
    await addBeta.click()
    await expect(page.getByRole('tab', { name: 'Mazzo 6/50' })).toBeVisible()

    // Scheda Mazzo: Printing mostrata diversa, conteggio invariato.
    await page.getByRole('tab', { name: 'Mazzo 6/50' }).click()
    await page.getByLabel(`Stampa mostrata di ${ALPHA.name}`).selectOption(`${ALPHA.code}_p1`)
    await page.getByRole('button', { name: `Togli una copia di ${BETA.name}` }).click()
    await expect(page.getByRole('tab', { name: 'Mazzo 5/50' })).toBeVisible()

    // Riaperto, il mazzo è com'era.
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Mazzo 5/50' })).toBeVisible()
    await expect(page.getByLabel(`Stampa mostrata di ${ALPHA.name}`)).toHaveValue(
      `${ALPHA.code}_p1`,
    )
    // La scheda "Aggiungi carte" (nascosta) ha lo stesso contatore: si guarda la scheda Mazzo.
    await expect(
      page.locator('#pannello-deck').getByLabel(`Copie di ${ALPHA.name} nel mazzo`),
    ).toHaveText('4')

    // Carte mancanti (RIB-25): la Collection è vuota, quindi mancano il Leader e le 5 carte.
    await expect(page.locator('#pannello-deck').getByLabel('ne hai 0 su 4')).toBeVisible()
    await page.getByText('Ti mancano 6 carte').click()
    await page.getByRole('button', { name: 'Copia lista mancanti' }).click()
    await expect(page.getByRole('button', { name: 'Lista copiata' })).toBeVisible()
    const missing = String(await page.evaluate('navigator.clipboard.readText()')).replace(
      /\r\n/g,
      '\n',
    )
    expect(missing).toBe(`1x${LEADER.code}\n1x${BETA.code}\n4x${ALPHA.code}`)

    // Deck Warning (RIB-23): 5 carte su 50 e la coppia bandita Alfa + Beta (RIB-29); gli avvisi
    // si aprono e non bloccano nulla.
    await page.getByRole('button', { name: /2 avvisi/ }).click()
    await expect(page.getByText('Il mazzo ha 5 carte: ne servono esattamente 50')).toBeVisible()
    await expect(page.getByText(/^Coppia bandita: queste carte/)).toBeVisible()
    // Formato: Standard di base, si passa a Extra e resta dopo il ricaricamento.
    const formats = page.getByRole('radiogroup', { name: 'Formato del mazzo' })
    await expect(formats.getByRole('radio', { name: 'Standard' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await formats.getByRole('radio', { name: 'Extra' }).click()
    // Statistiche: la curva conta 4 carte di costo 2 e 1 di costo 1.
    await page.getByText('Statistiche').click()
    await expect(page.getByLabel('Costo 2: 4 carte')).toBeVisible()
    await expect(page.getByLabel('Costo 1: 1 carta')).toBeVisible()
    await page.reload()
    await expect(
      page
        .getByRole('radiogroup', { name: 'Formato del mazzo' })
        .getByRole('radio', { name: 'Extra' }),
    ).toHaveAttribute('aria-checked', 'true')

    // Elenco: duplica, rinomina la copia, elimina l'originale.
    await page.getByRole('link', { name: 'Mazzi', exact: true }).first().click()
    await expect(page.getByText('5/50 carte')).toBeVisible()
    await expect(page.getByText('2 avvisi')).toBeVisible()
    await page.getByRole('button', { name: 'Duplica' }).click()
    await expect(page.getByText(`${LEADER.name} (copia)`)).toBeVisible()

    const copy = page.getByRole('listitem').filter({ hasText: `${LEADER.name} (copia)` })
    await copy.getByRole('button', { name: 'Rinomina' }).click()
    await copy.getByLabel('Nome del mazzo').fill(`Blu ${TAG}`)
    await copy.getByRole('button', { name: 'Salva' }).click()
    await expect(page.getByText(`Blu ${TAG}`)).toBeVisible()

    const original = page.getByRole('listitem').filter({ hasNotText: `Blu ${TAG}` })
    await original.getByRole('button', { name: 'Elimina' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText(`Blu ${TAG}`)).toBeVisible()
    // La copia è indipendente: ha ancora le sue carte.
    await expect(page.getByText('5/50 carte')).toBeVisible()

    // Importa mazzo (RIB-24): una riga sbagliata non blocca le altre.
    await page.getByRole('link', { name: 'Importa mazzo' }).click()
    await page
      .getByLabel('Incolla la lista del mazzo')
      .fill(`1x${LEADER.code}\n4 x ${ALPHA.code}\n${BETA.code} x2\n3xZZ00-000`)
    await expect(page.getByText(`Leader: ${LEADER.name} (${LEADER.code})`)).toBeVisible()
    await expect(page.getByText('6/50 carte')).toBeVisible()
    await expect(
      page.getByText('Riga 4: «3xZZ00-000» (codice non presente nel catalogo)'),
    ).toBeVisible()
    await page.getByLabel('Nome del mazzo').fill(`Importato ${TAG}`)
    await page.getByRole('button', { name: 'Crea mazzo comunque (1 riga ignorata)' }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Importato ${TAG}` })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Mazzo 6/50' })).toBeVisible()

    // Copia lista: formato standard, Leader per primo, poi per costo.
    await page.getByRole('button', { name: 'Copia lista' }).click()
    await expect(page.getByRole('button', { name: 'Lista copiata' })).toBeVisible()
    // Script come testo: i test E2E non hanno i tipi del browser (navigator).
    // Su Windows gli appunti restituiscono gli a capo come \r\n.
    const copied = String(await page.evaluate('navigator.clipboard.readText()')).replace(
      /\r\n/g,
      '\n',
    )
    expect(copied).toBe(`1x${LEADER.code}\n2x${BETA.code}\n4x${ALPHA.code}`)
  } finally {
    await sql`delete from auth.users where email = ${email}`
    await sql`delete from public.ban_list_entries where card_code = ${ALPHA.code}`
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code like ${`${PREFIX}-%`}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
