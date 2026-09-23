import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

// Default del Supabase locale (`npx supabase start`): non è un segreto, vale solo in locale.
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Una variabile vuota (come in .env.example) vale come non impostata.
const dbUrl = process.env.SUPABASE_DB_URL?.trim() ? process.env.SUPABASE_DB_URL : LOCAL_DB_URL

const sql = postgres(dbUrl, {
  connect_timeout: 5,
  max: 1,
  onnotice: () => undefined,
})

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
