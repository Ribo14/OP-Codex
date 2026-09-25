import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPersonal, readPersonal, withOfflineCopy, writePersonal } from './personal-cache'

describe('copia locale dei dati personali', () => {
  beforeEach(async () => {
    await clearPersonal()
  })

  it('salva e rilegge per lo stesso utente, mai per un altro', async () => {
    await writePersonal('collection', 'anna', [{ printId: 'OP01-001', quantity: 2 }])
    expect(await readPersonal('collection', 'anna')).toEqual([{ printId: 'OP01-001', quantity: 2 }])
    expect(await readPersonal('collection', 'bruno')).toBeNull()
    expect(await readPersonal('decks', 'anna')).toBeNull()
  })

  it('all’uscita non resta nessun dato personale', async () => {
    await writePersonal('profile', 'anna', { username: 'Anna' })
    await writePersonal('collection', 'anna', [])
    await writePersonal('decks', 'anna', [])
    await clearPersonal()
    for (const key of ['profile', 'collection', 'decks'] as const) {
      expect(await readPersonal(key, 'anna')).toBeNull()
    }
  })

  it('online salva la copia; offline restituisce la copia salvata', async () => {
    expect(await withOfflineCopy('decks', 'anna', () => Promise.resolve(['mazzo']))).toEqual([
      'mazzo',
    ])
    const offline = () => Promise.reject(new Error('Failed to fetch'))
    expect(await withOfflineCopy('decks', 'anna', offline)).toEqual(['mazzo'])
  })

  it('già offline usa subito la copia, senza provare la rete', async () => {
    await writePersonal('decks', 'anna', ['salvato'])
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const load = vi.fn(() => Promise.resolve(['dal server']))
    expect(await withOfflineCopy('decks', 'anna', load)).toEqual(['salvato'])
    expect(load).not.toHaveBeenCalled()
    online.mockRestore()
  })

  it('offline e senza copia, l’errore resta quello del server', async () => {
    await expect(
      withOfflineCopy('decks', 'bruno', () => Promise.reject(new Error('Failed to fetch'))),
    ).rejects.toThrow('Failed to fetch')
  })
})
