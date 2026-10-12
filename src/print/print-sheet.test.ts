import { describe, expect, it } from 'vitest'
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  layoutSheets,
  MARGIN_X_MM,
  MARGIN_Y_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  sheetCount,
  totalCopies,
} from './print-sheet'

describe('impaginazione su A4 (RIB-80)', () => {
  it('9 carte per foglio, 3×3, con 3 mm di spazio e la griglia centrata', () => {
    const [sheet] = layoutSheets([{ printId: 'OP01-016', copies: 9 }])
    expect(sheet).toHaveLength(9)
    expect(MARGIN_X_MM).toBeCloseTo(7.5)
    expect(MARGIN_Y_MM).toBeCloseTo(13.5)
    expect(sheet?.map((c) => [c.x, c.y])).toEqual([
      [7.5, 13.5],
      [73.5, 13.5],
      [139.5, 13.5],
      [7.5, 104.5],
      [73.5, 104.5],
      [139.5, 104.5],
      [7.5, 195.5],
      [73.5, 195.5],
      [139.5, 195.5],
    ])
    // L'ultima carta finisce dentro il foglio con lo stesso margine dell'inizio.
    const last = sheet?.at(-1)
    expect(PAGE_WIDTH_MM - ((last?.x ?? 0) + CARD_WIDTH_MM)).toBeCloseTo(MARGIN_X_MM)
    expect(PAGE_HEIGHT_MM - ((last?.y ?? 0) + CARD_HEIGHT_MM)).toBeCloseTo(MARGIN_Y_MM)
  })

  it('le copie della stessa carta restano vicine, nell’ordine della lista', () => {
    const sheets = layoutSheets([
      { printId: 'A', copies: 4 },
      { printId: 'B', copies: 0 },
      { printId: 'C', copies: 7 },
    ])
    expect(sheets.map((s) => s.map((c) => c.printId).join(''))).toEqual(['AAAACCCCC', 'CC'])
  })

  it('conta carte e fogli; niente carte, niente fogli', () => {
    const items = [
      { printId: 'A', copies: 4 },
      { printId: 'B', copies: 6 },
    ]
    expect(totalCopies(items)).toBe(10)
    expect(sheetCount(items)).toBe(2)
    expect(sheetCount([{ printId: 'A', copies: 9 }])).toBe(1)
    expect(sheetCount([])).toBe(0)
    expect(layoutSheets([{ printId: 'A', copies: -1 }])).toEqual([])
  })
})
