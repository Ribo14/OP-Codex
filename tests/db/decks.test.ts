import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Deck builder (RIB-21): Deck con Leader, carte per Card Code, duplicazione, RLS.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-0000000000d1'
const BRUNO = '00000000-0000-0000-0000-0000000000d2'

/** Due utenti, un Leader e una Character con due Printing (solo nella transazione annullata). */
async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna-d@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno-d@example.com')
  `
  await tx`insert into public.sets (series_id, code, name) values (999902, 'ZZ-98', 'Set di prova')`
  await tx`
    insert into public.cards (card_code, name, category)
    values ('ZZ98-001', 'Leader di prova', 'Leader'), ('ZZ98-002', 'Personaggio', 'Character')
  `
  await tx`
    insert into public.printings (print_id, card_code, series_id, rarity)
    values ('ZZ98-001', 'ZZ98-001', 999902, 'L'),
           ('ZZ98-001_p1', 'ZZ98-001', 999902, 'L'),
           ('ZZ98-002', 'ZZ98-002', 999902, 'C'),
           ('ZZ98-002_p1', 'ZZ98-002', 999902, 'SR')
  `
}

async function newDeck(tx: postgres.TransactionSql, name = 'Il mio mazzo') {
  const [deck] = await tx<{ id: string }[]>`
    insert into public.decks (name, leader_code) values (${name}, 'ZZ98-001') returning id
  `
  if (!deck) throw new Error('Deck non creato')
  return deck.id
}

async function change(tx: postgres.TransactionSql, deckId: string, code: string, delta: number) {
  const [row] = await tx<{ n: number }[]>`
    select public.cambia_carte_mazzo(${deckId}, ${code}, ${delta}) as n
  `
  return row?.n
}

const cardsOf = (tx: postgres.TransactionSql, deckId: string) =>
  tx`select card_code, quantity, print_id from public.deck_cards where deck_id = ${deckId} order by card_code`

describe('Deck', () => {
  it('si crea con un Leader, si aggiungono e tolgono carte, si riapre', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const deckId = await newDeck(tx)
      expect(await change(tx, deckId, 'ZZ98-002', 1)).toBe(1)
      expect(await change(tx, deckId, 'ZZ98-002', 3)).toBe(4)
      expect(await change(tx, deckId, 'ZZ98-002', -1)).toBe(3)
      expect(await cardsOf(tx, deckId)).toEqual([
        { card_code: 'ZZ98-002', quantity: 3, print_id: null },
      ])
      expect(await change(tx, deckId, 'ZZ98-002', -3)).toBe(0)
      expect(await cardsOf(tx, deckId)).toEqual([])
      const [deck] =
        await tx`select name, leader_code, visibility from public.decks where id = ${deckId}`
      expect(deck).toEqual({ name: 'Il mio mazzo', leader_code: 'ZZ98-001', visibility: 'private' })
    })
  })

  it('il Leader dev’essere un Leader e la Printing mostrata dev’essere della stessa Card', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`insert into public.decks (name, leader_code) values ('X', 'ZZ98-002')`,
        ),
      ).toBe('23514')
      const deckId = await newDeck(tx)
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`update public.decks set leader_print_id = 'ZZ98-002' where id = ${deckId}`,
        ),
      ).toBe('23514')
      await change(tx, deckId, 'ZZ98-002', 1)
      expect(
        await errorCodeOf(
          tx,
          (sp) =>
            sp`update public.deck_cards set print_id = 'ZZ98-001_p1' where deck_id = ${deckId}`,
        ),
      ).toBe('23514')
    })
  })

  it('cambiare la Printing mostrata non cambia il conteggio per Card Code', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const deckId = await newDeck(tx)
      await change(tx, deckId, 'ZZ98-002', 2)
      await tx`update public.deck_cards set print_id = 'ZZ98-002_p1' where deck_id = ${deckId}`
      await change(tx, deckId, 'ZZ98-002', 1)
      expect(await cardsOf(tx, deckId)).toEqual([
        { card_code: 'ZZ98-002', quantity: 3, print_id: 'ZZ98-002_p1' },
      ])
    })
  })

  it('duplicare crea una copia indipendente', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const deckId = await newDeck(tx, 'Blu')
      await change(tx, deckId, 'ZZ98-002', 4)
      const [copy] = await tx<{ id: string }[]>`select public.duplica_mazzo(${deckId}) as id`
      const copyId = copy?.id ?? ''
      expect(copyId).not.toBe(deckId)
      const [named] = await tx`select name from public.decks where id = ${copyId}`
      expect(named?.name).toBe('Blu (copia)')
      expect(await cardsOf(tx, copyId)).toEqual(await cardsOf(tx, deckId))
      // Modificare la copia non tocca l'originale.
      await change(tx, copyId, 'ZZ98-002', -2)
      expect(await cardsOf(tx, deckId)).toEqual([
        { card_code: 'ZZ98-002', quantity: 4, print_id: null },
      ])
    })
  })

  it('eliminare un Deck toglie anche le sue carte', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      const deckId = await newDeck(tx)
      await change(tx, deckId, 'ZZ98-002', 2)
      await tx`delete from public.decks where id = ${deckId}`
      await tx`reset role`
      expect(await tx`select 1 from public.deck_cards where deck_id = ${deckId}`).toEqual([])
    })
  })

  it('un utente non legge, non modifica e non duplica i Deck di un altro', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', BRUNO)
      const brunoDeck = await newDeck(tx, 'Di Bruno')
      await change(tx, brunoDeck, 'ZZ98-002', 2)

      await actAs(tx, 'authenticated', ANNA)
      expect(await tx`select * from public.decks`).toEqual([])
      expect(await tx`select * from public.deck_cards`).toEqual([])
      expect(
        (await tx`update public.decks set name = 'Rubato' where id = ${brunoDeck}`).count,
      ).toBe(0)
      expect((await tx`delete from public.decks where id = ${brunoDeck}`).count).toBe(0)
      // Non si aggiungono carte al Deck di un altro.
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`select public.cambia_carte_mazzo(${brunoDeck}, 'ZZ98-002', 1)`,
        ),
      ).toBe('42501')
      expect(await change(tx, brunoDeck, 'ZZ98-002', -1)).toBe(0)
      expect(await errorCodeOf(tx, (sp) => sp`select public.duplica_mazzo(${brunoDeck})`)).toBe(
        'P0002',
      )

      await tx`reset role`
      expect(await cardsOf(tx, brunoDeck)).toEqual([
        { card_code: 'ZZ98-002', quantity: 2, print_id: null },
      ])
      const [deck] = await tx`select name from public.decks where id = ${brunoDeck}`
      expect(deck?.name).toBe('Di Bruno')
    })
  })

  it('chi non ha fatto l’accesso o ha la sessione chiusa non vede i Deck', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await newDeck(tx)
      await actAs(tx, 'authenticated', ANNA, { sessionId: crypto.randomUUID() })
      expect(await tx`select * from public.decks`).toEqual([])
      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select * from public.decks`)).toBe('42501')
    })
  })
})
