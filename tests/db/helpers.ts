import type postgres from 'postgres'

class Rollback extends Error {}

/**
 * Esegue `fn` in una transazione che viene sempre annullata:
 * i test possono scrivere nel DB locale senza lasciare tracce.
 */
export async function inRollback(
  sql: postgres.Sql,
  fn: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx)
      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }
}

export interface Access {
  /** Livello del JWT: aal2 dopo il codice della verifica in due passaggi. */
  aal?: 'aal1' | 'aal2'
  /** Da quanti secondi è stato fatto l'accesso (claim amr). */
  secondsAgo?: number
  /** Sessione del JWT; se manca se ne crea una nuova (solo se l'utente esiste). */
  sessionId?: string
}

/**
 * Cambia ruolo come farebbe PostgREST per una richiesta anonima o di un utente loggato
 * (`userId` = sub del JWT, cioè auth.uid()). Per un utente che esiste in auth.users crea anche la
 * sessione, come un vero accesso: le policy sui dati personali la richiedono (RIB-18).
 * Restituisce l'id della sessione, o null.
 */
export async function actAs(
  tx: postgres.TransactionSql,
  role: 'anon' | 'authenticated',
  userId = '00000000-0000-0000-0000-000000000001',
  access: Access = {},
): Promise<string | null> {
  await tx`reset role`
  if (role === 'anon') {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'anon' })}, true)`
    await tx.unsafe('set local role anon')
    return null
  }
  const aal = access.aal ?? 'aal1'
  let sessionId = access.sessionId ?? null
  if (!sessionId) {
    const [session] = await tx<{ id: string }[]>`
      insert into auth.sessions (id, user_id, aal, created_at, updated_at)
      select gen_random_uuid(), id, ${aal}::auth.aal_level, now(), now()
      from auth.users where id = ${userId}
      returning id
    `
    sessionId = session?.id ?? null
  }
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    sub: userId,
    role: 'authenticated',
    aal,
    amr: [{ method: 'password', timestamp: now - (access.secondsAgo ?? 0) }],
    ...(sessionId ? { session_id: sessionId } : {}),
  }
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`
  await tx.unsafe('set local role authenticated')
  return sessionId
}

/** Esegue `fn` dentro un savepoint e restituisce il codice d'errore Postgres, o null se riesce. */
export async function errorCodeOf(
  tx: postgres.TransactionSql,
  fn: (sp: postgres.TransactionSql) => Promise<unknown>,
): Promise<string | null> {
  try {
    await tx.savepoint(fn)
    return null
  } catch (error) {
    return (error as postgres.PostgresError).code
  }
}
