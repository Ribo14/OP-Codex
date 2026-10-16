import { expect, test, type Locator, type Page } from '@playwright/test'
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
/** Effetto di tutti i Personaggi di prova: compare in alto quando se ne gioca uno (RIB-101). */
const EFFECT = '[On Play] Draw 1 card.'
const DECK_LABEL = `${LEADER.name} (${SET})`

/** Trascina col mouse (a piccoli passi, come un dito) dal centro di una carta a quello di una zona. */
async function dragTo(page: Page, from: Locator, to: Locator) {
  const a = await from.boundingBox()
  const b = await to.boundingBox()
  if (!a || !b) throw new Error('elemento non visibile')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

// Telefono in orizzontale: il tavolo è pensato per questa forma.
test.use({ viewport: { width: 844, height: 390 } })

test('Tavolo di prova: VS, mulligan, menu, trascinamento, info, mazzo, DON!! e fine turno', async ({
  page,
}) => {
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
        insert into public.cards (card_code, name, category, cost, power, colors, effect)
        values (${c.code}, ${c.name}, 'Character', 1, 3000, '{Red}', ${EFFECT})
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

    // La fase sulla linea di mezzo (l'effetto giocato è l'altro "status").
    const phase = page.getByRole('status').filter({ hasText: 'Turno' })

    // Primo turno di chi inizia: niente pesca, 1 DON!!; Vita dal Leader (4).
    await expect(phase).toHaveText(/Fase principale · Turno 1 · tocca a te/)
    await expect(page.getByRole('button', { name: /^DON!!: 1 attivi su 1 in gioco/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vita: 4 carte' })).toHaveCount(2)
    const hand = page.getByRole('list', { name: 'La tua mano' })
    await expect(hand.getByRole('button')).toHaveCount(5)

    // Una carta dalla mano in campo, col menu.
    await hand.getByRole('button').first().click()
    await page.getByRole('button', { name: 'Gioca in campo' }).click()
    await expect(hand.getByRole('button')).toHaveCount(4)
    // RIB-101: il suo effetto compare in alto (solo il testo) e poi sparisce da solo.
    const played = page.getByRole('status', { name: /^Giocata: Carta \d+/ })
    await expect(played).toContainText(EFFECT)
    await expect(played).toBeHidden({ timeout: 8000 })
    await expect(
      page
        .getByLabel('Area Personaggi')
        .last()
        .getByRole('button', { name: /Carta \d+/ }),
    ).toHaveCount(1)

    // Trascinamento (RIB-100): dalla mano al campo, poi dal campo al cestino.
    const myField = page.getByLabel('Area Personaggi').last()
    await dragTo(page, hand.getByRole('button').first(), myField)
    await expect(hand.getByRole('button')).toHaveCount(3)
    await expect(myField.getByRole('button', { name: /Carta \d+/ })).toHaveCount(2)
    await dragTo(
      page,
      myField.getByRole('button', { name: /Carta \d+/ }).first(),
      page.getByRole('button', { name: /^Cestino:/ }).last(),
    )
    await expect(myField.getByRole('button', { name: /Carta \d+/ })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Cestino: 1 carta' })).toBeVisible()
    // Il rilascio di un trascinamento non apre il menu; un rilascio fuori da una zona non sposta.
    await expect(page.getByRole('button', { name: 'Gioca in campo' })).toHaveCount(0)
    await dragTo(page, hand.getByRole('button').first(), phase)
    await expect(hand.getByRole('button')).toHaveCount(3)

    // Info della carta (RIB-101): tenendo premuta una carta della mano, che non si sposta.
    const box = await hand.getByRole('button').first().boundingBox()
    if (!box) throw new Error('carta non visibile')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()
    const info = page.getByRole('complementary', { name: /^Carta \d+/ })
    await expect(info.getByRole('heading', { name: 'Effetto' })).toBeVisible()
    await expect(info.getByText(EFFECT)).toBeVisible()
    await expect(info.getByRole('button', { name: 'Azioni sulla carta' })).toBeVisible()
    await expect(hand.getByRole('button')).toHaveCount(3)
    // Un tocco su una zona vuota del tavolo (la linea di mezzo) la chiude.
    const size = page.viewportSize()
    if (!size) throw new Error('viewport')
    await page.mouse.click(size.width * 0.45, size.height * 0.47)
    await expect(info).toHaveCount(0)
    // Anche dalla voce "Info" del menu, per una carta dell'avversario.
    await page
      .getByRole('button', { name: new RegExp(`^${LEADER.name}`) })
      .first()
      .click()
    await page.getByRole('button', { name: 'Info della carta' }).click()
    await expect(
      page
        .getByRole('complementary', { name: LEADER.name })
        .getByText('Questa carta non ha effetti.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Chiudi' }).click()

    // Guardare e cercare nel mazzo (RIB-102). Le prime 3: la prima in mano, le altre in cima.
    const myDeck = page.getByRole('button', { name: /^Mazzo: \d+ carte$/ }).last()
    const deckSize = async () =>
      Number((await myDeck.getAttribute('aria-label'))?.match(/\d+/)?.[0])
    const start = await deckSize()
    await myDeck.click()
    await page.getByRole('button', { name: 'Guarda le prime 3 carte del mazzo' }).click()
    const look = page.getByRole('dialog', { name: 'Le prime 3 carte del mazzo' })
    await expect(look.getByRole('listitem')).toHaveCount(3)
    await look.getByRole('combobox').first().selectOption({ label: 'In mano' })
    await look.getByRole('button', { name: 'Fatto' }).click()
    await expect(look).toHaveCount(0)
    await expect(hand.getByRole('button')).toHaveCount(4)
    expect(await deckSize()).toBe(start - 1)

    // Cerca nel mazzo: una carta in mano, mazzo rimescolato.
    await myDeck.click()
    await page.getByRole('button', { name: 'Cerca nel mazzo' }).click()
    const search = page.getByRole('dialog', { name: /^Cerca nel mazzo/ })
    await search.getByRole('listitem').first().getByRole('button').click()
    await search.getByRole('button', { name: 'Prendi in mano' }).click()
    await expect(search).toHaveCount(0)
    await expect(hand.getByRole('button')).toHaveCount(5)
    expect(await deckSize()).toBe(start - 2)

    // Rivela la carta in cima: la vedono entrambi, resta nel mazzo.
    await myDeck.click()
    await page.getByRole('button', { name: 'Rivela la carta in cima' }).click()
    const revealed = page.getByRole('dialog', { name: /^Carta rivelata: Carta \d+/ })
    await expect(revealed.getByText('Carta rivelata dal tuo mazzo')).toBeVisible()
    await revealed.getByRole('button', { name: 'Chiudi' }).click()
    await expect(revealed).toHaveCount(0)
    expect(await deckSize()).toBe(start - 2)

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
    await expect(phase).toHaveText(/Fase principale · Turno 2 · tocca all'avversario/)
    await expect(leader).toHaveAccessibleName(`${LEADER.name}, Potenza 5000`)
    await expect(page.getByRole('button', { name: '6 carte in mano' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^DON!!: 2 attivi su 2 in gioco/ })).toBeVisible()
    // La partita non si perde (RIB-103): ricaricando si riprende da qui; "Nuova partita" la
    // abbandona e il tavolo riparte dalla scelta dei mazzi.
    await page.reload()
    const resume = page.getByRole('dialog', { name: 'Partita in corso' })
    await expect(resume).toContainText('Turno 2')
    await resume.getByRole('button', { name: 'Riprendi la partita' }).click()
    await expect(phase).toHaveText(/Turno 2 · tocca all'avversario/)
    await expect(hand.getByRole('button')).toHaveCount(5)
    await expect(leader).toHaveAccessibleName(`${LEADER.name}, Potenza 5000`)
    await page.getByRole('button', { name: 'Menu del tavolo' }).click()
    await page.getByRole('button', { name: 'Nuova partita (abbandona questa)' }).click()
    await expect(page.getByRole('button', { name: 'Inizia la battaglia' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Inizia la battaglia' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Partita in corso' })).toHaveCount(0)

    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/tavolo-rib99.png` })
  } finally {
    await sql`delete from public.set_recipes where set_code = ${SET}`
    await sql`delete from public.printings where series_id = ${SERIES}`
    await sql`delete from public.cards where card_code like ${`${PREFIX}-%`}`
    await sql`delete from public.sets where series_id = ${SERIES}`
    await sql.end()
  }
})
