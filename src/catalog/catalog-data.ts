import { getSupabase } from '@/lib/supabase'
import type { CatalogRows } from './catalog-sync'

// L'intero catalogo sul dispositivo: ricerca e filtri girano in locale (RIB-15) e,
// grazie alla copia in IndexedDB, anche senza connessione (RIB-16).

export interface CatalogPrinting {
  printId: string
  rarity: string
  setCode: string
  hasImage: boolean
}

export interface CatalogCard {
  cardCode: string
  name: string
  category: string
  cost: number | null
  life: number | null
  power: number | null
  counter: number | null
  colors: string[]
  attributes: string[]
  types: string[]
  block: string | null
  effect: string | null
  trigger: string | null
  keywords: string[]
  /** Tutte le Printing, la base per prima e poi in ordine di Print ID. */
  printings: CatalogPrinting[]
  /** FAQ ufficiali di Bandai (RIB-44), nell'ordine dei PDF; assenti nei dati di prova. */
  faqs?: CardFaq[]
  /**
   * Card Explanation in italiano (RIB-52, ADR-0006), markdown semplice; null = non ancora scritta.
   * Assente nei dati di prova.
   */
  explanation?: string | null
}

/** Una domanda con risposta dalle FAQ ufficiali, in inglese. */
export interface CardFaq {
  question: string
  answer: string
  /** PDF di origine, es. "qa_op05.pdf". */
  source: string
}

export interface CatalogSet {
  seriesId: number
  code: string
  name: string
}

export interface Catalog {
  cards: CatalogCard[]
  sets: CatalogSet[]
}

// Il server restituisce al massimo 1000 righe per richiesta.
const PAGE_SIZE = 1000

async function fetchAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

/** Le righe cambiate dal momento `since` (orologio del server), oppure tutte con null. */
export async function fetchRowsSince(since: string | null): Promise<CatalogRows> {
  const supabase = getSupabase()
  const changed = <Q extends { gte: (column: 'updated_at', value: string) => Q }>(query: Q) =>
    since === null ? query : query.gte('updated_at', since)

  const [sets, cards, printings, faqs, explanations] = await Promise.all([
    fetchAll((from, to) =>
      changed(supabase.from('sets').select('series_id, code, name, updated_at'))
        .order('series_id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      changed(
        supabase
          .from('cards')
          .select(
            'card_code, name, category, cost, life, power, counter, colors, attributes, types, block, effect, trigger, keywords, updated_at',
          ),
      )
        .order('card_code')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      changed(
        supabase
          .from('printings')
          .select('print_id, card_code, rarity, series_id, image_synced_at, updated_at'),
      )
        .order('print_id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      changed(supabase.from('card_faqs').select('card_code, items, updated_at'))
        .order('card_code')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      changed(supabase.from('card_explanations').select('card_code, body, updated_at'))
        .order('card_code')
        .range(from, to),
    ),
  ])

  return { sets, cards, printings, faqs, explanations }
}
