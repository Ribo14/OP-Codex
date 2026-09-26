import { describe, expect, it } from 'vitest'
import type { BanList } from './ban-list'
import type { CatalogCard } from './catalog-data'
import {
  catalogFacets,
  countActiveFilters,
  EMPTY_FILTERS,
  filterCatalog,
  filtersFromSearchParams,
  filtersToSearchParams,
  relatedFilters,
  type CatalogFilters,
} from './filters'

function card(partial: Partial<CatalogCard> & Pick<CatalogCard, 'cardCode' | 'name'>): CatalogCard {
  return {
    category: 'Character',
    cost: null,
    life: null,
    power: null,
    counter: null,
    colors: ['Red'],
    attributes: [],
    types: [],
    block: '1',
    effect: null,
    trigger: null,
    keywords: [],
    printings: [{ printId: partial.cardCode, rarity: 'C', setCode: 'OP-01', hasImage: true }],
    ...partial,
  }
}

const CARDS: CatalogCard[] = [
  card({
    cardCode: 'OP01-001',
    name: 'Roronoa Zoro',
    category: 'Leader',
    life: 5,
    power: 5000,
    colors: ['Red'],
    attributes: ['Slash'],
    types: ['Supernovas', 'Straw Hat Crew'],
    effect: '[DON!! x1] [Your Turn] All of your Characters gain +1000 power.',
    keywords: ['DON!! x1', 'Your Turn'],
    printings: [
      { printId: 'OP01-001', rarity: 'L', setCode: 'OP-01', hasImage: true },
      { printId: 'OP01-001_p1', rarity: 'L', setCode: 'OP-01', hasImage: true },
    ],
  }),
  card({
    cardCode: 'OP01-016',
    name: 'Nami',
    cost: 1,
    power: 2000,
    counter: 1000,
    attributes: ['Special'],
    types: ['Straw Hat Crew'],
    effect:
      '[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type card other than [Nami] and add it to your hand.',
    keywords: ['On Play'],
    printings: [
      { printId: 'OP01-016', rarity: 'R', setCode: 'OP-01', hasImage: true },
      { printId: 'OP01-016_p8', rarity: 'R', setCode: 'PRB-01', hasImage: true },
    ],
  }),
  card({
    cardCode: 'ST01-012',
    name: 'Monkey.D.Luffy',
    cost: 5,
    power: 6000,
    attributes: ['Strike'],
    types: ['Supernovas', 'Straw Hat Crew'],
    effect:
      '[Rush]\n[DON!! x2] [When Attacking] Your opponent cannot activate [Blocker] during this battle.',
    keywords: ['Rush', 'DON!! x2', 'When Attacking'],
    printings: [{ printId: 'ST01-012', rarity: 'SR', setCode: 'ST-01', hasImage: true }],
  }),
  card({
    cardCode: 'OP02-008',
    name: 'Jozu',
    cost: 4,
    power: 5000,
    counter: 1000,
    colors: ['Green'],
    types: ['Whitebeard Pirates'],
    effect: '[Blocker]\n[On K.O.] Draw 1 card and trash 1 card from your hand.',
    keywords: ['Blocker', 'On K.O.'],
    block: '2',
    printings: [{ printId: 'OP02-008', rarity: 'C', setCode: 'OP-02', hasImage: true }],
  }),
  card({
    cardCode: 'OP01-029',
    name: 'Radical Beam!!',
    category: 'Event',
    cost: 1,
    effect:
      '[Counter] Up to 1 of your Leader or Character cards gains +2000 power during this battle.',
    trigger:
      '[Trigger] Up to 1 of your Leader or Character cards gains +1000 power during this turn.',
    keywords: ['Counter', 'Trigger'],
    printings: [{ printId: 'OP01-029', rarity: 'UC', setCode: 'OP-01', hasImage: true }],
  }),
]

const codes = (f: Partial<CatalogFilters>) =>
  filterCatalog(CARDS, { ...EMPTY_FILTERS, ...f }).map((e) => e.printing.printId)

