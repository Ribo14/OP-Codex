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

  it('andata e ritorno senza perdite', () => {
    const text = '1xOP02-049\n3xOP02-060\n4xOP02-051\n4xST01-006\n2xOP02-050'
    const parsed = parseDeckList(text, CATALOG)
    expect(formatDeckList(parsed.leaderCode, parsed.cards, CATALOG)).toBe(text)
  })
})
