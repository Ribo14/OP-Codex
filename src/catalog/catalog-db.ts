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

/** La copia salvata, oppure null (primo avvio, o IndexedDB non disponibile). */
export async function readSnapshot(): Promise<CatalogSnapshot | null> {
  try {
    return (await (await open()).get('catalog', 'snapshot')) ?? null
  } catch {
    return null
  }
}

export async function writeSnapshot(snapshot: CatalogSnapshot): Promise<void> {
  try {
    await (await open()).put('catalog', snapshot, 'snapshot')
  } catch {
    /* senza IndexedDB (es. navigazione privata) il catalogo resta solo in memoria */
  }
}
