import type postgres from 'postgres'
import { finishJobRun, startJobRun } from './catalog-store.ts'
import {
  mapCardmarket,
  nonEnglishExpansions,
  productCardCode,
  type CardmarketProduct,
  type CardmarketSealed,
  type PriceMapping,
} from './price-mapper.ts'

// Price Sync (RIB-32, ADR-0008): ogni notte i file pubblici di Cardmarket (gioco 18 = One Piece),
// l'abbinamento delle Printing (Price Mapper) e il salvataggio di prezzi e storico.

const FILES = 'https://downloads.s3.cardmarket.com/productCatalog'
export const CARDMARKET_FILES = {
  priceGuide: `${FILES}/priceGuide/price_guide_18.json`,
  singles: `${FILES}/productList/products_singles_18.json`,
  nonSingles: `${FILES}/productList/products_nonsingles_18.json`,
} as const

/** Giorni di Price Snapshot giornalieri; prima resta solo il lunedì. */
export const DAILY_HISTORY_DAYS = 90

/** Sotto questa soglia i file sono sicuramente incompleti o cambiati di formato. */
const MIN_PRODUCTS = 1000

export interface CardmarketPrice {
  idProduct: number
  trend: number | null
  low: number | null
}

export interface CardmarketFiles {
  /** Giorno del listino (data di createdAt del price guide), AAAA-MM-GG. */
  priceDate: string
  prices: CardmarketPrice[]
  singles: CardmarketProduct[]
  sealed: CardmarketSealed[]
}

