import { describe, expect, it } from 'vitest'
import {
  mapCardmarket,
  nonEnglishExpansions,
  productCardCode,
  type CardmarketProduct,
  type MapperPrinting,
} from './price-mapper.ts'

// Dati ridotti ma realistici (file pubblici di Cardmarket del 2026-09-27): ogni Set esiste in
// un'espansione inglese e in una non inglese; le Printing di una Card hanno tutte lo stesso nome.

const OP01 = 569101
const PRB01 = 569301
const EN_OP01 = 5229
const JP_OP01 = 5484
const EN_PRB01 = 5805

const product = (idProduct: number, name: string, idExpansion: number): CardmarketProduct => ({
  idProduct,
  name,
  idExpansion,
})

const products: CardmarketProduct[] = [
  product(690368, 'Roronoa Zoro (OP01-001)', EN_OP01),
  product(690369, 'Roronoa Zoro (OP01-001)', EN_OP01),
  product(768234, 'Roronoa Zoro (OP01-001)', JP_OP01),
  product(768236, 'Roronoa Zoro (OP01-001)', JP_OP01),
  product(690370, 'Usopp (OP01-004)', EN_OP01),
  product(768240, 'Usopp (OP01-004)', JP_OP01),
  // La parallela è stata inserita prima della base: la base è la più economica.
  product(690400, 'Nami (OP01-016)', EN_OP01),
  product(690401, 'Nami (OP01-016)', EN_OP01),
  // Tre prodotti per due Printing: non si indovina.
  product(690500, 'Shanks (OP01-120)', EN_OP01),
  product(690501, 'Shanks (OP01-120)', EN_OP01),
  product(690502, 'Shanks (OP01-120)', EN_OP01),
  // Ristampa di OP01-004 in PRB-01.
  product(799100, 'Usopp (OP01-004)', EN_PRB01),
  product(799101, 'Nico Robin (OP01-017)', EN_PRB01),
  product(799102, 'Nami (OP01-016)', EN_PRB01),
  product(799103, 'DON!! (OP01)', EN_PRB01),
]

const trends = new Map([
  [690400, 45.2],
  [690401, 0.3],
])

const printing = (printId: string, seriesId: number): MapperPrinting => ({
  printId,
  cardCode: printId.replace(/_.*/, ''),
  seriesId,
})

const printings: MapperPrinting[] = [
  printing('OP01-001', OP01),
  printing('OP01-001_p1', OP01),
  printing('OP01-004', OP01),
  printing('OP01-016', OP01),
  printing('OP01-016_p1', OP01),
  printing('OP01-120', OP01),
  printing('OP01-120_p1', OP01),
  printing('OP01-004_r1', PRB01),
  printing('OP01-016_r1', PRB01),
  printing('OP01-017_r1', PRB01),
]

const nonEnglish = new Set([JP_OP01])

const map = (overrides = new Map<string, number | null>()) =>
  new Map(
    mapCardmarket({ printings, products, nonEnglish, trends, overrides }).map((m) => [
      m.printId,
      m,
    ]),
  )

describe('productCardCode', () => {
  it('legge il Card Code tra parentesi, anche con spazi', () => {
    expect(productCardCode('Roronoa Zoro (OP01-001)')).toBe('OP01-001')
    expect(productCardCode('Uta ( ST11-001)')).toBe('ST11-001')
    expect(productCardCode('Monkey.D.Luffy (P-001)')).toBe('P-001')
  })

  it('ignora i prodotti senza Card Code', () => {
    expect(productCardCode('DON!! (OP01)')).toBeNull()
    expect(productCardCode('Monkey.D.Luffy')).toBeNull()
    expect(productCardCode('CS25-26 World Final Trophy Card')).toBeNull()
  })
})

describe('nonEnglishExpansions', () => {
  it('riconosce le espansioni non inglesi dai prodotti sigillati', () => {
    const sealed = [
      { name: 'Romance Dawn Booster', idExpansion: EN_OP01 },
      { name: 'Romance Dawn Booster Box', idExpansion: EN_OP01 },
      { name: 'Romance Dawn Booster (Non-English)', idExpansion: JP_OP01 },
      { name: 'Romance Dawn Booster Box (Non-English)', idExpansion: JP_OP01 },
      { name: 'OP17 Booster (Asia Region Legal)', idExpansion: 6723 },
      // The Best: una scatola "Asia" in mezzo a prodotti inglesi non basta.
      { name: 'The Best Booster Box', idExpansion: EN_PRB01 },
      { name: 'The Best Booster', idExpansion: EN_PRB01 },
      { name: 'The Best Booster Box Case (Asia Region Legal)', idExpansion: EN_PRB01 },
    ]
    expect(nonEnglishExpansions(sealed)).toEqual(new Set([JP_OP01, 6723]))
  })
})

