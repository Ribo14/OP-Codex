import { describe, expect, it } from 'vitest'
import type { OcrLayout } from './ocr'
import { ATTEMPTS, readCascade } from './scan-cascade'

const CODES = new Set(['OP17-048', 'OP17-040'])
const ZONES = {
  app: { x: 0, y: 0, width: 10, height: 10 },
  wide: { x: 0, y: 0, width: 20, height: 20 },
}

/** Un OCR finto: per ogni tentativo il testo indicato. */
function fakeOcr(texts: string[]) {
  const calls: string[] = []
  const read = (zone: { width: number }, layout: OcrLayout) => {
    calls.push(`${zone.width === 10 ? 'app' : 'wide'}/${layout}`)
    return Promise.resolve(texts[calls.length - 1] ?? '')
  }
  return { read, calls }
}

describe('cascata di letture (RIB-84)', () => {
  it('si ferma al primo tentativo che trova un codice del catalogo', async () => {
    const ocr = fakeOcr(['OP17-04 SR', 'LIFE OP17-048 SR 5', 'mai letto'])
    const result = await readCascade(ocr.read, ZONES, CODES)
    expect(result).toMatchObject({ found: ['OP17-048'], attempts: 2 })
    expect(ocr.calls).toEqual(['app/block', 'wide/block'])
  })

  it('senza codici prova tutti i tentativi, nell’ordine misurato sulle foto', async () => {
    const ocr = fakeOcr(['', 'OP99-999', 'niente'])
    const result = await readCascade(ocr.read, ZONES, CODES)
    expect(result).toMatchObject({ found: [], attempts: ATTEMPTS.length, text: 'niente' })
    expect(ocr.calls).toEqual(['app/block', 'wide/block', 'wide/sparse'])
  })
})
