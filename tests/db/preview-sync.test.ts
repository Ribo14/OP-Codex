import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import type { MergedCatalog } from '../../catalog-sync/catalog-merge.ts'
import { connect, upsertCatalog } from '../../catalog-sync/catalog-store.ts'
import { parsePreviewSet, upsertPreviewSet } from '../../catalog-sync/preview-sync.ts'
import { PREVIEW_JSON } from '../../catalog-sync/fixtures/preview-set.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Anteprime (ADR-0016) sul database locale: tutto dentro transazioni annullate.

const sql = connect()
afterAll(async () => {
  await sql.end()
})

const USER = '00000000-0000-0000-0000-0000000000e1'
// Un codice di Set che nessun dato vero usa: le anteprime di prova non si scontrano col catalogo.
const SITE_ID = 'zz97'
const json = structuredClone(PREVIEW_JSON)
for (const card of json.cards) card.id = card.id.replace('EB05', 'ZZ97')
const PREVIEW = parsePreviewSet(SITE_ID, json)

async function printings(tx: postgres.TransactionSql) {
  return tx<{ print_id: string; preview: boolean; preview_image: string | null }[]>`
    select print_id, preview, preview_image from public.printings
    where card_code like 'ZZ97-%' order by print_id
  `
}

/** Il catalogo ufficiale con la sola Card ZZ97-002, come la pubblicherebbe Bandai. */
function officialCatalog(): MergedCatalog {
  return {
    sets: [{ seriesId: 999797, code: 'ZZ-97', name: 'Set uscito', productType: null }],
    cards: [
      {
        cardCode: 'ZZ97-002',
        name: 'Character ufficiale',
        category: 'Character',
        cost: 6,
        life: null,
        power: 6000,
        counter: 1000,
        attributes: ['Wisdom'],
        colors: ['Green'],
        types: ['Straw Hat Crew'],
        block: '3',
        effect: 'Testo ufficiale.',
        trigger: null,
        keywords: [],
      },
    ],
    printings: [
      { printId: 'ZZ97-002', cardCode: 'ZZ97-002', rarity: 'SR', block: '3', seriesId: 999797 },
    ],
    duplicatePrintIds: [],
  }
}

