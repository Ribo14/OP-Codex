import type { CatalogCard } from '@/catalog/catalog-data'
import { DECK_SIZE, type DeckCard } from '@/decks/deck'
import type { DeckList } from './game'

// Mazzi per il tavolo (RIB-34): i Deck dell'utente o, senza account, uno Starter Deck preso dal
// catalogo (Leader del Set e le sue carte, 4 copie ciascuna fino a 50).

export interface TableDeck {
  id: string
  name: string
  list: DeckList
}

/** Da un Deck salvato alla lista del tavolo. */
export function fromDeck(
  id: string,
  name: string,
  leaderCode: string,
  leaderPrintId: string | null,
  cards: readonly DeckCard[],
  byCode: ReadonlyMap<string, CatalogCard>,
): TableDeck | null {
  const leader = byCode.get(leaderCode)
  if (!leader) return null
  return {
    id,
    name,
    list: {
      leader: { cardCode: leaderCode, printId: leaderPrintId, life: leader.life ?? 5 },
      cards: cards.map((c) => ({ cardCode: c.cardCode, printId: c.printId, quantity: c.quantity })),
    },
  }
}

/** Uno Starter Deck dal catalogo, per provare il tavolo senza mazzi propri. */
export function starterDeck(prefix: string, catalog: readonly CatalogCard[]): TableDeck | null {
  const cards = catalog.filter((c) => c.cardCode.startsWith(`${prefix}-`))
  const leader = cards.find((c) => c.category === 'Leader')
  if (!leader) return null
  let left = DECK_SIZE
  const list = cards
    .filter((c) => c.category !== 'Leader')
    .flatMap((c) => {
      const quantity = Math.min(4, left)
      left -= quantity
      return quantity > 0 ? [{ cardCode: c.cardCode, printId: null, quantity }] : []
    })
  return {
    id: `starter-${prefix}`,
    name: `${leader.name} (${prefix})`,
    list: {
      leader: { cardCode: leader.cardCode, printId: null, life: leader.life ?? 5 },
      cards: list,
    },
  }
}
