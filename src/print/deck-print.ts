import type { CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import type { DeckCard } from '@/decks/deck'
import type { MissingRow } from '@/decks/missing-cards'
import type { PrintItem } from './print-sheet'

// Stampa dal mazzo (RIB-80): per ogni carta del Deck quante copie stampare e quale Printing.
// Si parte dalle copie mancanti nella Collection, con la Printing scelta nel Deck.

export interface DeckPrintRow {
  card: CatalogCard
  /** Printing da stampare; null se nessuna Printing della carta ha l'immagine. */
  printId: string | null
  copies: number
  /** Copie nel Deck: il massimo che si può stampare. */
  required: number
  missing: number
}

/** Le Printing stampabili: solo quelle con l'immagine. */
export function printablePrintings(card: CatalogCard): CatalogPrinting[] {
  return card.printings.filter((p) => p.hasImage)
}

function defaultPrintId(card: CatalogCard, chosen: string | null): string | null {
  const printable = printablePrintings(card)
  return (printable.find((p) => p.printId === chosen) ?? printable[0])?.printId ?? null
}

/** Le righe di stampa del Deck, Leader per primo, nell'ordine delle Missing Cards. */
export function deckPrintRows(
  deck: { leaderCode: string; leaderPrintId: string | null },
  cards: readonly DeckCard[],
  ownership: readonly MissingRow[],
  catalog: ReadonlyMap<string, CatalogCard>,
): DeckPrintRow[] {
  const chosen = new Map<string, string | null>([
    [deck.leaderCode, deck.leaderPrintId],
    ...cards.map((c) => [c.cardCode, c.printId] as const),
  ])
  return ownership.flatMap((row) => {
    const card = catalog.get(row.cardCode)
    if (!card) return []
    const printId = defaultPrintId(card, chosen.get(row.cardCode) ?? null)
    return [
      {
        card,
        printId,
        copies: printId === null ? 0 : row.missing,
        required: row.required,
        missing: row.missing,
      },
    ]
  })
}

/** Cosa va nel PDF: le righe con almeno una copia e un'immagine. */
export function printItems(rows: readonly DeckPrintRow[]): PrintItem[] {
  return rows.flatMap((row) => {
    if (row.printId === null || row.copies <= 0) return []
    const preview = row.card.printings.find((p) => p.printId === row.printId)?.preview === true
    return [{ printId: row.printId, copies: row.copies, ...(preview ? { preview } : {}) }]
  })
}
