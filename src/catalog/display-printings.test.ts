import { describe, expect, it } from 'vitest'
import { pickDisplayPrintings, type SetPrinting } from './display-printings'

const p = (printId: string, name = 'X'): SetPrinting => ({
  printId,
  cardCode: printId.split('_')[0] ?? printId,
  name,
})

describe('pickDisplayPrintings', () => {
  it('mostra una sola Printing per Card Code, preferendo la base', () => {
    const result = pickDisplayPrintings([p('OP01-001_p1'), p('OP01-002'), p('OP01-001')])
    expect(result.map((x) => x.printId)).toEqual(['OP01-001', 'OP01-002'])
  })

  it('senza Printing base usa la prima per Print ID', () => {
    const result = pickDisplayPrintings([p('OP01-006_r1'), p('OP01-006_p4'), p('OP01-006_p3')])
    expect(result.map((x) => x.printId)).toEqual(['OP01-006_p3'])
  })

  it('ordina per Card Code', () => {
    const result = pickDisplayPrintings([p('ST01-001'), p('OP01-016_p8'), p('OP01-001')])
    expect(result.map((x) => x.cardCode)).toEqual(['OP01-001', 'OP01-016', 'ST01-001'])
  })
})
