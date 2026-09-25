import { describe, expect, it } from 'vitest'
import type { CollectionEntry, Language } from './collection'
import { createCollectionStore, type CollectionDeps } from './collection-store'

/** Un server finto: tiene le copie e risponde quando lo si decide. */
function fakeServer(initial: CollectionEntry[] = []) {
  const copies = new Map(initial.map((e) => [`${e.printId}|${e.language}`, e.quantity]))
  const waiting: { resolve: () => void; reject: () => void }[] = []
  const deps: CollectionDeps = {
    load: () => Promise.resolve(initial),
    change: (printId: string, language: Language, delta: number) =>
      new Promise<number>((resolve, reject) => {
        waiting.push({
          resolve: () => {
            const key = `${printId}|${language}`
            const next = Math.max(0, (copies.get(key) ?? 0) + delta)
            copies.set(key, next)
            resolve(next)
          },
          reject: () => {
            reject(new Error('rete'))
          },
        })
      }),
    now: () => '2026-09-25T12:00:00Z',
  }
  return { deps, waiting }
}

const quantity = (state: ReturnType<ReturnType<typeof createCollectionStore>['getState']>) =>
  state.status === 'ready'
    ? (state.entries.find((e) => e.printId === 'OP01-016')?.quantity ?? 0)
    : null

async function ready(store: ReturnType<typeof createCollectionStore>) {
  store.ensure('anna')
  await Promise.resolve()
  await Promise.resolve()
}

describe('stato della Collection', () => {
  it('carica la Collection dell’utente una sola volta', async () => {
    let loads = 0
    const { deps } = fakeServer()
    const store = createCollectionStore({
      ...deps,
      load: () => {
        loads++
        return Promise.resolve([])
      },
    })
    await ready(store)
    store.ensure('anna')
    expect(loads).toBe(1)
    expect(store.getState()).toEqual({ status: 'ready', entries: [] })
  })

  it('il numero cambia subito e resta giusto anche con risposte in disordine', async () => {
    const { deps, waiting } = fakeServer()
    const store = createCollectionStore(deps)
    await ready(store)

    const first = store.change('OP01-016', 'EN', 1)
    const second = store.change('OP01-016', 'EN', 1)
    expect(quantity(store.getState())).toBe(2)

    // Il server salva nell'ordine, ma la seconda risposta arriva prima della prima.
    const [a, b] = waiting
    a?.resolve()
    b?.resolve()
    await expect(second).resolves.toBe(true)
    await expect(first).resolves.toBe(true)
    expect(quantity(store.getState())).toBe(2)
  })

  it('se il salvataggio fallisce si annulla solo quel tocco', async () => {
    const { deps, waiting } = fakeServer([
      { printId: 'OP01-016', language: 'EN', quantity: 2, updatedAt: '2026-09-25T10:00:00Z' },
    ])
    const store = createCollectionStore(deps)
    await ready(store)

    const ok = store.change('OP01-016', 'EN', 1)
    const failed = store.change('OP01-016', 'EN', 1)
    expect(quantity(store.getState())).toBe(4)
    waiting[1]?.reject()
    await expect(failed).resolves.toBe(false)
    expect(quantity(store.getState())).toBe(3)
    waiting[0]?.resolve()
    await expect(ok).resolves.toBe(true)
    expect(quantity(store.getState())).toBe(3)
  })

  it('a 0 la Printing sparisce dalla Collection', async () => {
    const { deps, waiting } = fakeServer([
      { printId: 'OP01-016', language: 'EN', quantity: 1, updatedAt: '2026-09-25T10:00:00Z' },
    ])
    const store = createCollectionStore(deps)
    await ready(store)
    const removed = store.change('OP01-016', 'EN', -1)
    expect(store.getState()).toEqual({ status: 'ready', entries: [] })
    waiting[0]?.resolve()
    await removed
    expect(store.getState()).toEqual({ status: 'ready', entries: [] })
  })

  it('un errore di caricamento si segnala e si può riprovare', async () => {
    let attempts = 0
    const { deps } = fakeServer()
    const store = createCollectionStore({
      ...deps,
      load: () => (++attempts === 1 ? Promise.reject(new Error('rete')) : Promise.resolve([])),
    })
    await ready(store)
    expect(store.getState()).toEqual({ status: 'error' })
    await store.reload()
    expect(store.getState()).toEqual({ status: 'ready', entries: [] })
  })
})
