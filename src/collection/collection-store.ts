import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useSession } from '@/account/session'
import type { Ownership } from '@/catalog/filters'
import { withOfflineCopy } from '@/lib/personal-cache'
import { getSupabase } from '@/lib/supabase'
import {
  isLanguage,
  quantityOf,
  withQuantity,
  type CollectionEntry,
  type Language,
} from './collection'

// La Collection dell'utente come stato condiviso (dettaglio Card e pagina Collezione vedono gli
// stessi numeri). I +/− cambiano subito lo schermo e poi si allineano al database; se il
// salvataggio fallisce si annulla solo quel tocco.

export type CollectionState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: CollectionEntry[] }

export interface CollectionDeps {
  load: (userId: string) => Promise<CollectionEntry[]>
  /** Somma `delta` sul server e restituisce le copie risultanti. */
  change: (printId: string, language: Language, delta: number) => Promise<number>
  now: () => string
}

export interface CollectionStore {
  getState: () => CollectionState
  /** Utente a cui si riferisce lo stato (null prima del primo caricamento). */
  userId: () => string | null
  subscribe: (listener: () => void) => () => void
  /** Carica la Collection di `userId`, se non è già quella in memoria. */
  ensure: (userId: string) => void
  reload: () => Promise<void>
  /** +/−: true se il server ha salvato, false se il tocco è stato annullato. */
  change: (printId: string, language: Language, delta: number) => Promise<boolean>
}

const LOADING: CollectionState = { status: 'loading' }

export function createCollectionStore(deps: CollectionDeps): CollectionStore {
  let owner: string | null = null
  let state: CollectionState = LOADING
  const listeners = new Set<() => void>()
  // Richieste ancora in viaggio per Printing e lingua: ci si allinea al server solo all'ultima,
  // così risposte arrivate in disordine non riportano indietro il numero.
  const pending = new Map<string, number>()

  const set = (next: CollectionState) => {
    state = next
    for (const listener of listeners) listener()
  }

  const load = async (userId: string) => {
    owner = userId
    pending.clear()
    set(LOADING)
    try {
      const entries = await deps.load(userId)
      if (owner === userId) set({ status: 'ready', entries })
    } catch {
      if (owner === userId) set({ status: 'error' })
    }
  }

  const setQuantity = (printId: string, language: Language, quantity: number) => {
    if (state.status !== 'ready') return
    set({
      status: 'ready',
      entries: withQuantity(state.entries, printId, language, quantity, deps.now()),
    })
  }

  /** Copie attuali (lo stato può essere cambiato mentre si aspettava il server). */
  const currentQuantity = (printId: string, language: Language) =>
    state.status === 'ready' ? quantityOf(state.entries, printId, language) : 0

  return {
    getState: () => state,
    userId: () => owner,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    ensure: (userId) => {
      if (owner !== userId) void load(userId)
    },
    reload: async () => {
      if (owner) await load(owner)
    },
    change: async (printId, language, delta) => {
      if (state.status !== 'ready' || !owner) return false
      const userId = owner
      const key = `${printId}|${language}`
      const before = quantityOf(state.entries, printId, language)
      const applied = Math.max(0, before + delta) - before
      setQuantity(printId, language, before + applied)
      pending.set(key, (pending.get(key) ?? 0) + 1)
      const done = () => {
        const left = (pending.get(key) ?? 1) - 1
        if (left === 0) pending.delete(key)
        else pending.set(key, left)
        return left
      }
      try {
        const saved = await deps.change(printId, language, delta)
        if (owner !== userId) return true
        if (done() === 0) setQuantity(printId, language, saved)
        return true
      } catch {
        if (owner !== userId) return false
        done()
        // Si toglie solo l'effetto di questo tocco: gli altri restano.
        setQuantity(printId, language, Math.max(0, currentQuantity(printId, language) - applied))
        return false
      }
    },
  }
}

// Il server restituisce al massimo 1000 righe per richiesta.
const PAGE_SIZE = 1000

async function loadFromSupabase(userId: string): Promise<CollectionEntry[]> {
  const entries: CollectionEntry[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getSupabase()
      .from('collection_entries')
      .select('print_id, language, quantity, updated_at')
      .eq('user_id', userId)
      .order('print_id')
      .order('language')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    for (const row of data) {
      if (isLanguage(row.language)) {
        entries.push({
          printId: row.print_id,
          language: row.language,
          quantity: row.quantity,
          updatedAt: row.updated_at,
        })
      }
    }
    if (data.length < PAGE_SIZE) return entries
  }
}

async function changeOnSupabase(printId: string, language: Language, delta: number) {
  const { data, error } = await getSupabase().rpc('cambia_copie', {
    p_print_id: printId,
    p_language: language,
    p_delta: delta,
  })
  if (error) throw new Error(error.message)
  return data
}

let defaultStore: CollectionStore | null = null

export function collectionStore(): CollectionStore {
  defaultStore ??= createCollectionStore({
    // Offline: la copia salvata all'ultimo accesso online (RIB-27).
    load: (userId) => withOfflineCopy('collection', userId, () => loadFromSupabase(userId)),
    change: changeOnSupabase,
    now: () => new Date().toISOString(),
  })
  return defaultStore
}

/** La Collection di `userId`: si scarica la prima volta e poi resta in memoria. */
export function useCollection(userId: string | null, store: CollectionStore = collectionStore()) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  useEffect(() => {
    if (userId) store.ensure(userId)
  }, [store, userId])
  return {
    state: userId !== null && store.userId() === userId ? state : LOADING,
    change: store.change,
    reload: store.reload,
  }
}

/**
 * Per il filtro "possedute" (RIB-22): i Print ID della Collection di chi ha fatto l'accesso;
 * null senza accesso o finché la Collection non è caricata (il filtro allora si ignora).
 */
export function useOwnership(): Ownership | null {
  const session = useSession()
  const userId = session.status === 'signedIn' && !session.needsCode ? session.user.id : null
  const { state } = useCollection(userId)
  const entries = state.status === 'ready' ? state.entries : null
  return useMemo(() => (entries ? new Set(entries.map((e) => e.printId)) : null), [entries])
}
