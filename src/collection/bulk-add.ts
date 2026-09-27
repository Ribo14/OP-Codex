import type { CatalogCard } from '@/catalog/catalog-data'
import { readLine, type ListError } from '@/decks/deck-list'
import type { Language } from './collection'

// Aggiunta in blocco alla Collection: tutte le carte di un Set (es. uno Starter Deck comprato) o
// una lista nel formato dei mazzi ("4xST01-001"). Codice puro: righe da mostrare e correggere,
// poi il contenuto della chiamata al database (aggiungi_copie).

export interface BulkRow {
  printId: string
  cardCode: string
  name: string
  rarity: string
  quantity: number
}

/** Copie al massimo per stampa in una volta sola (come il database). */
export const MAX_PER_ROW = 99

/**
 * Le stampe di un Set. Proposta: una copia delle base e delle ristampe (_r), nessuna delle
 * parallele (_p), che in una busta o in un mazzo capitano di rado. Si corregge a mano.
 */
export function setRows(cards: readonly CatalogCard[], setCode: string): BulkRow[] {
  return cards.flatMap((card) =>
    card.printings
      .filter((p) => p.setCode === setCode)
      .map((p) => ({
        printId: p.printId,
        cardCode: card.cardCode,
        name: card.name,
        rarity: p.rarity,
        quantity: /_p\d+$/.test(p.printId) ? 0 : 1,
      })),
  )
}

/**
 * Una lista "4xST01-001" (anche più mazzi insieme): ogni carta sulla sua stampa base, righe
 * ripetute sommate; Leader e parallele valgono come le altre carte.
 */
export function listRows(
  text: string,
  catalog: ReadonlyMap<string, CatalogCard>,
): { rows: BulkRow[]; errors: ListError[] } {
  const rows = new Map<string, BulkRow>()
  const errors: ListError[] = []
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) return
    const parsed = readLine(line)
    if (!parsed || parsed.quantity < 1) {
      errors.push({ line: index + 1, text: line, problem: 'format' })
      return
    }
    const card = catalog.get(parsed.cardCode)
    const base = card?.printings[0]
    if (!card || !base) {
      errors.push({ line: index + 1, text: line, problem: 'unknown' })
      return
    }
    const row = rows.get(base.printId)
    if (row) row.quantity += parsed.quantity
    else {
      rows.set(base.printId, {
        printId: base.printId,
        cardCode: card.cardCode,
        name: card.name,
        rarity: base.rarity,
        quantity: parsed.quantity,
      })
    }
  })
  return { rows: [...rows.values()], errors }
}

/** Il contenuto per aggiungi_copie: solo le righe con copie, al massimo 99 per stampa. */
export function payload(rows: readonly BulkRow[], language: Language) {
  return rows
    .filter((r) => r.quantity > 0)
    .map((r) => ({
      print_id: r.printId,
      language,
      quantity: Math.min(r.quantity, MAX_PER_ROW),
    }))
}
