// Preview Sync (ADR-0016): carte dei Set non ancora usciti da OPTCG Leaks, come anteprime.
// Uso: npm run sync:previews -- [--delay-ms 1000]
// Richiede SUPABASE_URL e SUPABASE_SECRET_KEY (immagini su Storage) e SUPABASE_DB_URL in produzione.

import { parseArgs } from 'node:util'
import { connect, finishJobRun, startJobRun } from './catalog-store.ts'
import { convertCardImage } from './image-sync.ts'
import { USER_AGENT } from './official-site.ts'
import { PREVIEW_SITE, previewImagePath, runPreviewSync } from './preview-sync.ts'
import { supabaseImageStore } from './storage.ts'

const TIMEOUT_MS = 30_000

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? ''
  if (value === '') throw new Error(`Variabile d'ambiente mancante: ${name} (vedi .env.example)`)
  return value
}

async function get(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'delay-ms': { type: 'string', default: '1000' } } })
  const delayMs = Number(values['delay-ms'])
  if (!Number.isInteger(delayMs) || delayMs < 0) throw new Error('--delay-ms deve essere >= 0')

  const store = supabaseImageStore(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SECRET_KEY'))
  const sql = connect()
  const runId = await startJobRun(sql, 'preview_sync')
  try {
    const stats = await runPreviewSync({
      sql,
      delayMs,
      async fetchSet(siteId) {
        const response = await get(`${PREVIEW_SITE}/${siteId}/${siteId}.json`)
        // Il sito risponde 403 (S3) per i Set che non ha.
        if (response.status === 403 || response.status === 404) return null
        if (!response.ok) throw new Error(`HTTP ${String(response.status)} per ${siteId}`)
        return response.json()
      },
      async fetchImage(path) {
        const [set, image] = path.split('/')
        const response = await get(`${PREVIEW_SITE}/${set ?? ''}/images/${image ?? ''}.webp`)
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
        return new Uint8Array(await response.arrayBuffer())
      },
      async storeImage(printId, image) {
        const { thumb, full } = await convertCardImage(image)
        await store.upload(previewImagePath('thumb', printId), thumb)
        await store.upload(previewImagePath('full', printId), full)
      },
      log: (message) => {
        console.log(message)
      },
    })
    // Qualche richiesta fallita non è un guasto; se non risponde nessun Set, sì (sito giù).
    const siteDown = stats.failedSets.length > 0 && stats.sets.length === 0
    await finishJobRun(sql, runId, {
      status: siteDown ? 'error' : 'success',
      stats,
      ...(siteDown ? { error: 'Il sito delle anteprime non risponde' } : {}),
    })
    if (siteDown) process.exitCode = 1
    console.log(
      `Preview Sync completato: Set ${stats.sets.join(', ') || 'nessuno'}; cambiate ${String(stats.cards)} carte e ` +
        `${String(stats.printings)} stampe, tolte ${String(stats.removed)}; immagini ${String(stats.images)} ` +
        `(fallite ${String(stats.failedImages.length)})`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Preview Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
