import { detectCard, scaleRect, toGray } from './card-detect'
import type { Ocr } from './ocr'
import { readCascade, type CascadeResult } from './scan-cascade'
import { cardFrame, clampRect, codeZones, toVideo, type Rect, type Size } from './scan-geometry'
import { FrameStack, GLARE_THRESHOLD, glareFraction } from './scan-glare'
import { recognize } from './scan-recognizer'

// Un giro di lettura dello Scanner, sul browser (RIB-84, RIB-85, RIB-86):
// 1. il fotogramma si "congela" in un canvas: tutti i tentativi leggono la stessa immagine;
// 2. la carta si cerca su una copia ridotta; se c'è, le zone del codice si ritagliano su di lei,
//    altrimenti sul riquadro fisso dell'anteprima;
// 3. la cascata di letture;
// 4. se non trova niente e c'è un riflesso, prova la fusione degli ultimi fotogrammi.

/** Lato lungo della copia ridotta su cui si cerca la carta. */
const DETECT_SIZE = 400
/** Dimensione fissa della zona ampia per la fusione: così i fotogrammi si sovrappongono. */
const FUSE_WIDTH = 480
const FUSE_HEIGHT = 236
/** Fotogrammi minimi per tentare la fusione. */
const FUSE_MIN = 3

export interface FrameRead extends CascadeResult {
  /** La carta trovata, in pixel del video; null = riquadro fisso. */
  card: Rect | null
  /** Parte della zona del codice bruciata da un riflesso (0–1). */
  glare: number
  /** Il codice è arrivato dalla fusione dei fotogrammi. */
  fused: boolean
}

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas non disponibile')
  return ctx
}

export function createFrameReader() {
  const frame = document.createElement('canvas')
  const small = document.createElement('canvas')
  const fuse = document.createElement('canvas')
  fuse.width = FUSE_WIDTH
  fuse.height = FUSE_HEIGHT
  const stack = new FrameStack(FUSE_WIDTH * FUSE_HEIGHT)

  return {
    async read(
      video: HTMLVideoElement,
      box: Size,
      ocr: Ocr,
      codes: ReadonlySet<string>,
    ): Promise<FrameRead> {
      const size = { width: video.videoWidth, height: video.videoHeight }
      frame.width = size.width
      frame.height = size.height
      context(frame).drawImage(video, 0, 0)

      // La carta, cercata sulla copia ridotta.
      const factor = Math.max(1, Math.max(size.width, size.height) / DETECT_SIZE)
      small.width = Math.round(size.width / factor)
      small.height = Math.round(size.height / factor)
      const smallCtx = context(small)
      smallCtx.drawImage(frame, 0, 0, small.width, small.height)
      const pixels = smallCtx.getImageData(0, 0, small.width, small.height)
      const found = detectCard(toGray(pixels.data, small.width, small.height))
      const card = found ? scaleRect(found, size.width / small.width) : null
      const zones = codeZones(card ?? toVideo(cardFrame(box), box, size))
      const app = clampRect(zones.app, size)
      const wide = clampRect(zones.wide, size)

      const result = await readCascade(
        (zone, layout) => ocr.read(frame, zone, layout),
        { app, wide },
        codes,
      )

      // La zona ampia a dimensione fissa, in grigi: per misurare il riflesso e per la fusione.
      const fuseCtx = context(fuse)
      fuseCtx.filter = 'grayscale(1)'
      fuseCtx.drawImage(
        frame,
        wide.x,
        wide.y,
        wide.width,
        wide.height,
        0,
        0,
        FUSE_WIDTH,
        FUSE_HEIGHT,
      )
      fuseCtx.filter = 'none'
      const zonePixels = fuseCtx.getImageData(0, 0, FUSE_WIDTH, FUSE_HEIGHT)
      const gray = toGray(zonePixels.data, FUSE_WIDTH, FUSE_HEIGHT).data as Uint8Array
      const glare = glareFraction(gray)
      // Si sommano solo fotogrammi allineati: con la carta trovata. Senza, si riparte.
      if (card) stack.push(gray)
      else stack.clear()

      if (result.found.length === 0 && glare >= GLARE_THRESHOLD && stack.length >= FUSE_MIN) {
        const fused = stack.fused()
        const image = fuseCtx.createImageData(FUSE_WIDTH, FUSE_HEIGHT)
        fused.forEach((v, i) => {
          image.data[i * 4] = v
          image.data[i * 4 + 1] = v
          image.data[i * 4 + 2] = v
          image.data[i * 4 + 3] = 255
        })
        fuseCtx.putImageData(image, 0, 0)
        const text = await ocr.read(
          fuse,
          { x: 0, y: 0, width: FUSE_WIDTH, height: FUSE_HEIGHT },
          'block',
        )
        const fusedResult = recognize(text, codes)
        if (fusedResult.found.length > 0) {
          return { ...fusedResult, text, attempts: result.attempts + 1, card, glare, fused: true }
        }
      }
      return { ...result, card, glare, fused: false }
    },

    /** La zona del codice dell'ultimo giro in PNG, per la diagnostica (RIB-87). */
    async zonePng(): Promise<Blob | null> {
      return new Promise((resolve) => {
        fuse.toBlob(resolve, 'image/png')
      })
    },

    /** Dopo una carta trovata si riparte: i fotogrammi vecchi non servono più. */
    reset() {
      stack.clear()
    },
  }
}