// Con tutti i test insieme alcune transazioni superano il secondo: margine come catalog-job.
describe('Preview Sync sul database (ADR-0016)', { timeout: 10_000 }, () => {
  it('salva Set, Card e Printing come anteprime, con series_id negativo; rifarlo non cambia nulla', async () => {
    await inRollback(sql, async (tx) => {
      const first = await upsertPreviewSet(tx, PREVIEW)
      expect(first).toEqual({ cards: 3, printings: 4, official: 0, removed: 0 })
      const [set] = await tx<{ series_id: number; preview: boolean }[]>`
        select series_id, preview from public.sets where code = 'ZZ-97'
      `
      expect(set?.preview).toBe(true)
      expect(set?.series_id).toBeLessThan(0)
      expect((await printings(tx)).map((p) => [p.print_id, p.preview])).toEqual([
        ['ZZ97-001', true],
        ['ZZ97-002', true],
        ['ZZ97-002_p1', true],
        ['ZZ97-003', true],
      ])
      const [card] =
        await tx`select preview, preview_credit from public.cards where card_code = 'ZZ97-002'`
      expect(card).toEqual({ preview: true, preview_credit: 'Traduttore' })

      expect(await upsertPreviewSet(tx, PREVIEW)).toEqual({
        cards: 0,
        printings: 0,
        official: 0,
        removed: 0,
      })
    })
  })

  it('un’immagine cambiata sul sito si riscarica; una variante sparita si toglie', async () => {
    await inRollback(sql, async (tx) => {
      await upsertPreviewSet(tx, PREVIEW)
      await tx`update public.printings set image_synced_at = now() where card_code like 'ZZ97-%'`
      const changed = structuredClone(PREVIEW)
      const card = changed.cards.find((c) => c.cardCode === 'ZZ97-002')
      if (!card) throw new Error('carta mancante')
      card.printings = [{ printId: 'ZZ97-002', rarity: 'SR', image: 'zz97-002v3' }]

      expect(await upsertPreviewSet(tx, changed)).toMatchObject({ printings: 1, removed: 1 })
      const rows = await tx<{ print_id: string; synced: boolean }[]>`
        select print_id, image_synced_at is not null as synced from public.printings
        where card_code = 'ZZ97-002' order by print_id
      `
      expect(rows).toEqual([{ print_id: 'ZZ97-002', synced: false }])
    })
  })

  it('le anteprime non entrano in una Collection, nemmeno scrivendo direttamente', async () => {
    await inRollback(sql, async (tx) => {
      await tx`insert into auth.users (id, aud, role, email) values (${USER}, 'authenticated', 'authenticated', 'anteprime@example.com')`
      await upsertPreviewSet(tx, PREVIEW)
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('ZZ97-001', 'EN', 1)`),
      ).not.toBeNull()
      await actAs(tx, 'authenticated', USER)
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.cambia_copie('ZZ97-001', 'EN', 1)`),
      ).toBe('23514')
      await tx`reset role`
      expect(
        await errorCodeOf(
          tx,
          (sp) =>
            sp`insert into public.collection_entries (user_id, print_id, quantity) values (${USER}, 'ZZ97-001', 1)`,
        ),
      ).toBe('23514')
    })
  })

  it('una carta già ufficiale in un altro Set non diventa anteprima', async () => {
    await inRollback(sql, async (tx) => {
      await upsertCatalog(tx, {
        ...officialCatalog(),
        sets: [{ seriesId: 999796, code: 'ZZ-96', name: 'Altro Set', productType: null }],
        printings: [
          { printId: 'ZZ97-002', cardCode: 'ZZ97-002', rarity: 'SR', block: '3', seriesId: 999796 },
        ],
      })
      expect(await upsertPreviewSet(tx, PREVIEW)).toMatchObject({ official: 1, cards: 2 })
      const [card] = await tx`select name, preview from public.cards where card_code = 'ZZ97-002'`
      expect(card).toEqual({ name: 'Character ufficiale', preview: false })
    })
  })

  it('quando la carta esce, il Catalog Sync sostituisce l’anteprima e i mazzi restano', async () => {
    await inRollback(sql, async (tx) => {
      await tx`insert into auth.users (id, aud, role, email) values (${USER}, 'authenticated', 'authenticated', 'anteprime@example.com')`
      await upsertPreviewSet(tx, PREVIEW)
      // Un mazzo con il Leader in anteprima e la variante alt-art della 002.
      const [deck] = await tx<{ id: string }[]>`
        insert into public.decks (user_id, name, leader_code, leader_print_id)
        values (${USER}, 'Mazzo anteprima', 'ZZ97-001', 'ZZ97-001') returning id
      `
      await tx`
        insert into public.deck_cards (deck_id, card_code, quantity, print_id)
        values (${deck?.id ?? ''}, 'ZZ97-002', 4, 'ZZ97-002_p1')
      `

      await upsertCatalog(tx, officialCatalog())

      // La 002 è ufficiale: dati di Bandai, solo la stampa ufficiale, immagine da scaricare.
      const [card] = await tx`
        select name, block, preview, preview_credit from public.cards where card_code = 'ZZ97-002'
      `
      expect(card).toEqual({
        name: 'Character ufficiale',
        block: '3',
        preview: false,
        preview_credit: null,
      })
      expect((await printings(tx)).map((p) => [p.print_id, p.preview])).toEqual([
        ['ZZ97-001', true],
        ['ZZ97-002', false],
        ['ZZ97-003', true],
      ])
      // Il mazzo ha ancora 4 copie della 002, ora sulla stampa base.
      const [row] =
        await tx`select quantity, print_id from public.deck_cards where deck_id = ${deck?.id ?? ''}`
      expect(row).toEqual({ quantity: 4, print_id: null })
      // Il Set in anteprima resta (ha ancora carte) ma cede il codice a quello ufficiale.
      const sets =
        await tx`select code, preview from public.sets where code like 'ZZ-97%' order by code`
      expect(sets).toEqual([
        { code: 'ZZ-97', preview: false },
        { code: 'ZZ-97 (anteprima)', preview: true },
      ])

      // Il Set è uscito: un nuovo Preview Sync non lo tocca più.
      expect(await upsertPreviewSet(tx, PREVIEW)).toEqual({
        cards: 0,
        printings: 0,
        official: 0,
        removed: 0,
      })
      const [still] = await tx`select name, preview from public.cards where card_code = 'ZZ97-002'`
      expect(still).toEqual({ name: 'Character ufficiale', preview: false })
    })
  })
})
