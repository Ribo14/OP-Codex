// Carica nel database le Card Explanation dei file del repo (RIB-52, ADR-0006).
// Uso: node catalog-sync/sync-explanations.ts   (SUPABASE_DB_URL per la produzione, altrimenti il locale)
//      node catalog-sync/sync-explanations.ts --check   (controlla solo i file, senza database)

import { readdir, readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { connect, finishJobRun, startJobRun } from './catalog-store.ts'
import { collectExplanations, upsertExplanations } from './explanation-sync.ts'

const DIR = new URL('./explanations/', import.meta.url)

async function readFiles() {
  const names = (await readdir(DIR)).filter((name) => name.endsWith('.json')).sort()
  return Promise.all(
    names.map(async (name) => ({
      name,
      content: JSON.parse(await readFile(new URL(name, DIR), 'utf8')) as unknown,
    })),
  )
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } })
  const { byCard, problems } = collectExplanations(await readFiles())
  if (problems.length > 0) throw new Error(`file non validi:\n${problems.join('\n')}`)
  if (values.check) {
    console.log(`Spiegazioni valide: ${String(byCard.size)}`)
    return
  }

  const sql = connect()
  try {
    const runId = await startJobRun(sql, 'explanation_sync')
    try {
      const stats = await sql.begin((tx) => upsertExplanations(tx, byCard))
      await finishJobRun(sql, runId, { status: 'success', stats })
      console.log(
        `Explanation Sync completato: ${String(stats.cards)} spiegazioni ` +
          `(nuove ${String(stats.inserted)}, aggiornate ${String(stats.updated)}, svuotate ${String(stats.emptied)})`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
      throw error
    }
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Explanation Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
