// Image Sync: scarica le immagini mancanti dal sito ufficiale e le carica su Storage in WebP.
// Uso: npm run sync:images -- [--limit 200] [--delay-ms 2000]
// Richiede SUPABASE_URL e SUPABASE_SECRET_KEY (in locale da `npx supabase status`, in .env.local).

import { parseArgs } from 'node:util'
import { connect, imageSyncRepository } from './catalog-store.ts'
import { syncImages } from './image-sync.ts'
import { fetchCardImage } from './official-site.ts'
import { supabaseImageStore } from './storage.ts'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? ''
  if (value === '') throw new Error(`Variabile d'ambiente mancante: ${name} (vedi .env.example)`)
  return value
}

function nonNegativeInteger(value: string, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} deve essere un intero >= 0`)
  return n
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      limit: { type: 'string', default: '200' },
      'delay-ms': { type: 'string', default: '2000' },
    },
  })

  const store = supabaseImageStore(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SECRET_KEY'))
  const sql = connect()
  try {
    const result = await syncImages({
      repository: imageSyncRepository(sql),
      store,
      fetchImage: (printId) => fetchCardImage(printId),
      limit: nonNegativeInteger(values.limit, '--limit'),
      delayMs: nonNegativeInteger(values['delay-ms'], '--delay-ms'),
      log: (message) => {
        console.log(message)
      },
    })

    console.log(
      `Image Sync: ${String(result.synced.length)} caricate, ${String(result.failed.length)} fallite, ${String(result.remaining)} ancora da scaricare`,
    )
    if (result.failed.length > 0) process.exitCode = 1
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Image Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
