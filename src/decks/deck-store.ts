import { useEffect, useSyncExternalStore } from 'react'
import {
  quantityInDeck,
  withCardQuantity,
  withPrint,
  type DeckCard,
  type DeckSummary,
} from './deck'
import * as api from './decks-api'

// Lo stato del Deck aperto nell'editor (RIB-21). Ogni modifica si salva da sola: i +/− cambiano
// subito lo schermo e poi si allineano al server (solo all'ultima risposta, come la Collection);
// se un salvataggio fallisce si annulla quella modifica.

export type DeckState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; deck: DeckSummary; cards: DeckCard[] }

export type DeckDeps = Pick<
  typeof api,
  'loadDeck' | 'changeDeckCard' | 'setDeckCardPrint' | 'renameDeck' | 'setLeader'
>

export interface DeckStore {
  getState: () => DeckState
  deckId: () => string | null
  subscribe: (listener: () => void) => () => void
  ensure: (deckId: string) => void
  reload: () => Promise<void>
  /** +/−: true se salvato, false se annullato. */
  change: (cardCode: string, delta: number) => Promise<boolean>
  setPrint: (cardCode: string, printId: string | null) => Promise<boolean>
  rename: (name: string) => Promise<boolean>
  setLeader: (leaderCode: string, leaderPrintId: string | null) => Promise<boolean>
}

const LOADING: DeckState = { status: 'loading' }

export function createDeckStore(deps: DeckDeps): DeckStore {
  let owner: string | null = null
  let state: DeckState = LOADING
  const listeners = new Set<() => void>()
  const pending = new Map<string, number>()

  const set = (next: DeckState) => {
    state = next
    for (const listener of listeners) listener()
  }

  const load = async (deckId: string) => {
    owner = deckId
    pending.clear()
    set(LOADING)
    try {
      const detail = await deps.loadDeck(deckId)
      if (owner !== deckId) return
      set(detail ? { status: 'ready', ...detail } : { status: 'missing' })
    } catch {
      if (owner === deckId) set({ status: 'error' })
    }
  }

  /** Aggiorna il Deck pronto (se lo è ancora e se è lo stesso). */
  const update = (
    deckId: string,
    fn: (ready: Extract<DeckState, { status: 'ready' }>) => DeckState,
  ) => {
    if (owner !== deckId || state.status !== 'ready') return
    set(fn(state))
  }

  const current = (cardCode: string) =>
    state.status === 'ready' ? quantityInDeck(state.cards, cardCode) : 0

  const setCards = (deckId: string, cardCode: string, quantity: number) => {
    update(deckId, (s) => {
      const cards = withCardQuantity(s.cards, cardCode, quantity)
      return {
        ...s,
        cards,
        deck: { ...s.deck, cardCount: cards.reduce((n, c) => n + c.quantity, 0) },
      }
    })
  }

  return {
    getState: () => state,
    deckId: () => owner,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    ensure: (deckId) => {
      if (owner !== deckId) void load(deckId)
    },
    reload: async () => {
      if (owner) await load(owner)
    },
    change: async (cardCode, delta) => {
      if (state.status !== 'ready' || !owner) return false
      const deckId = owner
      const before = current(cardCode)
      const applied = Math.min(50, Math.max(0, before + delta)) - before
      setCards(deckId, cardCode, before + applied)
      pending.set(cardCode, (pending.get(cardCode) ?? 0) + 1)
      const done = () => {
        const left = (pending.get(cardCode) ?? 1) - 1
        if (left === 0) pending.delete(cardCode)
        else pending.set(cardCode, left)
        return left
      }
      try {
        const saved = await deps.changeDeckCard(deckId, cardCode, delta)
        if (done() === 0) setCards(deckId, cardCode, saved)
        return true
      } catch {
        done()
        setCards(deckId, cardCode, Math.max(0, current(cardCode) - applied))
        return false
      }
    },
    setPrint: async (cardCode, printId) => {
      if (state.status !== 'ready' || !owner) return false
      const deckId = owner
      const previous = state.cards.find((c) => c.cardCode === cardCode)?.printId ?? null
      update(deckId, (s) => ({ ...s, cards: withPrint(s.cards, cardCode, printId) }))
      try {
        await deps.setDeckCardPrint(deckId, cardCode, printId)
        return true
      } catch {
        update(deckId, (s) => ({ ...s, cards: withPrint(s.cards, cardCode, previous) }))
        return false
      }
    },
    rename: async (name) => {
      if (state.status !== 'ready' || !owner) return false
      const deckId = owner
      const previous = state.deck.name
      update(deckId, (s) => ({ ...s, deck: { ...s.deck, name } }))
      try {
        await deps.renameDeck(deckId, name)
        return true
      } catch {
        update(deckId, (s) => ({ ...s, deck: { ...s.deck, name: previous } }))
        return false
      }
    },
    setLeader: async (leaderCode, leaderPrintId) => {
      if (state.status !== 'ready' || !owner) return false
      const deckId = owner
      const { leaderCode: oldCode, leaderPrintId: oldPrint } = state.deck
      update(deckId, (s) => ({ ...s, deck: { ...s.deck, leaderCode, leaderPrintId } }))
      try {
        await deps.setLeader(deckId, leaderCode, leaderPrintId)
        return true
      } catch {
        update(deckId, (s) => ({
          ...s,
          deck: { ...s.deck, leaderCode: oldCode, leaderPrintId: oldPrint },
        }))
        return false
      }
    },
  }
}

let defaultStore: DeckStore | null = null

export function deckStore(): DeckStore {
  defaultStore ??= createDeckStore(api)
  return defaultStore
}

/** Il Deck aperto nell'editor; si ricarica ogni volta che si apre un Deck diverso. */
export function useDeck(deckId: string, store: DeckStore = deckStore()) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  useEffect(() => {
    store.ensure(deckId)
  }, [store, deckId])
  return { state: store.deckId() === deckId ? state : LOADING, store }
}
