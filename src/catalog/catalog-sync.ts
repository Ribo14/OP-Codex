import type { Catalog, CatalogPrinting } from './catalog-data'

// Copia locale del catalogo (RIB-16): righe del database salvate sul dispositivo e
// aggiornate in modo incrementale, chiedendo al server solo ciò che è cambiato.

export interface RawSet {
  series_id: number
  code: string
  name: string
  updated_at: string
}

export interface RawCard {
  card_code: string
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
  updated_at: string
}

export interface RawPrinting {
  print_id: string
  card_code: string
  rarity: string
  series_id: number
  image_synced_at: string | null
  updated_at: string
}

export interface CatalogRows {
  sets: RawSet[]
  cards: RawCard[]
  printings: RawPrinting[]
}

export interface CatalogSnapshot extends CatalogRows {
  /** Il più recente updated_at visto (orologio del server): da qui riparte il prossimo aggiornamento. */
  watermark: string | null
  /** Quando il dispositivo ha controllato l'ultima volta con successo (ms, orologio del dispositivo). */
  checkedAt: number
}

/** Da dove leggere le righe cambiate: null = tutto il catalogo. */
export type FetchRowsSince = (since: string | null) => Promise<CatalogRows>

/**
 * Margine di sicurezza: si richiede anche l'ultimo tratto prima del watermark, per non
 * perdere righe salvate dal server con un orario appena precedente ma rese visibili dopo.
 */
export const OVERLAP_MS = 5 * 60 * 1000

export function sinceFor(watermark: string | null): string | null {
  if (watermark === null) return null
  return new Date(new Date(watermark).getTime() - OVERLAP_MS).toISOString()
}

function latest(current: string | null, rows: CatalogRows): string | null {
  let max = current
  for (const row of [...rows.sets, ...rows.cards, ...rows.printings]) {
    if (max === null || new Date(row.updated_at) > new Date(max)) max = row.updated_at
  }
  return max
}

function upsert<T>(
  existing: readonly T[],
  incoming: readonly T[],
  key: (row: T) => string | number,
) {
  if (incoming.length === 0) return [...existing]
  const byKey = new Map(existing.map((row) => [key(row), row]))
  for (const row of incoming) byKey.set(key(row), row)
  return [...byKey.values()]
}

/** Unisce le righe cambiate alla copia locale (il catalogo non cancella mai righe). */
export function mergeSnapshot(
  local: CatalogSnapshot | null,
  delta: CatalogRows,
  checkedAt: number,
): CatalogSnapshot {
  const base: CatalogRows = local ?? { sets: [], cards: [], printings: [] }
  return {
    sets: upsert(base.sets, delta.sets, (s) => s.series_id),
    cards: upsert(base.cards, delta.cards, (c) => c.card_code),
    printings: upsert(base.printings, delta.printings, (p) => p.print_id),
    watermark: latest(local?.watermark ?? null, delta),
    checkedAt,
  }
}

export function isEmpty(rows: CatalogRows): boolean {
  return rows.sets.length === 0 && rows.cards.length === 0 && rows.printings.length === 0
}

/** Aggiorna la copia locale: tutto al primo avvio, poi solo le righe cambiate. */
export async function syncSnapshot(
  local: CatalogSnapshot | null,
  fetchRowsSince: FetchRowsSince,
  now: number,
): Promise<{ snapshot: CatalogSnapshot; changed: boolean }> {
  const delta = await fetchRowsSince(local ? sinceFor(local.watermark) : null)
  return { snapshot: mergeSnapshot(local, delta, now), changed: local === null || !isEmpty(delta) }
}

/** Dalle righe del database al catalogo usato da ricerca, filtri e dettaglio. */
export function buildCatalog(rows: CatalogRows): Catalog {
  const sets = [...rows.sets].sort((a, b) => a.code.localeCompare(b.code))
  const setCodes = new Map(sets.map((s) => [s.series_id, s.code]))

  const printingsByCard = new Map<string, CatalogPrinting[]>()
  for (const p of [...rows.printings].sort((a, b) => a.print_id.localeCompare(b.print_id))) {
    const list = printingsByCard.get(p.card_code) ?? []
    const printing: CatalogPrinting = {
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
    cards: [...rows.cards]
      .sort((a, b) => a.card_code.localeCompare(b.card_code))
      .map((c) => ({
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
