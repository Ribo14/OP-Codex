import type { Rect } from './scan-geometry'

// Ritaglio dinamico dello Scanner (RIB-85): trova la carta nel fotogramma, anche non centrata,
// così la zona del Card Code si ritaglia nel punto giusto. Codice puro, senza librerie: lavora
// su un fotogramma piccolo in scala di grigi (circa 320 px di lato), in pochi millisecondi.
//
// Idea: i bordi della carta sono linee dritte lunghe, quasi verticali e quasi orizzontali. Si
// cercano le colonne e le righe con più bordi "dritti" (Sobel), si provano le coppie che formano
// un rettangolo con le proporzioni di una carta (63×88) e si tiene quello i cui quattro lati
// hanno più bordi lungo tutta la loro lunghezza.

export interface Gray {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

/** Il rettangolo della carta nel fotogramma e quanto è sicuro (0–1: parte dei lati con bordo). */
export interface DetectedCard extends Rect {
  score: number
}

/** Proporzioni di una carta (63 × 88 mm). */
const CARD_RATIO = 63 / 88
/** Scarto ammesso sulle proporzioni (prospettiva, carta un po' storta). */
const RATIO_TOLERANCE = 0.14
/** La carta deve occupare almeno questa parte dell'altezza del fotogramma. */
const MIN_HEIGHT = 0.3
/** Sotto questa parte di lati con bordo non è una carta. */
const MIN_SCORE = 0.45
/** Rettangoli con un supporto fin qui sotto il migliore restano in gara (vince il più grande). */
const SCORE_MARGIN = 0.15
/** Picchi di colonne e di righe da provare. */
const PEAKS = 10

/** Da RGBA (canvas) a grigi, riducendo di `step` pixel per lato. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number, step = 1): Gray {
  const w = Math.floor(width / step)
  const h = Math.floor(height / step)
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * step * width + x * step) * 4
      data[y * w + x] =
        (77 * (rgba[i] ?? 0) + 150 * (rgba[i + 1] ?? 0) + 29 * (rgba[i + 2] ?? 0)) >> 8
    }
  }
  return { data, width: w, height: h }
}

/** Gradienti di Sobel: orizzontale (bordi verticali) e verticale (bordi orizzontali). */
function sobel({ data, width, height }: Gray) {
  const gx = new Int16Array(width * height)
  const gy = new Int16Array(width * height)
  const at = (x: number, y: number) => data[y * width + x] ?? 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      gx[y * width + x] =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1)
      gy[y * width + x] =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1)
    }
  }
  return { gx, gy }
}

/** I picchi più alti di un profilo, distanti tra loro almeno `gap`. */
function peaks(profile: Float32Array, count: number, gap: number): number[] {
  const order = [...profile.keys()].sort((a, b) => (profile[b] ?? 0) - (profile[a] ?? 0))
  const chosen: number[] = []
  for (const i of order) {
    if ((profile[i] ?? 0) <= 0) break
    if (chosen.every((c) => Math.abs(c - i) >= gap)) chosen.push(i)
    if (chosen.length === count) break
  }
  return chosen.sort((a, b) => a - b)
}

/**
 * La carta nel fotogramma, oppure null. Le coordinate sono quelle del fotogramma ricevuto.
 */
export function detectCard(gray: Gray): DetectedCard | null {
  const { width, height } = gray
  if (width < 32 || height < 32) return null
  const { gx, gy } = sobel(gray)

  // Un pixel è "bordo verticale" se il gradiente è forte e soprattutto orizzontale (e viceversa).
  let total = 0
  for (let i = 0; i < gx.length; i++) total += Math.abs(gx[i] ?? 0) + Math.abs(gy[i] ?? 0)
  const strong = Math.max(40, (total / gx.length) * 2.5)
  const vertical = new Uint8Array(width * height)
  const horizontal = new Uint8Array(width * height)
  const cols = new Float32Array(width)
  const rows = new Float32Array(height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const ax = Math.abs(gx[i] ?? 0)
      const ay = Math.abs(gy[i] ?? 0)
      if (ax > strong && ax > 2 * ay) {
        vertical[i] = 1
        cols[x] = (cols[x] ?? 0) + 1
      }
      if (ay > strong && ay > 2 * ax) {
        horizontal[i] = 1
        rows[y] = (rows[y] ?? 0) + 1
      }
    }
  }

  const gap = Math.max(3, Math.round(Math.min(width, height) * 0.03))
  const colPeaks = peaks(cols, PEAKS, gap)
  const rowPeaks = peaks(rows, PEAKS, gap)
  // Un po' di tolleranza intorno alla linea: carta appena ruotata o bordo non netto.
  const slack = Math.max(2, Math.round(Math.min(width, height) * 0.012))

  const verticalSupport = (x: number, top: number, bottom: number) => {
    let hits = 0
    for (let y = top; y <= bottom; y++) {
      for (let dx = -slack; dx <= slack; dx++) {
        if (vertical[y * width + x + dx]) {
          hits++
          break
        }
      }
    }
    return hits / (bottom - top + 1)
  }
  const horizontalSupport = (y: number, left: number, right: number) => {
    let hits = 0
    for (let x = left; x <= right; x++) {
      for (let dy = -slack; dy <= slack; dy++) {
        if (horizontal[(y + dy) * width + x]) {
          hits++
          break
        }
      }
    }
    return hits / (right - left + 1)
  }

  const candidates: DetectedCard[] = []
  for (let a = 0; a < rowPeaks.length; a++) {
    for (let b = a + 1; b < rowPeaks.length; b++) {
      const top = rowPeaks[a] ?? 0
      const bottom = rowPeaks[b] ?? 0
      const h = bottom - top
      if (h < height * MIN_HEIGHT) continue
      for (let c = 0; c < colPeaks.length; c++) {
        for (let d = c + 1; d < colPeaks.length; d++) {
          const left = colPeaks[c] ?? 0
          const right = colPeaks[d] ?? 0
          const w = right - left
          if (Math.abs(w / h / CARD_RATIO - 1) > RATIO_TOLERANCE) continue
          if (left < slack || right >= width - slack || top < slack || bottom >= height - slack) {
            continue
          }
          // Il lato più debole conta di più: un rettangolo vero ha bordo su tutti e quattro.
          const sides = [
            verticalSupport(left, top, bottom),
            verticalSupport(right, top, bottom),
            horizontalSupport(top, left, right),
            horizontalSupport(bottom, left, right),
          ].sort((p, q) => p - q)
          const score =
            (((sides[0] ?? 0) + (sides[1] ?? 0)) / 2) * 0.6 +
            (((sides[2] ?? 0) + (sides[3] ?? 0)) / 2) * 0.4
          if (score >= MIN_SCORE) candidates.push({ x: left, y: top, width: w, height: h, score })
        }
      }
    }
  }
  // Dentro la carta ci sono altri rettangoli con proporzioni simili (illustrazione, riquadri):
  // tra quelli con un supporto vicino al migliore vince il più grande, cioè il bordo esterno.
  const top = Math.max(0, ...candidates.map((c) => c.score))
  return (
    candidates
      .filter((c) => c.score >= top - SCORE_MARGIN)
      .sort((p, q) => q.width * q.height - p.width * p.height)[0] ?? null
  )
}

/** Il rettangolo trovato nel fotogramma ridotto, riportato alla scala del video. */
export function scaleRect(rect: Rect, factor: number): Rect {
  return {
    x: rect.x * factor,
    y: rect.y * factor,
    width: rect.width * factor,
    height: rect.height * factor,
  }
}
