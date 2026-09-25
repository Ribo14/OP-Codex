import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import type { CollectionEntry } from '@/collection/collection'
import { parseDeckList } from './deck-list'
import {
  deckOwnership,
  missingCards,
  missingListText,
  missingTotal,
  ownedByCard,
} from './missing-cards'

const own = (printId: string, quantity: number, language: CollectionEntry['language'] = 'EN') => ({
  printId,
  language,
  quantity,
  updatedAt: '',
})

const DECK = [
  { cardCode: 'OP01-016', quantity: 4 },
  { cardCode: 'OP01-006', quantity: 4 },
  { cardCode: 'OP01-025', quantity: 2 },
]

describe('Missing Cards', () => {
  it('somma tutte le Printing (parallel e ristampe) e tutte le lingue della stessa Card', () => {
    const owned = ownedByCard([
      own('OP01-016', 1),
      own('OP01-016', 1, 'JP'),
      own('OP01-016_p1', 1),
      own('OP01-006_r1', 2),
    ])
    expect(owned.get('OP01-016')).toBe(3)
    expect(owned.get('OP01-006')).toBe(2)
  })

  it('richieste, possedute e mancanti per carta; il Leader conta come una copia', () => {
    const rows = deckOwnership('OP01-001', DECK, [
      own('OP01-016', 2),
      own('OP01-016_p1', 1, 'JP'),
      own('OP01-006', 5),
    ])
    expect(rows).toEqual([
      { cardCode: 'OP01-001', required: 1, owned: 0, missing: 1 },
      { cardCode: 'OP01-016', required: 4, owned: 3, missing: 1 },
      { cardCode: 'OP01-006', required: 4, owned: 5, missing: 0 },
      { cardCode: 'OP01-025', required: 2, owned: 0, missing: 2 },
    ])
    expect(missingTotal(rows)).toBe(4)
    expect(missingCards(rows).map((r) => r.cardCode)).toEqual(['OP01-001', 'OP01-016', 'OP01-025'])
  })

  it('Deck completo → nessuna mancante; Collection vuota → mancano tutte', () => {
    const full = deckOwnership('OP01-001', DECK, [
      own('OP01-001', 1),
      own('OP01-016', 4),
      own('OP01-006', 4),
      own('OP01-025', 2),
    ])
    expect(missingTotal(full)).toBe(0)
    const empty = deckOwnership('OP01-001', DECK, [])
    expect(missingTotal(empty)).toBe(11)
  })

  it('la lista delle mancanti è importabile', () => {
    const card = (code: string, category: string): CatalogCard => ({
      cardCode: code,
      name: code,
      category,
      cost: 1,
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
      printings: [{ printId: code, rarity: 'C', setCode: 'OP-01', hasImage: true }],
    })
    const catalog = new Map(
      [
        card('OP01-001', 'Leader'),
        card('OP01-016', 'Character'),
        card('OP01-025', 'Character'),
      ].map((c) => [c.cardCode, c]),
    )
    const rows = deckOwnership('OP01-001', DECK, [own('OP01-016', 3), own('OP01-006', 4)])
    const text = missingListText('OP01-001', rows, catalog)
    expect(text).toBe('1xOP01-001\n1xOP01-016\n2xOP01-025')
    expect(parseDeckList(text, catalog).errors).toEqual([])
    // Con il Leader posseduto, il Leader non compare.
    const withLeader = deckOwnership('OP01-001', DECK, [own('OP01-001', 1), own('OP01-006', 4)])
    expect(missingListText('OP01-001', withLeader, catalog)).toBe('4xOP01-016\n2xOP01-025')
  })
})