function fail(what: string): never {
  throw new Error(`File Cardmarket non valido: ${what}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function listOf(file: unknown, key: string, name: string): Record<string, unknown>[] {
  const list = isRecord(file) ? file[key] : undefined
  if (!Array.isArray(list)) fail(`${name} senza "${key}"`)
  return list.filter(isRecord)
}

/** Prezzo in euro, o null: Cardmarket usa null o 0 quando il prezzo non c'è. */
function euro(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : null
}

function products(file: unknown, name: string): CardmarketProduct[] {
  return listOf(file, 'products', name).flatMap((p) =>
    typeof p.idProduct === 'number' &&
    typeof p.name === 'string' &&
    typeof p.idExpansion === 'number'
      ? [{ idProduct: p.idProduct, name: p.name, idExpansion: p.idExpansion }]
      : [],
  )
}

/** Controlla e riduce i tre file ai soli campi usati. Lancia un errore se il formato è cambiato. */
export function parseCardmarketFiles(raw: {
  priceGuide: unknown
  singles: unknown
  nonSingles: unknown
}): CardmarketFiles {
  const createdAt = isRecord(raw.priceGuide) ? raw.priceGuide.createdAt : undefined
  const priceDate = typeof createdAt === 'string' ? /^\d{4}-\d{2}-\d{2}/.exec(createdAt)?.[0] : null
  if (!priceDate) fail('price guide senza "createdAt"')

  const prices = listOf(raw.priceGuide, 'priceGuides', 'price guide').flatMap((g) =>
    typeof g.idProduct === 'number'
      ? [{ idProduct: g.idProduct, trend: euro(g.trend), low: euro(g.low) }]
      : [],
  )
  const singles = products(raw.singles, 'products_singles')
  const sealed = products(raw.nonSingles, 'products_nonsingles')
  if (prices.length < MIN_PRODUCTS) fail(`solo ${String(prices.length)} prezzi`)
  if (singles.length < MIN_PRODUCTS) fail(`solo ${String(singles.length)} carte`)
  return { priceDate, prices, singles, sealed }
}

export interface PriceSyncStats {
  priceDate: string
  products: number
  mapped: number
  toCheck: number
  overrides: number
  unmapped: number
  pricesChanged: number
  snapshots: number
  snapshotsPruned: number
}

type Tx = postgres.TransactionSql

/** Salva prodotti, abbinamenti, ultimi prezzi e storico. Va chiamata dentro una transazione. */
export async function savePrices(tx: Tx, files: CardmarketFiles): Promise<PriceSyncStats> {
  const printings = await tx<{ print_id: string; card_code: string; series_id: number }[]>`
    select print_id, card_code, series_id from public.printings
  `
  const overrideRows = await tx<{ print_id: string; product_id: number | null }[]>`
    select print_id, product_id from public.mapping_overrides where marketplace = 'cardmarket'
  `
  const priceOf = new Map(files.prices.map((p) => [p.idProduct, p]))
  const mappings = mapCardmarket({
    printings: printings.map((p) => ({
      printId: p.print_id,
      cardCode: p.card_code,
      seriesId: p.series_id,
    })),
    products: files.singles,
    nonEnglish: nonEnglishExpansions(files.sealed),
    trends: new Map(files.prices.map((p) => [p.idProduct, p.trend])),
    overrides: new Map(overrideRows.map((o) => [o.print_id, o.product_id])),
  })

  const productCount = await saveProducts(tx, files, priceOf)
  await saveMappings(tx, mappings)

  const rows = mappings.map((m) => ({
    print_id: m.printId,
    product_id: m.productId,
    trend: priceOf.get(m.productId)?.trend ?? null,
    low: priceOf.get(m.productId)?.low ?? null,
  }))

  // Ultimo prezzo: si tocca updated_at solo se qualcosa è cambiato, così il dispositivo
  // riscarica solo i prezzi davvero nuovi.
  let pricesChanged = 0
  for (const batch of chunks(rows)) {
    const result = await tx`
      insert into public.printing_prices as p (print_id, marketplace, product_id, trend, low, price_date)
      select r.print_id, 'cardmarket', r.product_id, r.trend, r.low, ${files.priceDate}::date
      from jsonb_to_recordset(${tx.json(batch)}::jsonb)
        as r(print_id text, product_id integer, trend numeric, low numeric)
      on conflict (print_id, marketplace) do update set
        product_id = excluded.product_id,
        trend = excluded.trend,
        low = excluded.low,
        price_date = excluded.price_date,
        updated_at = now()
      where (p.product_id, p.trend, p.low, p.price_date)
        is distinct from (excluded.product_id, excluded.trend, excluded.low, excluded.price_date)
      returning 1
    `
    pricesChanged += result.length
  }
  // Una Printing che ha perso l'abbinamento resta, con i prezzi vuoti.
  const mapped = mappings.map((m) => m.printId)
  const emptied = await tx`
    update public.printing_prices set
      product_id = null, trend = null, low = null, price_date = null, updated_at = now()
    where marketplace = 'cardmarket'
      and product_id is not null
      and print_id <> all(${mapped}::text[])
    returning 1
  `
  pricesChanged += emptied.length

  // Storico del giorno (rilanciare il job lo stesso giorno aggiorna, non duplica).
  let snapshots = 0
  for (const batch of chunks(rows.filter((r) => r.trend !== null || r.low !== null))) {
    const result = await tx`
      insert into public.price_snapshots (print_id, marketplace, day, trend, low)
      select r.print_id, 'cardmarket', ${files.priceDate}::date, r.trend, r.low
      from jsonb_to_recordset(${tx.json(batch)}::jsonb)
        as r(print_id text, trend numeric, low numeric)
      on conflict (print_id, marketplace, day) do update set trend = excluded.trend, low = excluded.low
      returning 1
    `
    snapshots += result.length
  }
  const pruned = await pruneSnapshots(tx, files.priceDate)

  return {
    priceDate: files.priceDate,
    products: productCount,
    mapped: mappings.length,
    toCheck: mappings.filter((m) => m.confidence === 'check').length,
    overrides: mappings.filter((m) => m.source === 'override').length,
    unmapped: printings.length - mappings.length,
    pricesChanged,
    snapshots,
    snapshotsPruned: pruned,
  }
}

/** Oltre i 90 giorni resta un Price Snapshot a settimana, quello del lunedì. */
export async function pruneSnapshots(tx: Tx, today: string): Promise<number> {
  const result = await tx`
    delete from public.price_snapshots
    where day < ${today}::date - ${DAILY_HISTORY_DAYS}::int
      and extract(isodow from day) <> 1
    returning 1
  `
  return result.length
}

/** I prodotti inglesi con Card Code, per la scelta degli override dall'Admin. */
async function saveProducts(
  tx: Tx,
  files: CardmarketFiles,
  priceOf: ReadonlyMap<number, CardmarketPrice>,
): Promise<number> {
  const nonEnglish = nonEnglishExpansions(files.sealed)
  const rows = files.singles.flatMap((p) => {
    const cardCode = productCardCode(p.name)
    return cardCode && !nonEnglish.has(p.idExpansion)
      ? [
          {
            id_product: p.idProduct,
            card_code: cardCode,
            name: p.name,
            id_expansion: p.idExpansion,
            trend: priceOf.get(p.idProduct)?.trend ?? null,
            low: priceOf.get(p.idProduct)?.low ?? null,
          },
        ]
      : []
  })
  for (const batch of chunks(rows)) {
    await tx`
      insert into public.cardmarket_products as c
        (id_product, card_code, name, id_expansion, trend, low)
      select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as r(
        id_product integer, card_code text, name text, id_expansion integer,
        trend numeric, low numeric
      )
      on conflict (id_product) do update set
        card_code = excluded.card_code,
        name = excluded.name,
        id_expansion = excluded.id_expansion,
        trend = excluded.trend,
        low = excluded.low,
        updated_at = now()
      where (c.card_code, c.name, c.id_expansion, c.trend, c.low)
        is distinct from
            (excluded.card_code, excluded.name, excluded.id_expansion, excluded.trend, excluded.low)
    `
  }
  return rows.length
}

async function saveMappings(tx: Tx, mappings: readonly PriceMapping[]): Promise<void> {
  await tx`delete from public.price_mappings where marketplace = 'cardmarket'`
  for (const batch of chunks(mappings)) {
    const rows = batch.map((m) => ({
      print_id: m.printId,
      product_id: m.productId,
      source: m.source,
      confidence: m.confidence,
    }))
    await tx`
      insert into public.price_mappings (print_id, marketplace, product_id, source, confidence)
      select r.print_id, 'cardmarket', r.product_id, r.source, r.confidence
      from jsonb_to_recordset(${tx.json(rows)}::jsonb)
        as r(print_id text, product_id integer, source text, confidence text)
    `
  }
}

const BATCH_SIZE = 1000

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) result.push(items.slice(i, i + BATCH_SIZE))
  return result
}

export interface PriceSyncOptions {
  sql: postgres.Sql
  /** Scarica un file JSON di Cardmarket. */
  fetchJson: (url: string) => Promise<unknown>
}

/** Esegue il Price Sync e lo registra in job_runs. Se un file non va, non scrive niente. */
export async function runPriceSync({ sql, fetchJson }: PriceSyncOptions): Promise<PriceSyncStats> {
  const runId = await startJobRun(sql, 'price_sync')
  try {
    const files = parseCardmarketFiles({
      priceGuide: await fetchJson(CARDMARKET_FILES.priceGuide),
      singles: await fetchJson(CARDMARKET_FILES.singles),
      nonSingles: await fetchJson(CARDMARKET_FILES.nonSingles),
    })
    const stats = await sql.begin((tx) => savePrices(tx, files))
    await finishJobRun(sql, runId, { status: 'success', stats })
    return stats
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
    throw error
  }
}
