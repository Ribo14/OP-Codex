import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Amici (RIB-71, ADR-0015): ricerca per Username esatto, Friend Request, Friendship, link di
// invito. Ogni caso della matrice di accesso che riguarda richieste e ricerca.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000a1'
const BRUNO = '00000000-0000-0000-0000-0000000000a2'
const CARLA = '00000000-0000-0000-0000-0000000000a3'
/** Account senza Username: non usa gli amici e non si trova. */
const DARIO = '00000000-0000-0000-0000-0000000000a4'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-f@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-f@example.com'),
           (${CARLA}, 'authenticated', 'authenticated', 'carla-f@example.com'),
           (${DARIO}, 'authenticated', 'authenticated', 'dario-f@example.com')
  `
  await tx`
    insert into public.profiles (id, username)
    values (${ANNA}, 'AnnaAmici'), (${BRUNO}, 'BrunoAmici'), (${CARLA}, 'CarlaAmici')
  `
}

type Row = Record<string, unknown>

const search = async (tx: postgres.TransactionSql, username: string) =>
  await tx<Row[]>`select * from public.cerca_utente(${username})`

const request = async (tx: postgres.TransactionSql, username: string) =>
  (await tx<{ r: string }[]>`select public.invia_richiesta_amicizia(${username}) as r`)[0]?.r

const state = async (tx: postgres.TransactionSql) =>
  (await tx<{ s: Row }[]>`select public.stato_amici() as s`)[0]?.s

const names = (list: unknown) => (list as { username: string }[]).map((f) => f.username)

describe('ricerca per Username', () => {
  it('trova solo lo Username esatto, senza distinguere maiuscole e minuscole', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(await search(tx, 'brunoamici')).toEqual([
        { username: 'BrunoAmici', rapporto: 'nessuno' },
      ])
      for (const partial of ['Bruno', 'brunoamic', '%', 'Bruno%', '']) {
        expect(await search(tx, partial), partial).toEqual([])
      }
    })
  })

  it('non trova sé stessi né chi è bloccato o ha bloccato', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`insert into public.user_blocks (blocker, blocked) values (${BRUNO}, ${ANNA})`
      await actAs(tx, 'authenticated', ANNA)
      expect(await search(tx, 'AnnaAmici')).toEqual([])
      expect(await search(tx, 'BrunoAmici')).toEqual([])
      await actAs(tx, 'authenticated', BRUNO)
      expect(await search(tx, 'AnnaAmici')).toEqual([])
    })
  })

  it('serve un accesso valido e uno Username; gli anonimi non cercano', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', DARIO)
      expect(
        await errorCodeOf(tx, (sp) => sp`select * from public.cerca_utente('AnnaAmici')`),
      ).toBe('42501')
      await actAs(tx, 'anon')
      expect(
        await errorCodeOf(tx, (sp) => sp`select * from public.cerca_utente('AnnaAmici')`),
      ).toBe('42501')
    })
  })

  it('gli altri profili restano illeggibili direttamente', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(await tx`select username from public.profiles`).toEqual([{ username: 'AnnaAmici' }])
    })
  })
})

describe('Friend Request', () => {
  it('invia, la vede chi la riceve, accettata diventa amicizia', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(await request(tx, 'brunoamici')).toBe('inviata')
      expect(names((await state(tx))?.inviate)).toEqual(['BrunoAmici'])
      expect(await search(tx, 'BrunoAmici')).toEqual([
        { username: 'BrunoAmici', rapporto: 'inviata' },
      ])

      await actAs(tx, 'authenticated', BRUNO)
      expect(names((await state(tx))?.ricevute)).toEqual(['AnnaAmici'])
      await tx`select public.accetta_richiesta_amicizia('AnnaAmici')`
      const bruno = await state(tx)
      expect(names(bruno?.amici)).toEqual(['AnnaAmici'])
      expect(bruno?.ricevute).toEqual([])

      await actAs(tx, 'authenticated', ANNA)
      const anna = await state(tx)
      expect(names(anna?.amici)).toEqual(['BrunoAmici'])
      expect(anna?.inviate).toEqual([])
      expect(await tx`select * from public.friend_requests`).toEqual([])
    })
  })

  it('richiesta doppia o verso un amico: nessuna riga in più', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await request(tx, 'BrunoAmici')
      expect(await request(tx, 'BrunoAmici')).toBe('inviata')
      await actAs(tx, 'authenticated', BRUNO)
      await tx`select public.accetta_richiesta_amicizia('AnnaAmici')`
      await actAs(tx, 'authenticated', ANNA)
      expect(await request(tx, 'BrunoAmici')).toBe('amico')
      expect(await tx`select * from public.friend_requests`).toEqual([])
      expect(await tx`select * from public.friendships`).toHaveLength(1)
    })
  })

  it('due richieste incrociate diventano subito amicizia', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await request(tx, 'BrunoAmici')
      await actAs(tx, 'authenticated', BRUNO)
      expect(await request(tx, 'AnnaAmici')).toBe('amico')
      expect(names((await state(tx))?.amici)).toEqual(['AnnaAmici'])
    })
  })

  it('rifiuta e annulla cancellano la richiesta; senza richiesta danno errore', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await request(tx, 'BrunoAmici')
      await request(tx, 'CarlaAmici')
      await tx`select public.annulla_richiesta_amicizia('CarlaAmici')`
      await actAs(tx, 'authenticated', BRUNO)
      await tx`select public.rifiuta_richiesta_amicizia('AnnaAmici')`
      expect(await tx`select * from public.friend_requests`).toEqual([])
      expect(await tx`select * from public.friendships`).toEqual([])
      for (const fn of ['accetta', 'rifiuta', 'annulla']) {
        expect(
          await errorCodeOf(tx, (sp) =>
            sp.unsafe(`select public.${fn}_richiesta_amicizia('AnnaAmici')`),
          ),
          fn,
        ).toBe('P0002')
      }
    })
  })

  it('non si accetta una richiesta inviata da sé', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await request(tx, 'BrunoAmici')
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.accetta_richiesta_amicizia('BrunoAmici')`),
      ).toBe('P0002')
    })
  })

  it('con un blocco, in qualunque direzione, nessuna richiesta', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`insert into public.user_blocks (blocker, blocked) values (${ANNA}, ${BRUNO})`
      await actAs(tx, 'authenticated', BRUNO)
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.invia_richiesta_amicizia('AnnaAmici')`),
      ).toBe('P0002')
      await actAs(tx, 'authenticated', ANNA)
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.invia_richiesta_amicizia('BrunoAmici')`),
      ).toBe('P0002')
      // Chi è bloccato non vede il blocco.
      await actAs(tx, 'authenticated', BRUNO)
      expect(await tx`select * from public.user_blocks`).toEqual([])
    })
  })

  it('le richieste e le amicizie altrui non si leggono e non si scrivono direttamente', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await request(tx, 'BrunoAmici')
      await actAs(tx, 'authenticated', CARLA)
      expect(await tx`select * from public.friend_requests`).toEqual([])
      expect(await tx`select * from public.friendships`).toEqual([])
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`insert into public.friendships (user_a, user_b) values (${ANNA}, ${CARLA})`,
        ),
      ).toBe('42501')
      expect(
        await errorCodeOf(
          tx,
          (sp) =>
            sp`insert into public.friend_requests (from_user, to_user) values (${CARLA}, ${ANNA})`,
        ),
      ).toBe('42501')
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`delete from public.friend_requests where to_user = ${BRUNO}`,
        ),
      ).toBe('42501')
    })
  })

  it('al massimo 50 richieste in attesa', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`
        insert into auth.users (id, aud, role, email)
        select ('00000000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
               'authenticated', 'authenticated', 'spam-' || n || '@example.com'
        from generate_series(1, 51) as n
      `
      await tx`
        insert into public.profiles (id, username)
        select ('00000000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'Spam' || n
        from generate_series(1, 51) as n
      `
      await tx`
        insert into public.friend_requests (from_user, to_user)
        select ${ANNA}, ('00000000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid
        from generate_series(1, 50) as n
      `
      await actAs(tx, 'authenticated', ANNA)
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.invia_richiesta_amicizia('Spam51')`),
      ).toBe('P0001')
    })
  })
})

describe('link di invito', () => {
  const link = async (tx: postgres.TransactionSql) =>
    (await tx<{ t: string }[]>`select public.link_invito_amici() as t`)[0]?.t ?? ''

  it('stesso token finché non si rigenera; porta a chi ha invitato', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const token = await link(tx)
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(await link(tx)).toBe(token)

      await actAs(tx, 'authenticated', BRUNO)
      expect(await tx`select * from public.utente_da_invito(${token})`).toEqual([
        { username: 'AnnaAmici', rapporto: 'nessuno' },
      ])

      await actAs(tx, 'authenticated', ANNA)
      const [fresh] = await tx<{ t: string }[]>`select public.rigenera_link_invito_amici() as t`
      expect(fresh?.t).not.toBe(token)
      await actAs(tx, 'authenticated', BRUNO)
      expect(await tx`select * from public.utente_da_invito(${token})`).toEqual([])
      expect(await tx`select * from public.utente_da_invito(${fresh?.t ?? ''})`).toHaveLength(1)
    })
  })

  it('niente con il proprio link, con un blocco o con un token sbagliato', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const token = await link(tx)
      expect(await tx`select * from public.utente_da_invito(${token})`).toEqual([])
      await tx`reset role`
      await tx`insert into public.user_blocks (blocker, blocked) values (${ANNA}, ${CARLA})`
      await actAs(tx, 'authenticated', CARLA)
      expect(await tx`select * from public.utente_da_invito(${token})`).toEqual([])
      for (const bad of ['A'.repeat(22), 'corto', "'; drop table friend_invites; --"]) {
        expect(await tx`select * from public.utente_da_invito(${bad})`, bad).toEqual([])
      }
      // Il token degli altri non si legge.
      expect(await tx`select * from public.friend_invites`).toEqual([])
    })
  })
})

describe('account eliminato', () => {
  it('richieste, amicizie, blocchi e link spariscono con l’account', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await request(tx, 'BrunoAmici')
      await request(tx, 'CarlaAmici')
      await link(tx)
      await actAs(tx, 'authenticated', CARLA)
      await tx`select public.accetta_richiesta_amicizia('AnnaAmici')`
      await tx`reset role`
      await tx`insert into public.user_blocks (blocker, blocked) values (${ANNA}, ${DARIO})`
      await tx`delete from auth.users where id = ${ANNA}`
      for (const table of ['friend_requests', 'friendships', 'user_blocks', 'friend_invites']) {
        expect(await tx.unsafe(`select * from public.${table}`), table).toEqual([])
      }
    })
  })

  async function link(tx: postgres.TransactionSql) {
    await tx`select public.link_invito_amici()`
  }
})
