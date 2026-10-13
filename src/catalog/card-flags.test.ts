import { describe, expect, it } from 'vitest'
import type { BanListEntry } from './ban-list'
import { cardFlags } from './card-flags'
import type { CatalogCard, CatalogPrinting } from './catalog-data'

// Simbolini di stato nelle liste di carte (RIB-97).

const printing = (printId: string, preview?: boolean): CatalogPrinting => ({
  printId,
  rarity: 'C',
  setCode: 'OP-01',
  hasImage: false,
  ...(preview ? { preview } : {}),
})

const card = (cardCode: string, partial: Partial<CatalogCard> = {}): CatalogCard => ({
  cardCode,
  name: cardCode,
  category: 'Character',
  cost: 1,
  life: null,
  power: 1000,
  counter: null,
  colors: ['Red'],
  attributes: [],
  types: [],
  block: '3',
  effect: null,
  trigger: null,
  keywords: [],
  printings: [printing(cardCode)],
  ...partial,
})

let nextId = 1
const entry = (partial: Partial<BanListEntry> & Pick<BanListEntry, 'cardCode' | 'kind'>) => ({
  id: nextId++,
  maxCopies: null,
  pairCode: null,
  effectiveFrom: '2026-09-24',
  source: null,
  ...partial,
})

const ENTRIES: BanListEntry[] = [
  entry({ cardCode: 'OP06-047', kind: 'banned' }),
  entry({ cardCode: 'OP01-001', kind: 'restricted', maxCopies: 1 }),
  entry({ cardCode: 'EB04-058', kind: 'pair', pairCode: 'OP07-115' }),
  entry({ cardCode: 'OP14-020', kind: 'banned', effectiveFrom: '2026-11-01' }),
]

const TODAY = new Date(2026, 9, 13) // 13 ottobre 2026: Standard dal Block 2
const STANDARD = { standard: true }

const flagsOf = (c: CatalogCard, options = STANDARD, p?: CatalogPrinting) =>
  cardFlags(c, p, ENTRIES, TODAY, options)

describe('simbolini di stato', () => {
  it('nessun simbolo per una carta senza niente di particolare', () => {
    expect(flagsOf(card('OP09-001'))).toEqual([])
  })

  it('bandita, limitata e coppia bandita (entrambe le carte)', () => {
    expect(flagsOf(card('OP06-047'))).toEqual([{ kind: 'banned' }])
    expect(flagsOf(card('OP01-001'))).toEqual([{ kind: 'restricted', copies: 1 }])
    expect(flagsOf(card('EB04-058'))).toEqual([{ kind: 'pair', with: ['OP07-115'] }])
    expect(flagsOf(card('OP07-115'))).toEqual([{ kind: 'pair', with: ['EB04-058'] }])
  })

  it('ban futuro: simbolo a parte, la carta non è ancora bandita', () => {
    expect(flagsOf(card('OP14-020'))).toEqual([
      { kind: 'upcoming', ban: 'banned', from: '2026-11-01' },
    ])
  })

  it('anteprima dalla stampa mostrata, o dalla carta se la stampa non c’è', () => {
    expect(flagsOf(card('OP15-001'), STANDARD, printing('OP15-001', true))).toEqual([
      { kind: 'preview' },
    ])
    expect(flagsOf(card('OP15-001', { preview: true }))).toEqual([{ kind: 'preview' }])
  })

  it('fuori Standard solo se richiesto', () => {
    const old = card('ST01-012', { block: '1' })
    expect(flagsOf(old)).toEqual([{ kind: 'notStandard', block: '1', min: 2 }])
    expect(flagsOf(old, { standard: false })).toEqual([])
    expect(flagsOf(card('P-001', { block: 'X' }))).toEqual([])
  })

  it('più simboli insieme, nell’ordine in cui contano', () => {
    const old = card('OP01-001', { block: '1' })
    expect(flagsOf(old).map((f) => f.kind)).toEqual(['restricted', 'notStandard'])
  })
})
