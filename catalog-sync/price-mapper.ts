// Price Mapper (RIB-32, ADR-0008): collega ogni Printing al suo prodotto Cardmarket.
// Codice puro, senza rete né database.
//
// Cardmarket dà lo stesso nome a tutte le Printing di una Card ("Roronoa Zoro (OP01-001)") e
// tiene ogni Set due volte, in un'espansione inglese e in una non inglese. L'abbinamento è quindi
// euristico:
// 1. si scartano le espansioni non inglesi;
// 2. per ogni Set si sceglie l'espansione inglese che contiene più Card Code del Set;
// 3. per ogni Card del Set, se l'espansione ha tanti prodotti quante Printing, si abbinano in
//    ordine: la base al prodotto più economico, le altre per idProduct;
// 4. se il Set ha solo la base della Card ma Cardmarket ha più versioni (negli Starter Deck la
//    "Super PreRelease" timbrata, poi le ristampe), la base va al prodotto più economico tra
//    quelli aggiunti il giorno dell'uscita, cercati in tutte le espansioni inglesi (RIB-96);
// 5. una ristampa (_rN) rimasta senza prodotto prende quello della base. Altrimenti niente.
// I Mapping Override dell'Admin prevalgono sempre, anche per togliere un abbinamento.

export interface CardmarketProduct {
  idProduct: number
  name: string
  idExpansion: number
  /** Quando Cardmarket l'ha aggiunto ("2023-01-06 10:12:00"): distingue l'uscita dalle aggiunte successive. */
  dateAdded?: string
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

// Alcuni Starter Deck giapponesi sono "(Japanese)" invece di "(Non-English)", e un box ha il
// refuso "(Asia Region Lega)" (RIB-96).
const NON_ENGLISH = /\((Non-English|Asia Region Legal?|Japanese)\)/

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
  const englishOf = new Map<string, CardmarketProduct[]>()
  // Quanti prodotti di ogni serie di Card Code ("ST11", "P") ha ogni espansione inglese.
  const seriesCount = new Map<string, number>()
  const expansionsOf = new Map<string, Set<number>>()
  for (const p of [...input.products].sort((a, b) => a.idProduct - b.idProduct)) {
    const code = productCardCode(p.name)
    if (code === null || nonEnglish.has(p.idExpansion)) continue
    const key = `${code}|${String(p.idExpansion)}`
    productsOf.set(key, [...(productsOf.get(key) ?? []), p])
    englishOf.set(code, [...(englishOf.get(code) ?? []), p])
    const series = `${seriesOf(code)}|${String(p.idExpansion)}`
    seriesCount.set(series, (seriesCount.get(series) ?? 0) + 1)
    expansionsOf.set(code, (expansionsOf.get(code) ?? new Set()).add(p.idExpansion))
  }

  const sets = groupBy(input.printings, (p) => p.seriesId)
  const homes = homeExpansions(sets, expansionsOf)
  const matched: PriceMapping[] = []
  for (const [seriesId, setPrintings] of sets) {
    const expansion = homes.get(seriesId)
    for (const [cardCode, cardPrintings] of groupBy(setPrintings, (p) => p.cardCode)) {
      const candidates =
        expansion === undefined ? [] : (productsOf.get(`${cardCode}|${String(expansion)}`) ?? [])
      const ordered = [...cardPrintings].sort(printingOrder)
      const [only] = ordered
      // Regola 4: il Set ha solo la base e l'espansione non ha esattamente un prodotto: si
      // guarda l'uscita originale della Card in tutte le espansioni inglesi. L'espansione del Set
      // può non essere quella giusta (uno Starter Deck pieno di ristampe, le Promo che finiscono
      // nell'espansione dei DON!! Card Pack con le versioni speciali).
      // Prima l'espansione "di casa" della Card, quella con più carte della sua serie (le Promo
      // nell'espansione delle Promo, ST11 in "Starter Deck: Uta" e non nella busta del Capodanno
      // cinese uscita prima); se lì non c'è un prezzo, tutte.
      if (ordered.length === 1 && only && candidates.length !== 1) {
        const all = englishOf.get(cardCode) ?? []
        const own = ownExpansion(cardCode, all, seriesCount)
        const found = matchBaseOnly(only, own, trends)
        matched.push(...(found.length > 0 ? found : matchBaseOnly(only, all, trends)))
      } else {
        matched.push(...matchInOrder(ordered, candidates, trends))
      }
    }
  }
  // Rete di sicurezza: un prodotto finito su due Printing è ambiguo, non lo si usa.
  const uses = groupBy(matched, (m) => m.productId)
  const auto = matched.filter((m) => uses.get(m.productId)?.length === 1)

  // Regola 5 (RIB-96): una ristampa (_rN) senza prodotto suo, di solito negli Starter Deck,
  // per Cardmarket è la stessa carta dell'originale: prende il prodotto della base.
  const byPrint = new Map(auto.map((m) => [m.printId, m]))
  for (const p of input.printings) {
    if (!/_r\d+$/.test(p.printId) || byPrint.has(p.printId)) continue
    const base = byPrint.get(p.cardCode)
    if (base) auto.push({ ...base, printId: p.printId })
  }

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

/**
 * Il Set ha solo la base, Cardmarket più versioni della stessa Card (regola 4). Si guarda solo
 * il giorno dell'uscita, quando arrivano base e varianti promozionali (le ristampe arrivano
 * dopo e possono costare meno della base); la base è la più economica. Sicuro ("high") se costa
 * al massimo la metà della seconda, altrimenti da controllare. Senza prezzi, niente.
 */
function matchBaseOnly(
  printing: MapperPrinting,
  products: readonly CardmarketProduct[],
  trends: ReadonlyMap<number, number | null>,
): PriceMapping[] {
  if (printing.printId !== printing.cardCode) return []
  const day = (p: CardmarketProduct) => p.dateAdded?.slice(0, 10) ?? ''
  const firstDay = products.map(day).sort()[0] ?? ''
  const priced = products
    .filter((p) => day(p) === firstDay)
    .flatMap((p) => {
      const trend = trends.get(p.idProduct)
      return typeof trend === 'number' && trend > 0 ? [{ p, trend }] : []
    })
    .sort((a, b) => a.trend - b.trend)
  const [best, second] = priced
  if (!best) return []
  const confidence = !second || best.trend * 2 <= second.trend ? 'high' : 'check'
  return [{ printId: printing.printId, productId: best.p.idProduct, source: 'auto', confidence }]
}

/** La serie di un Card Code: "ST11" per ST11-001, "P" per P-030. */
function seriesOf(cardCode: string): string {
  return cardCode.split('-')[0] ?? cardCode
}

/** I prodotti della Card nell'espansione con più carte della sua serie (a parità, la più vecchia). */
function ownExpansion(
  cardCode: string,
  products: readonly CardmarketProduct[],
  seriesCount: ReadonlyMap<string, number>,
): CardmarketProduct[] {
  const series = seriesOf(cardCode)
  const count = (expansion: number) => seriesCount.get(`${series}|${String(expansion)}`) ?? 0
  const [best] = [...new Set(products.map((p) => p.idExpansion))].sort(
    (a, b) => count(b) - count(a) || a - b,
  )
  return products.filter((p) => p.idExpansion === best)
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
