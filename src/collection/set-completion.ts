import type { CatalogCard, CatalogSet } from '@/catalog/catalog-data'
import type { CollectionEntry } from './collection'

// Completamento dei Set (RIB-22): per ogni Set, Card distinte possedute sul totale. Si conta per
// Card Code, ma solo con Printing di quel Set (base, parallel o ristampa pubblicata nel Set): una
// ristampa di OP01-006 in PRB-01 si completa solo con la Printing di PRB-01.
// Calcolato sul dispositivo: catalogo e Collection sono già lì, e i numeri seguono ogni +/−.

export interface SetCompletion {
  set: CatalogSet
  owned: number
  total: number
}

/** Tutti i Set del catalogo, dal più recente (Series ID più alto). */
export function setCompletion(
  cards: readonly CatalogCard[],
  sets: readonly CatalogSet[],
  entries: readonly CollectionEntry[],
): SetCompletion[] {
  const ownedPrints = new Set(entries.map((e) => e.printId))
  const total = new Map<string, Set<string>>()
  const owned = new Map<string, Set<string>>()
  const add = (map: Map<string, Set<string>>, setCode: string, cardCode: string) => {
    let codes = map.get(setCode)
    if (!codes) map.set(setCode, (codes = new Set()))
    codes.add(cardCode)
  }
  for (const card of cards) {
    for (const printing of card.printings) {
      add(total, printing.setCode, card.cardCode)
      if (ownedPrints.has(printing.printId)) add(owned, printing.setCode, card.cardCode)
    }
  }
  return [...sets]
    .sort((a, b) => b.seriesId - a.seriesId)
    .map((set) => ({
      set,
      owned: owned.get(set.code)?.size ?? 0,
      total: total.get(set.code)?.size ?? 0,
    }))
    .filter((row) => row.total > 0)
}

/** Percentuale intera (arrotondata per difetto: 100% solo a Set completo). */
export function percent({ owned, total }: Pick<SetCompletion, 'owned' | 'total'>): number {
  return total === 0 ? 0 : Math.floor((owned / total) * 100)
}
