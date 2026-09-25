import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import { EMPTY_FILTERS } from '@/catalog/filters'
import {
  deckCandidates,
  deckCount,
  deckRows,
  leaderCandidates,
  quantityInDeck,
  shownPrinting,
  withCardQuantity,
  withPrint,
  type DeckCard,
} from './deck'

const card = (
  cardCode: string,
  name: string,
  category: string,
  cost: number | null,
  extra: string[] = [],
  colors = ['Blue'],
): CatalogCard => ({
  cardCode,
  name,
  category,
  cost,
  life: null,
  power: null,
  counter: null,
  colors,
  attributes: [],
  types: [],
  block: '1',
  effect: null,
  trigger: null,
  keywords: [],
  printings: [cardCode, ...extra].map((printId) => ({
    printId,
    rarity: 'C',
    setCode: 'OP-01',
    hasImage: true,
  })),
})

const CATALOG = [
  card('OP02-049', 'Aokiji', 'Leader', null),
  card('OP01-001', 'Zoro', 'Leader', null, [], ['Red']),
  card('OP02-050', 'Borsalino', 'Character', 5, ['OP02-050_p1']),
  card('OP02-051', 'Smoker', 'Character', 2),
  card('OP02-060', 'Ice Age', 'Event', 1),
  card('OP02-070', 'Marineford', 'Stage', 1),
  card('DON-001', 'DON!!', 'DON!!', null),
]

describe('Deck', () => {
  it('conta le carte per Card Code e toglie quelle a 0', () => {
    let cards: DeckCard[] = []
    cards = withCardQuantity(cards, 'OP02-051', 4)
    cards = withCardQuantity(cards, 'OP02-050', 2)
    expect(deckCount(cards)).toBe(6)
    cards = withCardQuantity(cards, 'OP02-051', 0)
    expect(cards).toEqual([{ cardCode: 'OP02-050', quantity: 2, printId: null }])
    expect(quantityInDeck(cards, 'OP02-051')).toBe(0)
  })

  it('cambiare la Printing mostrata non cambia il conteggio', () => {
    let cards = withCardQuantity([], 'OP02-050', 3)
    cards = withPrint(cards, 'OP02-050', 'OP02-050_p1')
    cards = withCardQuantity(cards, 'OP02-050', 4)
    expect(cards).toEqual([{ cardCode: 'OP02-050', quantity: 4, printId: 'OP02-050_p1' }])
    expect(deckCount(cards)).toBe(4)
  })

  it('mostra la Printing scelta, o la base se non esiste più', () => {
    const borsalino = CATALOG[2]
    if (!borsalino) throw new Error('carta mancante')
    expect(shownPrinting(borsalino, 'OP02-050_p1')?.printId).toBe('OP02-050_p1')
    expect(shownPrinting(borsalino, null)?.printId).toBe('OP02-050')
    expect(shownPrinting(borsalino, 'OP02-050_p9')?.printId).toBe('OP02-050')
  })

  it('ordina le carte per categoria, costo e codice', () => {
    const cards: DeckCard[] = [
      { cardCode: 'OP02-070', quantity: 1, printId: null },
      { cardCode: 'OP02-060', quantity: 2, printId: null },
      { cardCode: 'OP02-050', quantity: 4, printId: 'OP02-050_p1' },
      { cardCode: 'OP02-051', quantity: 4, printId: null },
      { cardCode: 'ZZ99-999', quantity: 1, printId: null },
    ]
    expect(deckRows(cards, CATALOG).map((r) => [r.card.cardCode, r.printing?.printId])).toEqual([
      ['OP02-051', 'OP02-051'],
      ['OP02-050', 'OP02-050_p1'],
      ['OP02-060', 'OP02-060'],
      ['OP02-070', 'OP02-070'],
    ])
  })

  it('si aggiungono al Deck solo carte che non sono Leader né DON!!', () => {
    const codes = deckCandidates(CATALOG, EMPTY_FILTERS).map((e) => e.card.cardCode)
    expect(codes).toEqual(['OP02-050', 'OP02-051', 'OP02-060', 'OP02-070'])
    expect(
      deckCandidates(CATALOG, { ...EMPTY_FILTERS, q: 'smok' }).map((e) => e.card.cardCode),
    ).toEqual(['OP02-051'])
  })

  it('il Leader si sceglie tra i Leader, con ricerca e colori', () => {
    // Nell'ordine del catalogo, come i risultati della ricerca.
    expect(leaderCandidates(CATALOG, { q: '', colors: [] }).map((e) => e.card.name)).toEqual([
      'Aokiji',
      'Zoro',
    ])
    expect(leaderCandidates(CATALOG, { q: '', colors: ['Blue'] }).map((e) => e.card.name)).toEqual([
      'Aokiji',
    ])
  })
})
