// Geometria dello Scanner (fase 4): il riquadro in cui inquadrare la carta, la zona del Card Code
// (in basso a destra) e la conversione dalle coordinate dell'anteprima ai pixel del video.

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

/** Proporzioni di una carta del gioco (63 × 88 mm). */
const CARD_RATIO = 63 / 88

/** Il riquadro della carta sull'anteprima: 80% dell'altezza, al massimo 90% della larghezza. */
export function cardFrame(box: Size): Rect {
  let height = box.height * 0.8
  let width = height * CARD_RATIO
  if (width > box.width * 0.9) {
    width = box.width * 0.9
    height = width / CARD_RATIO
  }
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height }
}

/**
 * La zona del Card Code dentro la carta: l'angolo in basso a destra. Sulle carte il codice sta
 * tra l'80% e il 93% della larghezza, a circa il 94% dell'altezza, subito a destra della riga dei
 * tipi: la zona lascia un po' di margine ma esclude quasi tutta quella riga, che confonde l'OCR.
 */
export function codeZone(frame: Rect): Rect {
  return codeZones(frame).app
}

/**
 * Le zone del Card Code dentro una carta (RIB-84): `app` è quella storica, `wide` un po' più
 * ampia, che tollera meglio una carta trovata con qualche pixel di errore. Nella prova sulle
 * foto vere le due insieme leggono più codici di ciascuna da sola.
 */
export function codeZones(card: Rect): { app: Rect; wide: Rect } {
  const zone = (x: number, y: number, w: number, h: number): Rect => ({
    x: card.x + card.width * x,
    y: card.y + card.height * y,
    width: card.width * w,
    height: card.height * h,
  })
  return { app: zone(0.66, 0.89, 0.34, 0.11), wide: zone(0.6, 0.86, 0.4, 0.14) }
}

/** Da pixel del video a coordinate dell'anteprima (l'inverso di toVideo, senza ritagli ai bordi). */
export function toPreview(rect: Rect, box: Size, video: Size): Rect {
  const scale = Math.max(box.width / video.width, box.height / video.height)
  const offsetX = (box.width - video.width * scale) / 2
  const offsetY = (box.height - video.height * scale) / 2
  return {
    x: rect.x * scale + offsetX,
    y: rect.y * scale + offsetY,
    width: rect.width * scale,
    height: rect.height * scale,
  }
}

/** Un rettangolo tenuto dentro il video (per i ritagli: mai fuori dall'immagine). */
export function clampRect(rect: Rect, video: Size): Rect {
  const left = clamp(rect.x, video.width)
  const top = clamp(rect.y, video.height)
  const right = clamp(rect.x + rect.width, video.width)
  const bottom = clamp(rect.y + rect.height, video.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Da un rettangolo sull'anteprima ai pixel del video. L'anteprima usa object-cover: il video è
 * scalato per riempire il riquadro e la parte in eccesso è tagliata, metà per lato.
 */
export function toVideo(rect: Rect, box: Size, video: Size): Rect {
  const scale = Math.max(box.width / video.width, box.height / video.height)
  const offsetX = (box.width - video.width * scale) / 2
  const offsetY = (box.height - video.height * scale) / 2
  const left = clamp((rect.x - offsetX) / scale, video.width)
  const top = clamp((rect.y - offsetY) / scale, video.height)
  const right = clamp((rect.x + rect.width - offsetX) / scale, video.width)
  const bottom = clamp((rect.y + rect.height - offsetY) / scale, video.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max)
}
