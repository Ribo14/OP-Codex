import { describe, expect, it } from 'vitest'
import { imageUrlPattern, runtimeCaching } from './runtime-caching.ts'

const BASE = 'https://khxjggxukrodbnczoryn.supabase.co/storage/v1/object/public/card-images'

describe('cache delle immagini', () => {
  it('riconosce miniature e immagini grandi, ognuna nella sua cache', () => {
    expect(imageUrlPattern('thumb').test(`${BASE}/thumb/OP01-001.webp`)).toBe(true)
    expect(imageUrlPattern('thumb').test(`${BASE}/thumb/OP01-001_p1.webp`)).toBe(true)
    expect(imageUrlPattern('thumb').test(`${BASE}/full/OP01-001.webp`)).toBe(false)
    expect(imageUrlPattern('full').test(`${BASE}/full/OP01-001_r1.webp`)).toBe(true)
    // Supabase locale
    expect(
      imageUrlPattern('thumb').test(
        'http://127.0.0.1:54321/storage/v1/object/public/card-images/thumb/OP01-001.webp',
      ),
    ).toBe(true)
  })

  it('ignora le altre richieste a Supabase', () => {
    const thumb = imageUrlPattern('thumb')
    expect(thumb.test('https://x.supabase.co/rest/v1/cards?select=*')).toBe(false)
    expect(thumb.test('https://x.supabase.co/storage/v1/object/public/altro/thumb/a.webp')).toBe(
      false,
    )
    expect(thumb.test(`http://evil.example/?u=${BASE}/thumb/OP01-001.webp`)).toBe(false)
  })

  it('le cache bastano per tutto il catalogo (~4.900 Printing), come chiede "Scarica tutte"', () => {
    for (const entry of runtimeCaching) {
      expect(entry.options?.expiration?.maxEntries).toBeGreaterThanOrEqual(6000)
    }
  })

  it('usa CacheFirst con un limite di voci e senza risposte opache', () => {
    expect(runtimeCaching).toHaveLength(2)
    for (const entry of runtimeCaching) {
      expect(entry.handler).toBe('CacheFirst')
      expect(entry.options?.expiration?.maxEntries).toBeGreaterThan(0)
      expect(entry.options?.expiration?.purgeOnQuotaError).toBe(true)
      expect(entry.options?.cacheableResponse?.statuses).toEqual([200])
    }
  })
})
