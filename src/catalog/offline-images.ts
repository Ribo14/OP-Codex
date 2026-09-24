import { useEffect, useSyncExternalStore } from 'react'
import {
  cachedImageUrls,
  clearImageCaches,
  downloadImages,
  type DownloadProgress,
} from './image-download'

// "Scarica tutte le immagini" (Impostazioni, RIB-37). Lo stato vive fuori dai componenti:
// il download continua anche se si cambia pagina dentro l'app. Riparte sempre dalle sole
// immagini mancanti, quindi interromperlo e riprenderlo non riscarica nulla.

export interface OfflineImagesState {
  /** idle: nessun download in questa sessione; stopped: interrotto dall'utente. */
  phase: 'idle' | 'running' | 'done' | 'stopped'
  /** Immagini del catalogo già sul dispositivo; null finché non sono state contate. */
  cached: number | null
  /** Immagini del catalogo in tutto (miniature e grandi). */
  total: number
  /** Immagini ancora da scaricare. */
  missing: readonly string[]
  /** Download in corso, o l'ultimo concluso. */
  progress: DownloadProgress | null
}

export interface OfflineImagesDeps {
  cachedUrls: () => Promise<Set<string>>
  download: typeof downloadImages
  clear: () => Promise<void>
  /** Chiede al browser di non cancellare i dati dell'app quando lo spazio scarseggia. */
  persist: () => Promise<void>
  /** Tiene acceso lo schermo durante il download; restituisce la funzione che lo rilascia. */
  keepAwake: () => Promise<() => void>
  /** Attesa prima del conteggio finale, perché il service worker finisca di scrivere in cache. */
  settle: () => Promise<void>
}

export type OfflineImagesStore = ReturnType<typeof createOfflineImagesStore>

export function createOfflineImagesStore(deps: OfflineImagesDeps) {
  let state: OfflineImagesState = {
    phase: 'idle',
    cached: null,
    total: 0,
    missing: [],
    progress: null,
  }
  const listeners = new Set<() => void>()
  let urls: readonly string[] = []
  let controller: AbortController | null = null

  const set = (patch: Partial<OfflineImagesState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const recount = async () => {
    const target = urls
    const cached = await deps.cachedUrls()
    if (target !== urls) return
    const missing = target.filter((url) => !cached.has(url))
    set({ cached: target.length - missing.length, total: target.length, missing })
  }

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Le immagini del catalogo attuale; durante un download si ricontano alla fine. */
    track: async (next: readonly string[]) => {
      if (next === urls) return
      urls = next
      if (state.phase !== 'running') await recount()
    },

    start: async () => {
      if (state.phase === 'running') return
      // Subito "running": un secondo tocco sul pulsante non avvia un altro download.
      const current = new AbortController()
      controller = current
      set({ phase: 'running', progress: null })
      await recount()
      const todo = state.missing
      const before = state.cached ?? 0
      set({ progress: { done: 0, failed: 0, total: todo.length } })
      await deps.persist()
      const release = await deps.keepAwake()
      let phase: OfflineImagesState['phase'] = 'stopped'
      try {
        const progress = await deps.download(todo, {
          signal: current.signal,
          onProgress: (p) => {
            set({ progress: p, cached: before + p.done })
          },
        })
        set({ progress })
        if (!current.signal.aborted) phase = 'done'
      } catch {
        // Imprevisto (i singoli errori li conta downloadImages): si potrà riprendere.
      } finally {
        release()
        controller = null
      }
      // Il service worker salva in cache subito dopo aver risposto: un attimo di margine,
      // poi conteggio e fase cambiano insieme (niente "mancano…" a download finito).
      await deps.settle()
      await recount()
      set({ phase })
    },

    stop: () => {
      controller?.abort()
    },

    clear: async () => {
      if (state.phase === 'running') return
      await deps.clear()
      set({ phase: 'idle', progress: null })
      await recount()
    },
  }
}

let defaultStore: OfflineImagesStore | null = null

function offlineImagesStore(): OfflineImagesStore {
  defaultStore ??= createOfflineImagesStore({
    cachedUrls: cachedImageUrls,
    download: downloadImages,
    clear: clearImageCaches,
    settle: () =>
      new Promise((resolve) => {
        setTimeout(resolve, 1000)
      }),
    async persist() {
      try {
        await navigator.storage.persist()
      } catch {
        /* non supportato: il browser decide da sé */
      }
    },
    async keepAwake() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        return () => {
          void lock.release()
        }
      } catch {
        // Wake Lock non disponibile (o negato): lo schermo si spegne come sempre.
        return () => undefined
      }
    },
  })
  return defaultStore
}

/** Stato e comandi del download di tutte le immagini di `urls`. */
export function useOfflineImages(
  urls: readonly string[],
  store: OfflineImagesStore = offlineImagesStore(),
) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  useEffect(() => {
    void store.track(urls)
  }, [store, urls])
  return { ...state, start: store.start, stop: store.stop, clear: store.clear }
}
