// Image Sync: scarica le immagini mancanti dal sito ufficiale e le carica su Storage in WebP.
// Uso: npm run sync:images -- [--limit 200] [--delay-ms 2000]
// Richiede SUPABASE_URL e SUPABASE_SECRET_KEY (in locale da `npx supabase status`, in .env.local).

import { parseArgs } from 'node:util'
import { connect, finishJobRun, imageSyncRepository, startJobRun } from './catalog-store.ts'
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
  const limit = nonNegativeInteger(values.limit, '--limit')
  const delayMs = nonNegativeInteger(values['delay-ms'], '--delay-ms')

  const sql = connect()
  const runId = await startJobRun(sql, 'image_sync')
  try {
    const result = await syncImages({
      repository: imageSyncRepository(sql),
      store,
      fetchImage: (printId) => fetchCardImage(printId),
      limit,
      delayMs,
      log: (message) => {
        console.log(message)
      },
    })

    // Qualche immagine mancante non è un guasto; se falliscono tutte, sì (sito giù, Storage rotto…).
    const allFailed = result.failed.length > 0 && result.synced.length === 0
    await finishJobRun(sql, runId, {
      status: allFailed ? 'error' : 'success',
      stats: { synced: result.synced.length, failed: result.failed, remaining: result.remaining },
      ...(allFailed ? { error: 'Tutte le immagini tentate sono fallite' } : {}),
    })

    console.log(
      `Image Sync: ${String(result.synced.length)} caricate, ${String(result.failed.length)} fallite, ${String(result.remaining)} ancora da scaricare`,
    )
    if (allFailed) process.exitCode = 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Image Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
