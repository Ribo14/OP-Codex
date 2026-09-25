import type { CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'

// Collection (RIB-20): le Collection Entry dell'utente e i calcoli per la pagina Collezione.
// Tutto in locale: la Collection si scarica intera e si abbina al catalogo sul dispositivo.

/** Lingue di stampa; devono coincidere con il vincolo di collection_entries. */
export const LANGUAGES = ['EN', 'JP', 'FR', 'CN', 'KR'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'EN'

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value)
}

export interface CollectionEntry {
  printId: string
  language: Language
  quantity: number
  updatedAt: string
}

const same = (e: CollectionEntry, printId: string, language: Language) =>
  e.printId === printId && e.language === language

/**
 * Le Entry con le copie di una Printing e lingua fissate a `quantity` (0 = la Entry sparisce).
 * Serve sia per il cambio immediato sullo schermo sia per allinearsi alla risposta del server.
 */
export function withQuantity(
  entries: readonly CollectionEntry[],
  printId: string,
  language: Language,
  quantity: number,
  now: string,
): CollectionEntry[] {
  const others = entries.filter((e) => !same(e, printId, language))
  if (quantity <= 0) return others
  const existing = entries.find((e) => same(e, printId, language))
  const updatedAt = existing?.quantity === quantity ? existing.updatedAt : now
  return [...others, { printId, language, quantity, updatedAt }]
}

export function quantityOf(
  entries: readonly CollectionEntry[],
  printId: string,
  language: Language,
): number {
  return entries.find((e) => same(e, printId, language))?.quantity ?? 0
}

/** Copie di una Printing, in tutto e per lingua (nell'ordine di LANGUAGES). */
export function copiesOf(entries: readonly CollectionEntry[], printId: string) {
  const byLanguage = LANGUAGES.map(
    (language) => [language, quantityOf(entries, printId, language)] as const,
  ).filter(([, quantity]) => quantity > 0)
  return { total: byLanguage.reduce((sum, [, q]) => sum + q, 0), byLanguage }
}

/** Il Card Code di un Print ID (OP01-001_p1 → OP01-001). */
export function cardCodeOf(printId: string): string {
  return printId.split('_')[0] ?? printId
}

/** Totali della pagina Collezione: copie in tutto e Card distinte. */
export function totals(entries: readonly CollectionEntry[]) {
  return {
    copies: entries.reduce((sum, e) => sum + e.quantity, 0),
    distinctCards: new Set(entries.map((e) => cardCodeOf(e.printId))).size,
  }
}

/** Una tessera della pagina Collezione: una Printing posseduta, con le copie per lingua. */
export interface OwnedItem {
  card: CatalogCard
  printing: CatalogPrinting
  total: number
  byLanguage: (readonly [Language, number])[]
  /** Ultima modifica tra le lingue della Printing. */
  updatedAt: string
}

/** Le Printing possedute, abbinate al catalogo (quelle che il catalogo non conosce si saltano). */
export function ownedItems(
  entries: readonly CollectionEntry[],
  cards: readonly CatalogCard[],
): OwnedItem[] {
  const byPrintId = new Map<string, { card: CatalogCard; printing: CatalogPrinting }>()
  for (const card of cards) {
    for (const printing of card.printings) byPrintId.set(printing.printId, { card, printing })
  }
  const printIds = [...new Set(entries.map((e) => e.printId))]
  return printIds.flatMap((printId) => {
    const found = byPrintId.get(printId)
    if (!found) return []
    const own = entries.filter((e) => e.printId === printId)
    const updatedAt = own.map((e) => e.updatedAt).reduce((a, b) => (a > b ? a : b))
    return [{ ...found, ...copiesOf(own, printId), updatedAt }]
  })
}

export type CollectionSort = 'code' | 'recent' | 'quantity'
export const COLLECTION_SORTS: readonly CollectionSort[] = ['code', 'recent', 'quantity']

const byCode = (a: OwnedItem, b: OwnedItem) =>
  a.printing.printId.localeCompare(b.printing.printId, 'en', { numeric: true })

/** Ricerca per nome, Card Code o Print ID, e ordinamento. */
export function searchOwned(
  items: readonly OwnedItem[],
  query: string,
  sort: CollectionSort,
): OwnedItem[] {
  const q = query.trim().toLowerCase()
  const found = q
    ? items.filter(
        (item) =>
          item.card.name.toLowerCase().includes(q) ||
          item.printing.printId.toLowerCase().includes(q),
      )
    : [...items]
  switch (sort) {
    case 'recent':
      return found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byCode(a, b))
    case 'quantity':
      return found.sort((a, b) => b.total - a.total || byCode(a, b))
    default:
      return found.sort(byCode)
  }
}
