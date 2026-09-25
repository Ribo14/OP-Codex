import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import { formatDeckList, parseDeckList } from './deck-list'

const card = (cardCode: string, category: string, cost: number | null): CatalogCard => ({
  cardCode,
  name: cardCode,
  category,
  cost,
  life: null,
  power: null,
  counter: null,
  colors: ['Blue'],
  attributes: [],
  types: [],
  block: '2',
  effect: null,
  trigger: null,
  keywords: [],
  printings: [{ printId: cardCode, rarity: 'C', setCode: 'OP-02', hasImage: true }],
})

const CATALOG = new Map(
  [
    card('OP02-049', 'Leader', null),
    card('OP01-001', 'Leader', null),
    card('OP02-050', 'Character', 5),
    card('OP02-051', 'Character', 2),
    card('OP02-060', 'Event', 1),
    card('ST01-006', 'Character', 2),
    card('DON-001', 'DON!!', null),
  ].map((c) => [c.cardCode, c]),
)

describe('Deck List Codec', () => {
  it('legge il formato standard: Leader per primo, poi le carte', () => {
    expect(parseDeckList('1xOP02-049\n4xOP02-051\n2xOP02-050', CATALOG)).toEqual({
      leaderCode: 'OP02-049',
      cards: [
        { cardCode: 'OP02-051', quantity: 4 },
        { cardCode: 'OP02-050', quantity: 2 },
      ],
      errors: [],
    })
  })

  it('tollera spazi, righe vuote, minuscole, commenti e le varianti comuni', () => {
    const text = [
      '  # Il mio mazzo',
      'op02-049',
      '',
      '4 x OP02-051',
      'OP02-050 x2',
      '3 OP02-060',
      '1×ST01-006 Nami',
      '1xOP02-050_p1',
      '// fine',
    ].join('\r\n')
    expect(parseDeckList(text, CATALOG)).toEqual({
      leaderCode: 'OP02-049',
      cards: [
        { cardCode: 'OP02-051', quantity: 4 },
        { cardCode: 'OP02-050', quantity: 3 },
        { cardCode: 'OP02-060', quantity: 3 },
        { cardCode: 'ST01-006', quantity: 1 },
      ],
      errors: [],
    })
  })

  it('le righe sbagliate diventano errori con il numero di riga, senza scartare le altre', () => {
    const text =
      '1xOP02-049\n4xOP02-051\nquattro Nami\n0xOP02-050\n2xZZ99-001\n1xOP01-001\n1xDON-001'
    const parsed = parseDeckList(text, CATALOG)
    expect(parsed.leaderCode).toBe('OP02-049')
    expect(parsed.cards).toEqual([{ cardCode: 'OP02-051', quantity: 4 }])
    expect(parsed.errors).toEqual([
      { line: 3, text: 'quattro Nami', problem: 'format' },
      { line: 4, text: '0xOP02-050', problem: 'format' },
      { line: 5, text: '2xZZ99-001', problem: 'unknown' },
      { line: 6, text: '1xOP01-001', problem: 'extraLeader' },
      { line: 7, text: '1xDON-001', problem: 'notDeckCard' },
    ])
  })

  it('senza Leader nella lista, il Leader resta vuoto', () => {
    expect(parseDeckList('4xOP02-051', CATALOG).leaderCode).toBeNull()
  })

  it('scrive: Leader per primo, poi per costo e codice', () => {
    expect(
      formatDeckList(
        'OP02-049',
        [
          { cardCode: 'OP02-050', quantity: 2 },
          { cardCode: 'ST01-006', quantity: 4 },
          { cardCode: 'OP02-060', quantity: 3 },
          { cardCode: 'OP02-051', quantity: 4 },
        ],
        CATALOG,
      ),
    ).toBe('1xOP02-049\n3xOP02-060\n4xOP02-051\n4xST01-006\n2xOP02-050')
  })

  it('legge una lista reale esportata da OPTCG Sim ("quantità codice nome", senza la x)', () => {
    // Esportata da OPTCG Sim il 2026-09-25 (Leader Rocks.D.Xebec).
    const sim = [
      '1 OP17-039 Rocks.D.Xebec',
      '2 OP08-051 Buckin',
      '3 OP17-050 Streusen',
      '4 OP17-045 Kyo',
      '4 OP17-054 Miss Buckingham Stussy',
      '4 OP17-046 Gloriosa',
      '3 OP17-044 Captain John',
      '4 OP17-041 Wang Zhi',
      '4 OP17-049 Charlotte Linlin',
      '4 OP17-040 Edward.Newgate',
      '4 OP17-048 Shiki',
      '4 OP17-118 Rocks.D.Xebec',
      '4 OP17-056 Rocks Pirates',
      "4 OP17-055 There's No Authority in the World That Lasts Forever!!!",
      "2 EB02-030 And That's When Somebody Makes Fun of Their Friend's Dream!!!!",
    ].join('\n')
    const events = new Set(['OP17-056', 'OP17-055', 'EB02-030'])
    const codes = [...sim.matchAll(/ ([A-Z0-9]+-\d+) /g)].map((m) => m[1] ?? '')
    const catalog = new Map(
      codes.map((code) => [
        code,
        card(
          code,
          code === 'OP17-039' ? 'Leader' : events.has(code) ? 'Event' : 'Character',
          code === 'OP17-039' ? null : 1,
        ),
      ]),
    )
    const parsed = parseDeckList(sim, catalog)
    expect(parsed.leaderCode).toBe('OP17-039')
    expect(parsed.errors).toEqual([])
    expect(parsed.cards).toHaveLength(14)
    expect(parsed.cards.reduce((n, c) => n + c.quantity, 0)).toBe(50)
    expect(parsed.cards).toContainEqual({ cardCode: 'EB02-030', quantity: 2 })
  })

  it('andata e ritorno senza perdite', () => {
    const text = '1xOP02-049\n3xOP02-060\n4xOP02-051\n4xST01-006\n2xOP02-050'
    const parsed = parseDeckList(text, CATALOG)
    expect(formatDeckList(parsed.leaderCode, parsed.cards, CATALOG)).toBe(text)
  })
})
