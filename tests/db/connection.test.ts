import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../catalog-sync/catalog-store.ts'

const sql = connect()

afterAll(async () => {
  await sql.end()
})

describe('Supabase locale', () => {
  it('risponde alle query', async () => {
    const [row] = await sql<{ ok: number }[]>`select 1 as ok`
    expect(row?.ok).toBe(1)
  })

  it('ha gli schemi di Supabase (auth, storage)', async () => {
    const rows = await sql<{ schema_name: string }[]>`
      select schema_name from information_schema.schemata
      where schema_name in ('auth', 'storage')
      order by schema_name
    `
    expect(rows.map((r) => r.schema_name)).toEqual(['auth', 'storage'])
  })

  it('ha i ruoli usati dalla Row Level Security', async () => {
    const rows = await sql<{ rolname: string }[]>`
      select rolname from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role')
      order by rolname
    `
    expect(rows.map((r) => r.rolname)).toEqual(['anon', 'authenticated', 'service_role'])
  })
})
