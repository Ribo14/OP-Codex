import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CardListParseError,
  parseCardListPage,
  type ParsedCardListPage,
} from './card-list-parser.ts'

// Fixture: pagine della Official Card List salvate il 2026-09-23.
function fixture(name: string): ParsedCardListPage {
  const html = readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')
  return parseCardListPage(html)
}

function cardOf(page: ParsedCardListPage, cardCode: string) {
  const card = page.cards.find((c) => c.cardCode === cardCode)
  if (!card) throw new Error(`${cardCode} non trovata`)
  return card
}

function printIdsOf(page: ParsedCardListPage, cardCode: string) {
  return page.printings.filter((p) => p.cardCode === cardCode).map((p) => p.printId)
}

describe('Set booster: OP-01', () => {
  const page = fixture('op-01')

  it('riconosce il Set', () => {
    expect(page.set).toEqual({
      seriesId: 569101,
      code: 'OP-01',
      name: 'ROMANCE DAWN',
      productType: 'BOOSTER PACK',
    })
  })

  it('estrae una Card per Card Code e una Printing per Print ID', () => {
    expect(page.printings).toHaveLength(154)
    expect(page.cards).toHaveLength(121)
    expect(new Set(page.cards.map((c) => c.cardCode)).size).toBe(121)
  })

  it('estrae tutti i campi di un Leader', () => {
    expect(cardOf(page, 'OP01-001')).toEqual({
      cardCode: 'OP01-001',
      name: 'Roronoa Zoro',
      category: 'Leader',
      cost: null,
      life: 5,
      power: 5000,
      counter: null,
      attributes: ['Slash'],
      colors: ['Red'],
      types: ['Supernovas', 'Straw Hat Crew'],
      block: '1',
      effect: '[DON!! x1] [Your Turn] All of your Characters gain +1000 power.',
      trigger: null,
    })
  })

  it('distingue le Printing con suffisso _pN', () => {
    expect(printIdsOf(page, 'OP01-001')).toEqual(['OP01-001', 'OP01-001_p1'])
    expect(page.printings.find((p) => p.printId === 'OP01-001_p1')).toEqual({
      printId: 'OP01-001_p1',
      cardCode: 'OP01-001',
      rarity: 'L',
    })
  })

  it('estrae un Event con Trigger', () => {
    expect(cardOf(page, 'OP01-029')).toMatchObject({
      category: 'Event',
      cost: 1,
      power: null,
      counter: null,
      attributes: [],
      trigger:
        '[Trigger] Up to 1 of your Leader or Character cards gains +1000 power during this turn.',
    })
  })

  it('tratta "-" come potenza 0 per i Character', () => {
    expect(cardOf(page, 'OP01-006')).toMatchObject({ name: 'Otama', power: 0, counter: 2000 })
  })

  it('decodifica le entità HTML nei nomi', () => {
    expect(cardOf(page, 'OP01-040').name).toBe("Kin'emon")
  })
})

describe('Starter deck: ST-01', () => {
  const page = fixture('st-01')

  it('riconosce il Set', () => {
    expect(page.set).toEqual({
      seriesId: 569001,
      code: 'ST-01',
      name: 'Straw Hat Crew',
      productType: 'STARTER DECK',
    })
    expect(page.cards).toHaveLength(17)
    expect(page.printings).toHaveLength(17)
  })

  it('estrae uno Stage', () => {
    expect(cardOf(page, 'ST01-017')).toEqual({
      cardCode: 'ST01-017',
      name: 'Thousand Sunny',
      category: 'Stage',
      cost: 2,
      life: null,
      power: null,
      counter: null,
      attributes: [],
      colors: ['Red'],
      types: ['Straw Hat Crew'],
      block: '1',
      effect:
        '[Activate: Main] You may rest this Stage: Up to 1 {Straw Hat Crew} type Leader or Character card on your field gains +1000 power during this turn.',
      trigger: null,
    })
  })

  it('mantiene gli a capo degli effetti su più righe', () => {
    expect(cardOf(page, 'ST01-012').effect).toBe(
      '[Rush] (This card can attack on the turn in which it is played.)\n' +
        '[DON!! x2] [When Attacking] Your opponent cannot activate [Blocker] during this battle.',
    )
  })
})

