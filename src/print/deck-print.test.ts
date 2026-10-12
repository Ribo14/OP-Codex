import { describe, expect, it } from 'vitest'
import type { CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import { deckOwnership } from '@/decks/missing-cards'
import { deckPrintRows, printItems } from './deck-print'

const printing = (printId: string, hasImage = true): CatalogPrinting => ({
  printId,
  rarity: 'R',
  setCode: 'OP-01',
  hasImage,
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

const CATALOG = new Map(
  [
    card('OP01-001', [printing('OP01-001'), printing('OP01-001_p1')]),
    card('OP01-016', [printing('OP01-016'), printing('OP01-016_p9')]),
    card('OP01-006', [printing('OP01-006', false), printing('OP01-006_r1')]),
    card('OP01-025', [printing('OP01-025', false)]),
  ].map((c) => [c.cardCode, c]),
)

const own = (printId: string, quantity: number) => ({
  printId,
  language: 'EN' as const,
  quantity,
  updatedAt: '',
})

describe('stampa dal mazzo (RIB-80)', () => {
  const deck = { leaderCode: 'OP01-001', leaderPrintId: 'OP01-001_p1' }
  const cards = [
    { cardCode: 'OP01-016', quantity: 4, printId: 'OP01-016_p9' },
    { cardCode: 'OP01-006', quantity: 4, printId: null },
    { cardCode: 'OP01-025', quantity: 2, printId: null },
  ]
  const ownership = deckOwnership(deck.leaderCode, cards, [own('OP01-001', 1), own('OP01-016', 1)])
  const rows = deckPrintRows(deck, cards, ownership, CATALOG)

  it('parte dalle copie mancanti, con la Printing scelta nel mazzo', () => {
    expect(rows.map((r) => [r.card.cardCode, r.printId, r.copies, r.required, r.missing])).toEqual([
      // Il Leader c'è già: niente copie, ma resta in lista per poterlo aggiungere.
      ['OP01-001', 'OP01-001_p1', 0, 1, 0],
      ['OP01-016', 'OP01-016_p9', 3, 4, 3],
      // Senza immagine della base: la prima Printing che ce l'ha.
      ['OP01-006', 'OP01-006_r1', 4, 4, 4],
      // Nessuna immagine: non si può stampare.
      ['OP01-025', null, 0, 2, 2],
    ])
  })

  it('nel PDF solo le righe con copie e immagine', () => {
    expect(printItems(rows)).toEqual([
      { printId: 'OP01-016_p9', copies: 3 },
      { printId: 'OP01-006_r1', copies: 4 },
    ])
  })
})
