import { getSupabase } from '@/lib/supabase'

// L'intero catalogo caricato sul dispositivo: ricerca e filtri girano in locale (RIB-15),
// e la stessa struttura servirà per la consultazione offline (RIB-16).

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

async function fetchCatalog(): Promise<Catalog> {
  const supabase = getSupabase()

  const [sets, cards, printings] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from('sets').select('series_id, code, name').order('code').range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('cards')
        .select(
          'card_code, name, category, cost, life, power, counter, colors, attributes, types, block, effect, trigger, keywords',
        )
        .order('card_code')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('printings')
        .select('print_id, card_code, rarity, series_id, image_synced_at')
        .order('print_id')
        .range(from, to),
    ),
  ])

  const setCodes = new Map(sets.map((s) => [s.series_id, s.code]))
  const printingsByCard = new Map<string, CatalogPrinting[]>()
  for (const p of printings) {
    const list = printingsByCard.get(p.card_code) ?? []
    const printing = {
      printId: p.print_id,
      rarity: p.rarity,
      setCode: setCodes.get(p.series_id) ?? '',
      hasImage: p.image_synced_at !== null,
    }
    // La Printing base (senza suffisso) va per prima.
    if (p.print_id === p.card_code) list.unshift(printing)
    else list.push(printing)
    printingsByCard.set(p.card_code, list)
  }

  return {
    sets: sets.map((s) => ({ seriesId: s.series_id, code: s.code, name: s.name })),
    cards: cards.map((c) => ({
      cardCode: c.card_code,
      name: c.name,
      category: c.category,
      cost: c.cost,
      life: c.life,
      power: c.power,
      counter: c.counter,
      colors: c.colors,
      attributes: c.attributes,
      types: c.types,
      block: c.block,
      effect: c.effect,
      trigger: c.trigger,
      keywords: c.keywords,
      printings: printingsByCard.get(c.card_code) ?? [],
    })),
  }
}

let cached: Promise<Catalog> | null = null

/** Carica il catalogo una volta per sessione; in caso di errore si potrà riprovare. */
export function loadCatalog(): Promise<Catalog> {
  cached ??= fetchCatalog().catch((error: unknown) => {
    cached = null
    throw error
  })
  return cached
}