describe('Premium booster con ristampe: PRB-01', () => {
  const page = fixture('prb-01')

  it('riconosce il Set', () => {
    expect(page.set).toEqual({
      seriesId: 569301,
      code: 'PRB-01',
      name: 'ONE PIECE CARD THE BEST',
      productType: 'PREMIUM BOOSTER',
    })
    expect(page.printings).toHaveLength(319)
    expect(page.cards).toHaveLength(111)
  })

  it('distingue parallel (_pN) e ristampe (_rN) della stessa Card', () => {
    expect(printIdsOf(page, 'OP01-006')).toEqual([
      'OP01-006_p3',
      'OP01-006_p4',
      'OP01-006_p5',
      'OP01-006_r1',
    ])
  })

  it('ricava la Card anche senza Printing base nella pagina', () => {
    expect(printIdsOf(page, 'P-014')).toEqual(['P-014_p2', 'P-014_p3', 'P-014_r1'])
    expect(cardOf(page, 'P-014')).toMatchObject({
      name: 'Koby',
      category: 'Character',
      types: ['FILM', 'Navy'],
      trigger: '[Trigger] Play this card.',
    })
  })

  it('ogni Printing appartiene a una Card estratta', () => {
    const cardCodes = new Set(page.cards.map((c) => c.cardCode))
    for (const printing of page.printings) {
      expect(cardCodes.has(printing.cardCode)).toBe(true)
      expect(printing.printId.startsWith(printing.cardCode)).toBe(true)
    }
  })
})

describe('HTML inatteso', () => {
  const page = (
    cards: string,
    series = '<option value="569101" selected>BOOSTER PACK -X- [OP-01]</option>',
  ) => `<select id="series">${series}</select>${cards}`

  const card = (id: string, info: string) => `
    <dl class="modalCol" id="${id}">
      <dt><div class="infoCol">${info}</div><div class="cardName">Test</div></dt>
      <dd><div class="backCol"><div class="cost"><h3>Cost</h3>1</div></div></dd>
    </dl>`

  it('fallisce se manca il Set selezionato', () => {
    expect(() => parseCardListPage(page(card('OP01-001', ''), ''))).toThrow(CardListParseError)
  })

  it('fallisce se la pagina non contiene carte', () => {
    expect(() => parseCardListPage(page(''))).toThrow('Nessuna carta')
  })

  it('fallisce su una Category sconosciuta, indicando il Print ID', () => {
    const html = page(card('OP01-001', '<span>OP01-001</span><span>C</span><span>TOKEN</span>'))
    expect(() => parseCardListPage(html)).toThrow('OP01-001: Category sconosciuta "TOKEN"')
  })

  it('fallisce su un Print ID con formato sconosciuto', () => {
    const html = page(
      card('OP01-001_x1', '<span>OP01-001</span><span>C</span><span>CHARACTER</span>'),
    )
    expect(() => parseCardListPage(html)).toThrow('Print ID non riconosciuto')
  })

  const cardWithBlock = (blockValue: string) =>
    page(`
      <dl class="modalCol" id="OP16-063">
        <dt><div class="infoCol"><span>OP16-063</span><span>C</span><span>CHARACTER</span></div>
        <div class="cardName">Test</div></dt>
        <dd><div class="backCol">
          <div class="cost"><h3>Cost</h3>1</div>
          <div class="block"><h3>Block<br class="spInline"> icon</h3>${blockValue}</div>
        </div></dd>
      </dl>`)

  it('accetta come Block un numero o "X"; "-" vuol dire nessun Block', () => {
    expect(parseCardListPage(cardWithBlock('3')).cards[0]?.block).toBe('3')
    expect(parseCardListPage(cardWithBlock('X')).cards[0]?.block).toBe('X')
    expect(parseCardListPage(cardWithBlock('-')).cards[0]?.block).toBeNull()
  })

  it('fallisce su un Block sconosciuto', () => {
    expect(() => parseCardListPage(cardWithBlock('Z9'))).toThrow('OP16-063: Block non valido: "Z9"')
  })

  it('usa i codici noti per i Set senza codice tra parentesi', () => {
    const html = page(
      card('P-001', '<span>P-001</span><span>P</span><span>CHARACTER</span>'),
      '<option value="569901" selected>Promotion card</option>',
    )
    expect(parseCardListPage(html).set).toEqual({
      seriesId: 569901,
      code: 'PROMO',
      name: 'Promotion card',
      productType: null,
    })
  })
})
