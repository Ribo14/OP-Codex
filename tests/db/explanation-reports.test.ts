import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Segnalazioni e richieste di spiegazione (RIB-54): dati personali, limite giornaliero, coda
// dell'Admin con i cambi di stato nel registro.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ADMIN = '00000000-0000-0000-0000-0000000005ad'
const ANNA = '00000000-0000-0000-0000-0000000005a1'
const BRUNO = '00000000-0000-0000-0000-0000000005b1'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email, raw_app_meta_data)
    values
      (${ADMIN}, 'authenticated', 'authenticated', 'admin-seg@example.com', '{"admin": true}'),
      (${ANNA}, 'authenticated', 'authenticated', 'anna-seg@example.com', '{}'),
      (${BRUNO}, 'authenticated', 'authenticated', 'bruno-seg@example.com', '{}')
  `
  await tx`
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), ${ADMIN}, 'OP-Codex', 'totp', 'verified', now(), now())
  `
}

const report = (tx: postgres.TransactionSql, cardCode = 'OP01-001', note: string | null = null) =>
  tx`
    insert into public.explanation_reports (card_code, kind, reason, note)
    values (${cardCode}, 'report', 'wrong', ${note})
  `

const visible = (tx: postgres.TransactionSql) =>
  tx<{ card_code: string; kind: string; status: string }[]>`
    select card_code, kind, status from public.explanation_reports order by id
  `

describe('Segnalazioni e richieste di spiegazione', () => {
  it('ognuno vede solo le proprie; l’Admin attivo vede tutto', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await report(tx, 'OP01-001', 'Il costo è sbagliato')
      await actAs(tx, 'authenticated', BRUNO)
      await tx`insert into public.explanation_reports (card_code, kind) values ('OP02-001', 'request')`
      expect(await visible(tx)).toEqual([
        { card_code: 'OP02-001', kind: 'request', status: 'open' },
      ])

      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal1' })
      expect(await visible(tx)).toEqual([])
      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal2' })
      expect(await visible(tx)).toHaveLength(2)

      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select 1 from public.explanation_reports`)).toBe(
        '42501',
      )
    })
  })

  it('si segnala solo a proprio nome e aperta; lo stato lo cambia solo l’Admin', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`
            insert into public.explanation_reports (user_id, card_code, kind)
            values (${BRUNO}, 'OP01-001', 'request')
          `,
        ),
      ).toBe('42501')
      expect(
        await errorCodeOf(
          tx,
          (sp) => sp`
            insert into public.explanation_reports (card_code, kind, status)
            values ('OP01-001', 'request', 'resolved')
          `,
        ),
      ).toBe('42501')
      await report(tx)
      await tx`update public.explanation_reports set status = 'resolved'`
      expect((await visible(tx))[0]?.status).toBe('open')

      await actAs(tx, 'authenticated', ADMIN, { aal: 'aal2' })
      await tx`update public.explanation_reports set status = 'resolved'`
      expect((await visible(tx))[0]?.status).toBe('resolved')
      const [log] = await tx<{ table_name: string; action: string }[]>`
        select table_name, action from public.admin_audit_log
        where table_name = 'public.explanation_reports'
      `
      expect(log).toEqual({ table_name: 'public.explanation_reports', action: 'update' })
    })
  })

  it('niente doppioni aperti, dati validi, al massimo 10 al giorno', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await report(tx, 'OP01-001')
      expect(await errorCodeOf(tx, (sp) => report(sp, 'OP01-001'))).toBe('23505')
      // Una segnalazione senza motivo, o una richiesta con il motivo, non vanno.
      expect(
        await errorCodeOf(
          tx,
          (sp) =>
            sp`insert into public.explanation_reports (card_code, kind) values ('OP01-002', 'report')`,
        ),
      ).toBe('23514')
      expect(await errorCodeOf(tx, (sp) => report(sp, 'OP01-003', 'x'.repeat(501)))).toBe('23514')
      expect(await errorCodeOf(tx, (sp) => report(sp, 'OP01-004', '   '))).toBe('23514')

      for (let i = 5; i <= 13; i++) await report(tx, `OP01-${String(i).padStart(3, '0')}`)
      expect(await errorCodeOf(tx, (sp) => report(sp, 'OP01-099'))).toBe('23514')
    })
  })

  it('eliminando l’account spariscono anche le sue segnalazioni', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'authenticated', ANNA)
      await report(tx)
      await tx`reset role`
      await tx`delete from auth.users where id = ${ANNA}`
      const [left] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.explanation_reports where user_id = ${ANNA}
      `
      expect(left?.n).toBe(0)
    })
  })
})
