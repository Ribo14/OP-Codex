import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import type { CollectionEntry } from '@/collection/collection'
import { parseDeckList } from './deck-list'
import {
  cardmarketWantsText,
  cardtraderWishlistText,
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

describe('liste per i Marketplace', () => {
  const card = (cardCode: string, name: string, expansion: string | null): CatalogCard => ({
    cardCode,
    name,
    category: 'Character',
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
    printings: [
      {
        printId: cardCode,
        rarity: 'C',
        setCode: 'OP-01',
        hasImage: true,
        cardtrader: expansion ? { low: 1, blueprintId: 1, expansion } : null,
      },
    ],
  })
  const catalog = new Map(
    [
      card('OP01-001', 'Roronoa Zoro', 'op01'),
      card('OP01-016', 'Nami', 'op01'),
      card('OP14-020', 'Dracule Mihawk', 'op-14'),
      card('P-034', 'Sanji', null),
      card('EB01-006', 'Tony Tony.Chopper', null),
    ].map((c) => [c.cardCode, c]),
  )
  const rows = deckOwnership(
    'OP01-001',
    [
      { cardCode: 'OP01-016', quantity: 4 },
      { cardCode: 'OP14-020', quantity: 2 },
      { cardCode: 'P-034', quantity: 1 },
      { cardCode: 'EB01-006', quantity: 3 },
    ],
    [own('OP01-016', 1)],
  )

  it('Cardmarket (Wants): "3x Nome CODICE", Leader per primo', () => {
    expect(cardmarketWantsText('OP01-001', rows, catalog)).toBe(
      [
        '1x Roronoa Zoro OP01-001',
        '3x Nami OP01-016',
        '2x Dracule Mihawk OP14-020',
        '1x Sanji P-034',
        '3x Tony Tony.Chopper EB01-006',
      ].join('\n'),
    )
  })

  it('CardTrader (wishlist, formato MTGA): "3 Nome (espansione) numero"', () => {
    expect(cardtraderWishlistText('OP01-001', rows, catalog)).toBe(
      [
        '1 Roronoa Zoro (op01) 001',
        '3 Nami (op01) 016',
        // Codice di CardTrader "op-14" senza trattino: con il trattino la riga viene scartata.
        '2 Dracule Mihawk (op14) 020',
        // Senza dati CardTrader: promo per le P, prefisso in minuscolo per le altre.
        '1 Sanji (promo) 034',
        '3 Tony Tony.Chopper (eb01) 006',
      ].join('\n'),
    )
  })
})
