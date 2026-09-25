import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Collection (RIB-20): +/− atomici, lingue separate, RLS.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000c1'
const BRUNO = '00000000-0000-0000-0000-0000000000c2'

/** Due utenti e una Card di prova con due Printing (solo dentro la transazione annullata). */
async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-c@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-c@example.com')
  `
  await tx`insert into public.sets (series_id, code, name) values (999901, 'ZZ-99', 'Set di prova')`
  await tx`insert into public.cards (card_code, name, category) values ('ZZ99-001', 'Prova', 'Character')`
  await tx`
    insert into public.printings (print_id, card_code, series_id, rarity)
    values ('ZZ99-001', 'ZZ99-001', 999901, 'C'), ('ZZ99-001_p1', 'ZZ99-001', 999901, 'C')
  `
}

async function change(
  tx: postgres.TransactionSql,
  printId: string,
  language: string,
  delta: number,
) {
  const [row] = await tx<{ copie: number }[]>`
    select public.cambia_copie(${printId}, ${language}, ${delta}) as copie
  `
  return row?.copie
}

const entries = (tx: postgres.TransactionSql) =>
  tx`select print_id, language, quantity from public.collection_entries order by print_id, language`

describe('Collection', () => {
  it('aggiunge, incrementa, decrementa e a 0 rimuove la Collection Entry', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(await change(tx, 'ZZ99-001', 'EN', 1)).toBe(1)
      expect(await change(tx, 'ZZ99-001', 'EN', 1)).toBe(2)
      expect(await change(tx, 'ZZ99-001', 'EN', 2)).toBe(4)
      expect(await change(tx, 'ZZ99-001', 'EN', -1)).toBe(3)
      expect(await entries(tx)).toEqual([{ print_id: 'ZZ99-001', language: 'EN', quantity: 3 }])
      expect(await change(tx, 'ZZ99-001', 'EN', -5)).toBe(0)
      expect(await entries(tx)).toEqual([])
      // Togliere da una Entry che non c'è non fa nulla.
      expect(await change(tx, 'ZZ99-001', 'EN', -1)).toBe(0)
    })
  })

  it('Printing diverse e lingue diverse si contano separatamente', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await change(tx, 'ZZ99-001', 'EN', 2)
      await change(tx, 'ZZ99-001', 'JP', 1)
      await change(tx, 'ZZ99-001_p1', 'EN', 1)
      expect(await entries(tx)).toEqual([
        { print_id: 'ZZ99-001', language: 'EN', quantity: 2 },
        { print_id: 'ZZ99-001', language: 'JP', quantity: 1 },
        { print_id: 'ZZ99-001_p1', language: 'EN', quantity: 1 },
      ])
    })
  })

  it('rifiuta lingue, Printing e variazioni non valide', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      // 23514: lingua fuori elenco; 23503: Printing inesistente; 22023: delta non valido.
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('ZZ99-001', 'IT', 1)`),
      ).toBe('23514')
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('NOPE-001', 'EN', 1)`),
      ).toBe('23503')
      for (const delta of [0, 100, -100]) {
        expect(
          await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('ZZ99-001', 'EN', ${delta})`),
          String(delta),
        ).toBe('22023')
      }
    })
  })

  it('un utente non legge né modifica la Collection di un altro', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      await change(tx, 'ZZ99-001', 'EN', 3)

      await actAs(tx, 'authenticated', ANNA)
      expect(await entries(tx)).toEqual([])
      const updated =
        await tx`update public.collection_entries set quantity = 99 where user_id = ${BRUNO}`
      expect(updated.count).toBe(0)
      const deleted = await tx`delete from public.collection_entries where user_id = ${BRUNO}`
      expect(deleted.count).toBe(0)
      // Non si inserisce a nome di un altro (user_id non è tra le colonne scrivibili).
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`
            insert into public.collection_entries (user_id, print_id, language, quantity)
            values (${BRUNO}, 'ZZ99-001', 'JP', 1)
          `,
        ),
      ).toBe('42501')
      // Il +/− di Anna tocca solo la sua Collection.
      expect(await change(tx, 'ZZ99-001', 'EN', -1)).toBe(0)

      await tx`reset role`
      const [bruno] = await tx`
        select quantity from public.collection_entries where user_id = ${BRUNO} and print_id = 'ZZ99-001'
      `
      expect(bruno?.quantity).toBe(3)
    })
  })

  it('chi non ha fatto l’accesso non vede e non tocca nulla', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select * from public.collection_entries`)).toBe(
        '42501',
      )
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('ZZ99-001', 'EN', 1)`),
      ).toBe('42501')
    })
  })

  it('con la sessione chiusa la Collection resta chiusa', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await change(tx, 'ZZ99-001', 'EN', 1)
      await actAs(tx, 'authenticated', ANNA, { sessionId: crypto.randomUUID() })
      expect(await entries(tx)).toEqual([])
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('ZZ99-001', 'EN', 1)`),
      ).toBe('42501')
    })
  })
})