describe('filterCatalog', () => {
  it('senza filtri mostra una voce per Card, con la Printing base', () => {
    expect(codes({})).toEqual(['OP01-001', 'OP01-016', 'ST01-012', 'OP02-008', 'OP01-029'])
  })

  it('cerca il testo in nome, codice, effetto e Type, senza badare a maiuscole e accenti', () => {
    expect(codes({ q: 'zoro' })).toEqual(['OP01-001'])
    expect(codes({ q: 'st01-012' })).toEqual(['ST01-012'])
    expect(codes({ q: 'whitebeard' })).toEqual(['OP02-008'])
    expect(codes({ q: 'Straw   HAT supernovas' })).toEqual(['OP01-001', 'ST01-012'])
  })

  it('filtra per Keyword: solo le Card che la possiedono, non quelle che la citano', () => {
    expect(codes({ keywords: ['Blocker'] })).toEqual(['OP02-008'])
    expect(codes({ keywords: ['Rush'] })).toEqual(['ST01-012'])
    // Più valori dello stesso filtro sono in OR.
    expect(codes({ keywords: ['Rush', 'Blocker'] })).toEqual(['ST01-012', 'OP02-008'])
  })

  it('le scorciatoie degli effetti cercano nel testo inglese', () => {
    expect(codes({ effects: ['trash'] })).toEqual(['OP02-008'])
    expect(codes({ effects: ['draw'] })).toEqual(['OP02-008'])
    expect(codes({ effects: ['lookTop'] })).toEqual(['OP01-016'])
    expect(codes({ effects: ['powerUp'] })).toEqual(['OP01-001', 'OP01-029'])
  })

  it('combina filtri diversi in AND', () => {
    expect(codes({ types: ['Straw Hat Crew'], keywords: ['On Play'] })).toEqual(['OP01-016'])
    expect(codes({ colors: ['Green'], effects: ['draw'], cost: [3, 5] })).toEqual(['OP02-008'])
    expect(codes({ colors: ['Green'], cost: [0, 3] })).toEqual([])
  })

  it('gli intervalli escludono chi non ha quel valore; nessun Counter vale 0', () => {
    expect(codes({ cost: [4, null] })).toEqual(['ST01-012', 'OP02-008'])
    expect(codes({ power: [null, 2000] })).toEqual(['OP01-016'])
    expect(codes({ counter: [0, 0] })).toEqual(['OP01-001', 'ST01-012', 'OP01-029'])
    expect(codes({ counter: [1000, null] })).toEqual(['OP01-016', 'OP02-008'])
  })

  it('filtra per Category, attributo, Block e presenza di Trigger', () => {
    expect(codes({ categories: ['Leader', 'Event'] })).toEqual(['OP01-001', 'OP01-029'])
    expect(codes({ attributes: ['Slash'] })).toEqual(['OP01-001'])
    expect(codes({ blocks: ['2'] })).toEqual(['OP02-008'])
    expect(codes({ trigger: true })).toEqual(['OP01-029'])
    expect(codes({ trigger: false })).toHaveLength(4)
  })

  it('Set e rarità agiscono sulle Printing: si mostra quella che passa i filtri', () => {
    expect(codes({ sets: ['PRB-01'] })).toEqual(['OP01-016_p8'])
    expect(codes({ sets: ['OP-01'], rarities: ['L'] })).toEqual(['OP01-001'])
  })

  it('l’interruttore delle Printing mostra anche le varianti', () => {
    expect(codes({ allPrintings: true, q: 'zoro' })).toEqual(['OP01-001', 'OP01-001_p1'])
    expect(codes({ allPrintings: true, q: 'nami', sets: ['OP-01'] })).toEqual(['OP01-016'])
  })
})

