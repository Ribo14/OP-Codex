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

/** Cambia ruolo come farebbe PostgREST per una richiesta anonima o di un utente loggato. */
export async function actAs(tx: postgres.TransactionSql, role: 'anon' | 'authenticated') {
  const claims =
    role === 'authenticated'
      ? { sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated' }
      : { role: 'anon' }
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`
  await tx.unsafe(`set local role ${role}`)
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
