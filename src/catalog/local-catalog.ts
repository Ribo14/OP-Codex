import { useEffect, useSyncExternalStore } from 'react'
import { readSnapshot, writeSnapshot } from './catalog-db'
import { fetchRowsSince, type Catalog } from './catalog-data'
import {
  buildCatalog,
  syncSnapshot,
  type CatalogSnapshot,
  type FetchRowsSince,
} from './catalog-sync'

// Il catalogo come lo vede l'app: subito la copia sul dispositivo, poi (se c'è rete)
// un aggiornamento in background che scarica solo le righe cambiate.

export interface CatalogState {
  catalog: Catalog | null
  /** Ultimo controllo riuscito col server (ms), null se il catalogo non è mai stato scaricato. */
  checkedAt: number | null
  syncing: boolean
  /** Errore dell'ultimo aggiornamento; con un catalogo già sul dispositivo non blocca nulla. */
  error: string | null
}

export interface CatalogStoreDeps {
  readSnapshot: () => Promise<CatalogSnapshot | null>
  writeSnapshot: (snapshot: CatalogSnapshot) => Promise<void>
  fetchRowsSince: FetchRowsSince
  now: () => number
  isOnline: () => boolean
}

/** Valore di `error` quando il dispositivo è offline: non è un guasto, non va mostrato come tale. */
export const OFFLINE = 'offline'

export interface CatalogStore {
  getState: () => CatalogState
  subscribe: (listener: () => void) => () => void
  /** Carica la copia locale (solo la prima volta) e poi la aggiorna dal server. */
  refresh: () => Promise<void>
  /** Come refresh, ma solo se l'ultimo controllo è più vecchio di `maxAgeMs`. */
  refreshIfStale: (maxAgeMs: number) => Promise<void>
}

/** Ogni quanto, al massimo, l'app ricontrolla da sola il catalogo col server. */
export const MAX_AGE_MS = 15 * 60 * 1000

export function createCatalogStore(deps: CatalogStoreDeps): CatalogStore {
  let state: CatalogState = { catalog: null, checkedAt: null, syncing: false, error: null }
  const listeners = new Set<() => void>()
  let local: Promise<CatalogSnapshot | null> | null = null
  let running: Promise<void> | null = null
  // Momento dell'ultimo aggiornamento riuscito in questa sessione.
  let lastSync: number | null = null

  const set = (patch: Partial<CatalogState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const loadLocal = () => {
    local ??= deps.readSnapshot().then((snapshot) => {
      if (snapshot) set({ catalog: buildCatalog(snapshot), checkedAt: snapshot.checkedAt })
      // Nessuna copia letta (o lettura fallita): al prossimo tentativo si riprova a leggerla,
      // così "Riprova" funziona anche offline invece di ripetere lo stesso risultato.
      else local = null
      return snapshot
    })
    return local
  }

  const run = async () => {
    const current = await loadLocal()
    // Senza rete non si prova nemmeno: si riparte all'evento "online".
    if (!deps.isOnline()) {
      set({ error: OFFLINE })
      return
    }
    set({ syncing: true, error: null })
    try {
      const { snapshot, changed } = await syncSnapshot(current, deps.fetchRowsSince, deps.now())
      local = Promise.resolve(snapshot)
      lastSync = snapshot.checkedAt
      await deps.writeSnapshot(snapshot)
      set({
        ...(changed ? { catalog: buildCatalog(snapshot) } : {}),
        checkedAt: snapshot.checkedAt,
        syncing: false,
      })
    } catch (error) {
      set({ syncing: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const refresh = () => {
    running ??= run().finally(() => {
      running = null
    })
    return running
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh,
    refreshIfStale(maxAgeMs) {
      if (lastSync !== null && deps.now() - lastSync < maxAgeMs) return Promise.resolve()
      return refresh()
    },
  }
}

let defaultStore: CatalogStore | null = null

export function catalogStore(): CatalogStore {
  defaultStore ??= createCatalogStore({
    readSnapshot,
    writeSnapshot,
    fetchRowsSince,
    now: Date.now,
    isOnline: () => navigator.onLine,
  })
  return defaultStore
}

/** Il catalogo sul dispositivo; si aggiorna all'apertura e quando torna la connessione. */
export function useCatalog(store: CatalogStore = catalogStore()) {
  const state = useSyncExternalStore(store.subscribe, store.getState)

  useEffect(() => {
    void store.refreshIfStale(MAX_AGE_MS)
    const onOnline = () => {
      void store.refresh()
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [store])

  return { ...state, retry: store.refresh }
}