describe('filtro Ban List (RIB-50)', () => {
  const banList: BanList = {
    banned: new Set(['OP01-016']),
    restricted: new Map([['ST01-012', 1]]),
    pairs: [['OP02-008', 'OP01-029']],
  }
  const withBan = (ban: string[]) =>
    filterCatalog(CARDS, { ...EMPTY_FILTERS, ban }, null, banList).map((e) => e.card.cardCode)

  it('bandite, limitate e coppie: le carte della Ban List in vigore', () => {
    expect(withBan(['banned'])).toEqual(['OP01-016'])
    expect(withBan(['restricted'])).toEqual(['ST01-012'])
    // Entrambe le carte di una coppia.
    expect(withBan(['pair'])).toEqual(['OP02-008', 'OP01-029'])
    // Più scelte in OR.
    expect(withBan(['banned', 'restricted'])).toEqual(['OP01-016', 'ST01-012'])
  })

  it('"solo carte legali" esclude le bandite, non le limitate né le coppie', () => {
    expect(withBan(['legal'])).toEqual(['OP01-001', 'ST01-012', 'OP02-008', 'OP01-029'])
  })

  it('si combina con gli altri filtri', () => {
    expect(
      filterCatalog(
        CARDS,
        { ...EMPTY_FILTERS, ban: ['legal'], colors: ['Green'] },
        null,
        banList,
      ).map((e) => e.card.cardCode),
    ).toEqual(['OP02-008'])
  })

  it('senza Ban List nessuna carta è bandita; valori sconosciuti si ignorano', () => {
    const all = filterCatalog(CARDS, EMPTY_FILTERS).map((e) => e.card.cardCode)
    expect(filterCatalog(CARDS, { ...EMPTY_FILTERS, ban: ['banned'] })).toEqual([])
    expect(
      filterCatalog(CARDS, { ...EMPTY_FILTERS, ban: ['legal'] }).map((e) => e.card.cardCode),
    ).toEqual(all)
    expect(withBan(['boh'])).toEqual(all)
  })

  it('sta nell’URL', () => {
    const f = { ...EMPTY_FILTERS, ban: ['banned', 'pair'] }
    expect(filtersToSearchParams(f).toString()).toBe('ban=banned&ban=pair')
    expect(filtersFromSearchParams(filtersToSearchParams(f))).toEqual(f)
    expect(countActiveFilters(f)).toBe(1)
  })
})

describe('filtri nell’URL', () => {
  it('andata e ritorno ripristinano esattamente la stessa ricerca', () => {
    const filters: CatalogFilters = {
      ...EMPTY_FILTERS,
      q: 'straw hat',
      colors: ['Red', 'Green'],
      keywords: ['Rush', 'On Play'],
      effects: ['trash'],
      types: ['Straw Hat Crew'],
      sets: ['OP-01'],
      cost: [3, 5],
      power: [null, 6000],
      counter: [0, 0],
      trigger: false,
      allPrintings: true,
    }
    const url = filtersToSearchParams(filters).toString()
    expect(filtersFromSearchParams(new URLSearchParams(url))).toEqual(filters)
  })

  it('i filtri vuoti non sporcano l’URL', () => {
    expect(filtersToSearchParams(EMPTY_FILTERS).toString()).toBe('')
  })

  it('valori malformati vengono ignorati', () => {
    const f = filtersFromSearchParams(new URLSearchParams('costo=abc&trigger=forse&colore='))
    expect(f).toEqual(EMPTY_FILTERS)
  })
})

describe('supporto all’interfaccia', () => {
  it('conta i filtri attivi, testo escluso', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        q: 'x',
        colors: ['Red'],
        cost: [1, null],
        trigger: true,
      }),
    ).toBe(3)
  })

  it('ricava i valori disponibili: i più frequenti prima, a pari merito in ordine alfabetico', () => {
    const facets = catalogFacets(CARDS)
    // L e R compaiono due volte (due Printing ciascuna), C, SR e UC una volta.
    expect(facets.rarities).toEqual(['L', 'R', 'C', 'SR', 'UC'])
    expect(facets.keywords).toHaveLength(10)
    expect(facets.types).toEqual(['Straw Hat Crew', 'Supernovas', 'Whitebeard Pirates'])
    expect(facets.blocks).toEqual(['1', '2'])
  })
})

