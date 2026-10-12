// Stampa delle carte (RIB-80): impaginazione su fogli A4 verticali. Le carte hanno la misura
// reale (63×88 mm), 3×3 per foglio con uno spazio tra l'una e l'altra per ritagliarle con le
// forbici; la griglia è centrata nel foglio. Tutte le misure in millimetri, origine in alto a
// sinistra (il PDF le converte).

export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297
export const CARD_WIDTH_MM = 63
export const CARD_HEIGHT_MM = 88
export const GAP_MM = 3
export const COLUMNS = 3
export const ROWS = 3
export const CARDS_PER_SHEET = COLUMNS * ROWS

/** Una carta da stampare: quale Printing e quante copie. */
export interface PrintItem {
  printId: string
  copies: number
  /** Printing in anteprima (ADR-0016): l'immagine sta altrove. */
  preview?: boolean
}

/** Una carta sul foglio: Print ID e angolo in alto a sinistra, in mm. */
export interface PlacedCard {
  printId: string
  preview?: boolean
  x: number
  y: number
}

const GRID_WIDTH = COLUMNS * CARD_WIDTH_MM + (COLUMNS - 1) * GAP_MM
const GRID_HEIGHT = ROWS * CARD_HEIGHT_MM + (ROWS - 1) * GAP_MM
export const MARGIN_X_MM = (PAGE_WIDTH_MM - GRID_WIDTH) / 2
export const MARGIN_Y_MM = (PAGE_HEIGHT_MM - GRID_HEIGHT) / 2

/** Quante carte in tutto. */
export function totalCopies(items: readonly PrintItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.copies), 0)
}

/** Quanti fogli A4 servono. */
export function sheetCount(items: readonly PrintItem[]): number {
  return Math.ceil(totalCopies(items) / CARDS_PER_SHEET)
}

/**
 * Le carte foglio per foglio, riga per riga: le copie della stessa carta vicine, nell'ordine
 * della lista.
 */
export function layoutSheets(items: readonly PrintItem[]): PlacedCard[][] {
  const copies = items.flatMap((item) =>
    Array.from({ length: Math.max(0, item.copies) }, () => item),
  )
  const sheets: PlacedCard[][] = []
  copies.forEach(({ printId, preview }, i) => {
    const slot = i % CARDS_PER_SHEET
    if (slot === 0) sheets.push([])
    const column = slot % COLUMNS
    const row = Math.floor(slot / COLUMNS)
    sheets[sheets.length - 1]?.push({
      printId,
      ...(preview ? { preview } : {}),
      x: MARGIN_X_MM + column * (CARD_WIDTH_MM + GAP_MM),
      y: MARGIN_Y_MM + row * (CARD_HEIGHT_MM + GAP_MM),
    })
  })
  return sheets
}
