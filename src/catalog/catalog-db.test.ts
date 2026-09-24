import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { readSnapshot, writeSnapshot } from './catalog-db'
import type { CatalogSnapshot } from './catalog-sync'

const SNAPSHOT: CatalogSnapshot = {
  sets: [{ series_id: 1, code: 'OP-01', name: 'ROMANCE DAWN', updated_at: '2026-09-20T00:00:00Z' }],
  cards: [],
  printings: [],
  watermark: '2026-09-20T00:00:00Z',
  checkedAt: 1000,
}

describe('copia del catalogo in IndexedDB', () => {
  it('senza copia salvata restituisce null, poi rilegge quella scritta', async () => {
    expect(await readSnapshot()).toBeNull()
    await writeSnapshot(SNAPSHOT)
    expect(await readSnapshot()).toEqual(SNAPSHOT)
    await writeSnapshot({ ...SNAPSHOT, checkedAt: 2000 })
    expect((await readSnapshot())?.checkedAt).toBe(2000)
  })

  it('se la connessione a IndexedDB si è persa, riapre e legge comunque la copia', async () => {
    await writeSnapshot(SNAPSHOT)
    const get = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => {
      throw new DOMException('Connection to Indexed Database server lost', 'UnknownError')
    })
    expect(await readSnapshot()).toEqual(SNAPSHOT)
    expect(get).toHaveBeenCalledTimes(2)
    get.mockRestore()
  })
})
