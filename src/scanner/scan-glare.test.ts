import { describe, expect, it } from 'vitest'
import { FrameStack, fuseMin, GLARE_THRESHOLD, glareFraction } from './scan-glare'

// Una "zona del codice" di 10×1 pixel: testo bianco (230) su fascia scura (40).
const TEXT = [40, 230, 230, 40, 40, 230, 40, 40, 230, 40]
/** La stessa zona con un riflesso (255) che copre i pixel da `from` a `to`. */
const withGlare = (from: number, to: number) =>
  Uint8Array.from(TEXT.map((v, i) => (i >= from && i <= to ? 255 : v)))

describe('riflessi (RIB-86)', () => {
  it('misura la parte di pixel bruciati', () => {
    expect(glareFraction(Uint8Array.from(TEXT))).toBe(0)
    expect(glareFraction(withGlare(0, 4))).toBeCloseTo(0.5)
    expect(glareFraction(withGlare(0, 4))).toBeGreaterThan(GLARE_THRESHOLD)
    expect(glareFraction(new Uint8Array(0))).toBe(0)
  })

  it('la fusione col minimo cancella un riflesso che si sposta e lascia il testo', () => {
    expect([...fuseMin([withGlare(0, 3), withGlare(4, 7), withGlare(6, 9)])]).toEqual(TEXT)
    // Un riflesso fermo nello stesso punto in tutti i fotogrammi resta (serve inclinare la carta).
    expect([...fuseMin([withGlare(0, 1), withGlare(0, 1)])].slice(0, 2)).toEqual([255, 255])
  })

  it('la pila tiene gli ultimi fotogrammi della stessa dimensione', () => {
    const stack = new FrameStack(TEXT.length, 2)
    stack.push(withGlare(0, 3))
    stack.push(new Uint8Array(3))
    stack.push(withGlare(4, 7))
    stack.push(withGlare(6, 9))
    expect(stack.length).toBe(2)
    // Il primo è uscito: restano i riflessi 4–7 e 6–9; solo i pixel 6–7 sono coperti in entrambi.
    expect([...stack.fused()]).toEqual(TEXT.map((v, i) => (i === 6 || i === 7 ? 255 : v)))
    stack.clear()
    expect(stack.length).toBe(0)
  })
})
