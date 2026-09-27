import type postgres from 'postgres'
import {
  cheapestEuroCents,
  mapCardTrader,
  parseBlueprints,
  parseExpansions,
  parseMarketplace,
  type CardTraderBlueprint,
  type CardTraderOffer,
} from './cardtrader.ts'
import { finishJobRun, startJobRun } from './catalog-store.ts'

// Job CardTrader (RIB-32, slice 5.5): dopo il Price Sync di Cardmarket scarica blueprint e offerte
// delle espansioni One Piece, abbina le Printing tramite i loro prodotti Cardmarket e salva il
// prezzo minimo in euro. Richieste in sequenza con una pausa: l'API permette 10 richieste al
// secondo sul marketplace e 200 ogni 10 secondi in tutto.

export const CARDTRADER_API = 'https://api.cardtrader.com/api/v2'

type Tx = postgres.TransactionSql

export interface CardTraderPrice {
  blueprintId: number
  /** Minimo in euro, o null se nessuna offerta confrontabile. */
  low: number | null
  /** Codice dell'espansione del blueprint su CardTrader (per le wishlist). */
  expansionCode: string | null
}

export interface CardTraderSaveStats {
  mapped: number
  withPrice: number
  pricesChanged: number
}

/** Salva abbinamenti e ultimi prezzi CardTrader. Va chiamata dentro una transazione. */
export async function saveCardTraderPrices(
  tx: Tx,
  prices: ReadonlyMap<string, CardTraderPrice>,
  priceDate: string,
): Promise<CardTraderSaveStats> {
  const rows = [...prices].map(([printId, p]) => ({
    print_id: printId,
    product_id: p.blueprintId,
    low: p.low,
    market_set: p.expansionCode,
  }))
  await tx`delete from public.price_mappings where marketplace = 'cardtrader'`
  let pricesChanged = 0
  for (const batch of chunks(rows)) {
    await tx`
      insert into public.price_mappings (print_id, marketplace, product_id, source, confidence)
      select r.print_id, 'cardtrader', r.product_id, 'auto', 'high'
      from jsonb_to_recordset(${tx.json(batch)}::jsonb) as r(print_id text, product_id integer)
    `
    const changed = await tx`
      insert into public.printing_prices as p
        (print_id, marketplace, product_id, low, market_set, price_date)
      select r.print_id, 'cardtrader', r.product_id, r.low, r.market_set, ${priceDate}::date
      from jsonb_to_recordset(${tx.json(batch)}::jsonb)
        as r(print_id text, product_id integer, low numeric, market_set text)
      on conflict (print_id, marketplace) do update set
        product_id = excluded.product_id,
        low = excluded.low,
        market_set = excluded.market_set,
        price_date = excluded.price_date,
        updated_at = now()
      where (p.product_id, p.low, p.market_set, p.price_date)
        is distinct from
            (excluded.product_id, excluded.low, excluded.market_set, excluded.price_date)
      returning 1
    `
    pricesChanged += changed.length
  }
  // Chi ha perso l'abbinamento resta, con il prezzo vuoto (il dispositivo non vede le cancellazioni).
  const emptied = await tx`
    update public.printing_prices set
      product_id = null, low = null, market_set = null, price_date = null, updated_at = now()
    where marketplace = 'cardtrader'
      and product_id is not null
      and print_id <> all(${rows.map((r) => r.print_id)}::text[])
    returning 1
  `
  return {
    mapped: rows.length,
    withPrice: rows.filter((r) => r.low !== null).length,
    pricesChanged: pricesChanged + emptied.length,
  }
}

const BATCH_SIZE = 1000

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) result.push(items.slice(i, i + BATCH_SIZE))
  return result
}

export interface CardTraderSyncOptions {
  sql: postgres.Sql
  /** GET autenticato su un percorso dell'API (es. "/expansions"), JSON già letto. */
  get: (path: string) => Promise<unknown>
  delayMs: number
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
  today?: string
}

export interface CardTraderSyncStats extends CardTraderSaveStats {
  expansions: number
  blueprints: number
}

/** Esegue il job e lo registra in job_runs. Se l'API non risponde come previsto, non scrive. */
export async function runCardTraderSync(
  options: CardTraderSyncOptions,
): Promise<CardTraderSyncStats> {
  const { sql, get, delayMs } = options
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const log = options.log ?? (() => undefined)
  const today = options.today ?? new Date().toISOString().slice(0, 10)

  const runId = await startJobRun(sql, 'cardtrader_sync')
  try {
    const expansions = parseExpansions(await get('/expansions'))
    if (expansions.length === 0) throw new Error('Nessuna espansione One Piece su CardTrader')
    log(`Espansioni One Piece: ${String(expansions.length)}`)

    const blueprints: CardTraderBlueprint[] = []
    const expansionOf = new Map<number, string>()
    const offers = new Map<number, CardTraderOffer[]>()
    for (const [index, expansion] of expansions.entries()) {
      await sleep(delayMs)
      const found = parseBlueprints(
        await get(`/blueprints/export?expansion_id=${String(expansion.id)}`),
      )
      for (const b of found) expansionOf.set(b.id, expansion.code)
      blueprints.push(...found)
      await sleep(delayMs)
      for (const [blueprintId, list] of parseMarketplace(
        await get(`/marketplace/products?expansion_id=${String(expansion.id)}`),
      )) {
        offers.set(blueprintId, list)
      }
      log(`${String(index + 1)}/${String(expansions.length)} ${expansion.name}`)
    }

    const cardmarket = await sql<{ print_id: string; product_id: number }[]>`
      select print_id, product_id from public.price_mappings where marketplace = 'cardmarket'
    `
    const mapping = mapCardTrader(
      new Map(cardmarket.map((m) => [m.print_id, m.product_id])),
      blueprints,
    )
    const prices = new Map<string, CardTraderPrice>()
    for (const [printId, blueprintId] of mapping) {
      const cents = cheapestEuroCents(offers.get(blueprintId) ?? [])
      const code = expansionOf.get(blueprintId) ?? ''
      prices.set(printId, {
        blueprintId,
        low: cents === null ? null : cents / 100,
        // Un codice vuoto vale come assente.
        expansionCode: code === '' ? null : code,
      })
    }

    const saved = await sql.begin((tx) => saveCardTraderPrices(tx, prices, today))
    const stats: CardTraderSyncStats = {
      ...saved,
      expansions: expansions.length,
      blueprints: blueprints.length,
    }
    await finishJobRun(sql, runId, { status: 'success', stats })
    return stats
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
    throw error
  }
}
