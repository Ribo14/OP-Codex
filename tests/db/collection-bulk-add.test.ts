import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { upsertRecipes } from '../../catalog-sync/recipe-sync.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Aggiunta in blocco alla Collection (aggiungi_copie): somma alle copie esistenti, solo nella
// propria Collection, rifiuta input non validi.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000d1'
const BRUNO = '00000000-0000-0000-0000-0000000000d2'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-b@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-b@example.com')
  `
  await tx`insert into public.sets (series_id, code, name) values (999902, 'ZY-99', 'Set di prova')`
  await tx`
    insert into public.cards (card_code, name, category)
    values ('ZY99-001', 'Uno', 'Leader'), ('ZY99-002', 'Due', 'Character')
  `
  await tx`
    insert into public.printings (print_id, card_code, series_id, rarity)
    values ('ZY99-001', 'ZY99-001', 999902, 'L'), ('ZY99-002', 'ZY99-002', 999902, 'C')
  `
}

const add = (tx: postgres.TransactionSql, rows: unknown) =>
  tx<
    { aggiunte: number }[]
  >`select public.aggiungi_copie(${tx.json(rows as postgres.JSONValue)}) as aggiunte`

const mine = (tx: postgres.TransactionSql) =>
  tx`select print_id, language, quantity from public.collection_entries order by print_id, language`

describe('set_recipes', () => {
  it('il job allinea le composizioni al file, anche togliendo i mazzi spariti; tutti le leggono', async () => {
    await inRollback(sql, async (tx) => {
      const deck = { 'ZY99-001': 1, 'ZY99-002': 50 }
      const first = await upsertRecipes(tx, {
        source: 'prova',
        decks: { 'ZY-98': deck, 'ZY-99': deck },
      })
      expect(first).toMatchObject({ decks: 2, inserted: 2 })
      const again = await upsertRecipes(tx, { source: 'prova', decks: { 'ZY-99': deck } })
      expect(again).toMatchObject({ inserted: 0, updated: 0 })
      const rows = await tx<{ set_code: string }[]>`
        select set_code from public.set_recipes where set_code like 'ZY-%'
      `
      expect(rows.map((r) => r.set_code)).toEqual(['ZY-99'])

      await actAs(tx, 'anon')
      const [recipe] = await tx<{ cards: unknown }[]>`
        select cards from public.set_recipes where set_code = 'ZY-99'
      `
      expect(recipe?.cards).toEqual(deck)
      expect(
        await errorCodeOf(tx, (sp) => sp`delete from public.set_recipes where set_code = 'ZY-99'`),
      ).toBe('42501')
    })
  })
})

describe('aggiungi_copie', () => {
  it('aggiunge più stampe insieme, sommando alle copie già possedute e le righe ripetute', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await tx`select public.cambia_copie('ZY99-002', 'EN', 1)`
      const [row] = await add(tx, [
        { print_id: 'ZY99-001', language: 'EN', quantity: 1 },
        { print_id: 'ZY99-002', language: 'EN', quantity: 4 },
        { print_id: 'ZY99-002', language: 'EN', quantity: 2 },
        { print_id: 'ZY99-002', language: 'JP', quantity: 3 },
      ])
      expect(row?.aggiunte).toBe(10)
      expect(await mine(tx)).toEqual([
        { print_id: 'ZY99-001', language: 'EN', quantity: 1 },
        { print_id: 'ZY99-002', language: 'EN', quantity: 7 },
        { print_id: 'ZY99-002', language: 'JP', quantity: 3 },
      ])
    })
  })

  it('scrive solo nella Collection di chi chiama', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      await add(tx, [{ print_id: 'ZY99-001', language: 'EN', quantity: 2 }])
      await tx`reset role`
      const owners = await tx`
        select user_id::text from public.collection_entries where print_id = 'ZY99-001'
      `
      expect(owners).toEqual([{ user_id: BRUNO }])
      // Anna non vede le carte di Bruno.
      await actAs(tx, 'authenticated', ANNA)
      expect(await mine(tx)).toEqual([])
    })
  })

  it('rifiuta righe non valide senza scrivere nulla', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const invalid = [
        [],
        { print_id: 'ZY99-001' },
        [{ print_id: 'ZY99-001', language: 'EN', quantity: 0 }],
        [{ print_id: 'ZY99-001', language: 'EN', quantity: 100 }],
        [{ print_id: 'ZY99-001', language: 'XX', quantity: 1 }],
        [{ print_id: 'NON-ESISTE', language: 'EN', quantity: 1 }],
        Array.from({ length: 1001 }, () => ({ print_id: 'ZY99-001', language: 'EN', quantity: 1 })),
      ]
      for (const rows of invalid) {
        expect(await errorCodeOf(tx, (sp) => add(sp, rows))).not.toBeNull()
      }
      expect(await mine(tx)).toEqual([])
    })
  })

  it('senza accesso non si può chiamare', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'anon')
      expect(
        await errorCodeOf(tx, (sp) =>
          add(sp, [{ print_id: 'ZY99-001', language: 'EN', quantity: 1 }]),
        ),
      ).toBe('42501')
    })
  })
})
