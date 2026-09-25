import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Share Link dei Deck (RIB-26): token casuale, lettura pubblica solo tramite token, revoca.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000f1'
const BRUNO = '00000000-0000-0000-0000-0000000000f2'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-s@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-s@example.com')
  `
  await tx`insert into public.profiles (id, username) values (${ANNA}, 'AnnaDeck')`
  await tx`insert into public.sets (series_id, code, name) values (999903, 'ZZ-97', 'Set di prova')`
  await tx`
    insert into public.cards (card_code, name, category)
    values ('ZZ97-001', 'Leader di prova', 'Leader'), ('ZZ97-002', 'Personaggio', 'Character')
  `
  await tx`
    insert into public.printings (print_id, card_code, series_id, rarity)
    values ('ZZ97-001', 'ZZ97-001', 999903, 'L'), ('ZZ97-002', 'ZZ97-002', 999903, 'C')
  `
  await actAs(tx, 'authenticated', ANNA)
  const [deck] = await tx<{ id: string }[]>`
    insert into public.decks (name, leader_code) values ('Mazzo di Anna', 'ZZ97-001') returning id
  `
  await tx`select public.cambia_carte_mazzo(${deck?.id ?? ''}, 'ZZ97-002', 4)`
  return deck?.id ?? ''
}

const createLink = async (tx: postgres.TransactionSql, deckId: string) =>
  (await tx<{ t: string }[]>`select public.crea_link_mazzo(${deckId}) as t`)[0]?.t ?? ''

const readShared = async (tx: postgres.TransactionSql, token: string) =>
  (await tx<{ d: unknown }[]>`select public.mazzo_condiviso(${token}) as d`)[0]?.d

describe('Share Link dei Deck', () => {
  it('crea un token casuale di 22 caratteri, lo stesso finché non si revoca', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      const token = await createLink(tx, deckId)
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(token).not.toContain(deckId.slice(0, 8))
      expect(await createLink(tx, deckId)).toBe(token)
      const [deck] = await tx`select visibility from public.decks where id = ${deckId}`
      expect(deck?.visibility).toBe('link')
    })
  })

  it('un visitatore senza account vede il Deck tramite il token, con l’autore', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      const token = await createLink(tx, deckId)
      await actAs(tx, 'anon')
      expect(await readShared(tx, token)).toMatchObject({
        name: 'Mazzo di Anna',
        leader_code: 'ZZ97-001',
        username: 'AnnaDeck',
        cards: [{ card_code: 'ZZ97-002', quantity: 4, print_id: null }],
      })
    })
  })

  it('dopo la revoca il vecchio link non restituisce nulla; il nuovo link è diverso', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      const old = await createLink(tx, deckId)
      await tx`select public.revoca_link_mazzo(${deckId})`
      await actAs(tx, 'anon')
      expect(await readShared(tx, old)).toBeNull()
      await actAs(tx, 'authenticated', ANNA)
      const fresh = await createLink(tx, deckId)
      expect(fresh).not.toBe(old)
    })
  })

  it('con un token sbagliato o malformato non si ottiene nulla', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      await createLink(tx, deckId)
      await actAs(tx, 'anon')
      for (const token of ['A'.repeat(22), 'corto', "'; drop table decks; --", '']) {
        expect(await readShared(tx, token), token).toBeNull()
      }
    })
  })

  it('non si elencano né si leggono Deck altrui, nemmeno quelli condivisi', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      await createLink(tx, deckId)
      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select * from public.decks`)).toBe('42501')
      await actAs(tx, 'authenticated', BRUNO)
      expect(await tx`select * from public.decks`).toEqual([])
      expect(await tx`select * from public.deck_cards`).toEqual([])
    })
  })

  it('solo il proprietario crea o revoca il link; un Deck privato non è accessibile', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      expect(await errorCodeOf(tx, (sp) => sp`select public.crea_link_mazzo(${deckId})`)).toBe(
        'P0002',
      )
      expect(await errorCodeOf(tx, (sp) => sp`select public.revoca_link_mazzo(${deckId})`)).toBe(
        'P0002',
      )
      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select public.crea_link_mazzo(${deckId})`)).toBe(
        '42501',
      )
      // Il token non si imposta a mano, nemmeno dal proprietario.
      await actAs(tx, 'authenticated', ANNA)
      expect(
        await errorCodeOf(
          tx,
          (sp) =>
            sp`update public.decks set share_token = 'AAAAAAAAAAAAAAAAAAAAAA', visibility = 'link' where id = ${deckId}`,
        ),
      ).toBe('42501')
    })
  })

  it('duplicare un Deck condiviso crea una copia privata', async () => {
    await inRollback(sql, async (tx) => {
      const deckId = await setup(tx)
      await createLink(tx, deckId)
      const [copy] = await tx<{ id: string }[]>`select public.duplica_mazzo(${deckId}) as id`
      const [row] = await tx`
        select visibility, share_token from public.decks where id = ${copy?.id ?? ''}
      `
      expect(row).toEqual({ visibility: 'private', share_token: null })
    })
  })
})
