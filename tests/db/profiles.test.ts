import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-00000000000a'
const BRUNO = '00000000-0000-0000-0000-00000000000b'

/** Due account di prova (solo dentro la transazione annullata). */
async function users(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno@example.com')
  `
}

/** Come l'utente `id`: prova a creare il proprio (o un altro) profilo. */
async function insertProfile(tx: postgres.TransactionSql, id: string, username: string) {
  return errorCodeOf(
    tx,
    (sp) => sp`insert into public.profiles (id, username) values (${id}, ${username})`,
  )
}

describe('Profili e Username', () => {
  it('un utente crea e legge il proprio profilo', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(await insertProfile(tx, ANNA, 'Anna_99')).toBeNull()
      const rows = await tx`select id, username from public.profiles`
      expect(rows).toEqual([{ id: ANNA, username: 'Anna_99' }])
    })
  })

  it('non si può creare il profilo di un altro', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await actAs(tx, 'authenticated', ANNA)
      // 42501: violazione della policy RLS
      expect(await insertProfile(tx, BRUNO, 'finto_bruno')).toBe('42501')
    })
  })

  it('un utente non vede e non modifica il profilo di un altro', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await tx`insert into public.profiles (id, username) values (${BRUNO}, 'bruno')`
      await actAs(tx, 'authenticated', ANNA)

      expect(await tx`select * from public.profiles`).toEqual([])
      const updated = await tx`update public.profiles set username = 'rubato' where id = ${BRUNO}`
      expect(updated.count).toBe(0)
      const deleted = await errorCodeOf(
        tx,
        (sp) => sp`delete from public.profiles where id = ${BRUNO}`,
      )
      expect(deleted).toBe('42501')

      await tx`reset role`
      const [row] = await tx`select username from public.profiles where id = ${BRUNO}`
      expect(row?.username).toBe('bruno')
    })
  })

  it('si cambia il proprio Username, ma non l’id', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await actAs(tx, 'authenticated', ANNA)
      await insertProfile(tx, ANNA, 'anna')
      const updated = await tx`update public.profiles set username = 'AnnaNuova' where id = ${ANNA}`
      expect(updated.count).toBe(1)
      // Permesso solo sulla colonna username.
      const code = await errorCodeOf(
        tx,
        (sp) => sp`update public.profiles set id = ${BRUNO} where id = ${ANNA}`,
      )
      expect(code).toBe('42501')
    })
  })

  it('due utenti non possono avere lo stesso Username, neanche cambiando le maiuscole', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await tx`insert into public.profiles (id, username) values (${ANNA}, 'Ribo')`
      await actAs(tx, 'authenticated', BRUNO)
      // 23505: violazione di unicità
      expect(await insertProfile(tx, BRUNO, 'rIBO')).toBe('23505')
      expect(await insertProfile(tx, BRUNO, 'Ribo2')).toBeNull()
    })
  })

  it('rifiuta Username troppo corti, troppo lunghi, con caratteri non ammessi o riservati', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await actAs(tx, 'authenticated', ANNA)
      // 23514: violazione di un vincolo check
      for (const username of [
        'ab',
        'a'.repeat(21),
        'con spazio',
        'àccento',
        'emoji🙂',
        'a.b',
        'Admin',
        'OPCodex',
      ]) {
        expect(await insertProfile(tx, ANNA, username), username).toBe('23514')
      }
      expect(await insertProfile(tx, ANNA, 'abc')).toBeNull()
    })
  })

  it('chi non ha fatto l’accesso non legge né scrive i profili', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await tx`insert into public.profiles (id, username) values (${ANNA}, 'anna')`
      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select * from public.profiles`)).toBe('42501')
      expect(await insertProfile(tx, BRUNO, 'bruno')).toBe('42501')
    })
  })

  it('eliminando l’account sparisce anche il profilo', async () => {
    await inRollback(sql, async (tx) => {
      await users(tx)
      await tx`insert into public.profiles (id, username) values (${ANNA}, 'anna')`
      await tx`delete from auth.users where id = ${ANNA}`
      expect(await tx`select * from public.profiles where id = ${ANNA}`).toEqual([])
    })
  })
})
