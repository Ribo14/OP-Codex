import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import type { DeckCard } from './deck'
import {
  checkDeck,
  deckStats,
  EMPTY_BAN_LIST,
  flaggedCards,
  isStandardLegal,
  minimumStandardBlock,
  type BanList,
  type DeckFormat,
  type WarningCode,
} from './deck-rules'

const card = (cardCode: string, partial: Partial<CatalogCard> = {}): CatalogCard => ({
  cardCode,
  name: cardCode,
  category: 'Character',
  cost: 2,
  life: null,
  power: 3000,
  counter: 1000,
  colors: ['Blue'],
  attributes: [],
  types: ['Navy'],
  block: '3',
  effect: null,
  trigger: null,
  keywords: [],
  printings: [{ printId: cardCode, rarity: 'C', setCode: 'OP-09', hasImage: true }],
  ...partial,
})

const CARDS = [
  card('L-BLUE', { category: 'Leader', colors: ['Blue'], cost: null, counter: null }),
  card('L-BICOLOR', { category: 'Leader', colors: ['Blue', 'Red'], cost: null, counter: null }),
  card('L-MAXCOST', {
    category: 'Leader',
    colors: ['Blue'],
    effect:
      'Under the rules of this game, you cannot include cards with a cost of 5 or more in your deck.',
  }),
  card('L-EVENTS', {
    category: 'Leader',
    colors: ['Blue'],
    effect:
      'Under the rules of this game, you cannot include Events with a cost of 2 or more in your deck.',
  }),
  card('L-TYPE', {
    category: 'Leader',
    colors: ['Blue'],
    effect:
      'Under the rules of this game, you can only include {East Blue} type cards in your deck.',
  }),
  card('L-OLD', { category: 'Leader', colors: ['Blue'], block: '1' }),
  ...Array.from({ length: 13 }, (_, i) => card(`B-${String(i).padStart(2, '0')}`)),
  card('RED', { colors: ['Red'] }),
  card('BLUE-RED', { colors: ['Blue', 'Red'] }),
  card('OLD', { block: '1' }),
  card('X-BLOCK', { block: 'X' }),
  card('ANY', {
    effect: 'Under the rules of this game, you may have any number of this card in your deck.',
  }),
  card('EVENT-3', { category: 'Event', cost: 3 }),
  card('EVENT-1', { category: 'Event', cost: 1, trigger: '[Trigger] Draw 1 card.' }),
  card('BIG', { cost: 7, counter: null }),
  card('EAST', { types: ['East Blue'] }),
  card('DON', { category: 'DON!!', cost: null }),
]
const CATALOG = new Map(CARDS.map((c) => [c.cardCode, c]))

/** 48 carte blu legali (12 × 4) più quelle indicate. */
function deck(extra: DeckCard[] = [], base = 12): DeckCard[] {
  return [
    ...Array.from({ length: base }, (_, i) => ({
      cardCode: `B-${String(i).padStart(2, '0')}`,
      quantity: 4,
      printId: null,
    })),
    ...extra,
  ]
}
const c = (cardCode: string, quantity = 1): DeckCard => ({ cardCode, quantity, printId: null })

const TODAY = new Date(2026, 8, 25)
function codes(
  leaderCode: string | null,
  cards: DeckCard[],
  format: DeckFormat = 'standard',
  banList: BanList = EMPTY_BAN_LIST,
): WarningCode[] {
  return checkDeck({ leaderCode, cards }, CATALOG, { format, banList, today: TODAY }).map(
    (w) => w.code,
  )
}
const warningFor = (leaderCode: string, cards: DeckCard[], code: WarningCode) =>
  checkDeck({ leaderCode, cards }, CATALOG, {
    format: 'standard',
    banList: EMPTY_BAN_LIST,
    today: TODAY,
  }).find((w) => w.code === code)

