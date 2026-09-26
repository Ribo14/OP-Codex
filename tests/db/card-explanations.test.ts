import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { upsertExplanations } from '../../catalog-sync/explanation-sync.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Card Explanation (RIB-52): caricamento idempotente, spiegazioni tolte, lettura pubblica.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const rows = (tx: postgres.TransactionSql) =>
  tx<{ card_code: string; body: string; updated_at: Date }[]>`
    select card_code, body, updated_at from public.card_explanations
    where card_code like 'ZZ9%' order by card_code
  `

describe('Card Explanation', () => {
  it('rilanciato senza novità non tocca nulla; una spiegazione tolta resta vuota', async () => {
    await inRollback(sql, async (tx) => {
      const first = new Map([
        ['ZZ99-001', 'Uno.'],
        ['ZZ99-002', 'Due.'],
      ])
      expect(await upsertExplanations(tx, first)).toMatchObject({
        cards: 2,
        inserted: 2,
        updated: 0,
      })
      const before = await rows(tx)

      expect(await upsertExplanations(tx, first)).toMatchObject({
        inserted: 0,
        updated: 0,
        emptied: 0,
      })
      expect(await rows(tx)).toEqual(before)

      const second = new Map([['ZZ99-001', 'Uno, corretto.']])
      expect(await upsertExplanations(tx, second)).toMatchObject({ updated: 1, emptied: 1 })
      expect((await rows(tx)).map((r) => [r.card_code, r.body])).toEqual([
        ['ZZ99-001', 'Uno, corretto.'],
        ['ZZ99-002', ''],
      ])
    })
  })

  it('tutti leggono, nessuno scrive dall’app', async () => {
    await inRollback(sql, async (tx) => {
      await upsertExplanations(tx, new Map([['ZZ99-001', 'Uno.']]))
      await actAs(tx, 'anon')
      expect(await rows(tx)).toHaveLength(1)
      const denied = await errorCodeOf(
        tx,
        (sp) => sp`insert into public.card_explanations (card_code, body) values ('ZZ99-003', 'x')`,
      )
      expect(denied).toBe('42501')
    })
    await inRollback(sql, async (tx) => {
      await upsertExplanations(tx, new Map([['ZZ99-001', 'Uno.']]))
      await actAs(tx, 'authenticated', '00000000-0000-0000-0000-0000000000f1')
      const denied = await errorCodeOf(
        tx,
        (sp) => sp`update public.card_explanations set body = 'x' where card_code = 'ZZ99-001'`,
      )
      expect(denied).toBe('42501')
    })
  })

  it('il database rifiuta testi troppo lunghi e Card Code non validi', async () => {
    await inRollback(sql, async (tx) => {
      const long = await errorCodeOf(
        tx,
        (sp) =>
          sp`insert into public.card_explanations (card_code, body) values ('ZZ99-004', ${'x'.repeat(4001)})`,
      )
      expect(long).toBe('23514')
      const bad = await errorCodeOf(
        tx,
        (sp) => sp`insert into public.card_explanations (card_code, body) values ('zz 1', 'x')`,
      )
      expect(bad).toBe('23514')
    })
  })
})
