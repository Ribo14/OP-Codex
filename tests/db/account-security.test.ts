import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

// Sicurezza dell'account (RIB-18): sessioni revocate, verifica in due passaggi, eliminazione.

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const ANNA = '00000000-0000-0000-0000-00000000000a'
const BRUNO = '00000000-0000-0000-0000-00000000000b'

/** Due account con profilo (solo dentro la transazione annullata). */
async function accounts(tx: postgres.TransactionSql) {
  await tx`
    insert into auth.users (id, aud, role, email)
    values (${ANNA}, 'authenticated', 'authenticated', 'anna@example.com'),
           (${BRUNO}, 'authenticated', 'authenticated', 'bruno@example.com')
  `
  await tx`insert into public.profiles (id, username) values (${ANNA}, 'Anna'), (${BRUNO}, 'Bruno')`
}

async function ownProfile(tx: postgres.TransactionSql) {
  return tx`select username from public.profiles`
}

async function activateTotp(tx: postgres.TransactionSql, userId: string) {
  await tx`
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), ${userId}, 'OP-Codex', 'totp', 'verified', now(), now())
  `
}

async function deleteAccount(tx: postgres.TransactionSql, username: string | null) {
  try {
    await tx.savepoint((sp) => sp`select public.elimina_account(${username})`)
    return null
  } catch (error) {
    const e = error as postgres.PostgresError
    return { code: e.code, message: e.message }
  }
}

describe('Sessioni', () => {
  it('con una sessione attiva si leggono i propri dati', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await actAs(tx, 'authenticated', ANNA)
      expect(await ownProfile(tx)).toEqual([{ username: 'Anna' }])
    })
  })

  it('dopo "Esci da tutti i dispositivi" un token ancora valido non legge né scrive più', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      const sessionId = await actAs(tx, 'authenticated', ANNA)
      // Supabase Auth cancella tutte le sessioni dell'utente (signOut con scope global).
      await tx`reset role`
      await tx`delete from auth.sessions where user_id = ${ANNA}`
      await actAs(tx, 'authenticated', ANNA, { sessionId: sessionId ?? undefined })

      expect(await ownProfile(tx)).toEqual([])
      const updated = await tx`update public.profiles set username = 'AnnaNuova' where id = ${ANNA}`
      expect(updated.count).toBe(0)
    })
  })

  it('un token senza sessione non vale', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await actAs(tx, 'authenticated', ANNA, { sessionId: crypto.randomUUID() })
      expect(await ownProfile(tx)).toEqual([])
    })
  })

  it('non vale la sessione di un altro utente', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      const brunoSession = await actAs(tx, 'authenticated', BRUNO)
      await actAs(tx, 'authenticated', ANNA, { sessionId: brunoSession ?? undefined })
      expect(await ownProfile(tx)).toEqual([])
    })
  })
})

describe('Verifica in due passaggi', () => {
  it('con la verifica attiva, senza codice (aal1) i dati personali restano chiusi', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await activateTotp(tx, ANNA)
      await actAs(tx, 'authenticated', ANNA, { aal: 'aal1' })
      expect(await ownProfile(tx)).toEqual([])
      const code = await errorCodeOf(
        tx,
        (sp) => sp`insert into public.profiles (id, username) values (${ANNA}, 'AnnaBis')`,
      )
      expect(code).toBe('42501')
    })
  })

  it('con il codice (aal2) i dati si aprono', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await activateTotp(tx, ANNA)
      await actAs(tx, 'authenticated', ANNA, { aal: 'aal2' })
      expect(await ownProfile(tx)).toEqual([{ username: 'Anna' }])
    })
  })

  it('un fattore non ancora confermato non chiede il codice', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await tx`
        insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
        values (gen_random_uuid(), ${ANNA}, 'OP-Codex', 'totp', 'unverified', now(), now())
      `
      await actAs(tx, 'authenticated', ANNA, { aal: 'aal1' })
      expect(await ownProfile(tx)).toEqual([{ username: 'Anna' }])
    })
  })
})