describe('mapCardmarket', () => {
  it("abbina base e parallela in ordine, nell'espansione inglese del Set", () => {
    const result = map()
    expect(result.get('OP01-001')).toMatchObject({ productId: 690368, confidence: 'high' })
    expect(result.get('OP01-001_p1')).toMatchObject({ productId: 690369, confidence: 'high' })
    expect(result.get('OP01-004')).toMatchObject({ productId: 690370, source: 'auto' })
  })

  it('la base è il prodotto più economico: se non è il primo, abbinamento da verificare', () => {
    const result = map()
    expect(result.get('OP01-016')).toMatchObject({ productId: 690401, confidence: 'check' })
    expect(result.get('OP01-016_p1')).toMatchObject({ productId: 690400, confidence: 'check' })
  })

  it('senza lo stesso numero di prodotti e Printing non abbina nulla', () => {
    const result = map()
    expect(result.has('OP01-120')).toBe(false)
    expect(result.has('OP01-120_p1')).toBe(false)
  })

  it("le ristampe usano l'espansione del loro Set, non quella d'origine", () => {
    const result = map()
    expect(result.get('OP01-004_r1')?.productId).toBe(799100)
    expect(result.get('OP01-016_r1')?.productId).toBe(799102)
    expect(result.get('OP01-017_r1')?.productId).toBe(799101)
  })

  it('non usa mai prodotti delle espansioni non inglesi', () => {
    const used = new Set([...map().values()].map((m) => m.productId))
    expect(used.has(768234)).toBe(false)
    expect(used.has(768236)).toBe(false)
    expect(used.has(768240)).toBe(false)
  })

  it('i Mapping Override prevalgono sempre, anche per togliere un abbinamento', () => {
    const result = map(
      new Map<string, number | null>([
        ['OP01-001', 690369],
        ['OP01-004', null],
        ['OP01-120', 690502],
      ]),
    )
    expect(result.get('OP01-001')).toEqual({
      printId: 'OP01-001',
      productId: 690369,
      source: 'override',
      confidence: 'high',
    })
    expect(result.has('OP01-004')).toBe(false)
    expect(result.get('OP01-120')).toMatchObject({ productId: 690502, source: 'override' })
  })

  it('un override su un prodotto lo toglie alle Printing abbinate in automatico', () => {
    const result = map(new Map<string, number | null>([['OP01-001', 690369]]))
    // 690369 era la parallela: ora è della base, la parallela resta senza prezzo.
    expect(result.get('OP01-001')?.productId).toBe(690369)
    expect(result.has('OP01-001_p1')).toBe(false)
  })

  it("un'espansione è di un solo Set: uno Starter Deck di ristampe non ruba le carte d'origine", () => {
    // ST-19 ristampa carte di OP-01: la sua espansione ne contiene solo alcune, tante quante
    // quella di OP-01. OP-01 si tiene la sua, ST-19 prende la propria.
    const ST19 = 569019
    const EN_ST19 = 5751
    const result = mapCardmarket({
      printings: [
        ...printings,
        printing('OP01-001_p2', ST19),
        printing('OP01-004_p1', ST19),
        printing('ST19-001', ST19),
      ],
      products: [
        ...products,
        product(751000, 'Usopp (OP01-004)', EN_ST19),
        product(751001, 'Smoker (ST19-001)', EN_ST19),
      ],
      nonEnglish,
      trends,
      overrides: new Map(),
    })
    const byId = new Map(result.map((m) => [m.printId, m.productId]))
    expect(byId.get('OP01-001')).toBe(690368)
    expect(byId.get('OP01-004')).toBe(690370)
    expect(byId.get('OP01-004_p1')).toBe(751000)
    expect(byId.get('ST19-001')).toBe(751001)
    expect(byId.has('OP01-001_p2')).toBe(false)
    const ids = result.map((m) => m.productId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ordina le parallele per numero, non per testo (_p2 prima di _p10)', () => {
    const many: CardmarketProduct[] = Array.from({ length: 11 }, (_, i) =>
      product(900000 + i, 'Luffy (OP01-024)', EN_OP01),
    )
    const printingsOf = [
      'OP01-024',
      ...Array.from({ length: 10 }, (_, i) => `OP01-024_p${String(i + 1)}`),
    ]
    const result = mapCardmarket({
      printings: printingsOf.map((id) => printing(id, OP01)),
      products: many,
      nonEnglish,
      trends: new Map(),
      overrides: new Map(),
    })
    const byId = new Map(result.map((m) => [m.printId, m.productId]))
    expect(byId.get('OP01-024_p2')).toBe(900002)
    expect(byId.get('OP01-024_p10')).toBe(900010)
  })
})
