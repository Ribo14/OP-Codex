import { afterAll, describe, expect, it } from 'vitest'
import { runCardTraderSync, saveCardTraderPrices } from '../../catalog-sync/cardtrader-sync.ts'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, inRollback } from './helpers.ts'

// Prezzi CardTrader (RIB-32, slice 5.5): giro completo con un'API finta, salvataggio idempotente,
// permessi di lettura.

const sql = connect()
const SERIES = 979002
const createdRuns: number[] = []

afterAll(async () => {
  if (createdRuns.length > 0) await sql`delete from public.job_runs where id in ${sql(createdRuns)}`
  await sql.end()
})

async function setup(db: typeof sql) {
  await db`insert into public.sets (series_id, code, name) values (${SERIES}, 'YC-01', 'CardTrader di prova')`
  await db`insert into public.cards (card_code, name, category) values ('YC01-001', 'Prova CT', 'Character')`
  await db`
    insert into public.printings (print_id, card_code, series_id, rarity) values
      ('YC01-001', 'YC01-001', ${SERIES}, 'C'),
      ('YC01-001_p1', 'YC01-001', ${SERIES}, 'SR')
  `
  // Abbinamenti Cardmarket già fatti dal Price Sync.
  await db`
    insert into public.price_mappings (print_id, marketplace, product_id, source, confidence) values
      ('YC01-001', 'cardmarket', 880001, 'auto', 'high'),
      ('YC01-001_p1', 'cardmarket', 880002, 'auto', 'high')
  `
}

async function cleanup() {
  await sql`delete from public.printing_prices where print_id like 'YC01-%'`
  await sql`delete from public.price_mappings where print_id like 'YC01-%'`
  await sql`delete from public.printings where series_id = ${SERIES}`
  await sql`delete from public.cards where card_code = 'YC01-001'`
  await sql`delete from public.sets where series_id = ${SERIES}`
}

const API: Record<string, unknown> = {
  '/expansions': [
    { id: 5001, game_id: 15, code: 'yc01', name: 'Prova' },
    { id: 9, game_id: 1, code: 'mtg', name: 'Magic' },
  ],
  '/blueprints/export?expansion_id=5001': [
    { id: 70001, category_id: 192, card_market_ids: [880001, 990001] },
    { id: 70002, category_id: 192, card_market_ids: [880002] },
    { id: 70003, category_id: 193, card_market_ids: [880003] },
  ],
  '/marketplace/products?expansion_id=5001': {
    '70001': [
      {
        quantity: 1,
        price: { cents: 250, currency: 'EUR' },
        properties_hash: { condition: 'Near Mint', onepiece_language: 'en' },
      },
      {
        quantity: 1,
        price: { cents: 90, currency: 'USD' },
        properties_hash: { condition: 'Near Mint', onepiece_language: 'en' },
      },
      {
        quantity: 3,
        price: { cents: 180, currency: 'EUR' },
        properties_hash: { condition: 'Near Mint', onepiece_language: 'jp' },
      },
    ],
    '70002': [{ quantity: 1, price: { cents: 90, currency: 'USD' }, properties_hash: {} }],
  },
}

const fakeGet = (api: Record<string, unknown>) => (path: string) =>
  path in api ? Promise.resolve(api[path]) : Promise.reject(new Error(`HTTP 404 per ${path}`))

async function latestRuns() {
  const rows = await sql<{ id: string; status: string; error: string | null }[]>`
    select id, status, error from public.job_runs
    where job = 'cardtrader_sync' and started_at > now() - interval '1 minute'
    order by id desc
  `
  createdRuns.push(...rows.map((r) => Number(r.id)))
  return rows
}

describe('CardTrader: giro completo', () => {
  it('abbina tramite gli id Cardmarket e salva il minimo in euro', async () => {
    try {
      await setup(sql)
      const stats = await runCardTraderSync({
        sql,
        get: fakeGet(API),
        delayMs: 0,
        sleep: () => Promise.resolve(),
        today: '2026-09-27',
      })
      expect(stats).toMatchObject({ expansions: 1, blueprints: 2, mapped: 2, withPrice: 1 })
      const prices = await sql`
        select print_id, product_id, low::text, price_date::text from public.printing_prices
        where marketplace = 'cardtrader' and print_id like 'YC01-%' order by print_id
      `
      expect(prices).toEqual([
        { print_id: 'YC01-001', product_id: 70001, low: '2.50', price_date: '2026-09-27' },
        // Solo offerte in dollari: abbinata, ma senza prezzo.
        { print_id: 'YC01-001_p1', product_id: 70002, low: null, price_date: '2026-09-27' },
      ])
      const [run] = await latestRuns()
      expect(run?.status).toBe('success')
    } finally {
      await cleanup()
    }
  })

  it("se l'API risponde male il job fallisce senza scrivere", async () => {
    try {
      await setup(sql)
      await expect(
        runCardTraderSync({
          sql,
          get: fakeGet({ '/expansions': { error: 'Unauthorized' } }),
          delayMs: 0,
          sleep: () => Promise.resolve(),
        }),
      ).rejects.toThrow(/espansioni/)
      const prices = await sql`
        select 1 from public.printing_prices where marketplace = 'cardtrader' and print_id like 'YC01-%'
      `
      expect(prices).toHaveLength(0)
      const [run] = await latestRuns()
      expect(run).toMatchObject({ status: 'error' })
    } finally {
      await cleanup()
    }
  })
})

describe('CardTrader: salvataggio', () => {
  it('rilanciato uguale non cambia nulla; chi perde il blueprint resta con il prezzo vuoto', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx as unknown as typeof sql)
      const both = new Map([
        ['YC01-001', { blueprintId: 70001, low: 2.5 }],
        ['YC01-001_p1', { blueprintId: 70002, low: 12 }],
      ])
      await saveCardTraderPrices(tx, both, '2026-09-27')
      expect((await saveCardTraderPrices(tx, both, '2026-09-27')).pricesChanged).toBe(0)
      const stats = await saveCardTraderPrices(
        tx,
        new Map([['YC01-001', { blueprintId: 70001, low: 2.5 }]]),
        '2026-09-27',
      )
      expect(stats.pricesChanged).toBe(1)
      const rows = await tx`
        select print_id, product_id, low from public.printing_prices
        where marketplace = 'cardtrader' and print_id = 'YC01-001_p1'
      `
      expect(rows).toEqual([{ print_id: 'YC01-001_p1', product_id: null, low: null }])

      // Il prezzo minimo è pubblico come quello Cardmarket.
      await actAs(tx, 'anon')
      expect(
        await tx`select 1 from public.printing_prices where marketplace = 'cardtrader' and print_id = 'YC01-001'`,
      ).toHaveLength(1)
    })
  })
})
