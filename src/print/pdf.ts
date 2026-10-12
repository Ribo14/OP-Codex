import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  type PlacedCard,
} from './print-sheet'

// Stampa delle carte (RIB-80): un PDF minimo scritto a mano, senza librerie. Contiene solo
// immagini JPEG (che il PDF incorpora così come sono, filtro DCTDecode) e le linee di taglio:
// poche righe di formato, nessuna dipendenza in più da scaricare e da tenere aggiornata.

/** Un'immagine JPEG già pronta: i byte del file e le sue dimensioni in pixel. */
export interface JpegImage {
  bytes: Uint8Array
  width: number
  height: number
}

const PT_PER_MM = 72 / 25.4
const pt = (mm: number) => (mm * PT_PER_MM).toFixed(2)
/** Grigio chiaro e sottile delle linee di taglio: si vede sul bianco, non disturba la carta. */
const CUT_LINE = '0.6 G 0.3 w'

const encoder = new TextEncoder()

/**
 * Il PDF con un foglio A4 per ogni elemento di `sheets`; ogni Print ID deve avere la sua
 * immagine in `images`. Ogni immagine si incorpora una volta sola anche se stampata più volte.
 */
export function buildPdf(
  sheets: readonly (readonly PlacedCard[])[],
  images: ReadonlyMap<string, JpegImage>,
): Uint8Array {
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const write = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length
    write(`${String(id)} 0 obj\n${body}\n`)
    if (stream) {
      write('stream\n')
      write(stream)
      write('\nendstream\n')
    }
    write('endobj\n')
  }

  // Numeri degli oggetti: 1 catalogo, 2 elenco delle pagine, poi le immagini, poi per ogni
  // foglio la pagina e il suo contenuto.
  const used = [...new Set(sheets.flat().map((card) => card.printId))]
  const imageIds = new Map(used.map((printId, i) => [printId, 3 + i]))
  const firstPage = 3 + used.length
  const pageIds = sheets.map((_, i) => firstPage + i * 2)

  // Intestazione; la seconda riga con byte oltre 127 dice ai programmi che il file è binario.
  write('%PDF-1.4\n')
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(' ')}] /Count ${String(sheets.length)} >>`,
  )

  for (const printId of used) {
    const image = images.get(printId)
    if (!image) throw new Error(`Immagine mancante: ${printId}`)
    object(
      imageIds.get(printId) ?? 0,
      `<< /Type /XObject /Subtype /Image /Width ${String(image.width)} /Height ${String(image.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${String(image.bytes.length)} >>`,
      image.bytes,
    )
  }

  sheets.forEach((sheet, i) => {
    const pageId = pageIds[i] ?? 0
    const resources = [...new Set(sheet.map((card) => card.printId))]
      .map((printId) => `/Im${String(imageIds.get(printId))} ${String(imageIds.get(printId))} 0 R`)
      .join(' ')
    const width = pt(CARD_WIDTH_MM)
    const height = pt(CARD_HEIGHT_MM)
    // Il PDF misura dal basso: si ribalta la y.
    const bottom = (card: PlacedCard) => pt(PAGE_HEIGHT_MM - card.y - CARD_HEIGHT_MM)
    const content = encoder.encode(
      [
        ...sheet.map(
          (card) =>
            `q ${width} 0 0 ${height} ${pt(card.x)} ${bottom(card)} cm /Im${String(imageIds.get(card.printId))} Do Q`,
        ),
        `q ${CUT_LINE}`,
        ...sheet.map((card) => `${pt(card.x)} ${bottom(card)} ${width} ${height} re S`),
        'Q',
      ].join('\n'),
    )
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(PAGE_WIDTH_MM)} ${pt(PAGE_HEIGHT_MM)}] /Resources << /XObject << ${resources} >> >> /Contents ${String(pageId + 1)} 0 R >>`,
    )
    object(pageId + 1, `<< /Length ${String(content.length)} >>`, content)
  })

  // Tabella dei riferimenti: righe di 20 byte esatti con la posizione di ogni oggetto.
  const size = firstPage + sheets.length * 2
  const xref = length
  write(`xref\n0 ${String(size)}\n0000000000 65535 f \n`)
  for (let id = 1; id < size; id++) {
    write(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`)
  }
  write(`trailer\n<< /Size ${String(size)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`)

  const pdf = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    pdf.set(chunk, at)
    at += chunk.length
  }
  return pdf
}
