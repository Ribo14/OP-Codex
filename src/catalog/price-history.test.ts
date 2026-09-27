import { describe, expect, it } from 'vitest'
import { chartGeometry, nearestIndex } from './price-history'

// Grafico dell'andamento del prezzo (RIB-32, slice 5.3): geometria pura, senza DOM.

const points = [
  { day: '2026-09-01', trend: 10 },
  { day: '2026-09-02', trend: 12 },
  { day: '2026-09-04', trend: 8 },
]

describe('chartGeometry', () => {
  const g = chartGeometry(points, { width: 300, height: 100, padding: 10 })

  it('mette i giorni in proporzione sull’asse x (il 3 settembre manca)', () => {
    expect(g.xs).toEqual([10, 10 + 280 / 3, 290])
  })

  it('il prezzo più alto in alto, il più basso in basso', () => {
    expect(g.ys[1]).toBe(10)
    expect(g.ys[2]).toBe(90)
    expect(g.min).toBe(8)
    expect(g.max).toBe(12)
  })

  it('traccia la linea e l’area fino al fondo', () => {
    expect(g.line.startsWith('M10,')).toBe(true)
    expect(g.line.split('L')).toHaveLength(3)
    expect(g.area.endsWith('Z')).toBe(true)
  })

  it('con un prezzo sempre uguale la linea sta a metà', () => {
    const flat = chartGeometry(
      [
        { day: '2026-09-01', trend: 5 },
        { day: '2026-09-02', trend: 5 },
      ],
      { width: 300, height: 100, padding: 10 },
    )
    expect(flat.ys).toEqual([50, 50])
  })
})

describe('nearestIndex', () => {
  it('trova il punto più vicino alla x del puntatore', () => {
    const xs = [10, 100, 290]
    expect(nearestIndex(xs, 0)).toBe(0)
    expect(nearestIndex(xs, 60)).toBe(1)
    expect(nearestIndex(xs, 200)).toBe(2)
    expect(nearestIndex([], 50)).toBe(-1)
  })
})
