import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_X_MM,
  MARGIN_Y_MM,
  PAGE_WIDTH_MM,
  type PlacedCard,
} from './print-sheet'

// Stampa delle carte (RIB-80): un PDF minimo scritto a mano, senza librerie. Contiene solo
// immagini JPEG (che il PDF incorpora così come sono, filtro DCTDecode), le linee di taglio e una
// linea di controllo della scala:
// poche righe di formato, nessuna dipendenza in più da scaricare e da tenere aggiornata.

/** Un'immagine JPEG già pronta: i byte del file e le sue dimensioni in pixel. */
export interface JpegImage {
  bytes: Uint8Array
  width: number
  height: number
}

const PT_PER_MM = 72 / 25.4
const pt = (mm: number) => (mm * PT_PER_MM).toFixed(2)
/**
 * Linee di taglio sul bordo esatto della carta. Molte carte hanno il bordo quasi bianco: una
 * linea troppo chiara non si vede e si finisce per tagliare a metà dello spazio tra le carte,
 * con la carta più grande di ~1,5 mm per lato. Grigio scuro e un po' più spessa (0,18 mm).
 */
const CUT_LINE = '0.3 G 0.5 w'
/** Segni di taglio nei margini del foglio, allineati ai bordi delle carte. */
const CROP_MARK = '0 G 0.5 w'
/** Distanza dei segni di taglio dalla griglia e loro lunghezza, in mm. */
const CROP_OFFSET_MM = 1.5
const CROP_LENGTH_MM = 4
/** Linea di controllo in fondo al foglio: se non misura 50 mm, la stampa è stata scalata. */
export const RULER_MM = 50
const RULER_LABEL =
  'Controllo: questa linea deve misurare 5 cm. Se no, stampa al 100% (dimensioni reali).'

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

  // Numeri degli oggetti: 1 catalogo, 2 elenco delle pagine, poi le immagini, il font della
  // scritta di controllo, poi per ogni foglio la pagina e il suo contenuto.
  const used = [...new Set(sheets.flat().map((card) => card.printId))]
  const imageIds = new Map(used.map((printId, i) => [printId, 3 + i]))
  const fontId = 3 + used.length
  const firstPage = fontId + 1
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
  // Helvetica è uno dei font di base del PDF: non va incorporato.
  object(
    fontId,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  )

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
        `q ${CROP_MARK}`,
        ...cropMarks(sheet),
        'Q',
        ...ruler(),
      ].join('\n'),
    )
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(PAGE_WIDTH_MM)} ${pt(PAGE_HEIGHT_MM)}] /Resources << /XObject << ${resources} >> /Font << /F1 ${String(fontId)} 0 R >> >> /Contents ${String(pageId + 1)} 0 R >>`,
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

/** Una linea da (x1, y1) a (x2, y2), in mm dall'alto a sinistra. */
const line = (x1: number, y1: number, x2: number, y2: number) =>
  `${pt(x1)} ${pt(PAGE_HEIGHT_MM - y1)} m ${pt(x2)} ${pt(PAGE_HEIGHT_MM - y2)} l S`

/**
 * Segni di taglio fuori dalla griglia, sul prolungamento di ogni bordo delle carte: in alto per
 * i tagli verticali, a sinistra e a destra per quelli orizzontali. Restano visibili anche dopo
 * aver tagliato le carte vicine.
 */
function cropMarks(sheet: readonly PlacedCard[]): string[] {
  if (sheet.length === 0) return []
  const xs = [...new Set(sheet.flatMap((c) => [c.x, c.x + CARD_WIDTH_MM]))]
  const ys = [...new Set(sheet.flatMap((c) => [c.y, c.y + CARD_HEIGHT_MM]))]
  const top = Math.min(...ys)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const near = CROP_OFFSET_MM
  const far = CROP_OFFSET_MM + CROP_LENGTH_MM
  return [
    ...xs.map((x) => line(x, top - far, x, top - near)),
    ...ys.flatMap((y) => [
      line(left - far, y, left - near, y),
      line(right + near, y, right + far, y),
    ]),
  ]
}

/** La linea di controllo da 50 mm nel margine in basso, con la scritta accanto. */
function ruler(): string[] {
  const y = PAGE_HEIGHT_MM - MARGIN_Y_MM / 2
  const x = MARGIN_X_MM
  const label = RULER_LABEL.replace(/[()\\]/g, (c) => `\\${c}`)
  return [
    `q ${CROP_MARK}`,
    line(x, y, x + RULER_MM, y),
    line(x, y - 1.5, x, y + 1.5),
    line(x + RULER_MM, y - 1.5, x + RULER_MM, y + 1.5),
    'Q',
    `BT /F1 7 Tf 0.3 g ${pt(x + RULER_MM + 3)} ${pt(PAGE_HEIGHT_MM - y - 0.8)} Td (${label}) Tj ET`,
  ]
}
