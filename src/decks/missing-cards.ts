import type { CatalogCard } from '@/catalog/catalog-data'
import { cardCodeOf, type CollectionEntry } from '@/collection/collection'
import type { DeckCard } from './deck'
import { formatDeckList } from './deck-list'

// Missing Cards (RIB-25): cosa manca nella Collection per giocare un Deck dal vivo. Per ogni Card
// Code si sommano tutte le Printing (base, parallel, ristampe) e tutte le lingue possedute.
// Conta anche il Leader: serve una copia anche di lui.

export interface MissingRow {
  cardCode: string
  required: number
  owned: number
  missing: number
}

/** Copie possedute per Card Code, sommando Printing e lingue. */
export function ownedByCard(entries: readonly CollectionEntry[]): Map<string, number> {
  const owned = new Map<string, number>()
  for (const e of entries) {
    const code = cardCodeOf(e.printId)
    owned.set(code, (owned.get(code) ?? 0) + e.quantity)
  }
  return owned
}

/** Tutte le carte del Deck (Leader per primo) con richieste, possedute e mancanti. */
export function deckOwnership(
  leaderCode: string | null,
  cards: readonly Pick<DeckCard, 'cardCode' | 'quantity'>[],
  entries: readonly CollectionEntry[],
): MissingRow[] {
  const owned = ownedByCard(entries)
  const required = [...(leaderCode ? [{ cardCode: leaderCode, quantity: 1 }] : []), ...cards]
  return required.map(({ cardCode, quantity }) => {
    const have = owned.get(cardCode) ?? 0
    return { cardCode, required: quantity, owned: have, missing: Math.max(0, quantity - have) }
  })
}

/** Solo le carte che mancano. */
export function missingCards(rows: readonly MissingRow[]): MissingRow[] {
  return rows.filter((r) => r.missing > 0)
}

export function missingTotal(rows: readonly MissingRow[]): number {
  return rows.reduce((sum, r) => sum + r.missing, 0)
}

/**
 * "Copia lista mancanti": le copie che mancano nello stesso formato della Deck List, importabile;
 * il Leader compare solo se manca anche lui.
 */
export function missingListText(
  leaderCode: string | null,
  rows: readonly MissingRow[],
  catalog: ReadonlyMap<string, CatalogCard>,
): string {
  const missing = missingCards(rows)
  const leaderMissing = leaderCode !== null && missing.some((r) => r.cardCode === leaderCode)
  return formatDeckList(
    leaderMissing ? leaderCode : null,
    missing
      .filter((r) => r.cardCode !== leaderCode)
      .map((r) => ({ cardCode: r.cardCode, quantity: r.missing })),
    catalog,
  )
}
