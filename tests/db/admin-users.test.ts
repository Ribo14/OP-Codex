import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback, type Access } from './helpers.ts'

// Area Admin rinnovata (RIB-89): panoramica, elenco utenti, sospensione e chiusura sessioni.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ADMIN = '00000000-0000-0000-0000-0000000000ad'
const ALTRO_ADMIN = '00000000-0000-0000-0000-0000000000ae'
const UTENTE = '00000000-0000-0000-0000-0000000000a1'

async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email, raw_app_meta_data, created_at)
    values
      (${ADMIN}, 'authenticated', 'authenticated', 'admin@example.com', '{"admin": true}', now()),
      (${ALTRO_ADMIN}, 'authenticated', 'authenticated', 'admin2@example.com', '{"admin": true}', now()),
      (${UTENTE}, 'authenticated', 'authenticated', 'utente@example.com', '{"providers": ["email"]}', now())
  `
  await tx`insert into public.profiles (id, username) values (${UTENTE}, 'Utente_Prova')`
  await tx`
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), ${ADMIN}, 'OP-Codex', 'totp', 'verified', now(), now())
  `
  await tx`
    insert into public.job_runs (job, status, started_at, finished_at)
    values
      ('faq_sync', 'success', now() - interval '2 days', now() - interval '2 days'),
      ('faq_sync', 'error', now() - interval '1 day', now() - interval '1 day')
  `
}

/** Una sessione aperta dell'utente normale, come dopo un accesso. */
async function userSession(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.sessions (id, user_id, aal, created_at, updated_at)
    values (gen_random_uuid(), ${UTENTE}, 'aal1', now(), now())
  `
}

const as = (tx: postgres.TransactionSql, id: string, access: Access) =>
  actAs(tx, 'authenticated', id, access)

const CALLS = [
  (sp: postgres.TransactionSql) => sp`select public.admin_panoramica()`,
  (sp: postgres.TransactionSql) => sp`select * from public.admin_utenti()`,
  (sp: postgres.TransactionSql) => sp`select public.admin_utente(${UTENTE})`,
  (sp: postgres.TransactionSql) => sp`select public.admin_sospendi_utente(${UTENTE}, true)`,
  (sp: postgres.TransactionSql) => sp`select public.admin_chiudi_sessioni(${UTENTE})`,
]

describe('Funzioni Admin sugli utenti: chi può chiamarle', () => {
  it('un utente normale no', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await as(tx, UTENTE, { aal: 'aal2' })
      for (const call of CALLS) expect(await errorCodeOf(tx, call)).toBe('42501')
    })
  })

  it('l’Admin senza codice (aal1) no', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await as(tx, ADMIN, { aal: 'aal1' })
      for (const call of CALLS) expect(await errorCodeOf(tx, call)).toBe('42501')
    })
  })

  it('l’Admin con il codice dato più di 12 ore fa no (RIB-98)', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await as(tx, ADMIN, { aal: 'aal2', codeSecondsAgo: 13 * 3600 })
      for (const call of CALLS) expect(await errorCodeOf(tx, call)).toBe('42501')
    })
  })

  it('anon no', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'anon')
      for (const call of CALLS) expect(await errorCodeOf(tx, call)).toBe('42501')
    })
  })
})

