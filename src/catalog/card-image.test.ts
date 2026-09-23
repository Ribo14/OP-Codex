import { describe, expect, it } from 'vitest'
import { cardImageUrl } from './card-image'

describe('cardImageUrl', () => {
  it('costruisce l’URL della Printing base e delle varianti', () => {
    expect(cardImageUrl('OP01-001')).toBe('/card-images/OP01-001.png')
    expect(cardImageUrl('OP01-001_p1')).toBe('/card-images/OP01-001_p1.png')
    expect(cardImageUrl('OP01-006_r1')).toBe('/card-images/OP01-006_r1.png')
    expect(cardImageUrl('P-014_p2')).toBe('/card-images/P-014_p2.png')
  })

  it('rifiuta tutto ciò che non è un Print ID', () => {
    for (const bad of [
      '',
      '../secret',
      'OP01-001.png',
      'OP01-001?x=1',
      'op01-001',
      'OP01-001_x1',
    ]) {
      expect(() => cardImageUrl(bad)).toThrow('Print ID non valido')
    }
  })
})
