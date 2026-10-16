import type { CatalogCard } from '@/catalog/catalog-data'
import { DECK_SIZE, type DeckCard } from '@/decks/deck'
import type { DeckList } from './game'

// Mazzi con cui ci si siede al tavolo (RIB-99): i Deck salvati dell'utente e gli Starter Deck,
// con le composizioni di set_recipes (le stesse di "Aggiungi in blocco"). Dove la composizione
// manca, uno Starter si ricava dal catalogo: Leader del Set e 4 copie per carta fino a 50.

export interface TableDeck {
  id: string
  name: string
  /** Mazzo dell'utente o pronto (Starter Deck). */
  kind: 'own' | 'starter'
  list: DeckList
}

/** Composizione di un mazzo pronto: Card Code → copie. */
export type Recipe = Readonly<Record<string, number>>

const lifeOf = (leader: CatalogCard) => leader.life ?? 5

/** Da un Deck salvato alla lista del tavolo; null senza Leader nel catalogo. */
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
    kind: 'own',
    list: {
      leader: { cardCode: leaderCode, printId: leaderPrintId, life: lifeOf(leader) },
      cards: cards
        .filter((c) => byCode.has(c.cardCode))
        .map((c) => ({ cardCode: c.cardCode, printId: c.printId, quantity: c.quantity })),
    },
  }
}

/** Uno Starter Deck dalla sua composizione (il Leader è la carta Leader della lista). */
export function fromRecipe(
  setCode: string,
  recipe: Recipe,
  byCode: ReadonlyMap<string, CatalogCard>,
): TableDeck | null {
  const entries = Object.entries(recipe).flatMap(([code, quantity]) => {
    const card = byCode.get(code)
    return card && quantity > 0 ? [{ card, quantity }] : []
  })
  const leader = entries.find((e) => e.card.category === 'Leader')?.card
  if (!leader) return null
  return {
    id: `starter-${setCode}`,
    name: `${leader.name} (${setCode})`,
    kind: 'starter',
    list: {
      leader: { cardCode: leader.cardCode, printId: null, life: lifeOf(leader) },
      cards: entries
        .filter((e) => e.card.category !== 'Leader')
        .map((e) => ({ cardCode: e.card.cardCode, printId: null, quantity: e.quantity })),
    },
  }
}

/** Ripiego senza composizione: Leader del Set e 4 copie di ogni carta, fino a 50. */
export function approximateStarter(
  setCode: string,
  catalog: readonly CatalogCard[],
): TableDeck | null {
  const prefix = setCode.replace('-', '')
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
    id: `starter-${setCode}`,
    name: `${leader.name} (${setCode})`,
    kind: 'starter',
    list: {
      leader: { cardCode: leader.cardCode, printId: null, life: lifeOf(leader) },
      cards: list,
    },
  }
}

/** Carte nel mazzo (Leader escluso). */
export const deckCount = (deck: TableDeck) => deck.list.cards.reduce((n, c) => n + c.quantity, 0)
