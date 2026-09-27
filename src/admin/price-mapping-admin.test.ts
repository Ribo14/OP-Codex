import { describe, expect, it } from 'vitest'
import {
  choiceOf,
  mappingQueue,
  printingStatus,
  type MappingRow,
  type OverrideRow,
} from './price-mapping-admin'

// Area Admin, abbinamenti dei prezzi (RIB-32, slice 5.2): coda delle carte da controllare e stato
// di ogni Printing.

const mapping = (print_id: string, confidence: 'high' | 'check', source = 'auto'): MappingRow => ({
  print_id,
  product_id: 1,
  source,
  confidence,
})

describe('printingStatus', () => {
  it('distingue abbinamento sicuro, da verificare, mancante, corretto a mano ed escluso', () => {
    expect(printingStatus(mapping('A', 'high'), undefined)).toBe('ok')
    expect(printingStatus(mapping('A', 'check'), undefined)).toBe('check')
    expect(printingStatus(undefined, undefined)).toBe('missing')
    const override: OverrideRow = { print_id: 'A', product_id: 5, note: null }
    expect(printingStatus(mapping('A', 'high', 'override'), override)).toBe('override')
    expect(printingStatus(undefined, { ...override, product_id: null })).toBe('excluded')
  })

  it('un override appena salvato vale anche prima del prossimo Price Sync', () => {
    const override: OverrideRow = { print_id: 'A', product_id: 5, note: null }
    expect(printingStatus(undefined, override)).toBe('override')
    expect(printingStatus(mapping('A', 'check'), override)).toBe('override')
  })
})

describe('choiceOf', () => {
  it('senza override è "auto"; con override il prodotto o "none"', () => {
    expect(choiceOf(undefined)).toBe('auto')
    expect(choiceOf({ print_id: 'A', product_id: 7, note: null })).toBe('7')
    expect(choiceOf({ print_id: 'A', product_id: null, note: null })).toBe('none')
  })
})

describe('mappingQueue', () => {
  const printings = [
    { printId: 'OP01-001', cardCode: 'OP01-001' },
    { printId: 'OP01-001_p1', cardCode: 'OP01-001' },
    { printId: 'OP01-016', cardCode: 'OP01-016' },
    { printId: 'OP01-016_p1', cardCode: 'OP01-016' },
    { printId: 'P-001', cardCode: 'P-001' },
    { printId: 'P-001_p1', cardCode: 'P-001' },
    { printId: 'P-001_p2', cardCode: 'P-001' },
    { printId: 'ST01-001', cardCode: 'ST01-001' },
  ]
  const mappings = new Map([
    ['OP01-001', mapping('OP01-001', 'high')],
    ['OP01-001_p1', mapping('OP01-001_p1', 'high')],
    ['OP01-016', mapping('OP01-016', 'check')],
    ['OP01-016_p1', mapping('OP01-016_p1', 'check')],
  ])
  const overrides = new Map<string, OverrideRow>([
    ['ST01-001', { print_id: 'ST01-001', product_id: null, note: 'Nessuna versione inglese' }],
  ])

  it('elenca per carta le Printing da verificare', () => {
    expect(mappingQueue(printings, mappings, overrides, 'check')).toEqual([
      { cardCode: 'OP01-016', count: 2 },
    ])
  })

  it('elenca per carta le Printing senza prezzo, le più numerose prima; le escluse a mano no', () => {
    expect(mappingQueue(printings, mappings, overrides, 'missing')).toEqual([
      { cardCode: 'P-001', count: 3 },
    ])
  })
})
