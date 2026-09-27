import { describe, expect, it } from 'vitest'
import type { CollectionEntry } from '@/collection/collection'
import type { CatalogCard, CatalogPrinting } from './catalog-data'
import { collectionValue, deckValue } from './price-value'

// Valore stimato di Collection e Deck (RIB-32, slice 5.4): prezzo di tendenza Cardmarket delle
// stampe inglesi, per il numero di copie.

const printing = (printId: string, trend: number | null): CatalogPrinting => ({
  printId,
  rarity: 'C',
  setCode: 'OP-01',
  hasImage: false,
  price: trend === null ? null : { trend, low: null, date: '2026-09-27' },
})

const card = (cardCode: string, printings: CatalogPrinting[]): CatalogCard => ({
  cardCode,
  name: cardCode,
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
  printings,
})

const cards = [
  card('OP01-001', [printing('OP01-001', 2.16), printing('OP01-001_p1', 574.14)]),
  card('OP01-004', [printing('OP01-004', 0.15)]),
  card('OP01-016', [printing('OP01-016', null)]),
]

const entry = (printId: string, language: CollectionEntry['language'], quantity: number) => ({
  printId,
  language,
  quantity,
  updatedAt: '2026-09-27T10:00:00Z',
})

describe('collectionValue', () => {
  it('somma tendenza × copie delle stampe inglesi, al centesimo', () => {
    const value = collectionValue(
      [entry('OP01-001', 'EN', 2), entry('OP01-001_p1', 'EN', 1), entry('OP01-004', 'EN', 4)],
      cards,
    )
    expect(value).toEqual({ total: 579.06, priced: 7, unpriced: 0, otherLanguages: 0 })
  })

  it('conta a parte le copie senza prezzo e quelle in altre lingue', () => {
    const value = collectionValue(
      [entry('OP01-004', 'EN', 1), entry('OP01-016', 'EN', 3), entry('OP01-001', 'JP', 2)],
      cards,
    )
    expect(value).toEqual({ total: 0.15, priced: 1, unpriced: 3, otherLanguages: 2 })
  })

  it('una Printing sparita dal catalogo vale "senza prezzo"', () => {
    expect(collectionValue([entry('ZZ99-001', 'EN', 1)], cards).unpriced).toBe(1)
  })
})

describe('deckValue', () => {
  it('usa la stampa mostrata (la base se non scelta) e conta anche il Leader', () => {
    const value = deckValue(
      { leaderCode: 'OP01-001', leaderPrintId: 'OP01-001_p1' },
      [
        { cardCode: 'OP01-004', quantity: 4, printId: null },
        { cardCode: 'OP01-016', quantity: 2, printId: null },
      ],
      cards,
    )
    expect(value).toEqual({ total: 574.74, priced: 5, unpriced: 2 })
  })
})
