import type { CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import type { DeckFormat } from './deck-rules'
import {
  EMPTY_FILTERS,
  filterCatalog,
  type CatalogEntry,
  type CatalogFilters,
  type Ownership,
} from '@/catalog/filters'

// Deck (RIB-21): un Leader più 50 carte, contate per Card Code. Per ogni carta si può scegliere
// quale Printing mostrare, senza cambiare il conteggio.

export const DECK_SIZE = 50

export interface DeckSummary {
  id: string
  name: string
  leaderCode: string
  /** null = la Printing base. */
  leaderPrintId: string | null
  updatedAt: string
  cardCount: number
  /** Formato per i Deck Warning (RIB-23). */
  format: DeckFormat
}

export interface DeckCard {
  cardCode: string
  quantity: number
  /** Printing da mostrare; null = la base. */
  printId: string | null
}

export function deckCount(cards: readonly DeckCard[]): number {
  return cards.reduce((sum, c) => sum + c.quantity, 0)
}

export function quantityInDeck(cards: readonly DeckCard[], cardCode: string): number {
  return cards.find((c) => c.cardCode === cardCode)?.quantity ?? 0
}

/** Le carte con `cardCode` fissata a `quantity` (0 = esce dal Deck); la Printing scelta resta. */
export function withCardQuantity(
  cards: readonly DeckCard[],
  cardCode: string,
  quantity: number,
): DeckCard[] {
  const existing = cards.find((c) => c.cardCode === cardCode)
  if (quantity <= 0) return cards.filter((c) => c.cardCode !== cardCode)
  if (existing) return cards.map((c) => (c.cardCode === cardCode ? { ...c, quantity } : c))
  return [...cards, { cardCode, quantity, printId: null }]
}

/** Cambia solo la Printing mostrata: il conteggio per Card Code non cambia. */
export function withPrint(
  cards: readonly DeckCard[],
  cardCode: string,
  printId: string | null,
): DeckCard[] {
  return cards.map((c) => (c.cardCode === cardCode ? { ...c, printId } : c))
}

/** La Printing da mostrare: quella scelta se esiste ancora, altrimenti la base. */
export function shownPrinting(
  card: CatalogCard,
  printId: string | null,
): CatalogPrinting | undefined {
  return card.printings.find((p) => p.printId === printId) ?? card.printings[0]
}

export interface DeckRow {
  card: CatalogCard
  printing: CatalogPrinting | undefined
  quantity: number
  printId: string | null
}

const CATEGORY_ORDER = ['Character', 'Event', 'Stage']

/** Le carte del Deck abbinate al catalogo, per categoria, poi costo e Card Code. */
export function deckRows(cards: readonly DeckCard[], catalog: readonly CatalogCard[]): DeckRow[] {
  const byCode = new Map(catalog.map((card) => [card.cardCode, card]))
  const rows = cards.flatMap((c): DeckRow[] => {
    const card = byCode.get(c.cardCode)
    return card
      ? [
          {
            card,
            printing: shownPrinting(card, c.printId),
            quantity: c.quantity,
            printId: c.printId,
          },
        ]
      : []
  })
  const rank = (row: DeckRow) => {
    const index = CATEGORY_ORDER.indexOf(row.card.category)
    return index === -1 ? CATEGORY_ORDER.length : index
  }
  return rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
      a.card.cardCode.localeCompare(b.card.cardCode, 'en', { numeric: true }),
  )
}

/** Le carte che si possono aggiungere al Deck (niente Leader né DON!!), con ricerca e filtri. */
export function deckCandidates(
  catalog: readonly CatalogCard[],
  filters: CatalogFilters,
  ownership: Ownership | null = null,
): CatalogEntry[] {
  return filterCatalog(
    catalog.filter((card) => card.category !== 'Leader' && card.category !== 'DON!!'),
    { ...filters, allPrintings: false },
    ownership,
  )
}

/** I Leader, per sceglierne uno: ricerca per nome o codice e colori. */
export function leaderCandidates(
  catalog: readonly CatalogCard[],
  filters: Pick<CatalogFilters, 'q' | 'colors'>,
): CatalogEntry[] {
  return filterCatalog(
    catalog.filter((card) => card.category === 'Leader'),
    { ...EMPTY_FILTERS, q: filters.q, colors: filters.colors },
  )
}
