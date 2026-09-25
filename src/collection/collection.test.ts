import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import {
  cardCodeOf,
  copiesOf,
  ownedItems,
  searchOwned,
  totals,
  withQuantity,
  type CollectionEntry,
} from './collection'

const entry = (
  printId: string,
  language: CollectionEntry['language'],
  quantity: number,
  updatedAt = '2026-09-25T10:00:00Z',
): CollectionEntry => ({ printId, language, quantity, updatedAt })

const card = (cardCode: string, name: string, printIds: string[]): CatalogCard => ({
  cardCode,
  name,
  category: 'Character',
  cost: 1,
  life: null,
  power: 1000,
  counter: null,
  colors: ['Red'],
  attributes: [],
  types: [],
  block: '1',
  effect: null,
  trigger: null,
  keywords: [],
  printings: printIds.map((printId) => ({
    printId,
    rarity: 'C',
    setCode: 'OP-01',
    hasImage: true,
  })),
})

const CARDS = [
  card('OP01-016', 'Nami', ['OP01-016', 'OP01-016_p1']),
  card('OP01-001', 'Roronoa Zoro', ['OP01-001']),
  card('OP01-120', 'Shanks', ['OP01-120']),
]

describe('Collection', () => {
  it('fissa le copie di una Printing e lingua; a 0 la Entry sparisce', () => {
    const now = '2026-09-25T12:00:00Z'
    let entries = withQuantity([], 'OP01-016', 'EN', 1, now)
    expect(entries).toEqual([entry('OP01-016', 'EN', 1, now)])
    entries = withQuantity(entries, 'OP01-016', 'JP', 2, now)
    entries = withQuantity(entries, 'OP01-016', 'EN', 3, now)
    expect(copiesOf(entries, 'OP01-016')).toEqual({
      total: 5,
      byLanguage: [
        ['EN', 3],
        ['JP', 2],
      ],
    })
    entries = withQuantity(entries, 'OP01-016', 'EN', 0, now)
    expect(entries).toEqual([entry('OP01-016', 'JP', 2, now)])
  })

  it('i totali contano tutte le copie e le Card distinte (Printing e lingue insieme)', () => {
    const entries = [
      entry('OP01-016', 'EN', 2),
      entry('OP01-016', 'JP', 1),
      entry('OP01-016_p1', 'EN', 1),
      entry('OP01-001', 'EN', 4),
    ]
    expect(totals(entries)).toEqual({ copies: 8, distinctCards: 2 })
    expect(totals([])).toEqual({ copies: 0, distinctCards: 0 })
    expect(cardCodeOf('OP01-016_p1')).toBe('OP01-016')
    expect(cardCodeOf('OP01-006_r1')).toBe('OP01-006')
  })

  it('abbina le Entry al catalogo, una tessera per Printing', () => {
    const items = ownedItems(
      [
        entry('OP01-016', 'EN', 2, '2026-09-25T10:00:00Z'),
        entry('OP01-016', 'JP', 1, '2026-09-25T11:00:00Z'),
        entry('OP01-016_p1', 'EN', 1),
        entry('ZZ99-001', 'EN', 1),
      ],
      CARDS,
    )
    expect(items.map((i) => [i.printing.printId, i.total, i.updatedAt])).toEqual([
      ['OP01-016', 3, '2026-09-25T11:00:00Z'],
      ['OP01-016_p1', 1, '2026-09-25T10:00:00Z'],
    ])
  })

  it('cerca per nome o codice e ordina', () => {
    const items = ownedItems(
      [
        entry('OP01-120', 'EN', 1, '2026-09-25T09:00:00Z'),
        entry('OP01-016', 'EN', 2, '2026-09-25T11:00:00Z'),
        entry('OP01-001', 'EN', 4, '2026-09-25T10:00:00Z'),
      ],
      CARDS,
    )
    const codes = (list: typeof items) => list.map((i) => i.printing.printId)
    expect(codes(searchOwned(items, '', 'code'))).toEqual(['OP01-001', 'OP01-016', 'OP01-120'])
    expect(codes(searchOwned(items, '', 'recent'))).toEqual(['OP01-016', 'OP01-001', 'OP01-120'])
    expect(codes(searchOwned(items, '', 'quantity'))).toEqual(['OP01-001', 'OP01-016', 'OP01-120'])
    expect(codes(searchOwned(items, 'nam', 'code'))).toEqual(['OP01-016'])
    expect(codes(searchOwned(items, 'op01-12', 'code'))).toEqual(['OP01-120'])
  })
})
