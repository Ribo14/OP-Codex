import type { CollectionEntry } from '@/collection/collection'
import type { DeckCard } from '@/decks/deck'
import type { CatalogCard, CatalogPrinting } from './catalog-data'

// Valore stimato di Collection e Deck (RIB-32, slice 5.4, user story 63 e 64): prezzo di tendenza
// Cardmarket × copie. I prezzi abbinati sono quelli delle stampe inglesi: le copie in altre lingue
// non si valutano (si contano a parte), quelle senza prezzo nemmeno.

export interface CollectionValue {
  /** Euro, al centesimo. */
  total: number
  /** Copie inglesi con un prezzo. */
  priced: number
  /** Copie inglesi senza prezzo. */
  unpriced: number
  /** Copie in altre lingue, non valutate. */
  otherLanguages: number
}

function printingsById(cards: readonly CatalogCard[]): Map<string, CatalogPrinting> {
  return new Map(cards.flatMap((card) => card.printings.map((p) => [p.printId, p] as const)))
}

const cents = (euro: number) => Math.round(euro * 100)

export function collectionValue(
  entries: readonly CollectionEntry[],
  cards: readonly CatalogCard[],
): CollectionValue {
  const byId = printingsById(cards)
  const value = { total: 0, priced: 0, unpriced: 0, otherLanguages: 0 }
  for (const entry of entries) {
    if (entry.language !== 'EN') {
      value.otherLanguages += entry.quantity
      continue
    }
    const trend = byId.get(entry.printId)?.price?.trend ?? null
    if (trend === null) {
      value.unpriced += entry.quantity
      continue
    }
    value.priced += entry.quantity
    value.total += cents(trend) * entry.quantity
  }
  return { ...value, total: value.total / 100 }
}

export interface DeckValue {
  total: number
  priced: number
  unpriced: number
}

/** Il Deck con le stampe mostrate (la base se non scelta), Leader compreso. */
export function deckValue(
  deck: { leaderCode: string; leaderPrintId: string | null },
  deckCards: readonly DeckCard[],
  cards: readonly CatalogCard[],
): DeckValue {
  const byCode = new Map(cards.map((card) => [card.cardCode, card]))
  const value = { total: 0, priced: 0, unpriced: 0 }
  const lines = [
    { cardCode: deck.leaderCode, printId: deck.leaderPrintId, quantity: 1 },
    ...deckCards,
  ]
  for (const line of lines) {
    const card = byCode.get(line.cardCode)
    const shown = card?.printings.find((p) => p.printId === line.printId) ?? card?.printings[0]
    const trend = shown?.price?.trend ?? null
    if (trend === null) {
      value.unpriced += line.quantity
      continue
    }
    value.priced += line.quantity
    value.total += cents(trend) * line.quantity
  }
  return { ...value, total: value.total / 100 }
}
