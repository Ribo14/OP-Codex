import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import { approximateStarter, deckCount, fromDeck, fromRecipe } from './table-decks'

// Mazzi per il tavolo (RIB-99).

const card = (cardCode: string, category = 'Character', life: number | null = null) =>
  ({
    cardCode,
    name: cardCode,
    category,
    cost: 1,
    life,
    power: 1000,
    counter: null,
    colors: ['Red'],
    attributes: [],
    types: [],
    block: '1',
    effect: null,
    trigger: null,
    keywords: [],
    printings: [],
  }) satisfies CatalogCard

const catalog = [
  card('ST01-001', 'Leader', 5),
  ...Array.from({ length: 16 }, (_, i) => card(`ST01-${String(i + 2).padStart(3, '0')}`)),
  card('ST02-001', 'Leader', 4),
]
const byCode = new Map(catalog.map((c) => [c.cardCode, c]))

describe('mazzi del tavolo', () => {
  it('un Deck salvato: Leader con le sue Vite, carte sconosciute escluse', () => {
    const deck = fromDeck(
      'd1',
      'Il mio',
      'ST02-001',
      'ST02-001_p1',
      [
        { cardCode: 'ST01-002', quantity: 4, printId: null },
        { cardCode: 'XX99-001', quantity: 4, printId: null },
      ],
      byCode,
    )
    expect(deck?.list.leader).toEqual({ cardCode: 'ST02-001', printId: 'ST02-001_p1', life: 4 })
    expect(deck?.list.cards).toEqual([{ cardCode: 'ST01-002', printId: null, quantity: 4 }])
    expect(deck?.kind).toBe('own')
    expect(fromDeck('d2', 'x', 'XX99-001', null, [], byCode)).toBeNull()
  })

  it('uno Starter dalla composizione: il Leader è la carta Leader della lista', () => {
    const deck = fromRecipe('ST-01', { 'ST01-001': 1, 'ST01-002': 4, 'ST01-003': 2 }, byCode)
    expect(deck?.name).toBe('ST01-001 (ST-01)')
    expect(deck?.list.leader.cardCode).toBe('ST01-001')
    expect(deck && deckCount(deck)).toBe(6)
    expect(fromRecipe('ST-09', { 'ST01-002': 4 }, byCode)).toBeNull()
  })

  it('senza composizione: 4 copie per carta fino a 50', () => {
    const deck = approximateStarter('ST-01', catalog)
    expect(deck && deckCount(deck)).toBe(50)
    expect(deck?.list.cards.every((c) => c.quantity <= 4)).toBe(true)
  })
})
