import { describe, expect, it } from 'vitest'
import { detectCard, scaleRect, toGray, type Gray } from './card-detect'

// Immagini sintetiche: un tavolo con un po' di rumore e una carta (63×88) chiara col bordo netto,
// con dentro un'"illustrazione" più scura che ha anche lei un bordo rettangolare.

/** Generatore pseudo-casuale ripetibile. */
function random(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function scene(card: { x: number; y: number; h: number } | null, width = 270, height = 360): Gray {
  const rand = random(7)
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) data[i] = 150 + Math.round(rand() * 20)
  if (card) {
    const w = Math.round(card.h * (63 / 88))
    for (let y = card.y; y < card.y + card.h; y++) {
      for (let x = card.x; x < card.x + w; x++) {
        // Illustrazione: un rettangolo interno con proporzioni da carta, più scuro.
        const art =
          x > card.x + w * 0.1 &&
          x < card.x + w * 0.62 &&
          y > card.y + card.h * 0.12 &&
          y < card.y + card.h * 0.55
        data[y * width + x] = art ? 70 : 235
      }
    }
  }
  return { data, width, height }
}

describe('ritaglio dinamico: trovare la carta (RIB-85)', () => {
  it('trova la carta anche fuori centro, e non il rettangolo dell’illustrazione', () => {
    const found = detectCard(scene({ x: 20, y: 30, h: 250 }))
    expect(found).not.toBeNull()
    expect(found?.x).toBeCloseTo(20, -1)
    expect(found?.y).toBeCloseTo(30, -1)
    expect(found?.height).toBeCloseTo(250, -1)
    expect(found?.score).toBeGreaterThan(0.8)
  })

  it('senza carta, o con una carta troppo piccola, non trova niente', () => {
    expect(detectCard(scene(null))).toBeNull()
    expect(detectCard(scene({ x: 100, y: 100, h: 60 }))).toBeNull()
  })

  it('da RGBA a grigi con riduzione, e ritorno alla scala del video', () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 9, 9, 9, 255,
    ])
    const gray = toGray(rgba, 2, 2, 1)
    expect([...gray.data]).toEqual([76, 149, 28, 9])
    expect(toGray(rgba, 2, 2, 2).data).toHaveLength(1)
    expect(scaleRect({ x: 1, y: 2, width: 3, height: 4 }, 4)).toEqual({
      x: 4,
      y: 8,
      width: 12,
      height: 16,
    })
  })
})
