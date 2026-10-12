import type { OcrLayout } from './ocr'
import type { Rect } from './scan-geometry'
import { recognize } from './scan-recognizer'

// Cascata di letture sullo stesso fotogramma (RIB-84). Nella prova sulle 17 foto dell'utente
// (8 carte, con e senza bustina) un solo tentativo leggeva 6 codici su 17 (1 su 8 in bustina);
// questi tre, nell'ordine, 12 su 17 (5 su 8). Ci si ferma al primo che trova un codice del
// catalogo: con una carta facile il costo resta quello di una lettura.

export type ZoneName = 'app' | 'wide'

export const ATTEMPTS: readonly { zone: ZoneName; layout: OcrLayout }[] = [
  { zone: 'app', layout: 'block' },
  { zone: 'wide', layout: 'block' },
  { zone: 'wide', layout: 'sparse' },
]

export interface CascadeResult {
  /** Il testo dell'ultimo tentativo fatto (per la riga di prova in fondo allo Scanner). */
  text: string
  found: string[]
  unknown: string[]
  /** Quanti tentativi sono serviti. */
  attempts: number
}

/** Prova i tentativi in ordine finché uno trova un codice del catalogo. */
export async function readCascade(
  read: (zone: Rect, layout: OcrLayout) => Promise<string>,
  zones: Record<ZoneName, Rect>,
  codes: ReadonlySet<string>,
  attempts: readonly { zone: ZoneName; layout: OcrLayout }[] = ATTEMPTS,
): Promise<CascadeResult> {
  let result: CascadeResult = { text: '', found: [], unknown: [], attempts: 0 }
  for (const [i, attempt] of attempts.entries()) {
    const text = await read(zones[attempt.zone], attempt.layout)
    const { found, unknown } = recognize(text, codes)
    result = { text, found, unknown, attempts: i + 1 }
    if (found.length > 0) return result
  }
  return result
}
