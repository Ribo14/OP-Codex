import { describe, expect, it, vi } from 'vitest'
import type { downloadImages } from './image-download'
import { createOfflineImagesStore, type OfflineImagesDeps } from './offline-images'

const URLS = ['thumb/a', 'full/a', 'thumb/b', 'full/b', 'thumb/c', 'full/c']

/** Finto service worker: le immagini "scaricate" finiscono nella cache. */
function setup(initial: string[] = [], overrides: Partial<OfflineImagesDeps> = {}) {
  const cache = new Set(initial)
  const release = vi.fn()
  const download = vi.fn<typeof downloadImages>(async (urls, { onProgress, signal } = {}) => {
    const progress = { done: 0, failed: 0, total: urls.length }
    for (const url of urls) {
      if (signal?.aborted) break
      cache.add(url)
      progress.done++
      onProgress?.({ ...progress })
      await new Promise((resolve) => setTimeout(resolve, 1))
    }
    return progress
  })
  const deps: OfflineImagesDeps = {
    cachedUrls: () => Promise.resolve(new Set(cache)),
    download,
    clear: vi.fn(() => {
      cache.clear()
      return Promise.resolve()
    }),
    persist: vi.fn(() => Promise.resolve()),
    keepAwake: vi.fn(() => Promise.resolve(release)),
    settle: () => Promise.resolve(),
    ...overrides,
  }
  return { store: createOfflineImagesStore(deps), deps, download, release, cache }
}

describe('scarica tutte le immagini', () => {
  it('conta quelle già sul dispositivo e quelle che mancano', async () => {
    const { store } = setup(['thumb/a', 'full/a', 'altro'])
    await store.track(URLS)
    expect(store.getState()).toMatchObject({ phase: 'idle', cached: 2, total: 6 })
    expect(store.getState().missing).toEqual(['thumb/b', 'full/b', 'thumb/c', 'full/c'])
  })

  it('scarica solo le mancanti, tenendo acceso lo schermo e chiedendo spazio persistente', async () => {
    const { store, deps, download, release } = setup(['thumb/a', 'full/a'])
    await store.track(URLS)
    await store.start()
    expect(download).toHaveBeenCalledOnce()
    expect(download.mock.calls[0]?.[0]).toEqual(['thumb/b', 'full/b', 'thumb/c', 'full/c'])
    expect(deps.persist).toHaveBeenCalledOnce()
    expect(deps.keepAwake).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
    expect(store.getState()).toMatchObject({ phase: 'done', cached: 6, total: 6, missing: [] })
  })

  it('a download finito conta anche le immagini che il service worker salva in ritardo', async () => {
    // Il service worker risponde prima di aver scritto in cache: le scritture arrivano dopo.
    const cache = new Set<string>()
    const pending: string[] = []
    const { store } = setup([], {
      cachedUrls: () => Promise.resolve(new Set(cache)),
      download: (urls) => {
        pending.push(...urls)
        return Promise.resolve({ done: urls.length, failed: 0, total: urls.length })
      },
      settle: () => {
        for (const url of pending.splice(0)) cache.add(url)
        return Promise.resolve()
      },
    })
    await store.track(URLS)
    const doneStates: unknown[] = []
    store.subscribe(() => {
      const s = store.getState()
      if (s.phase === 'done') doneStates.push(s.missing)
    })
    await store.start()
    expect(store.getState()).toMatchObject({ phase: 'done', cached: 6, missing: [] })
    // Mai "finito" con immagini ancora da scaricare.
    expect(doneStates).toEqual([[]])
  })

  it('durante il download il conteggio sale immagine per immagine', async () => {
    const { store } = setup()
    await store.track(URLS)
    const seen: (number | null)[] = []
    store.subscribe(() => {
      seen.push(store.getState().cached)
    })
    await store.start()
    expect(seen).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]))
  })

  it('interrotto, riprende dalle sole immagini ancora mancanti', async () => {
    const { store, download } = setup()
    await store.track(URLS)
    // Interrompe appena la seconda immagine è sul dispositivo.
    const unsubscribe = store.subscribe(() => {
      if (store.getState().cached === 2) store.stop()
    })
    await store.start()
    unsubscribe()
    expect(store.getState()).toMatchObject({ phase: 'stopped', cached: 2 })

    await store.start()
    expect(download).toHaveBeenCalledTimes(2)
    expect(download.mock.calls[1]?.[0]).toEqual(['thumb/b', 'full/b', 'thumb/c', 'full/c'])
    expect(store.getState()).toMatchObject({ phase: 'done', cached: 6 })
  })

  it('un secondo "scarica" mentre il download è in corso non ne avvia un altro', async () => {
    const { store, download } = setup()
    await store.track(URLS)
    await Promise.all([store.start(), store.start()])
    expect(download).toHaveBeenCalledOnce()
  })

  it('se il download si rompe rilascia lo schermo e si può riprendere', async () => {
    const { store, release } = setup([], {
      download: () => Promise.reject(new Error('rete')),
    })
    await store.track(URLS)
    await store.start()
    expect(release).toHaveBeenCalledOnce()
    expect(store.getState().phase).toBe('stopped')
  })

  it('eliminare le immagini svuota le cache e riporta il conteggio a zero', async () => {
    const { store, deps } = setup(URLS)
    await store.track(URLS)
    expect(store.getState().cached).toBe(6)
    await store.clear()
    expect(deps.clear).toHaveBeenCalledOnce()
    expect(store.getState()).toMatchObject({ phase: 'idle', cached: 0, missing: URLS })
  })
})
