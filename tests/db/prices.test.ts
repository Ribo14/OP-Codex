import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { pruneSnapshots, savePrices, type CardmarketFiles } from '../../catalog-sync/price-sync.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Prezzi (RIB-32): salvataggio del Price Sync, Mapping Override, storico e permessi.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ADMIN = '00000000-0000-0000-0000-0000000000f1'
const UTENTE = '00000000-0000-0000-0000-0000000000f2'
const SERIES = 979001
const EN = 5229
const JP = 5484

async function setup(tx: postgres.TransactionSql) {
  await tx`insert into public.sets (series_id, code, name) values (${SERIES}, 'YP-01', 'Prezzi di prova')`
  await tx`
    insert into public.cards (card_code, name, category) values
      ('YP01-001', 'Zoro di prova', 'Leader'),
      ('YP01-002', 'Usopp di prova', 'Character')
  `
  await tx`
    insert into public.printings (print_id, card_code, series_id, rarity) values
      ('YP01-001', 'YP01-001', ${SERIES}, 'L'),
      ('YP01-001_p1', 'YP01-001', ${SERIES}, 'L'),
      ('YP01-002', 'YP01-002', ${SERIES}, 'C')
  `
}

// Le carte di prova hanno il prefisso "YP", che il Price Mapper non riconosce come Card Code del
// gioco: da solo non le abbina, così i test controllano il salvataggio tramite gli override.
const files = (overrides: Partial<CardmarketFiles> = {}): CardmarketFiles => ({
  priceDate: '2026-09-27',
  prices: [
    { idProduct: 1, trend: 2.16, low: 0.5 },
    { idProduct: 2, trend: 574.14, low: 500 },
    { idProduct: 3, trend: 0.15, low: 0.02 },
  ],
  singles: [
    { idProduct: 1, name: 'Zoro di prova (YP01-001)', idExpansion: EN },
    { idProduct: 2, name: 'Zoro di prova (YP01-001)', idExpansion: EN },
    { idProduct: 3, name: 'Usopp di prova (YP01-002)', idExpansion: EN },
    { idProduct: 4, name: 'Usopp di prova (YP01-002)', idExpansion: JP },
  ],
  sealed: [{ name: 'Prova Booster (Non-English)', idExpansion: JP }],
  ...overrides,
})

async function setOverride(tx: postgres.TransactionSql, printId: string, productId: number | null) {
  await tx`
    insert into public.mapping_overrides (print_id, marketplace, product_id)
    values (${printId}, 'cardmarket', ${productId})
  `
}

async function pricesOf(tx: postgres.TransactionSql) {
  return tx<
    { print_id: string; product_id: number | null; trend: string | null; low: string | null }[]
  >`
    select print_id, product_id, trend::text, low::text from public.printing_prices
    where print_id like 'YP01-%' order by print_id
  `
}

