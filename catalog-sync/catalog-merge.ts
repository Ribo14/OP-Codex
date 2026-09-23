import type {
  ParsedCard,
  ParsedCardListPage,
  ParsedPrinting,
  ParsedSet,
} from './card-list-parser.ts'

export interface CatalogPrinting extends ParsedPrinting {
  seriesId: number
}

/** Il catalogo pronto da salvare: nessun Set, Card o Printing ripetuti. */
export interface MergedCatalog {
  sets: ParsedSet[]
  cards: ParsedCard[]
  printings: CatalogPrinting[]
  /** Print ID trovati in più di un Set: vale il primo per series_id. */
  duplicatePrintIds: string[]
}

/**
 * Unisce le pagine di più Set in un catalogo coerente e deterministico:
 * - una Card per Card Code, con i dati presi dalla Printing base (senza suffisso) se esiste,
 *   altrimenti dal Set con series_id più basso: così una ristampa con testo diverso
 *   non sovrascrive la Card a ogni esecuzione;
 * - una Printing per Print ID, collegata al primo Set (per series_id) in cui compare.
 */
export function mergeCatalogPages(pages: readonly ParsedCardListPage[]): MergedCatalog {
  const ordered = [...pages].sort((a, b) => a.set.seriesId - b.set.seriesId)

  const sets = new Map<number, ParsedSet>()
  const cards = new Map<string, { card: ParsedCard; fromBase: boolean }>()
  const printings = new Map<string, CatalogPrinting>()
  const duplicatePrintIds = new Set<string>()

  for (const page of ordered) {
    if (sets.has(page.set.seriesId)) continue
    sets.set(page.set.seriesId, page.set)

    const basePrintIds = new Set(
      page.printings.filter((p) => p.printId === p.cardCode).map((p) => p.cardCode),
    )
    for (const card of page.cards) {
      const fromBase = basePrintIds.has(card.cardCode)
      const current = cards.get(card.cardCode)
      if (!current || (fromBase && !current.fromBase)) cards.set(card.cardCode, { card, fromBase })
    }

    for (const printing of page.printings) {
      if (printings.has(printing.printId)) {
        duplicatePrintIds.add(printing.printId)
        continue
      }
      printings.set(printing.printId, { ...printing, seriesId: page.set.seriesId })
    }
  }

  return {
    sets: [...sets.values()],
    cards: [...cards.values()].map((entry) => entry.card),
    printings: [...printings.values()],
    duplicatePrintIds: [...duplicatePrintIds].sort(),
  }
}
