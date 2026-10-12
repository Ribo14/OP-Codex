import { describe, expect, it } from 'vitest'
import { buildPdf, type JpegImage } from './pdf'
import { layoutSheets } from './print-sheet'

const text = (pdf: Uint8Array) => new TextDecoder('latin1').decode(pdf)
const jpeg = (marker: number): JpegImage => ({
  bytes: new Uint8Array([0xff, 0xd8, marker, 0xff, 0xd9]),
  width: 600,
  height: 838,
})

describe('PDF delle carte (RIB-80)', () => {
  const images = new Map([
    ['OP01-016', jpeg(1)],
    ['OP01-016_p9', jpeg(2)],
  ])
  const sheets = layoutSheets([
    { printId: 'OP01-016', copies: 4 },
    { printId: 'OP01-016_p9', copies: 6 },
  ])
  const pdf = buildPdf(sheets, images)
  const body = text(pdf)

  it('un foglio A4 per pagina e ogni immagine incorporata una volta sola', () => {
    expect(body.startsWith('%PDF-1.4\n')).toBe(true)
    expect(body).toContain('/Count 2')
    expect(body.match(/\/Type \/Page /g)).toHaveLength(2)
    expect(body.match(/\/Subtype \/Image/g)).toHaveLength(2)
    // A4 in punti tipografici.
    expect(body).toContain('/MediaBox [0 0 595.28 841.89]')
    expect(body).toContain('/Filter /DCTDecode /Length 5')
  })

  it('le carte misurano 63×88 mm (178,58×249,45 punti)', () => {
    const draws = body.match(/q 178\.58 0 0 249\.45 [\d.]+ [\d.]+ cm \/Im\d+ Do Q/g)
    expect(draws).toHaveLength(10)
    // Prima carta: 7,5 mm da sinistra e 13,5 mm dall'alto; il PDF misura dal basso, quindi
    // il suo bordo inferiore è a 297 − 13,5 − 88 = 195,5 mm.
    expect(draws?.[0]).toBe('q 178.58 0 0 249.45 21.26 554.17 cm /Im3 Do Q')
    expect(body.match(/ 178\.58 249\.45 re S/g)).toHaveLength(10)
  })

  it('la tabella dei riferimenti punta all’inizio di ogni oggetto', () => {
    const xref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(body)?.[1])
    expect(body.slice(xref, xref + 4)).toBe('xref')
    const entries = body.slice(xref).split('\n').slice(3)
    const size = Number(/\/Size (\d+)/.exec(body)?.[1])
    for (let id = 1; id < size; id++) {
      const entry = entries[id - 1] ?? ''
      expect(entry).toMatch(/^\d{10} 00000 n $/)
      const offset = Number(entry.slice(0, 10))
      expect(body.slice(offset, offset + `${String(id)} 0 obj`.length)).toBe(`${String(id)} 0 obj`)
    }
  })

  it('senza l’immagine di una carta si ferma', () => {
    expect(() => buildPdf(layoutSheets([{ printId: 'X', copies: 1 }]), images)).toThrow(/X/)
  })
})
