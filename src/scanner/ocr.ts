import type { Rect } from './scan-geometry'

// OCR dello Scanner (fase 4, ADR in docs/piano-fasi-4-5.md): Tesseract.js sul dispositivo, la foto
// non esce dal telefono. La libreria si carica solo aprendo lo Scanner e i suoi file arrivano da
// /ocr/ (scripts/copy-ocr.mjs): la CSP non permette CDN.

/**
 * Come leggere la zona (RIB-84): `block` la tratta come un blocco di testo, `sparse` come testo
 * sparso. Sulle foto vere i due modi leggono carte diverse: la cascata li usa entrambi.
 */
export type OcrLayout = 'block' | 'sparse'

export interface Ocr {
  /** Legge il testo di una zona di un'immagine (fotogramma o fusione di fotogrammi). */
  read: (source: CanvasImageSource, zone: Rect, layout: OcrLayout) => Promise<string>
  stop: () => Promise<void>
}

/** Larghezza a cui si porta la zona prima dell'OCR: il Card Code è piccolo, ingrandirlo aiuta. */
const TARGET_WIDTH = 900

export async function startOcr(): Promise<Ocr> {
  const { createWorker, OEM, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/',
    langPath: '/ocr/lang',
    // Niente blob: la CSP permette worker solo dal nostro dominio.
    workerBlobURL: false,
    gzip: true,
  })
  const PAGE_SEG: Record<OcrLayout, (typeof PSM)[keyof typeof PSM]> = {
    block: PSM.SINGLE_BLOCK,
    sparse: PSM.SPARSE_TEXT,
  }
  let current: OcrLayout = 'sparse'
  await worker.setParameters({
    tessedit_pageseg_mode: PAGE_SEG[current],
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
  })

  const canvas = document.createElement('canvas')
  return {
    async read(source, zone, layout) {
      if (layout !== current) {
        await worker.setParameters({ tessedit_pageseg_mode: PAGE_SEG[layout] })
        current = layout
      }
      const scale = Math.max(1, TARGET_WIDTH / zone.width)
      canvas.width = Math.round(zone.width * scale)
      canvas.height = Math.round(zone.height * scale)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas non disponibile')
      // In scala di grigi e con più contrasto: le carte foil riflettono e confondono i colori.
      context.filter = 'grayscale(1) contrast(1.6)'
      context.drawImage(
        source,
        zone.x,
        zone.y,
        zone.width,
        zone.height,
        0,
        0,
        canvas.width,
        canvas.height,
      )
      const { data } = await worker.recognize(canvas)
      return data.text
    },
    async stop() {
      await worker.terminate()
    },
  }
}
