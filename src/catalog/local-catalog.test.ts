import { describe, expect, it, vi } from 'vitest'
import type { CatalogRows, CatalogSnapshot } from './catalog-sync'
import { createCatalogStore, OFFLINE, type CatalogStoreDeps } from './local-catalog'

const ROWS: CatalogRows = {
  sets: [{ series_id: 1, code: 'OP-01', name: 'ROMANCE DAWN', updated_at: '2026-09-20T00:00:00Z' }],
  cards: [
    {
      card_code: 'OP01-001',
      name: 'Roronoa Zoro',
      category: 'Leader',
      cost: null,
      life: 5,
      power: 5000,
      counter: null,
      colors: ['Red'],
      attributes: ['Slash'],
      types: [],
      block: '1',
      effect: null,
      trigger: null,
      keywords: [],
      updated_at: '2026-09-20T00:00:00Z',
    },
  ],
  printings: [],
  faqs: [],
}

const EMPTY: CatalogRows = { sets: [], cards: [], printings: [], faqs: [] }

const SAVED: CatalogSnapshot = {
  ...ROWS,
  watermark: '2026-09-20T00:00:00Z',
  checkedAt: 100,
}

function deps(overrides: Partial<CatalogStoreDeps> = {}): CatalogStoreDeps {
  return {
    readSnapshot: () => Promise.resolve(null),
    writeSnapshot: vi.fn(() => Promise.resolve()),
    fetchRowsSince: vi.fn(() => Promise.resolve(ROWS)),
    now: () => 1000,
    isOnline: () => true,
    ...overrides,
  }
}

describe('store del catalogo', () => {
  it('primo avvio: scarica tutto, lo salva sul dispositivo e lo mostra', async () => {
    const d = deps()
    const store = createCatalogStore(d)
    await store.refresh()
    expect(d.fetchRowsSince).toHaveBeenCalledWith(null)
    expect(d.writeSnapshot).toHaveBeenCalledOnce()
    expect(store.getState()).toMatchObject({ checkedAt: 1000, syncing: false, error: null })
    expect(store.getState().catalog?.cards[0]?.name).toBe('Roronoa Zoro')
  })

  it('mostra subito la copia salvata, prima che risponda il server', async () => {
    let answer: (rows: CatalogRows) => void = () => undefined
    const d = deps({
      readSnapshot: () => Promise.resolve(SAVED),
      fetchRowsSince: vi.fn(
        () =>
          new Promise<CatalogRows>((resolve) => {
            answer = resolve
          }),
      ),
    })
    const store = createCatalogStore(d)
    const done = store.refresh()
    await vi.waitFor(() => {
      expect(store.getState().syncing).toBe(true)
    })
    expect(store.getState().catalog?.cards).toHaveLength(1)
    expect(store.getState().checkedAt).toBe(100)

    answer(EMPTY)
    await done
    expect(d.fetchRowsSince).toHaveBeenCalledWith(expect.any(String))
    expect(store.getState()).toMatchObject({ checkedAt: 1000, syncing: false })
  })

  it('senza novità non ricostruisce il catalogo', async () => {
    const store = createCatalogStore(
      deps({
        readSnapshot: () => Promise.resolve(SAVED),
        fetchRowsSince: () => Promise.resolve(EMPTY),
      }),
    )
    await store.refresh()
    const first = store.getState().catalog
    await store.refresh()
    expect(store.getState().catalog).toBe(first)
  })

  it('server irraggiungibile con la copia salvata: il catalogo resta, con l’errore da parte', async () => {
    const store = createCatalogStore(
      deps({
        readSnapshot: () => Promise.resolve(SAVED),
        fetchRowsSince: () => Promise.reject(new Error('Failed to fetch')),
      }),
    )
    await store.refresh()
    expect(store.getState().catalog?.cards).toHaveLength(1)
    expect(store.getState()).toMatchObject({ checkedAt: 100, error: 'Failed to fetch' })
  })

  it('server irraggiungibile al primo avvio: niente catalogo, errore; riprovando si recupera', async () => {
    const fetchRowsSince = vi
      .fn<CatalogStoreDeps['fetchRowsSince']>()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(ROWS)
    const store = createCatalogStore(deps({ fetchRowsSince }))
    await store.refresh()
    expect(store.getState()).toMatchObject({ catalog: null, error: 'Failed to fetch' })
    await store.refresh()
    expect(store.getState().catalog?.cards).toHaveLength(1)
    expect(store.getState().error).toBeNull()
  })

  it('senza rete non contatta il server ma mostra la copia salvata', async () => {
    const d = deps({ readSnapshot: () => Promise.resolve(SAVED), isOnline: () => false })
    const store = createCatalogStore(d)
    await store.refresh()
    expect(d.fetchRowsSince).not.toHaveBeenCalled()
    expect(store.getState()).toMatchObject({ checkedAt: 100, syncing: false, error: OFFLINE })
    expect(store.getState().catalog?.cards).toHaveLength(1)
  })

  it('senza rete, se la copia salvata non si legge al primo colpo, "Riprova" la rilegge', async () => {
    const readSnapshot = vi
      .fn<CatalogStoreDeps['readSnapshot']>()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(SAVED)
    const store = createCatalogStore(deps({ readSnapshot, isOnline: () => false }))
    await store.refresh()
    expect(store.getState()).toMatchObject({ catalog: null, error: OFFLINE })

    await store.refresh()
    expect(readSnapshot).toHaveBeenCalledTimes(2)
    expect(store.getState().catalog?.cards).toHaveLength(1)
  })

  it('aggiornamenti contemporanei diventano uno solo', async () => {
    const d = deps()
    const store = createCatalogStore(d)
    await Promise.all([store.refresh(), store.refresh(), store.refresh()])
    expect(d.fetchRowsSince).toHaveBeenCalledOnce()
  })

  it('refreshIfStale non richiama il server se ha appena controllato', async () => {
    let now = 1000
    const d = deps({ now: () => now })
    const store = createCatalogStore(d)
    await store.refreshIfStale(60_000)
    await store.refreshIfStale(60_000)
    expect(d.fetchRowsSince).toHaveBeenCalledOnce()
    now += 60_000
    await store.refreshIfStale(60_000)
    expect(d.fetchRowsSince).toHaveBeenCalledTimes(2)
  })

  it('avvisa chi è in ascolto', async () => {
    const store = createCatalogStore(deps())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    await store.refresh()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    await store.refresh()
    expect(listener).not.toHaveBeenCalled()
  })
})
