import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Ban List (RIB-29): lettura pubblica, scrittura solo Admin attivo, registro, dati ufficiali.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ADMIN = '00000000-0000-0000-0000-0000000000e1'
const UTENTE = '00000000-0000-0000-0000-0000000000e2'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email, raw_app_meta_data)
    values (${ADMIN}, 'authenticated', 'authenticated', 'admin-b@example.com', '{"admin": true}'),
           (${UTENTE}, 'authenticated', 'authenticated', 'utente-b@example.com', '{}')
  `
  await tx`
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), ${ADMIN}, 'OP-Codex', 'totp', 'verified', now(), now())
  `
}

const insertBan = (tx: postgres.TransactionSql, code: string) =>
  errorCodeOf(
    tx,
    (sp) => sp`
      insert into public.ban_list_entries (card_code, kind, effective_from, source)
      values (${code}, 'banned', '2026-10-01', 'test')
    `,
  )

describe('Ban List', () => {
  it('contiene le voci dell’avviso ufficiale del 24/09/2026', async () => {
    const rows = await sql`
      select card_code, kind, pair_code, effective_from::text as effective_from
      from public.ban_list_entries
      where source like 'Avviso ufficiale del 24/09/2026%'
      order by kind, card_code, pair_code
    `
    expect(rows).toEqual([
      { card_code: 'OP03-040', kind: 'banned', pair_code: null, effective_from: '2026-09-24' },
      { card_code: 'OP06-047', kind: 'banned', pair_code: null, effective_from: '2026-09-24' },
      { card_code: 'OP06-086', kind: 'banned', pair_code: null, effective_from: '2026-09-24' },
      { card_code: 'OP06-116', kind: 'banned', pair_code: null, effective_from: '2026-09-24' },
      { card_code: 'OP14-020', kind: 'banned', pair_code: null, effective_from: '2026-10-12' },
      { card_code: 'ST10-001', kind: 'banned', pair_code: null, effective_from: '2026-09-24' },
      { card_code: 'EB04-058', kind: 'pair', pair_code: 'OP07-115', effective_from: '2026-09-24' },
      { card_code: 'OP08-069', kind: 'pair', pair_code: 'OP11-040', effective_from: '2026-09-24' },
      { card_code: 'OP11-040', kind: 'pair', pair_code: 'OP11-067', effective_from: '2026-09-24' },
    ])
  })

  it('chiunque la legge, anche senza accesso', async () => {
    await inRollback(sql, async (tx) => {
      await actAs(tx, 'anon')
      const rows = await tx`select card_code from public.ban_list_entries`
      expect(rows.length).toBeGreaterThanOrEqual(9)
    })
  })

  it('solo l’Admin con il codice (aal2) scrive; ogni modifica va nel registro', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'anon')
      expect(await insertBan(tx, 'ZZ01-001')).toBe('42501')
      await actAs(tx, 'authenticated', UTENTE, { aal: 'aal2' })
      expect(await insertBan(tx, 'ZZ01-001')).toBe('42501')
      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal1' })
      expect(await insertBan(tx, 'ZZ01-001')).toBe('42501')

      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal2' })
      expect(await insertBan(tx, 'ZZ01-001')).toBeNull()
      const updated = await tx`
        update public.ban_list_entries set effective_from = '2026-11-01' where card_code = 'ZZ01-001'
      `
      expect(updated.count).toBe(1)
      await tx`delete from public.ban_list_entries where card_code = 'ZZ01-001'`

      await tx`reset role`
      const log = await tx`
        select actor, action from public.admin_audit_log
        where table_name = 'public.ban_list_entries' and record_id is not null
          and (before ->> 'card_code' = 'ZZ01-001' or after ->> 'card_code' = 'ZZ01-001')
        order by id
      `
      expect(log).toEqual([
        { actor: ADMIN, action: 'insert' },
        { actor: ADMIN, action: 'update' },
        { actor: ADMIN, action: 'delete' },
      ])
    })
  })

  it('un utente normale non modifica né cancella le voci esistenti', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', UTENTE, { aal: 'aal2' })
      expect((await tx`delete from public.ban_list_entries`).count).toBe(0)
      expect((await tx`update public.ban_list_entries set source = 'x'`).count).toBe(0)
    })
  })

  it('vincoli: limitata con copie massime, coppia con l’altra carta in ordine, niente doppioni', async () => {
    await inRollback(sql, async (tx) => {
      const insert = (kind: string, max: number | null, pair: string | null, code = 'ZZ02-001') =>
        errorCodeOf(
          tx,
          (sp) => sp`
            insert into public.ban_list_entries (card_code, kind, max_copies, pair_code, effective_from)
            values (${code}, ${kind}, ${max}, ${pair}, '2026-10-01')
          `,
        )
      expect(await insert('restricted', null, null)).toBe('23514')
      expect(await insert('restricted', 1, null)).toBeNull()
      expect(await insert('pair', null, null, 'ZZ03-001')).toBe('23514')
      expect(await insert('pair', null, 'ZZ01-001', 'ZZ03-001')).toBe('23514')
      expect(await insert('pair', null, 'ZZ04-001', 'ZZ03-001')).toBeNull()
      expect(await insert('banned', 2, null, 'ZZ05-001')).toBe('23514')
      expect(await insert('banned', null, null, 'non-un-codice')).toBe('23514')
      expect(await insert('banned', null, null, 'OP06-047')).toBe('23505')
    })
  })
})