describe('Deck Rules', () => {
  it('un Deck legale non ha avvisi', () => {
    expect(codes('L-BLUE', deck([c('B-12', 2)]))).toEqual([])
  })

  it('Leader mancante o non Leader', () => {
    expect(codes(null, deck([c('B-12', 2)]))).toEqual(['noLeader'])
    expect(codes('B-00', deck([c('B-12', 2)]))).toContain('noLeader')
  })

  it('esattamente 50 carte: 49 e 51 danno avviso', () => {
    expect(warningFor('L-BLUE', deck([c('B-12', 1)]), 'size')?.params).toEqual({
      count: 49,
      size: 50,
    })
    expect(warningFor('L-BLUE', deck([c('B-12', 3)]), 'size')?.params).toEqual({
      count: 51,
      size: 50,
    })
    expect(codes('L-BLUE', [])).toEqual(['size'])
  })

  it('al massimo 4 copie; le carte "in qualsiasi numero" sono esenti', () => {
    expect(warningFor('L-BLUE', deck([c('B-12', 1), c('B-00', 1)], 12), 'copies')).toBeUndefined()
    const five = deck([c('B-12', 2)]).map((d) =>
      d.cardCode === 'B-00' ? { ...d, quantity: 5 } : d,
    )
    expect(warningFor('L-BLUE', five, 'copies')?.cards).toEqual(['B-00'])
    expect(codes('L-BLUE', deck([c('ANY', 2)]))).toEqual([])
    expect(codes('L-BLUE', [...deck([], 10), c('ANY', 10)])).toEqual([])
  })

  it('solo i colori del Leader; un Leader bicolore accetta entrambi', () => {
    expect(warningFor('L-BLUE', deck([c('RED', 2)]), 'color')?.cards).toEqual(['RED'])
    expect(codes('L-BLUE', deck([c('BLUE-RED', 2)]))).toEqual([])
    expect(codes('L-BICOLOR', deck([c('RED', 1), c('BLUE-RED', 1)]))).toEqual([])
  })

  it('niente Leader né DON!! nel mazzo', () => {
    expect(
      warningFor('L-BLUE', deck([c('L-BICOLOR', 1), c('DON', 1)]), 'notDeckCard')?.cards,
    ).toEqual(['L-BICOLOR', 'DON'])
  })

  it('Standard: Block non più legale, Leader compreso; "X" sempre; Extra senza limiti', () => {
    expect(warningFor('L-BLUE', deck([c('OLD', 1), c('X-BLOCK', 1)]), 'block')).toEqual({
      code: 'block',
      cards: ['OLD'],
      params: { block: 2 },
    })
    expect(warningFor('L-OLD', deck([c('B-12', 2)]), 'block')?.cards).toEqual(['L-OLD'])
    expect(codes('L-OLD', deck([c('OLD', 2)]), 'extra')).toEqual([])
  })

  it('il Block minimo cambia ogni 1° aprile', () => {
    expect(minimumStandardBlock(new Date(2026, 2, 31))).toBe(1)
    expect(minimumStandardBlock(new Date(2026, 3, 1))).toBe(2)
    expect(minimumStandardBlock(new Date(2027, 3, 1))).toBe(3)
    expect(isStandardLegal('1', new Date(2026, 2, 31))).toBe(true)
    expect(isStandardLegal('1', TODAY)).toBe(false)
    expect(isStandardLegal('X', TODAY)).toBe(true)
    expect(isStandardLegal(null, TODAY)).toBe(true)
  })

  it('restrizioni scritte sul Leader', () => {
    expect(warningFor('L-MAXCOST', deck([c('BIG', 2)]), 'leaderMaxCost')).toEqual({
      code: 'leaderMaxCost',
      cards: ['BIG'],
      params: { cost: 5 },
    })
    expect(
      warningFor('L-EVENTS', deck([c('EVENT-3', 1), c('EVENT-1', 1)]), 'leaderMaxEventCost')?.cards,
    ).toEqual(['EVENT-3'])
    const onlyType = warningFor('L-TYPE', deck([c('EAST', 2)]), 'leaderOnlyType')
    expect(onlyType?.params).toEqual({ type: 'East Blue' })
    expect(onlyType?.cards).not.toContain('EAST')
    expect(onlyType?.cards).toHaveLength(12)
  })

  it('Ban List: bandite (anche il Leader), limitate e coppie', () => {
    const banList: BanList = {
      banned: new Set(['B-00', 'L-BLUE']),
      restricted: new Map([['B-01', 1]]),
      pairs: [
        ['B-02', 'B-03'],
        ['B-04', 'RED'],
      ],
    }
    const warnings = checkDeck({ leaderCode: 'L-BLUE', cards: deck([c('B-12', 2)]) }, CATALOG, {
      format: 'standard',
      banList,
      today: TODAY,
    })
    expect(warnings.map((w) => [w.code, w.cards])).toEqual([
      ['banned', ['B-00', 'L-BLUE']],
      ['restricted', ['B-01']],
      ['bannedPair', ['B-02', 'B-03']],
    ])
    expect(flaggedCards(warnings)).toEqual(new Set(['B-00', 'L-BLUE', 'B-01', 'B-02', 'B-03']))
  })

  it('le carte sconosciute al catalogo si ignorano nei controlli, ma contano nel totale', () => {
    expect(codes('L-BLUE', deck([c('ZZ-UNKNOWN', 2)]))).toEqual([])
  })
})

describe('statistiche del Deck', () => {
  it('curva dei costi, categorie, colori, counter e Trigger', () => {
    const stats = deckStats(
      [c('B-00', 4), c('EVENT-1', 2), c('EVENT-3', 1), c('BIG', 1), c('BLUE-RED', 3), c('ZZ', 9)],
      CATALOG,
    )
    const curve = Array.from({ length: 11 }, () => 0)
    curve[2] = 7
    curve[1] = 2
    curve[3] = 1
    curve[7] = 1
    expect(stats.costCurve).toEqual(curve)
    expect(stats.categories).toEqual({ Character: 8, Event: 3 })
    expect(stats.colors).toEqual({ Blue: 11, Red: 3 })
    expect(stats.counters).toEqual({ '1000': 10, '0': 1 })
    expect(stats.triggers).toBe(2)
  })

  it('i costi da 10 in su finiscono nell’ultima colonna', () => {
    const catalog = new Map([['HUGE', card('HUGE', { cost: 12 })]])
    expect(deckStats([c('HUGE', 2)], catalog).costCurve[10]).toBe(2)
  })
})