describe('Eliminazione dell’account', () => {
  it('cancella l’utente e tutte le righe collegate, in ogni tabella', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await activateTotp(tx, ANNA)
      await actAs(tx, 'authenticated', ANNA, { aal: 'aal2' })
      expect(await deleteAccount(tx, 'anna')).toBeNull()

      await tx`reset role`
      // Ogni colonna (in qualunque schema tranne auth stesso) che punta ad auth.users.
      const refs = await tx<{ tab: string; col: string }[]>`
        select c.conrelid::regclass::text as tab, a.attname as col
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
        where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      `
      expect(refs.length).toBeGreaterThan(0)
      for (const { tab, col } of refs) {
        const [row] = await tx.unsafe<{ n: number }[]>(
          `select count(*)::int as n from ${tab} where ${col} = $1`,
          [ANNA],
        )
        expect(row?.n, `${tab}.${col}`).toBe(0)
      }
      expect(await tx`select 1 from auth.users where id = ${ANNA}`).toEqual([])
      // Gli altri restano.
      expect(
        await tx`select username from public.profiles where id in (${ANNA}, ${BRUNO})`,
      ).toEqual([{ username: 'Bruno' }])
    })
  })

  it('ogni tabella personale in public si cancella a cascata con l’utente', async () => {
    // Vale anche per le tabelle future: chi ne aggiunge una senza on delete cascade fa fallire
    // questo test (e l'eliminazione dell'account lascerebbe dati o verrebbe bloccata).
    const refs = await sql<{ tab: string; action: string }[]>`
      select c.conrelid::regclass::text as tab, c.confdeltype as action
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and n.nspname <> 'auth'
    `
    expect(refs.length).toBeGreaterThan(0)
    for (const { tab, action } of refs) expect(action, tab).toBe('c')
  })

  it('senza lo Username giusto non elimina', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await actAs(tx, 'authenticated', ANNA)
      for (const wrong of ['Bruno', '', null]) {
        expect(await deleteAccount(tx, wrong)).toMatchObject({ message: 'username_errato' })
      }
      await tx`reset role`
      expect(await tx`select 1 from auth.users where id = ${ANNA}`).toHaveLength(1)
    })
  })

  it('con un accesso più vecchio di 10 minuti chiede di rifarlo', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await actAs(tx, 'authenticated', ANNA, { secondsAgo: 11 * 60 })
      expect(await deleteAccount(tx, 'Anna')).toMatchObject({ message: 'accesso_non_recente' })
    })
  })

  it('rifiuta chi non ha fatto l’accesso', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await actAs(tx, 'anon')
      // 42501: anon non ha il permesso di chiamarla.
      expect(await deleteAccount(tx, 'Anna')).toMatchObject({ code: '42501' })
    })
  })

  it('non elimina un altro utente: cancella sempre e solo chi la chiama', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await actAs(tx, 'authenticated', ANNA)
      // Lo Username di Bruno non basta: la funzione confronta con il profilo di chi chiama.
      expect(await deleteAccount(tx, 'Bruno')).toMatchObject({ message: 'username_errato' })
      await tx`reset role`
      expect(await tx`select 1 from auth.users where id = ${BRUNO}`).toHaveLength(1)
    })
  })

  it('rifiuta una sessione revocata o senza il codice della verifica in due passaggi', async () => {
    await inRollback(sql, async (tx) => {
      await accounts(tx)
      await activateTotp(tx, ANNA)
      await actAs(tx, 'authenticated', ANNA, { aal: 'aal1' })
      expect(await deleteAccount(tx, 'Anna')).toMatchObject({ code: '42501' })

      await actAs(tx, 'authenticated', BRUNO, { sessionId: crypto.randomUUID() })
      expect(await deleteAccount(tx, 'Bruno')).toMatchObject({ code: '42501' })
      await tx`reset role`
      expect(await tx`select 1 from auth.users where id in (${ANNA}, ${BRUNO})`).toHaveLength(2)
    })
  })
})
