import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CatalogSnapshot } from './catalog-sync'

// La copia locale del catalogo in IndexedDB: un solo record, letto e scritto per intero
// (qualche MB: più semplice e abbastanza veloce).

interface OpCodexDB extends DBSchema {
  catalog: { key: 'snapshot'; value: CatalogSnapshot }
}

const DB_NAME = 'op-codex'
const DB_VERSION = 1

let db: Promise<IDBPDatabase<OpCodexDB>> | null = null

function open(): Promise<IDBPDatabase<OpCodexDB>> {
  db ??= openDB<OpCodexDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('catalog')
    },
  })
  return db
}

/** Oltre questo tempo una lettura si considera bloccata e si riprova con una connessione nuova. */
const READ_TIMEOUT_MS = 3000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('IndexedDB timeout'))
    }, ms)
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer)
    })
  })
}

/**
 * La copia salvata, oppure null (primo avvio, o IndexedDB non disponibile).
 * Safari a volte perde la connessione a IndexedDB o la lascia appesa al primo accesso dopo
 * una riapertura ("Connection to Indexed Database server lost"): si riprova una volta da capo.
 */
export async function readSnapshot(): Promise<CatalogSnapshot | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return (
        (await withTimeout(
          open().then((database) => database.get('catalog', 'snapshot')),
          READ_TIMEOUT_MS,
        )) ?? null
      )
    } catch {
      db = null
    }
  }
  return null
}

export async function writeSnapshot(snapshot: CatalogSnapshot): Promise<void> {
  try {
    await (await open()).put('catalog', snapshot, 'snapshot')
  } catch {
    /* senza IndexedDB (es. navigazione privata) il catalogo resta solo in memoria */
  }
}
