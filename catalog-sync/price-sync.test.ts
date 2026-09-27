import { describe, expect, it } from 'vitest'
import { parseCardmarketFiles } from './price-sync.ts'

// Controllo dei file pubblici di Cardmarket (RIB-32): se il formato cambia il job deve fallire
// prima di scrivere, con un messaggio chiaro.

const many = <T>(n: number, make: (i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(i))

const raw = () => ({
  priceGuide: {
    version: 1,
    createdAt: '2026-09-27T02:44:48+0200',
    priceGuides: [
      { idProduct: 1, idCategory: 1621, avg: 2.34, low: 0.5, trend: 2.16, 'trend-foil': 0 },
      { idProduct: 2, idCategory: 1621, low: null, trend: 0 },
      { idProduct: 3, idCategory: 1621, low: 0.123, trend: 12759.994 },
      ...many(1000, (i) => ({ idProduct: 10 + i, low: 1, trend: 1 })),
    ],
  },
  singles: {
    products: [
      { idProduct: 1, name: 'Roronoa Zoro (OP01-001)', idExpansion: 5229, dateAdded: 'x' },
      { idProduct: 2, name: 'senza espansione' },
      ...many(1000, (i) => ({
        idProduct: 10 + i,
        name: `Carta (OP01-${String(i)})`,
        idExpansion: 1,
      })),
    ],
  },
  nonSingles: { products: [{ idProduct: 9, name: 'Romance Dawn Booster', idExpansion: 5229 }] },
})

describe('parseCardmarketFiles', () => {
  it('tiene solo i campi usati; prezzi assenti o a zero diventano null, in centesimi', () => {
    const files = parseCardmarketFiles(raw())
    expect(files.priceDate).toBe('2026-09-27')
    expect(files.prices.slice(0, 3)).toEqual([
      { idProduct: 1, trend: 2.16, low: 0.5 },
      { idProduct: 2, trend: null, low: null },
      { idProduct: 3, trend: 12759.99, low: 0.12 },
    ])
    expect(files.singles[0]).toEqual({
      idProduct: 1,
      name: 'Roronoa Zoro (OP01-001)',
      idExpansion: 5229,
    })
    expect(files.singles.some((p) => p.idProduct === 2)).toBe(false)
    expect(files.sealed).toEqual([
      { idProduct: 9, name: 'Romance Dawn Booster', idExpansion: 5229 },
    ])
  })

  it('fallisce se manca la data del listino', () => {
    const files = raw()
    delete (files.priceGuide as Partial<typeof files.priceGuide>).createdAt
    expect(() => parseCardmarketFiles(files)).toThrow(/createdAt/)
  })

  it('fallisce se un file ha cambiato struttura', () => {
    expect(() => parseCardmarketFiles({ ...raw(), singles: { items: [] } })).toThrow(/products/)
    expect(() => parseCardmarketFiles({ ...raw(), priceGuide: [] })).toThrow(/createdAt/)
  })

  it('fallisce se i file sono quasi vuoti', () => {
    const files = raw()
    files.priceGuide.priceGuides = files.priceGuide.priceGuides.slice(0, 10)
    expect(() => parseCardmarketFiles(files)).toThrow(/solo 10 prezzi/)
  })
})
