import { readFileSync } from 'node:fs'
import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { parseCardListPage } from '../../catalog-sync/card-list-parser.ts'
import { connect, upsertCatalogPage } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

const sql = connect()

afterAll(async () => {
  await sql.end()
})

function fixturePage(name: string) {
  const url = new URL(`../../catalog-sync/fixtures/${name}.html`, import.meta.url)
  return parseCardListPage(readFileSync(url, 'utf8'))
}

const op01 = fixturePage('op-01')
const prb01 = fixturePage('prb-01')

const CATALOG_TABLES = ['sets', 'cards', 'printings'] as const

/** Quante righe di OP-01 ci sono nel catalogo (indipendente da altri Set già sincronizzati). */
async function op01Counts(tx: postgres.TransactionSql) {
  const [row] = await tx<{ sets: number; cards: number; printings: number }[]>`
    select
      (select count(*)::int from public.sets where series_id = 569101) as sets,
      (select count(*)::int from public.cards where card_code like 'OP01-%') as cards,
      (select count(*)::int from public.printings where series_id = 569101) as printings
  `
  return row
}

describe('Sync del catalogo', () => {
  it('lanciato due volte non crea duplicati', async () => {
    await inRollback(sql, async (tx) => {
      await upsertCatalogPage(tx, op01)
      const afterFirst = await op01Counts(tx)
      await upsertCatalogPage(tx, op01)
      const afterSecond = await op01Counts(tx)

      expect(afterFirst).toEqual({ sets: 1, cards: 121, printings: 154 })
      expect(afterSecond).toEqual(afterFirst)
    })
  })

  it('salva Card, Printing e Set con i campi del parser', async () => {
    await inRollback(sql, async (tx) => {
      await upsertCatalogPage(tx, op01)

      const [card] = await tx`select * from public.cards where card_code = 'OP01-001'`
      expect(card).toMatchObject({
        name: 'Roronoa Zoro',
        category: 'Leader',
        life: 5,
        cost: null,
        power: 5000,
        attributes: ['Slash'],
        colors: ['Red'],
        types: ['Supernovas', 'Straw Hat Crew'],
      })

      const printings = await tx`
        select print_id, series_id, rarity from public.printings
        where card_code = 'OP01-001' and series_id = 569101 order by print_id
      `
      expect(printings).toEqual([
        { print_id: 'OP01-001', series_id: 569101, rarity: 'L' },
        { print_id: 'OP01-001_p1', series_id: 569101, rarity: 'L' },
      ])
    })
  })

  it('le ristampe di un altro Set si agganciano alla stessa Card', async () => {
    await inRollback(sql, async (tx) => {
      await upsertCatalogPage(tx, op01)
      await upsertCatalogPage(tx, prb01)

      const rows = await tx<{ series_id: number; n: number }[]>`
        select series_id, count(*)::int as n from public.printings
        where card_code = 'OP01-006' and series_id in (569101, 569301)
        group by series_id order by series_id
      `
      expect(rows).toEqual([
        { series_id: 569101, n: 1 },
        { series_id: 569301, n: 4 },
      ])
    })
  })
})

describe('Row Level Security del catalogo', () => {
  it('è attiva su tutte le tabelle del catalogo', async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relname in ${sql(CATALOG_TABLES)}
      order by relname
    `
    expect(rows).toEqual([
      { relname: 'cards', relrowsecurity: true },
      { relname: 'printings', relrowsecurity: true },
      { relname: 'sets', relrowsecurity: true },
    ])
  })

  for (const role of ['anon', 'authenticated'] as const) {
    describe(`ruolo ${role}`, () => {
      it('può leggere Set, Card e Printing', async () => {
        await inRollback(sql, async (tx) => {
          await upsertCatalogPage(tx, op01)
          await actAs(tx, role)

          expect(await op01Counts(tx)).toEqual({ sets: 1, cards: 121, printings: 154 })
        })
      })

      it('non può inserire, modificare o cancellare', async () => {
        await inRollback(sql, async (tx) => {
          await upsertCatalogPage(tx, op01)
          await actAs(tx, role)

          const attempts = {
            insertCard: await errorCodeOf(
              tx,
              (sp) => sp`
                insert into public.cards (card_code, name, category) values ('ZZ99-001', 'X', 'Character')
              `,
            ),
            updateCard: await errorCodeOf(
              tx,
              (sp) => sp`update public.cards set name = 'X' where card_code = 'OP01-001'`,
            ),
            deleteCard: await errorCodeOf(
              tx,
              (sp) => sp`delete from public.cards where card_code = 'OP01-001'`,
            ),
            insertPrinting: await errorCodeOf(
              tx,
              (sp) => sp`
                insert into public.printings (print_id, card_code, series_id, rarity)
                values ('OP01-001_p9', 'OP01-001', 569101, 'L')
              `,
            ),
            updatePrinting: await errorCodeOf(
              tx,
              (sp) => sp`update public.printings set rarity = 'X' where print_id = 'OP01-001'`,
            ),
            deletePrinting: await errorCodeOf(
              tx,
              (sp) => sp`delete from public.printings where print_id = 'OP01-001'`,
            ),
            updateSet: await errorCodeOf(
              tx,
              (sp) => sp`update public.sets set name = 'X' where series_id = 569101`,
            ),
          }

          // 42501 = insufficient_privilege
          for (const code of Object.values(attempts)) expect(code).toBe('42501')
        })
      })
    })
  }
})
