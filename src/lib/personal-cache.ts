import { openDB, type IDBPDatabase } from 'idb'

// Copia locale dei dati personali (RIB-27): profilo, Collection e Deck dell'utente, per
// consultarli offline. Database separato dal catalogo, così all'uscita si svuota tutto in un
// colpo solo e un dispositivo condiviso non espone nulla. Ogni voce ricorda di chi è: una copia
// di un altro utente non viene mai restituita.

export type PersonalKey = 'profile' | 'collection' | 'decks'

interface Stored {
  userId: string
  value: unknown
  savedAt: number
}

const DB_NAME = 'op-codex-personal'
const STORE = 'personal'

let db: Promise<IDBPDatabase> | null = null

function open(): Promise<IDBPDatabase> {
  db ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE)
    },
  })
  return db
}

/** La copia di `key` per `userId`, oppure null (niente copia, altro utente, IndexedDB assente). */
export async function readPersonal<T>(key: PersonalKey, userId: string): Promise<T | null> {
  try {
    const stored = (await (await open()).get(STORE, key)) as Stored | undefined
    return stored?.userId === userId ? (stored.value as T) : null
  } catch {
    db = null
    return null
  }
}

export async function writePersonal(key: PersonalKey, userId: string, value: unknown) {
  try {
    const stored: Stored = { userId, value, savedAt: Date.now() }
    await (await open()).put(STORE, stored, key)
  } catch {
    /* senza IndexedDB (es. navigazione privata) i dati restano solo online */
  }
}

/** Il browser sa di essere offline (quando dice "online" può comunque mancare internet). */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

/** Cancella tutti i dati personali salvati sul dispositivo (all'uscita dall'account). */
export async function clearPersonal(): Promise<void> {
  try {
    await (await open()).clear(STORE)
  } catch {
    /* niente da cancellare */
  }
}

/**
 * Carica dal server e salva la copia; se il server non risponde (offline) restituisce la copia
 * salvata. Senza copia l'errore resta quello del server.
 */
export async function withOfflineCopy<T>(
  key: PersonalKey,
  userId: string,
  load: () => Promise<T>,
): Promise<T> {
  // Già offline: subito la copia, senza aspettare che le richieste falliscano (la libreria di
  // Supabase le ripete più volte prima di arrendersi).
  if (isOffline()) {
    const copy = await readPersonal<T>(key, userId)
    if (copy !== null) return copy
  }
  try {
    const value = await load()
    await writePersonal(key, userId, value)
    return value
  } catch (error) {
    const copy = await readPersonal<T>(key, userId)
    if (copy !== null) return copy
    throw error
  }
}
