import { getSupabase } from '@/lib/supabase'
import type { CatalogRows } from './catalog-sync'

// L'intero catalogo sul dispositivo: ricerca e filtri girano in locale (RIB-15) e,
// grazie alla copia in IndexedDB, anche senza connessione (RIB-16).

export interface CatalogPrinting {
  printId: string
  rarity: string
  /**
   * Block stampato su questa Printing (RIB-76); null o assente = come la Card. Quello della Card
   * è il più recente tra le sue Printing e decide la legalità.
   */
  block?: string | null
  setCode: string
  hasImage: boolean
  /** Anteprima di un Set non ancora uscito (ADR-0016): mai in una Collection. */
  preview?: boolean
  /** Ultimo prezzo Cardmarket (RIB-32); null = nessun prezzo. Assente nei dati di prova. */
  price?: PrintingPrice | null
  /** Minimo su CardTrader (RIB-32, slice 5.5); null = nessun prezzo. */
  cardtrader?: CardTraderPrice | null
}

/** Offerta più economica su CardTrader (inglese, Near Mint o Mint), in euro. */
export interface CardTraderPrice {
  low: number
  /** Blueprint di CardTrader: la pagina della carta. */
  blueprintId: number | null
  /** Codice dell'espansione su CardTrader (es. op01, eb-01): serve alle liste per le wishlist. */
  expansion: string | null
}

/** Prezzo di una Printing su Cardmarket, in euro. */
export interface PrintingPrice {
  /** Prezzo di tendenza. */
  trend: number | null
  /** Minimo in vendita. */
  low: number | null
  /** Giorno del listino, AAAA-MM-GG. */
  date: string | null
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
  /**
   * Anteprima (ADR-0016): dati e traduzione non ufficiali, presi da OPTCG Leaks finché la carta
   * non arriva nella Official Card List. Assente nei dati di prova.
   */
  preview?: boolean
  /** Chi ha tradotto il testo dell'anteprima, se il sito lo dice. */
  previewCredit?: string | null
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
  /** Set non ancora uscito (ADR-0016). */
  preview?: boolean
}

export interface Catalog {
  cards: CatalogCard[]
  sets: CatalogSet[]
}

// Il server restituisce al massimo 1000 righe per richiesta.
const PAGE_SIZE = 1000

/** Il database non ha ancora una colonna che l'app chiede (Postgres 42703). */
class MissingColumnError extends Error {}

async function fetchAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) {
      throw error.code === '42703'
        ? new MissingColumnError(error.message)
        : new Error(error.message)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

/**
 * Le colonne aggiunte di recente (Block per Printing, RIB-76; anteprime, ADR-0016) oppure, con
 * `current` false, quelle di prima. Il tipo resta quello delle colonne nuove: nelle righe sono
 * tutte facoltative.
 */
function columns<T extends string>(current: boolean, next: T, legacy: string): T {
  return (current ? next : legacy) as T
}

/**
 * Le righe cambiate dal momento `since` (orologio del server), oppure tutte con null.
 * Se il database non ha ancora le colonne nuove (la migrazione arriva col merge su main, mentre
 * l'anteprima di Netlify e i primi minuti dopo il deploy usano già l'app nuova) si chiedono
 * quelle di prima: il catalogo si carica lo stesso.
 */
export async function fetchRowsSince(since: string | null): Promise<CatalogRows> {
  try {
    return await fetchRows(since, true)
  } catch (error) {
    if (error instanceof MissingColumnError) return fetchRows(since, false)
    throw error
  }
}

async function fetchRows(since: string | null, current: boolean): Promise<CatalogRows> {
  const supabase = getSupabase()
  const changed = <Q extends { gte: (column: 'updated_at', value: string) => Q }>(query: Q) =>
    since === null ? query : query.gte('updated_at', since)

  const [sets, cards, printings, faqs, explanations, prices] = await Promise.all([
    fetchAll((from, to) =>
      changed(
        supabase
          .from('sets')
          .select(
            columns(
              current,
              'series_id, code, name, preview, updated_at',
              'series_id, code, name, updated_at',
            ),
          ),
      )
        .order('series_id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      changed(
        supabase
          .from('cards')
          .select(
            columns(
              current,
              'card_code, name, category, cost, life, power, counter, colors, attributes, types, block, effect, trigger, keywords, preview, preview_credit, updated_at',
              'card_code, name, category, cost, life, power, counter, colors, attributes, types, block, effect, trigger, keywords, updated_at',
            ),
          ),
      )
        .order('card_code')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      changed(
        supabase
          .from('printings')
          .select(
            columns(
              current,
              'print_id, card_code, rarity, series_id, block, preview, image_synced_at, updated_at',
              'print_id, card_code, rarity, series_id, image_synced_at, updated_at',
            ),
          ),
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
    fetchAll((from, to) =>
      changed(
        supabase
          .from('printing_prices')
          .select(
            'print_id, marketplace, product_id, market_set, trend, low, price_date, updated_at',
          ),
      )
        .order('print_id')
        .order('marketplace')
        .range(from, to),
    ),
  ])

  return { sets, cards, printings, faqs, explanations, prices }
}
