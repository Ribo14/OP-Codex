import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { upsertFaqs, type FaqItem } from '../../catalog-sync/faq-sync.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// FAQ ufficiali (RIB-44): caricamento idempotente, carte svuotate, lettura pubblica.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const faq = (question: string): FaqItem => ({
  question,
  answer: 'Yes, you can.',
  source: 'qa_zz.pdf',
})

const rows = (tx: postgres.TransactionSql) =>
  tx<{ card_code: string; items: FaqItem[]; updated_at: Date }[]>`
    select card_code, items, updated_at from public.card_faqs
    where card_code like 'ZZ9%' order by card_code
  `

describe('FAQ ufficiali', () => {
  it('rilanciato senza novità non tocca nulla; una carta senza più FAQ resta vuota', async () => {
    await inRollback(sql, async (tx) => {
      const first = new Map([
        ['ZZ99-001', [faq('Q1'), faq('Q2')]],
        ['ZZ99-002', [faq('Q3')]],
      ])
      expect(await upsertFaqs(tx, first)).toMatchObject({
        cards: 2,
        questions: 3,
        inserted: 2,
        updated: 0,
      })
      const before = await rows(tx)

      expect(await upsertFaqs(tx, first)).toMatchObject({ inserted: 0, updated: 0, emptied: 0 })
      expect(await rows(tx)).toEqual(before)

      // ZZ99-001 cambia, ZZ99-002 sparisce dai PDF.
      const second = new Map([['ZZ99-001', [faq('Q1')]]])
      expect(await upsertFaqs(tx, second)).toMatchObject({ updated: 1, emptied: 1 })
      const after = await rows(tx)
      expect(after.map((r) => [r.card_code, r.items.length])).toEqual([
        ['ZZ99-001', 1],
        ['ZZ99-002', 0],
      ])
    })
  })

  it('tutti leggono, nessuno scrive dall’app', async () => {
    await inRollback(sql, async (tx) => {
      await upsertFaqs(tx, new Map([['ZZ99-001', [faq('Q1')]]]))
      await actAs(tx, 'anon')
      expect(await rows(tx)).toHaveLength(1)
      const denied = await errorCodeOf(
        tx,
        (sp) =>
          sp`insert into public.card_faqs (card_code, items) values ('ZZ99-003', '[]'::jsonb)`,
      )
      expect(denied).toBe('42501')
    })
    await inRollback(sql, async (tx) => {
      await upsertFaqs(tx, new Map([['ZZ99-001', [faq('Q1')]]]))
      await actAs(tx, 'authenticated', '00000000-0000-0000-0000-0000000000f1')
      const denied = await errorCodeOf(
        tx,
        (sp) => sp`update public.card_faqs set items = '[]'::jsonb where card_code = 'ZZ99-001'`,
      )
      expect(denied).toBe('42501')
    })
  })
})
