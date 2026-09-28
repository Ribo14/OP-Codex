import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Rimuovi amico e User Block (RIB-72, ADR-0015): i casi della matrice di accesso che
// riguardano blocco e rimozione.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000b1'
const BRUNO = '00000000-0000-0000-0000-0000000000b2'
const CARLA = '00000000-0000-0000-0000-0000000000b3'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-b@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-b@example.com'),
           (${CARLA}, 'authenticated', 'authenticated', 'carla-b@example.com')
  `
  await tx`
    insert into public.profiles (id, username)
    values (${ANNA}, 'AnnaBlocco'), (${BRUNO}, 'BrunoBlocco'), (${CARLA}, 'CarlaBlocco')
  `
}

/** Anna e Bruno diventano amici. */
async function friends(tx: postgres.TransactionSql) {
  await actAs(tx, 'authenticated', ANNA)
  await tx`select public.invia_richiesta_amicizia('BrunoBlocco')`
  await actAs(tx, 'authenticated', BRUNO)
  await tx`select public.accetta_richiesta_amicizia('AnnaBlocco')`
}

const count = async (tx: postgres.TransactionSql, table: string) =>
  Number((await tx.unsafe(`select count(*)::int as n from public.${table}`))[0]?.n)

describe('rimuovi amico', () => {
  it('toglie l’amicizia per entrambi; senza amicizia dà errore', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await friends(tx)
      await tx`select public.rimuovi_amico('annablocco')`
      await tx`reset role`
      expect(await count(tx, 'friendships')).toBe(0)
      await actAs(tx, 'authenticated', ANNA)
      expect(await errorCodeOf(tx, (sp) => sp`select public.rimuovi_amico('BrunoBlocco')`)).toBe(
        'P0002',
      )
      // Ci si può chiedere di nuovo l'amicizia.
      expect((await tx`select public.invia_richiesta_amicizia('BrunoBlocco') as r`)[0]?.r).toBe(
        'inviata',
      )
    })
  })
})

describe('User Block', () => {
  it('toglie amicizia e richieste in entrambe le direzioni', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await friends(tx)
      await actAs(tx, 'authenticated', CARLA)
      await tx`select public.invia_richiesta_amicizia('AnnaBlocco')`
      await actAs(tx, 'authenticated', ANNA)
      await tx`select public.invia_richiesta_amicizia('CarlaBlocco')`
      await tx`select public.blocca_utente('BrunoBlocco')`
      await tx`select public.blocca_utente('CarlaBlocco')`
      await tx`reset role`
      expect(await count(tx, 'friendships')).toBe(0)
      expect(await count(tx, 'friend_requests')).toBe(0)
      expect(await count(tx, 'user_blocks')).toBe(2)
    })
  })

  it('il bloccato non trova il bloccante e non gli chiede l’amicizia, nemmeno col link', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const [invite] = await tx<{ t: string }[]>`select public.link_invito_amici() as t`
      await tx`select public.blocca_utente('BrunoBlocco')`
      await actAs(tx, 'authenticated', BRUNO)
      expect(await tx`select * from public.cerca_utente('AnnaBlocco')`).toEqual([])
      expect(await tx`select * from public.utente_da_invito(${invite?.t ?? ''})`).toEqual([])
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.invia_richiesta_amicizia('AnnaBlocco')`),
      ).toBe('P0002')
      // Non sa di essere bloccato.
      expect(await tx`select * from public.user_blocks`).toEqual([])
      expect(await tx`select * from public.utenti_bloccati()`).toEqual([])
    })
  })

  it('nemmeno il bloccante chiede l’amicizia finché il blocco c’è', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await tx`select public.blocca_utente('BrunoBlocco')`
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.invia_richiesta_amicizia('BrunoBlocco')`),
      ).toBe('P0002')
    })
  })

  it('bloccare chi ti ha bloccato risponde come per uno Username inesistente', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      await tx`select public.blocca_utente('AnnaBlocco')`
      await actAs(tx, 'authenticated', ANNA)
      const blocked = await errorCodeOf(tx, (sp) => sp`select public.blocca_utente('BrunoBlocco')`)
      const missing = await errorCodeOf(tx, (sp) => sp`select public.blocca_utente('Nessuno')`)
      expect(blocked).toBe('P0002')
      expect(blocked).toBe(missing)
    })
  })

  it('bloccare due volte non cambia nulla; si vede solo chi si è bloccato', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await tx`select public.blocca_utente('BrunoBlocco')`
      await tx`select public.blocca_utente('brunoblocco')`
      const rows = await tx<{ username: string }[]>`select username from public.utenti_bloccati()`
      expect(rows.map((r) => r.username)).toEqual(['BrunoBlocco'])
      expect(await errorCodeOf(tx, (sp) => sp`select public.blocca_utente('AnnaBlocco')`)).toBe(
        'P0002',
      )
    })
  })

  it('sbloccare non ripristina l’amicizia; si può di nuovo chiedere', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await friends(tx)
      await actAs(tx, 'authenticated', ANNA)
      await tx`select public.blocca_utente('BrunoBlocco')`
      await tx`select public.sblocca_utente('BrunoBlocco')`
      expect(await count(tx, 'friendships')).toBe(0)
      expect(await tx`select * from public.cerca_utente('BrunoBlocco')`).toEqual([
        { username: 'BrunoBlocco', rapporto: 'nessuno' },
      ])
      expect(await errorCodeOf(tx, (sp) => sp`select public.sblocca_utente('BrunoBlocco')`)).toBe(
        'P0002',
      )
    })
  })

  it('solo chi ha bloccato può sbloccare', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await tx`select public.blocca_utente('BrunoBlocco')`
      await actAs(tx, 'authenticated', BRUNO)
      expect(await errorCodeOf(tx, (sp) => sp`select public.sblocca_utente('AnnaBlocco')`)).toBe(
        'P0002',
      )
      expect(await errorCodeOf(tx, (sp) => sp`delete from public.user_blocks`)).toBe('42501')
    })
  })
})
