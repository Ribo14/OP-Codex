import { describe, expect, it } from 'vitest'
import type { DeckCard } from './deck'
import { createDeckStore, type DeckDeps, type DeckState } from './deck-store'

const DECK = {
  id: 'd1',
  name: 'Aokiji',
  leaderCode: 'OP02-049',
  leaderPrintId: null,
  updatedAt: '2026-09-25T10:00:00Z',
  cardCount: 0,
  format: 'standard' as const,
}

/** Un server finto che risponde quando lo si decide. */
function fakeServer(cards: DeckCard[] = []) {
  const copies = new Map(cards.map((c) => [c.cardCode, c.quantity]))
  const waiting: { resolve: () => void; reject: () => void }[] = []
  const later = <T>(value: () => T) =>
    new Promise<T>((resolve, reject) => {
      waiting.push({
        resolve: () => {
          resolve(value())
        },
        reject: () => {
          reject(new Error('rete'))
        },
      })
    })
  const deps: DeckDeps = {
    loadDeck: () => Promise.resolve({ deck: DECK, cards }),
    changeDeckCard: (_deck, cardCode, delta) =>
      later(() => {
        const next = Math.max(0, (copies.get(cardCode) ?? 0) + delta)
        copies.set(cardCode, next)
        return next
      }),
    setDeckCardPrint: () => later(() => undefined),
    renameDeck: () => later(() => undefined),
    setLeader: () => later(() => undefined),
    setDeckFormat: () => later(() => undefined),
  }
  return { deps, waiting }
}

const ready = (state: DeckState) => {
  if (state.status !== 'ready') throw new Error(`stato ${state.status}`)
  return state
}

async function open(deps: DeckDeps) {
  const store = createDeckStore(deps)
  store.ensure('d1')
  await Promise.resolve()
  await Promise.resolve()
  return store
}

describe('editor del Deck', () => {
  it('i +/− cambiano subito conteggio e totale, e restano giusti con risposte in disordine', async () => {
    const { deps, waiting } = fakeServer()
    const store = await open(deps)
    const first = store.change('OP02-051', 1)
    const second = store.change('OP02-051', 1)
    expect(ready(store.getState()).cards).toEqual([
      { cardCode: 'OP02-051', quantity: 2, printId: null },
    ])
    expect(ready(store.getState()).deck.cardCount).toBe(2)
    waiting[0]?.resolve()
    waiting[1]?.resolve()
    // La prima risposta (1) arriva dopo la seconda: si guarda solo l'ultima.
    await second
    await first
    expect(ready(store.getState()).deck.cardCount).toBe(2)
  })

  it('se un salvataggio fallisce si annulla solo quella modifica', async () => {
    const { deps, waiting } = fakeServer([{ cardCode: 'OP02-051', quantity: 2, printId: null }])
    const store = await open(deps)
    const failed = store.change('OP02-051', 1)
    waiting[0]?.reject()
    await expect(failed).resolves.toBe(false)
    expect(ready(store.getState()).cards[0]?.quantity).toBe(2)

    const rename = store.rename('Nuovo nome')
    expect(ready(store.getState()).deck.name).toBe('Nuovo nome')
    waiting[1]?.reject()
    await expect(rename).resolves.toBe(false)
    expect(ready(store.getState()).deck.name).toBe('Aokiji')
  })

  it('la Printing mostrata cambia senza toccare il conteggio', async () => {
    const { deps, waiting } = fakeServer([{ cardCode: 'OP02-050', quantity: 3, printId: null }])
    const store = await open(deps)
    const saved = store.setPrint('OP02-050', 'OP02-050_p1')
    waiting[0]?.resolve()
    await expect(saved).resolves.toBe(true)
    expect(ready(store.getState()).cards).toEqual([
      { cardCode: 'OP02-050', quantity: 3, printId: 'OP02-050_p1' },
    ])
  })

  it('un Deck che non esiste (o non è dell’utente) risulta mancante', async () => {
    const { deps } = fakeServer()
    const store = await open({ ...deps, loadDeck: () => Promise.resolve(null) })
    expect(store.getState()).toEqual({ status: 'missing' })
  })
})
