import { expect, test } from '@playwright/test'
import postgres from 'postgres'

// Playtest Table (RIB-99) sul Supabase locale, su telefono in orizzontale e senza account: uno
// Starter Deck di prova (con la sua composizione in set_recipes), scelta "VS", mulligan dei due
// lati, una carta giocata, un DON!! al Leader e la fine del turno.

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SERIES = 960000 + Math.floor(Math.random() * 9000)
const PREFIX = `PT${String(SERIES % 100).padStart(2, '0')}`
const SET = `${PREFIX}-SET`
const TAG = crypto.randomUUID().slice(0, 6)
const LEADER = { code: `${PREFIX}-001`, name: `Leader ${TAG}` }
/** 12 Personaggi da 4 copie e uno da 2: 50 carte. */
const CHARACTERS = Array.from({ length: 13 }, (_, i) => ({
  code: `${PREFIX}-${String(i + 2).padStart(3, '0')}`,
  name: `Carta ${String(i + 1)} ${TAG}`,
  copies: i < 12 ? 4 : 2,
}))
const DECK_LABEL = `${LEADER.name} (${SET})`

// Telefono in orizzontale: il tavolo è pensato per questa forma.
test.use({ viewport: { width: 844, height: 390 } })

test('Tavolo di prova: VS, mulligan, carta giocata, DON!! e fine turno', async ({ page }) => {
  test.setTimeout(90_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  try {
    await sql`insert into public.sets (series_id, code, name) values (${SERIES}, ${SET}, 'Set di prova E2E')`
    await sql`
      insert into public.cards (card_code, name, category, cost, power, life, colors)
      values (${LEADER.code}, ${LEADER.name}, 'Leader', null, 5000, 4, '{Red}')
    `
    for (const c of CHARACTERS) {
      await sql`
        insert into public.cards (card_code, name, category, cost, power, colors)
        values (${c.code}, ${c.name}, 'Character', 1, 3000, '{Red}')
      `
    }
    for (const code of [LEADER.code, ...CHARACTERS.map((c) => c.code)]) {
      await sql`
        insert into public.printings (print_id, card_code, series_id, rarity)
        values (${code}, ${code}, ${SERIES}, 'C')
      `
    }
    const recipe = Object.fromEntries([
      [LEADER.code, 1],
      ...CHARACTERS.map((c) => [c.code, c.copies]),
    ]) as Record<string, number>
    await sql`
      insert into public.set_recipes (set_code, cards, source)
      values (${SET}, ${sql.json(recipe)}, 'E2E')
    `

    // Da Mazzi, anche senza account.
    await page.goto('/mazzi')
    await page.getByRole('link', { name: 'Tavolo di prova' }).click()
    await expect(page.getByRole('heading', { name: 'Tavolo di prova' })).toBeVisible()

    // Scelta "VS": lo Starter di prova per entrambi, inizio io.
    await page.getByLabel('Il tuo mazzo: Scegli il mazzo').selectOption({ label: DECK_LABEL })
    await page.getByLabel("L'avversario: Scegli il mazzo").selectOption({ label: DECK_LABEL })
    await expect(page.getByText('50 carte').first()).toBeVisible()
    await page
      .getByRole('radiogroup', { name: 'Chi inizia' })
      .getByRole('radio', { name: 'Io', exact: true })
      .click()
    await page.getByRole('button', { name: 'Inizia la battaglia' }).click()

    // Mulligan: si ripesca una volta sola, poi si decide anche per l'avversario.
    const mine = page.getByRole('dialog', { name: 'Inizi tu. Vuoi ripescare la mano?' })
    await expect(mine.getByRole('listitem')).toHaveCount(5)
    await mine.getByRole('button', { name: 'Ripesca' }).click()
    await expect(mine.getByRole('button', { name: 'Ripesca' })).toBeDisabled()
    await mine.getByRole('button', { name: 'Inizia con questa mano' }).click()
    await page
      .getByRole('dialog', { name: "Mano dell'avversario: vuoi ripescarla?" })
      .getByRole('button', { name: 'Inizia con questa mano' })
      .click()

    // Primo turno di chi inizia: niente pesca, 1 DON!!; Vita dal Leader (4).
    await expect(page.getByRole('status')).toHaveText(/Fase principale · Turno 1 · tocca a te/)
    await expect(page.getByRole('button', { name: /^DON!!: 1 attivi su 1 in gioco/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vita: 4 carte' })).toHaveCount(2)
    const hand = page.getByRole('list', { name: 'La tua mano' })
    await expect(hand.getByRole('button')).toHaveCount(5)

    // Una carta dalla mano in campo, col menu.
    await hand.getByRole('button').first().click()
    await page.getByRole('button', { name: 'Gioca in campo' }).click()
    await expect(hand.getByRole('button')).toHaveCount(4)
    await expect(
      page
        .getByLabel('Area Personaggi')
        .last()
        .getByRole('button', { name: /Carta \d+/ }),
    ).toHaveCount(1)

    // Un DON!! al Leader: +1000 nel proprio turno.
    const leader = page.getByRole('button', { name: new RegExp(`^${LEADER.name}`) }).last()
    await leader.click()
    await page.getByRole('button', { name: '+1 DON!!' }).click()
    await expect(leader).toHaveAccessibleName(`${LEADER.name}, Potenza 6000`)
    await page.getByRole('button', { name: 'Chiudi' }).click()
    await expect(page.getByRole('button', { name: 'Gioca in campo' })).toHaveCount(0)

    // Fine del turno: tocca all'avversario, che pesca e prende 2 DON!!; il bonus del Leader
    // non vale nel turno altrui.
    await page.getByRole('button', { name: 'Fine del turno' }).click()
    await expect(page.getByRole('status')).toHaveText(
      /Fase principale · Turno 2 · tocca all'avversario/,
    )
    await expect(leader).toHaveAccessibleName(`${LEADER.name}, Potenza 5000`)
    await expect(page.getByRole('button', { name: '6 carte in mano' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^DON!!: 2 attivi su 2 in gioco/ })).toBeVisible()
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/tavolo-rib99.png` })
  } finally {
    await sql`delete from public.set_recipes where set_code = ${SET}`
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code like ${`${PREFIX}-%`}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
