import { describe, expect, it } from 'vitest'
import type { CatalogCard, CatalogSet } from '@/catalog/catalog-data'
import type { CollectionEntry } from './collection'
import { percent, setCompletion } from './set-completion'

const card = (cardCode: string, printings: [string, string][]): CatalogCard => ({
  cardCode,
  name: cardCode,
  category: 'Character',
  cost: 1,
  life: null,
  power: null,
  counter: null,
  colors: ['Red'],
  attributes: [],
  types: [],
  block: '1',
  effect: null,
  trigger: null,
  keywords: [],
  printings: printings.map(([printId, setCode]) => ({
    printId,
    setCode,
    rarity: 'C',
    hasImage: true,
  })),
})

const SETS: CatalogSet[] = [
  { seriesId: 569101, code: 'OP-01', name: 'Romance Dawn' },
  { seriesId: 569301, code: 'PRB-01', name: 'The Best' },
  { seriesId: 569102, code: 'OP-02', name: 'Paramount War' },
]

const CARDS = [
  // Base e parallel in OP-01, ristampa in PRB-01.
  card('OP01-006', [
    ['OP01-006', 'OP-01'],
    ['OP01-006_p1', 'OP-01'],
    ['OP01-006_r1', 'PRB-01'],
  ]),
  card('OP01-007', [['OP01-007', 'OP-01']]),
  card('OP01-008', [['OP01-008', 'OP-01']]),
  card('PRB01-001', [['PRB01-001', 'PRB-01']]),
]

const own = (...printIds: string[]): CollectionEntry[] =>
  printIds.map((printId) => ({ printId, language: 'EN', quantity: 1, updatedAt: '' }))

const rows = (entries: CollectionEntry[]) =>
  setCompletion(CARDS, SETS, entries).map((r) => [r.set.code, r.owned, r.total])

describe('completamento dei Set', () => {
  it('conta le Card distinte del Set, dal Set più recente; i Set vuoti non compaiono', () => {
    expect(rows([])).toEqual([
      ['PRB-01', 0, 2],
      ['OP-01', 0, 3],
    ])
  })

  it('più Printing della stessa Card nello stesso Set contano una volta', () => {
    expect(rows(own('OP01-006', 'OP01-006_p1', 'OP01-007'))).toEqual([
      ['PRB-01', 0, 2],
      ['OP-01', 2, 3],
    ])
  })

  it('una ristampa conta solo nel Set in cui è stata pubblicata', () => {
    expect(rows(own('OP01-006_r1'))).toEqual([
      ['PRB-01', 1, 2],
      ['OP-01', 0, 3],
    ])
    // Più lingue della stessa Printing: sempre una Card.
    const japanese: CollectionEntry = {
      printId: 'OP01-008',
      language: 'JP',
      quantity: 2,
      updatedAt: '',
    }
    expect(rows([...own('OP01-008'), japanese])).toEqual([
      ['PRB-01', 0, 2],
      ['OP-01', 1, 3],
    ])
  })

  it('percentuale per difetto: 100% solo a Set completo', () => {
    expect(percent({ owned: 2, total: 3 })).toBe(66)
    expect(percent({ owned: 119, total: 120 })).toBe(99)
    expect(percent({ owned: 3, total: 3 })).toBe(100)
    expect(percent({ owned: 0, total: 0 })).toBe(0)
  })
})
