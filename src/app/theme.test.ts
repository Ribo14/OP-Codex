import { describe, expect, it } from 'vitest'
import { isDark, nextPreference, readPreference, THEME_STORAGE_KEY, writePreference } from './theme'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

const brokenStorage = {
  getItem: () => {
    throw new Error('bloccato')
  },
  setItem: () => {
    throw new Error('bloccato')
  },
  removeItem: () => {
    throw new Error('bloccato')
  },
}

describe('tema', () => {
  it('segue il sistema finché non si sceglie a mano', () => {
    expect(isDark('system', true)).toBe(true)
    expect(isDark('system', false)).toBe(false)
    expect(isDark('dark', false)).toBe(true)
    expect(isDark('light', true)).toBe(false)
  })

  it('il pulsante passa da Sistema a Chiaro a Scuro e ricomincia', () => {
    expect(nextPreference('system')).toBe('light')
    expect(nextPreference('light')).toBe('dark')
    expect(nextPreference('dark')).toBe('system')
  })

  it('la scelta si salva sul dispositivo e sopravvive al riavvio', () => {
    const storage = memoryStorage()
    writePreference(storage, 'dark')
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(readPreference(storage)).toBe('dark')

    writePreference(storage, 'system')
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false)
    expect(readPreference(storage)).toBe('system')
  })

  it('valori sconosciuti o storage bloccato: si segue il sistema senza errori', () => {
    expect(readPreference(memoryStorage({ [THEME_STORAGE_KEY]: 'viola' }))).toBe('system')
    expect(readPreference(brokenStorage)).toBe('system')
    expect(() => {
      writePreference(brokenStorage, 'dark')
    }).not.toThrow()
  })
})
