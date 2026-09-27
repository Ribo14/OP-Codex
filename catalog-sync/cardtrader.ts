// Prezzi CardTrader (RIB-32, slice 5.5, ADR-0008): API v2 con il token dell'utente.
// Qui la parte pura: lettura delle risposte, abbinamento incrociato e prezzo minimo.
//
// Abbinamento: ogni blueprint (la "carta" di CardTrader) elenca gli id dei prodotti Cardmarket a
// cui corrisponde (anche delle varianti di lingua). Una Printing ha già il suo prodotto Cardmarket
// (Price Mapper e Mapping Override): le si assegna il blueprint che lo contiene. Così un override
// dell'Admin corregge anche CardTrader.

/** One Piece nell'API di CardTrader. */
export const ONE_PIECE_GAME_ID = 15
/** Categoria delle carte singole di One Piece (le altre sono buste, box, accessori…). */
export const ONE_PIECE_SINGLES = 192

export interface CardTraderExpansion {
  id: number
  /** Codice dell'espansione (op01, op-14, eb-01, promo…): irregolare, si prende così com'è. */
  code: string
  name: string
}

export interface CardTraderBlueprint {
  id: number
  cardMarketIds: number[]
}

export interface CardTraderOffer {
  cents: number
  currency: string
  quantity: number
  graded: boolean
  condition: string | null
  language: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function list(value: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`Risposta CardTrader non valida: ${what}`)
  return value.filter(isRecord)
}

export function parseExpansions(value: unknown): CardTraderExpansion[] {
  return list(value, 'espansioni').flatMap((e) =>
    typeof e.id === 'number' && e.game_id === ONE_PIECE_GAME_ID
      ? [
          {
            id: e.id,
            code: typeof e.code === 'string' ? e.code : '',
            name: typeof e.name === 'string' ? e.name : '',
          },
        ]
      : [],
  )
}

export function parseBlueprints(value: unknown): CardTraderBlueprint[] {
  return list(value, 'blueprint').flatMap((b) =>
    typeof b.id === 'number' && b.category_id === ONE_PIECE_SINGLES
      ? [
          {
            id: b.id,
            cardMarketIds: Array.isArray(b.card_market_ids)
              ? b.card_market_ids.filter((id): id is number => typeof id === 'number')
              : [],
          },
        ]
      : [],
  )
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** Un'offerta; il prezzo arriva come { cents, currency } o come price_cents / price_currency. */
function offer(p: Record<string, unknown>): CardTraderOffer | null {
  const price = isRecord(p.price) ? p.price : {}
  const cents = typeof price.cents === 'number' ? price.cents : p.price_cents
  const currency = text(price.currency) ?? text(p.price_currency)
  if (typeof cents !== 'number' || currency === null) return null
  const properties = isRecord(p.properties_hash) ? p.properties_hash : {}
  return {
    cents,
    currency,
    quantity: typeof p.quantity === 'number' ? p.quantity : 0,
    graded: p.graded === true,
    condition: text(properties.condition),
    language: text(properties.onepiece_language),
  }
}

/** Le offerte del marketplace di un'espansione, per blueprint (le 25 più economiche di ognuno). */
export function parseMarketplace(value: unknown): Map<number, CardTraderOffer[]> {
  if (!isRecord(value)) throw new Error('Risposta CardTrader non valida: marketplace')
  const result = new Map<number, CardTraderOffer[]>()
  for (const [key, products] of Object.entries(value)) {
    const blueprintId = Number(key)
    if (!Number.isInteger(blueprintId) || !Array.isArray(products)) continue
    result.set(
      blueprintId,
      products.filter(isRecord).flatMap((p) => offer(p) ?? []),
    )
  }
  return result
}

const GOOD_CONDITIONS = new Set(['Mint', 'Near Mint'])

/**
 * Il prezzo minimo confrontabile con Cardmarket: offerte disponibili, in euro, non gradate, in
 * inglese e Near Mint o Mint (senza indicazione valgono come inglese e Near Mint).
 */
export function cheapestEuroCents(offers: readonly CardTraderOffer[]): number | null {
  let best: number | null = null
  for (const o of offers) {
    if (o.currency !== 'EUR' || o.quantity < 1 || o.graded) continue
    if (o.language !== null && o.language !== 'en') continue
    if (o.condition !== null && !GOOD_CONDITIONS.has(o.condition)) continue
    if (o.cents > 0 && (best === null || o.cents < best)) best = o.cents
  }
  return best
}

/** Print ID → blueprint, dal prodotto Cardmarket di ogni Printing; gli id ambigui si saltano. */
export function mapCardTrader(
  cardmarketByPrinting: ReadonlyMap<string, number>,
  blueprints: readonly CardTraderBlueprint[],
): Map<string, number> {
  const blueprintsOf = new Map<number, Set<number>>()
  for (const b of blueprints) {
    for (const id of b.cardMarketIds) {
      blueprintsOf.set(id, (blueprintsOf.get(id) ?? new Set()).add(b.id))
    }
  }
  const result = new Map<string, number>()
  for (const [printId, productId] of cardmarketByPrinting) {
    const found = blueprintsOf.get(productId)
    const [only] = found ?? []
    if (found?.size === 1 && only !== undefined) result.set(printId, only)
  }
  return result
}
