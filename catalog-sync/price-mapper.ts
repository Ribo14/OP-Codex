// Price Mapper (RIB-32, ADR-0008): collega ogni Printing al suo prodotto Cardmarket.
// Codice puro, senza rete né database.
//
// Cardmarket dà lo stesso nome a tutte le Printing di una Card ("Roronoa Zoro (OP01-001)") e
// tiene ogni Set due volte, in un'espansione inglese e in una non inglese. L'abbinamento è quindi
// euristico:
// 1. si scartano le espansioni non inglesi;
// 2. per ogni Set si sceglie l'espansione inglese che contiene più Card Code del Set;
// 3. per ogni Card del Set, se l'espansione ha tanti prodotti quante Printing, si abbinano in
//    ordine: la base al prodotto più economico, le altre per idProduct. Altrimenti niente.
// I Mapping Override dell'Admin prevalgono sempre, anche per togliere un abbinamento.

export interface CardmarketProduct {
  idProduct: number
  name: string
  idExpansion: number
}

/** Prodotto sigillato (busta, box): serve solo a capire la lingua di un'espansione. */
export interface CardmarketSealed {
  name: string
  idExpansion: number
}

export interface MapperPrinting {
  printId: string
  cardCode: string
  seriesId: number
}

export interface PriceMapping {
  printId: string
  productId: number
  source: 'auto' | 'override'
  /** 'check': abbinamento automatico plausibile ma da controllare (ordine dei prodotti diverso). */
  confidence: 'high' | 'check'
}

export interface CardmarketMapperInput {
  printings: readonly MapperPrinting[]
  products: readonly CardmarketProduct[]
  /** Espansioni non inglesi, da nonEnglishExpansions. */
  nonEnglish: ReadonlySet<number>
  /** Prezzo trend per idProduct: serve a riconoscere la base, di solito la più economica. */
  trends: ReadonlyMap<number, number | null>
  /** Mapping Override per Print ID: un prodotto, oppure null = nessun prodotto. */
  overrides: ReadonlyMap<string, number | null>
}

const CODE_IN_NAME = /\(\s*((?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3})\s*\)/

/** Il Card Code nel nome di un prodotto Cardmarket, o null (DON!!, trofei…). */
export function productCardCode(name: string): string | null {
  return CODE_IN_NAME.exec(name)?.[1] ?? null
}

const NON_ENGLISH = /\((Non-English|Asia Region Legal)\)/

/** Le espansioni in cui la maggior parte dei prodotti sigillati non è in inglese. */
export function nonEnglishExpansions(sealed: readonly CardmarketSealed[]): Set<number> {
  const counts = new Map<number, { total: number; foreign: number }>()
  for (const item of sealed) {
    const count = counts.get(item.idExpansion) ?? { total: 0, foreign: 0 }
    count.total++
    if (NON_ENGLISH.test(item.name)) count.foreign++
    counts.set(item.idExpansion, count)
  }
  return new Set(
    [...counts].filter(([, c]) => c.foreign * 2 > c.total).map(([expansion]) => expansion),
  )
}

const byPrintId = new Intl.Collator('en', { numeric: true })

/** Base per prima, poi le altre Printing in ordine di numero (_p2 prima di _p10). */
function printingOrder(a: MapperPrinting, b: MapperPrinting): number {
  if (a.printId === a.cardCode) return -1
  if (b.printId === b.cardCode) return 1
  return byPrintId.compare(a.printId, b.printId)
}

function groupBy<T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = groups.get(k)
    if (list) list.push(item)
    else groups.set(k, [item])
  }
  return groups
}

