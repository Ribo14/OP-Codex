import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Visibility Friends (RIB-73, ADR-0015): ogni riga della matrice di accesso per Deck e
// Collection. Anna ha tre Deck (privato, amici, link) e una Collection; Bruno è suo amico,
// Carla no, Dario è bloccato da Anna.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000c1'
const BRUNO = '00000000-0000-0000-0000-0000000000c2'
const CARLA = '00000000-0000-0000-0000-0000000000c3'
const DARIO = '00000000-0000-0000-0000-0000000000c4'

interface Decks {
  privato: string
  amici: string
  link: string
}

async function setup(tx: postgres.TransactionSql): Promise<Decks> {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-v@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-v@example.com'),
           (${CARLA}, 'authenticated', 'authenticated', 'carla-v@example.com'),
           (${DARIO}, 'authenticated', 'authenticated', 'dario-v@example.com')
  `
  await tx`
    insert into public.profiles (id, username)
    values (${ANNA}, 'AnnaVede'), (${BRUNO}, 'BrunoVede'), (${CARLA}, 'CarlaVede'),
           (${DARIO}, 'DarioVede')
  `
  await tx`insert into public.sets (series_id, code, name) values (999904, 'ZZ-96', 'Set di prova')`
  await tx`
    insert into public.cards (card_code, name, category)
    values ('ZZ96-001', 'Leader di prova', 'Leader'), ('ZZ96-002', 'Personaggio', 'Character')
  `
  await tx`
    insert into public.printings (print_id, card_code, series_id, rarity)
    values ('ZZ96-001', 'ZZ96-001', 999904, 'L'), ('ZZ96-002', 'ZZ96-002', 999904, 'C')
  `
  // Anna e Bruno amici; Dario amico e poi bloccato (il blocco toglie l'amicizia).
  await tx`
    insert into public.friendships (user_a, user_b)
    values (least(${ANNA}::uuid, ${BRUNO}::uuid), greatest(${ANNA}::uuid, ${BRUNO}::uuid))
  `
  await actAs(tx, 'authenticated', DARIO)
  await tx`select public.invia_richiesta_amicizia('AnnaVede')`
  await actAs(tx, 'authenticated', ANNA)
  await tx`select public.accetta_richiesta_amicizia('DarioVede')`
  await tx`select public.blocca_utente('DarioVede')`

  const deck = async (name: string) => {
    const [row] = await tx<{ id: string }[]>`
      insert into public.decks (name, leader_code) values (${name}, 'ZZ96-001') returning id
    `
    await tx`select public.cambia_carte_mazzo(${row?.id ?? ''}, 'ZZ96-002', 4)`
    return row?.id ?? ''
  }
  const decks = {
    privato: await deck('Privato'),
    amici: await deck('Amici'),
    link: await deck('Link'),
  }
  await tx`select public.imposta_visibilita_mazzo(${decks.amici}, 'friends')`
  await tx`select public.imposta_visibilita_mazzo(${decks.link}, 'link')`
  await tx`select public.cambia_copie('ZZ96-002', 'EN', 3)`
  return decks
}

const profile = async (tx: postgres.TransactionSql, username: string) =>
  (
    await tx<{ p: Record<string, unknown> | null }[]>`select public.profilo_amico(${username}) as p`
  )[0]?.p ?? null

const friendDeck = async (tx: postgres.TransactionSql, id: string) =>
  (await tx<{ d: unknown }[]>`select public.mazzo_amico(${id}) as d`)[0]?.d ?? null

const collection = async (tx: postgres.TransactionSql, username: string) =>
  await tx`select * from public.collezione_amico(${username})`

const setCollection = async (tx: postgres.TransactionSql, visibility: string) => {
  await tx`update public.profiles set collection_visibility = ${visibility} where id = ${ANNA}`
}

describe('Deck degli amici', () => {
  it('l’amico vede i Deck Friends e Public Link, mai quelli privati', async () => {
    await inRollback(sql, async (tx) => {
      const decks = await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      const p = await profile(tx, 'annavede')
      expect(p?.username).toBe('AnnaVede')
      const names = (p?.decks as { name: string; card_count: number }[]).map((d) => d.name)
      expect(names.sort()).toEqual(['Amici', 'Link'])
      expect((p?.decks as { card_count: number }[])[0]?.card_count).toBe(4)
      expect(await friendDeck(tx, decks.amici)).toMatchObject({
        name: 'Amici',
        username: 'AnnaVede',
        cards: [{ card_code: 'ZZ96-002', quantity: 4 }],
      })
      expect(await friendDeck(tx, decks.link)).not.toBeNull()
      expect(await friendDeck(tx, decks.privato)).toBeNull()
    })
  })

  it('un non amico e un bloccato non vedono nulla; il Public Link resta aperto col token', async () => {
    await inRollback(sql, async (tx) => {
      const decks = await setup(tx)
      const [row] = await tx<{ share_token: string }[]>`
        select share_token from public.decks where id = ${decks.link}
      `
      for (const user of [CARLA, DARIO]) {
        await actAs(tx, 'authenticated', user)
        expect(await profile(tx, 'AnnaVede'), user).toBeNull()
        for (const id of [decks.privato, decks.amici, decks.link]) {
          expect(await friendDeck(tx, id), user).toBeNull()
        }
        expect(await tx`select * from public.decks`).toEqual([])
        const [shared] = await tx`select public.mazzo_condiviso(${row?.share_token ?? ''}) as d`
        expect(shared?.d).not.toBeNull()
      }
    })
  })

  it('le liste dei propri Deck non includono quelli degli amici', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      expect(await tx`select * from public.decks`).toEqual([])
      expect(await tx`select * from public.deck_cards`).toEqual([])
    })
  })

  it('tolta l’amicizia non si vede più nulla', async () => {
    await inRollback(sql, async (tx) => {
      const decks = await setup(tx)
      await setCollection(tx, 'friends')
      await tx`select public.rimuovi_amico('BrunoVede')`
      await actAs(tx, 'authenticated', BRUNO)
      expect(await profile(tx, 'AnnaVede')).toBeNull()
      expect(await friendDeck(tx, decks.amici)).toBeNull()
      expect(await collection(tx, 'AnnaVede')).toEqual([])
    })
  })

  it('la Visibility: tre livelli, il link si crea e si revoca di conseguenza', async () => {
    await inRollback(sql, async (tx) => {
      const decks = await setup(tx)
      const read = async () =>
        (await tx`select visibility, share_token from public.decks where id = ${decks.privato}`)[0]
      const [first] = await tx<{ t: string }[]>`
        select public.imposta_visibilita_mazzo(${decks.privato}, 'link') as t
      `
      expect(first?.t).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(await read()).toEqual({ visibility: 'link', share_token: first?.t })
      // Di nuovo link: stesso token.
      const [again] = await tx<{ t: string }[]>`
        select public.imposta_visibilita_mazzo(${decks.privato}, 'link') as t
      `
      expect(again?.t).toBe(first?.t)
      await tx`select public.imposta_visibilita_mazzo(${decks.privato}, 'friends')`
      expect(await read()).toEqual({ visibility: 'friends', share_token: null })
      await tx`select public.imposta_visibilita_mazzo(${decks.privato}, 'private')`
      expect(await read()).toEqual({ visibility: 'private', share_token: null })
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`select public.imposta_visibilita_mazzo(${decks.privato}, 'public')`,
        ),
      ).toBe('22023')
    })
  })

  it('solo il proprietario cambia la Visibility, e non a mano', async () => {
    await inRollback(sql, async (tx) => {
      const decks = await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`select public.imposta_visibilita_mazzo(${decks.privato}, 'friends')`,
        ),
      ).toBe('P0002')
      await actAs(tx, 'authenticated', ANNA)
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`update public.decks set visibility = 'friends' where id = ${decks.privato}`,
        ),
      ).toBe('42501')
    })
  })
})

describe('Collection degli amici', () => {
  it('privata per default: l’amico sa solo che non è visibile', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      expect((await profile(tx, 'AnnaVede'))?.collection_visible).toBe(false)
      expect(await collection(tx, 'AnnaVede')).toEqual([])
    })
  })

  it('su Amici la vede l’amico (solo Printing, lingua e copie); gli altri no', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await setCollection(tx, 'friends')
      await actAs(tx, 'authenticated', BRUNO)
      expect((await profile(tx, 'AnnaVede'))?.collection_visible).toBe(true)
      expect(await collection(tx, 'AnnaVede')).toEqual([
        { print_id: 'ZZ96-002', language: 'EN', quantity: 3 },
      ])
      expect(await tx`select * from public.collection_entries`).toEqual([])
      for (const user of [CARLA, DARIO]) {
        await actAs(tx, 'authenticated', user)
        expect(await collection(tx, 'AnnaVede'), user).toEqual([])
      }
    })
  })

  it('la Visibility della Collection la cambia solo il proprietario, con valori ammessi', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await tx`update public.profiles set collection_visibility = 'friends' where id = ${ANNA}`
      expect(
        await errorCodeOf(
          tx,
          (sp) =>
            sp`update public.profiles set collection_visibility = 'public' where id = ${ANNA}`,
        ),
      ).toBe('23514')
      await actAs(tx, 'authenticated', BRUNO)
      await tx`update public.profiles set collection_visibility = 'private' where id = ${ANNA}`
      await tx`reset role`
      const [row] = await tx`select collection_visibility from public.profiles where id = ${ANNA}`
      expect(row?.collection_visibility).toBe('friends')
    })
  })
})
