import { getSupabase } from '@/lib/supabase'

// Area Admin, abbinamenti dei prezzi (RIB-32, slice 5.2, user story 77). Il Price Mapper abbina da
// solo circa il 90% delle Printing; qui l'Admin controlla quelle "da verificare" o senza prezzo e
// imposta un Mapping Override, che vale dal prossimo Price Sync (ogni notte). Il database accetta
// gli override solo dall'Admin attivo e li registra (ADR-0014).

export interface MappingRow {
  print_id: string
  product_id: number
  source: string
  confidence: string
}

export interface OverrideRow {
  print_id: string
  product_id: number | null
  note: string | null
}

export interface ProductRow {
  id_product: number
  name: string
  id_expansion: number
  trend: number | null
  low: number | null
}

export type PrintingStatus = 'ok' | 'check' | 'missing' | 'override' | 'excluded'

/** Lo stato di una Printing; l'override salvato conta subito, anche prima del Price Sync. */
export function printingStatus(
  mapping: MappingRow | undefined,
  override: OverrideRow | undefined,
): PrintingStatus {
  if (override) return override.product_id === null ? 'excluded' : 'override'
  if (!mapping) return 'missing'
  return mapping.confidence === 'check' ? 'check' : 'ok'
}

/** La scelta nel menu: "auto" (nessun override), "none" (nessun prodotto) o l'id del prodotto. */
export type Choice = 'auto' | 'none' | `${number}`

export function choiceOf(override: OverrideRow | undefined): Choice {
  if (!override) return 'auto'
  return override.product_id === null ? 'none' : (String(override.product_id) as Choice)
}

export interface QueueEntry {
  cardCode: string
  count: number
}

/** Le carte con Printing nello stato chiesto, le più numerose prima. */
export function mappingQueue(
  printings: readonly { printId: string; cardCode: string }[],
  mappings: ReadonlyMap<string, MappingRow>,
  overrides: ReadonlyMap<string, OverrideRow>,
  status: 'check' | 'missing',
): QueueEntry[] {
  const counts = new Map<string, number>()
  for (const p of printings) {
    if (printingStatus(mappings.get(p.printId), overrides.get(p.printId)) !== status) continue
    counts.set(p.cardCode, (counts.get(p.cardCode) ?? 0) + 1)
  }
  return [...counts]
    .map(([cardCode, count]) => ({ cardCode, count }))
    .sort((a, b) => b.count - a.count || a.cardCode.localeCompare(b.cardCode))
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

const PAGE = 1000

/** Tutti gli abbinamenti Cardmarket (circa 4.500 righe, a pagine). */
export async function fetchMappings(): Promise<Map<string, MappingRow>> {
  const rows: MappingRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from('price_mappings')
      .select('print_id, product_id, source, confidence')
      .eq('marketplace', 'cardmarket')
      .order('print_id')
      .range(from, from + PAGE - 1)
    fail(error)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return new Map(rows.map((r) => [r.print_id, r]))
}

export async function fetchOverrides(): Promise<Map<string, OverrideRow>> {
  const { data, error } = await getSupabase()
    .from('mapping_overrides')
    .select('print_id, product_id, note')
    .eq('marketplace', 'cardmarket')
  fail(error)
  return new Map((data ?? []).map((r) => [r.print_id, r]))
}

/** I prodotti Cardmarket inglesi con quel Card Code, in ordine di id. */
export async function fetchProducts(cardCode: string): Promise<ProductRow[]> {
  const { data, error } = await getSupabase()
    .from('cardmarket_products')
    .select('id_product, name, id_expansion, trend, low')
    .eq('card_code', cardCode)
    .order('id_product')
  fail(error)
  return data ?? []
}

/** Salva la scelta: "auto" toglie l'override, gli altri lo creano o lo aggiornano. */
export async function saveChoice(printId: string, choice: Choice, exists: boolean): Promise<void> {
  const supabase = getSupabase()
  const table = supabase.from('mapping_overrides')
  if (choice === 'auto') {
    const { error } = await table.delete().eq('print_id', printId).eq('marketplace', 'cardmarket')
    fail(error)
    return
  }
  const productId = choice === 'none' ? null : Number(choice)
  const { error } = exists
    ? await table
        .update({ product_id: productId })
        .eq('print_id', printId)
        .eq('marketplace', 'cardmarket')
    : await table.insert({ print_id: printId, marketplace: 'cardmarket', product_id: productId })
  fail(error)
}