describe('Panoramica e utenti per l’Admin attivo', () => {
  it('numeri dell’app e, per ogni job, l’ultima esecuzione e l’ultima riuscita', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await as(tx, ADMIN, { aal: 'aal2' })
      const [row] = await tx<
        { p: Record<string, unknown> }[]
      >`select public.admin_panoramica() as p`
      const p = row?.p ?? {}
      expect(Number(p.users)).toBeGreaterThanOrEqual(3)
      expect(Number(p.users_new_7d)).toBeGreaterThanOrEqual(3)
      const faq = (
        p.jobs as { job: string; status: string; last_success_at: string | null }[]
      ).find((j) => j.job === 'faq_sync')
      expect(faq?.status).toBe('error')
      expect(faq?.last_success_at).not.toBeNull()
    })
  })

  it('contenuti da completare: carte senza spiegazione per Set e booster senza FAQ (RIB-93)', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`insert into public.sets (series_id, code, name) values (-990, 'OP-99', 'Prova')`
      await tx`
        insert into public.cards (card_code, name, category, effect)
        values ('OP99-001', 'A', 'Character', '[On Play] Draw 1 card.'),
               ('OP99-002', 'B', 'Character', '[Blocker]'),
               ('OP99-003', 'C', 'Character', null)
      `
      await tx`insert into public.card_explanations (card_code, body) values ('OP99-002', 'Ha [Blocker].')`
      await as(tx, ADMIN, { aal: 'aal2' })
      const [row] = await tx<{ c: Record<string, unknown> }[]>`
        select public.admin_panoramica() -> 'content' as c
      `
      const content = row?.c ?? {}
      expect(content.missing_by_set).toEqual(
        expect.arrayContaining([{ set: 'OP99', count: 1, preview: false }]),
      )
      expect(content.sets_without_faq).toEqual(expect.arrayContaining(['OP-99']))
    })
  })

  it('elenco senza email; il dettaglio la mostra', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await as(tx, ADMIN, { aal: 'aal2' })
      const users = await tx`select * from public.admin_utenti()`
      const utente = users.find((u) => u.id === UTENTE)
      expect(utente).toMatchObject({ username: 'Utente_Prova', admin: false, suspended: false })
      expect(Object.keys(utente ?? {})).not.toContain('email')
      expect(users.find((u) => u.id === ADMIN)).toMatchObject({ admin: true, mfa: true })

      const [row] = await tx<
        { d: Record<string, unknown> }[]
      >`select public.admin_utente(${UTENTE}) as d`
      expect(row?.d).toMatchObject({ email: 'utente@example.com', providers: ['email'] })
      expect(
        await errorCodeOf(tx, (sp) => sp`select public.admin_utente(${crypto.randomUUID()})`),
      ).toBe('P0001')
    })
  })
})

describe('Sospensione e sessioni', () => {
  it('sospendere chiude le sessioni, blocca l’accesso e finisce nel registro; poi si riattiva', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await userSession(tx)
      await as(tx, ADMIN, { aal: 'aal2' })
      await tx`select public.admin_sospendi_utente(${UTENTE}, true)`

      await tx`reset role`
      const [user] =
        await tx`select banned_until > now() as banned from auth.users where id = ${UTENTE}`
      expect(user?.banned).toBe(true)
      expect(await tx`select 1 from auth.sessions where user_id = ${UTENTE}`).toHaveLength(0)

      await as(tx, ADMIN, { aal: 'aal2' })
      await tx`select public.admin_sospendi_utente(${UTENTE}, false)`
      await tx`reset role`
      const [after] = await tx`select banned_until from auth.users where id = ${UTENTE}`
      expect(after?.banned_until).toBeNull()

      const log = await tx`
        select actor, action, record_id, after from public.admin_audit_log
        where table_name = 'auth.users' and record_id = ${UTENTE} order by id
      `
      expect(log).toEqual([
        {
          actor: ADMIN,
          action: 'suspend_user',
          record_id: UTENTE,
          after: expect.objectContaining({ closed_sessions: 1 }) as unknown,
        },
        {
          actor: ADMIN,
          action: 'reactivate_user',
          record_id: UTENTE,
          after: { banned_until: null, closed_sessions: 0 },
        },
      ])
    })
  })

  it('chiudere le sessioni le cancella tutte e lo registra', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await userSession(tx)
      await userSession(tx)
      await as(tx, ADMIN, { aal: 'aal2' })
      const [row] = await tx<{ n: number }[]>`select public.admin_chiudi_sessioni(${UTENTE}) as n`
      expect(row?.n).toBe(2)
      await tx`reset role`
      expect(await tx`select 1 from auth.sessions where user_id = ${UTENTE}`).toHaveLength(0)
      const [log] = await tx`select action from public.admin_audit_log where record_id = ${UTENTE}`
      expect(log?.action).toBe('close_sessions')
    })
  })

  it('mai su se stessi né su un altro Admin', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await as(tx, ADMIN, { aal: 'aal2' })
      for (const id of [ADMIN, ALTRO_ADMIN]) {
        expect(
          await errorCodeOf(tx, (sp) => sp`select public.admin_sospendi_utente(${id}, true)`),
        ).toBe('P0001')
        expect(await errorCodeOf(tx, (sp) => sp`select public.admin_chiudi_sessioni(${id})`)).toBe(
          'P0001',
        )
      }
      await tx`reset role`
      expect(
        await tx`select 1 from public.admin_audit_log where record_id in (${ADMIN}, ${ALTRO_ADMIN})`,
      ).toEqual([])
    })
  })
})