describe('Price Sync: salvataggio', () => {
  it('senza Card Code riconosciuto non abbina; con gli override salva prezzi, storico e abbinamenti', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await savePrices(tx, files())
      expect(await pricesOf(tx)).toEqual([])

      await setOverride(tx, 'YP01-001', 1)
      await setOverride(tx, 'YP01-001_p1', 2)
      await setOverride(tx, 'YP01-002', 3)
      const stats = await savePrices(tx, files())
      expect(stats).toMatchObject({ overrides: 3, snapshots: 3 })
      expect(await pricesOf(tx)).toEqual([
        { print_id: 'YP01-001', product_id: 1, trend: '2.16', low: '0.50' },
        { print_id: 'YP01-001_p1', product_id: 2, trend: '574.14', low: '500.00' },
        { print_id: 'YP01-002', product_id: 3, trend: '0.15', low: '0.02' },
      ])
      const history = await tx`
        select print_id, day::text from public.price_snapshots where print_id like 'YP01-%' order by print_id
      `
      expect(history).toEqual([
        { print_id: 'YP01-001', day: '2026-09-27' },
        { print_id: 'YP01-001_p1', day: '2026-09-27' },
        { print_id: 'YP01-002', day: '2026-09-27' },
      ])
      const mappings = await tx<{ print_id: string; source: string }[]>`
        select print_id, source from public.price_mappings where print_id like 'YP01-%' order by print_id
      `
      expect(mappings.map((m) => m.source)).toEqual(['override', 'override', 'override'])
    })
  })

  it('rilanciato con gli stessi dati non cambia updated_at e non duplica lo storico', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await setOverride(tx, 'YP01-002', 3)
      await savePrices(tx, files())
      const [before] = await tx<{ updated_at: Date }[]>`
        select updated_at from public.printing_prices where print_id = 'YP01-002'
      `
      await savePrices(tx, files())
      const [after] = await tx<{ updated_at: Date }[]>`
        select updated_at from public.printing_prices where print_id = 'YP01-002'
      `
      expect(after?.updated_at).toEqual(before?.updated_at)
      const [count] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.price_snapshots where print_id = 'YP01-002'
      `
      expect(count?.n).toBe(1)
    })
  })

  it('una Printing che perde il prodotto resta, con i prezzi vuoti', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await setOverride(tx, 'YP01-002', 3)
      await savePrices(tx, files())
      await tx`update public.mapping_overrides set product_id = null where print_id = 'YP01-002'`
      await savePrices(tx, files())
      expect(await pricesOf(tx)).toEqual([
        { print_id: 'YP01-002', product_id: null, trend: null, low: null },
      ])
    })
  })

  it('salva i prodotti inglesi con Card Code per la scelta degli override', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await savePrices(
        tx,
        files({
          singles: [
            { idProduct: 5, name: 'Roronoa Zoro (OP01-001)', idExpansion: EN },
            { idProduct: 6, name: 'Roronoa Zoro (OP01-001)', idExpansion: JP },
            { idProduct: 7, name: 'DON!! (OP01)', idExpansion: EN },
          ],
        }),
      )
      const rows = await tx`
        select id_product, card_code from public.cardmarket_products where id_product in (5, 6, 7)
      `
      expect(rows).toEqual([{ id_product: 5, card_code: 'OP01-001' }])
    })
  })
})

describe('Storico dei prezzi', () => {
  it('oltre i 90 giorni tiene solo il lunedì', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      // 2026-06-01 è un lunedì, 2026-06-02 un martedì; 2026-07-01 è dentro i 90 giorni.
      await tx`
        insert into public.price_snapshots (print_id, marketplace, day, trend) values
          ('YP01-002', 'cardmarket', '2026-06-01', 1),
          ('YP01-002', 'cardmarket', '2026-06-02', 1),
          ('YP01-002', 'cardmarket', '2026-07-01', 1)
      `
      await pruneSnapshots(tx, '2026-09-27')
      const days = await tx<{ day: string }[]>`
        select day::text from public.price_snapshots where print_id = 'YP01-002' order by day
      `
      expect(days.map((d) => d.day)).toEqual(['2026-06-01', '2026-07-01'])
    })
  })
})

describe('Prezzi: permessi', () => {
  it('prezzi e storico li legge chiunque; prodotti, abbinamenti e override no', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await setOverride(tx, 'YP01-002', 3)
      await savePrices(tx, files())
      await actAs(tx, 'anon')
      expect(
        await tx`select 1 from public.printing_prices where print_id = 'YP01-002'`,
      ).toHaveLength(1)
      expect(
        await tx`select 1 from public.price_snapshots where print_id = 'YP01-002'`,
      ).toHaveLength(1)
      for (const table of ['price_mappings', 'mapping_overrides', 'cardmarket_products']) {
        expect(await errorCodeOf(tx, (sp) => sp`select 1 from ${sp(`public.${table}`)}`)).toBe(
          '42501',
        )
      }
    })
  })

  it('solo l’Admin con il codice (aal2) imposta un override, e finisce nel registro', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`
        insert into auth.users (id, aud, role, email, raw_app_meta_data)
        values (${ADMIN}, 'authenticated', 'authenticated', 'admin-p@example.com', '{"admin": true}'),
               (${UTENTE}, 'authenticated', 'authenticated', 'utente-p@example.com', '{}')
      `
      await tx`
        insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
        values (gen_random_uuid(), ${ADMIN}, 'OP-Codex', 'totp', 'verified', now(), now())
      `
      const insert = () =>
        errorCodeOf(
          tx,
          (sp) => sp`
            insert into public.mapping_overrides (print_id, marketplace, product_id)
            values ('YP01-001', 'cardmarket', 1)
          `,
        )
      await actAs(tx, 'authenticated', UTENTE, { aal: 'aal2' })
      expect(await insert()).toBe('42501')
      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal1' })
      expect(await insert()).toBe('42501')
      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal2' })
      expect(await insert()).toBeNull()
      // L'Admin vede prodotti e abbinamenti, per scegliere.
      expect(await errorCodeOf(tx, (sp) => sp`select 1 from public.price_mappings`)).toBeNull()

      await tx`reset role`
      const log = await tx`
        select action, after ->> 'print_id' as print_id from public.admin_audit_log
        where table_name = 'public.mapping_overrides' and actor = ${ADMIN}
      `
      expect(log).toEqual([{ action: 'insert', print_id: 'YP01-001' }])
    })
  })
})