describe('filtro possedute', () => {
  const nami = card({
    cardCode: 'OP01-016',
    name: 'Nami',
    printings: [
      { printId: 'OP01-016', rarity: 'R', setCode: 'OP-01', hasImage: true },
      { printId: 'OP01-016_r1', rarity: 'R', setCode: 'PRB-01', hasImage: true },
    ],
  })
  const zoro = card({ cardCode: 'OP01-025', name: 'Zoro' })
  const cards = [nami, zoro]
  const owned = new Set(['OP01-016'])
  const names = (f: Partial<CatalogFilters>, ownership: Set<string> | null = owned) =>
    filterCatalog(cards, { ...EMPTY_FILTERS, ...f }, ownership).map(
      (e) => `${e.card.name} ${e.printing.printId}`,
    )

  it('solo possedute o solo non possedute, per Card', () => {
    expect(names({ owned: true })).toEqual(['Nami OP01-016'])
    expect(names({ owned: false })).toEqual(['Zoro OP01-025'])
    expect(names({ owned: null })).toHaveLength(2)
  })

  it('con un filtro Set conta solo la Printing di quel Set', () => {
    expect(names({ owned: true, sets: ['PRB-01'] })).toEqual([])
    expect(names({ owned: false, sets: ['PRB-01'] })).toEqual(['Nami OP01-016_r1'])
  })

  it('con tutte le Printing guarda ogni singola Printing', () => {
    expect(names({ owned: false, allPrintings: true })).toEqual([
      'Nami OP01-016_r1',
      'Zoro OP01-025',
    ])
  })

  it('senza accesso il filtro si ignora; si combina con gli altri e va nell’URL', () => {
    expect(names({ owned: true }, null)).toHaveLength(2)
    expect(names({ owned: false, q: 'nami' })).toEqual([])
    const f = { ...EMPTY_FILTERS, owned: false }
    expect(filtersToSearchParams(f).toString()).toBe('possedute=no')
    expect(filtersFromSearchParams(new URLSearchParams('possedute=si')).owned).toBe(true)
    expect(countActiveFilters(f)).toBe(1)
  })
})

describe('carte correlate', () => {
  const aokiji = card({
    cardCode: 'OP02-049',
    name: 'Kuzan',
    category: 'Leader',
    colors: ['Blue'],
    types: ['Navy'],
    effect: '[Activate: Main] You may trash 1 card from your hand: Draw 1 card.',
  })

  it('da un Leader: stessi colori, tipi ed effetti, solo carte da mettere nel Deck', () => {
    expect(relatedFilters(aokiji)).toEqual({
      ...EMPTY_FILTERS,
      colors: ['Blue'],
      types: ['Navy'],
      effects: ['draw', 'trash'],
      categories: ['Character', 'Event', 'Stage'],
    })
  })

  it('da un’altra carta: senza limiti di categoria; niente effetti se il testo non ne ha', () => {
    const plain = card({ cardCode: 'OP01-010', name: 'Vanilla', colors: ['Red', 'Green'] })
    expect(relatedFilters(plain)).toEqual({ ...EMPTY_FILTERS, colors: ['Red', 'Green'] })
  })

  it('i filtri correlati trovano le carte simili e finiscono nell’URL', () => {
    const cards = [
      aokiji,
      card({
        cardCode: 'OP02-060',
        name: 'Smoker',
        colors: ['Blue'],
        types: ['Navy'],
        effect: 'Trash 1 card from your hand.',
      }),
      card({ cardCode: 'OP02-061', name: 'Rosso', colors: ['Red'], types: ['Navy'] }),
      card({ cardCode: 'OP02-062', name: 'Pirata', colors: ['Blue'], types: ['Pirates'] }),
    ]
    const found = filterCatalog(cards, relatedFilters(aokiji)).map((e) => e.card.name)
    expect(found).toEqual(['Smoker'])
    expect(filtersToSearchParams(relatedFilters(aokiji)).toString()).toBe(
      'colore=Blue&categoria=Character&categoria=Event&categoria=Stage&tipo=Navy&effetto=draw&effetto=trash',
    )
  })
})