export function mapCardmarket(input: CardmarketMapperInput): PriceMapping[] {
  const { nonEnglish, trends, overrides } = input

  // Prodotti inglesi con Card Code, per (Card Code, espansione), in ordine di idProduct.
  const productsOf = new Map<string, CardmarketProduct[]>()
  const expansionsOf = new Map<string, Set<number>>()
  for (const p of [...input.products].sort((a, b) => a.idProduct - b.idProduct)) {
    const code = productCardCode(p.name)
    if (code === null || nonEnglish.has(p.idExpansion)) continue
    const key = `${code}|${String(p.idExpansion)}`
    productsOf.set(key, [...(productsOf.get(key) ?? []), p])
    expansionsOf.set(code, (expansionsOf.get(code) ?? new Set()).add(p.idExpansion))
  }

  const sets = groupBy(input.printings, (p) => p.seriesId)
  const homes = homeExpansions(sets, expansionsOf)
  const matched: PriceMapping[] = []
  for (const [seriesId, setPrintings] of sets) {
    const expansion = homes.get(seriesId)
    if (expansion === undefined) continue
    for (const [cardCode, cardPrintings] of groupBy(setPrintings, (p) => p.cardCode)) {
      const candidates = productsOf.get(`${cardCode}|${String(expansion)}`) ?? []
      matched.push(...matchInOrder([...cardPrintings].sort(printingOrder), candidates, trends))
    }
  }
  // Rete di sicurezza: un prodotto finito su due Printing è ambiguo, non lo si usa.
  const uses = groupBy(matched, (m) => m.productId)
  const auto = matched.filter((m) => uses.get(m.productId)?.length === 1)

  // Gli override vincono: sostituiscono l'abbinamento della loro Printing e tolgono il loro
  // prodotto a qualunque altra Printing abbinata in automatico.
  const overridden = new Set([...overrides.values()].filter((id) => id !== null))
  const result = auto.filter((m) => !overrides.has(m.printId) && !overridden.has(m.productId))
  for (const [printId, productId] of overrides) {
    if (productId !== null)
      result.push({ printId, productId, source: 'override', confidence: 'high' })
  }
  return result.sort((a, b) => byPrintId.compare(a.printId, b.printId))
}

/**
 * L'espansione inglese di ogni Set: quella che contiene più Card Code del Set. Un'espansione è
 * di un solo Set: la prende il Set che ci si sovrappone di più (uno Starter Deck di ristampe non
 * porta via al booster d'origine la sua espansione) e gli altri ripiegano sulla migliore libera.
 */
function homeExpansions(
  sets: ReadonlyMap<number, readonly MapperPrinting[]>,
  expansionsOf: ReadonlyMap<string, ReadonlySet<number>>,
): Map<number, number> {
  const candidates: { seriesId: number; expansion: number; count: number; share: number }[] = []
  for (const [seriesId, printings] of sets) {
    const codes = new Set(printings.map((p) => p.cardCode))
    const counts = new Map<number, number>()
    for (const code of codes) {
      for (const expansion of expansionsOf.get(code) ?? []) {
        counts.set(expansion, (counts.get(expansion) ?? 0) + 1)
      }
    }
    for (const [expansion, count] of counts) {
      candidates.push({ seriesId, expansion, count, share: count / codes.size })
    }
  }
  // Prima le sovrapposizioni più ampie; a parità la quota del Set più alta, poi la più vecchia.
  candidates.sort(
    (a, b) =>
      b.count - a.count ||
      b.share - a.share ||
      a.expansion - b.expansion ||
      a.seriesId - b.seriesId,
  )
  const homes = new Map<number, number>()
  const taken = new Set<number>()
  for (const { seriesId, expansion } of candidates) {
    if (homes.has(seriesId) || taken.has(expansion)) continue
    homes.set(seriesId, expansion)
    taken.add(expansion)
  }
  return homes
}

function matchInOrder(
  printings: readonly MapperPrinting[],
  products: readonly CardmarketProduct[],
  trends: ReadonlyMap<number, number | null>,
): PriceMapping[] {
  if (products.length === 0 || products.length !== printings.length) return []
  const ordered = [...products]
  let confidence: PriceMapping['confidence'] = 'high'
  // La base è di solito la più economica: se Cardmarket ha inserito prima una parallela, la
  // base va spostata in testa e l'abbinamento resta da controllare.
  if (printings[0]?.printId === printings[0]?.cardCode && ordered.length > 1) {
    const cheapest = cheapestIndex(ordered, trends)
    if (cheapest > 0) {
      const [base] = ordered.splice(cheapest, 1)
      if (base) ordered.unshift(base)
      confidence = 'check'
    }
  }
  return printings.flatMap((p, i) => {
    const product = ordered[i]
    return product
      ? [{ printId: p.printId, productId: product.idProduct, source: 'auto' as const, confidence }]
      : []
  })
}

/** Indice del prodotto con il trend più basso; 0 se i prezzi mancano. */
function cheapestIndex(
  products: readonly CardmarketProduct[],
  trends: ReadonlyMap<number, number | null>,
): number {
  let best = 0
  let bestTrend = Infinity
  products.forEach((p, i) => {
    const trend = trends.get(p.idProduct)
    if (typeof trend === 'number' && trend > 0 && trend < bestTrend) {
      best = i
      bestTrend = trend
    }
  })
  return best
}
