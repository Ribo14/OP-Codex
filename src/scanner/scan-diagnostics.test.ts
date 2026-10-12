import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearCrops,
  cropsZip,
  diagnosticsEnabled,
  listCrops,
  MAX_CROPS,
  saveCrop,
  setDiagnosticsEnabled,
} from './scan-diagnostics'

const crop = (n: number) => ({
  image: new Blob([new Uint8Array([n])], { type: 'image/png' }),
  text: `testo ${String(n)}`,
  glare: 0.123,
  detected: n % 2 === 0,
  at: Date.UTC(2026, 9, 12, 10, 0, n),
})

describe('diagnostica dello Scanner (RIB-87)', () => {
  beforeEach(async () => {
    await clearCrops()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('spenta di default; l’interruttore vale su questo dispositivo', () => {
    expect(diagnosticsEnabled()).toBe(false)
    setDiagnosticsEnabled(true)
    expect(diagnosticsEnabled()).toBe(true)
    setDiagnosticsEnabled(false)
    expect(diagnosticsEnabled()).toBe(false)
  })

  it(`tiene al massimo ${String(MAX_CROPS)} ritagli, i più recenti`, async () => {
    for (let n = 0; n < MAX_CROPS + 3; n++) await saveCrop(crop(n))
    const crops = await listCrops()
    expect(crops).toHaveLength(MAX_CROPS)
    expect(crops[0]?.text).toBe('testo 3')
    await clearCrops()
    expect(await listCrops()).toEqual([])
  })

  it('lo zip contiene le immagini e un indice leggibile', async () => {
    const zip = await cropsZip([crop(1), crop(2)])
    const text = new TextDecoder('latin1').decode(new Uint8Array(await zip.arrayBuffer()))
    expect(text).toContain('ritaglio-01.png')
    expect(text).toContain('ritaglio-02.png')
    expect(text).toContain('indice.json')
    expect(text).toContain('"text": "testo 2"')
    expect(text).toContain('"glare": 0.12')
  })
})
