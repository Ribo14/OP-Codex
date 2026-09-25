import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback, type Access } from './helpers.ts'

// Area Admin (RIB-19): ruolo, verifica in due passaggi obbligatoria, registro, stato dei job.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ADMIN = '00000000-0000-0000-0000-0000000000ad'
const UTENTE = '00000000-0000-0000-0000-0000000000a1'

/** Un Admin (con TOTP confermato) e un utente normale, più un'esecuzione di un job. */
async function setup(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
    values
      (${ADMIN}, 'authenticated', 'authenticated', 'admin@example.com', '{"admin": true}', '{}'),
      (${UTENTE}, 'authenticated', 'authenticated', 'utente@example.com', '{}', '{"admin": true}')
  `
  await tx`
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), ${ADMIN}, 'OP-Codex', 'totp', 'verified', now(), now())
  `
  await tx`
    insert into public.job_runs (job, status, finished_at, stats)
    values ('catalog_sync', 'success', now(), '{"pages": 60}')
  `
}

async function asUser(tx: postgres.TransactionSql, id: string, access: Access = {}) {
  await actAs(tx, 'authenticated', id, access)
}

const jobRuns = (tx: postgres.TransactionSql) => tx`select job from public.job_runs`
const auditLog = (tx: postgres.TransactionSql) => tx`select action from public.admin_audit_log`
const adminState = async (tx: postgres.TransactionSql) =>
  (await tx<{ s: string }[]>`select public.stato_admin() as s`)[0]?.s

describe('Accesso all’area Admin', () => {
  it('un utente normale non legge job_runs né il registro', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await asUser(tx, UTENTE, { aal: 'aal2' })
      expect(await jobRuns(tx)).toEqual([])
      expect(await auditLog(tx)).toEqual([])
      expect(await adminState(tx)).toBe('no')
    })
  })

  it('l’Admin senza codice (aal1) non legge nulla', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await asUser(tx, ADMIN, { aal: 'aal1' })
      expect(await jobRuns(tx)).toEqual([])
      expect(await auditLog(tx)).toEqual([])
      expect(await adminState(tx)).toBe('codice')
    })
  })

  it('l’Admin senza la verifica attivata viene mandato ad attivarla', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`delete from auth.mfa_factors where user_id = ${ADMIN}`
      await asUser(tx, ADMIN, { aal: 'aal1' })
      expect(await adminState(tx)).toBe('codice')
      expect(await jobRuns(tx)).toEqual([])
    })
  })

  it('l’Admin con il codice (aal2) legge lo stato dei job', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await asUser(tx, ADMIN, { aal: 'aal2' })
      expect(await adminState(tx)).toBe('ok')
      expect((await jobRuns(tx)).length).toBeGreaterThan(0)
    })
  })

  it('con la sessione chiusa l’Admin perde l’accesso', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await asUser(tx, ADMIN, { aal: 'aal2', sessionId: crypto.randomUUID() })
      expect(await jobRuns(tx)).toEqual([])
    })
  })

  it('tolto il ruolo, lo si perde subito (anche con lo stesso token)', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      const sessionId = await actAs(tx, 'authenticated', ADMIN, { aal: 'aal2' })
      await tx`reset role`
      await tx`update auth.users set raw_app_meta_data = raw_app_meta_data - 'admin' where id = ${ADMIN}`
      await asUser(tx, ADMIN, { aal: 'aal2', sessionId: sessionId ?? undefined })
      expect(await jobRuns(tx)).toEqual([])
    })
  })

  it('nessuno scrive job_runs dall’app, nemmeno l’Admin', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await asUser(tx, ADMIN, { aal: 'aal2' })
      const code = await errorCodeOf(
        tx,
        (sp) => sp`insert into public.job_runs (job) values ('catalog_sync')`,
      )
      expect(code).toBe('42501')
    })
  })
})

describe('Il ruolo Admin', () => {
  it('un utente non può darselo modificando i propri dati', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await asUser(tx, UTENTE, { aal: 'aal2' })
      // user_metadata con admin: true (modificabile dall'utente) non conta.
      expect(await adminState(tx)).toBe('no')
      // auth.users non è scrivibile dall'app.
      const code = await errorCodeOf(
        tx,
        (sp) =>
          sp`update auth.users set raw_app_meta_data = '{"admin": true}' where id = ${UTENTE}`,
      )
      expect(code).toBe('42501')
    })
  })

  it('anon non può chiedere lo stato Admin', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await actAs(tx, 'anon')
      expect(await errorCodeOf(tx, (sp) => sp`select public.stato_admin()`)).toBe('42501')
      expect(await errorCodeOf(tx, (sp) => sp`select * from public.job_runs`)).toBe('42501')
    })
  })
})

describe('Registro delle azioni Admin', () => {
  /** Una tabella gestita dall'Admin, di prova, con il trigger del registro. */
  async function managedTable(tx: postgres.TransactionSql) {
    await tx`create table public.prova_admin (id int primary key, valore text)`
    await tx`grant select, insert, update, delete on public.prova_admin to authenticated`
    await tx`
      create trigger prova_admin_audit after insert or update or delete on public.prova_admin
        for each row execute function private.registra_azione_admin()
    `
  }

  it('ogni azione produce una riga con chi, cosa, prima e dopo', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await managedTable(tx)
      await asUser(tx, ADMIN, { aal: 'aal2' })
      await tx`insert into public.prova_admin values (1, 'a')`
      await tx`update public.prova_admin set valore = 'b' where id = 1`
      await tx`delete from public.prova_admin where id = 1`

      const rows = await tx`
        select actor, action, table_name, record_id, before, after
        from public.admin_audit_log
        where table_name = 'public.prova_admin'
        order by id
      `
      expect(rows).toEqual([
        {
          actor: ADMIN,
          action: 'insert',
          table_name: 'public.prova_admin',
          record_id: '1',
          before: null,
          after: { id: 1, valore: 'a' },
        },
        {
          actor: ADMIN,
          action: 'update',
          table_name: 'public.prova_admin',
          record_id: '1',
          before: { id: 1, valore: 'a' },
          after: { id: 1, valore: 'b' },
        },
        {
          actor: ADMIN,
          action: 'delete',
          table_name: 'public.prova_admin',
          record_id: '1',
          before: { id: 1, valore: 'b' },
          after: null,
        },
      ])
    })
  })

  it('nessuno modifica o cancella il registro, né dall’app né con i permessi massimi', async () => {
    await inRollback(sql, async (tx) => {
      await setup(tx)
      await tx`insert into public.admin_audit_log (action, table_name) values ('grant_admin', 'auth.users')`

      await asUser(tx, ADMIN, { aal: 'aal2' })
      for (const statement of [
        () => tx.savepoint((sp) => sp`update public.admin_audit_log set action = 'x'`),
        () => tx.savepoint((sp) => sp`delete from public.admin_audit_log`),
        () =>
          tx.savepoint(
            (sp) => sp`insert into public.admin_audit_log (action, table_name) values ('x', 'y')`,
          ),
      ]) {
        await expect(statement()).rejects.toMatchObject({ code: '42501' })
      }

      await tx`reset role`
      await expect(
        tx.savepoint((sp) => sp`update public.admin_audit_log set action = 'x'`),
      ).rejects.toMatchObject({ code: '42501' })
      await expect(
        tx.savepoint((sp) => sp`delete from public.admin_audit_log`),
      ).rejects.toMatchObject({ code: '42501' })
      await expect(tx.savepoint((sp) => sp`truncate public.admin_audit_log`)).rejects.toMatchObject(
        { code: '42501' },
      )
    })
  })
})
