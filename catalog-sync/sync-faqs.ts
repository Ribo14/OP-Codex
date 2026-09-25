// Carica nel database le FAQ ufficiali estratte dai PDF (RIB-44).
// Uso: node catalog-sync/sync-faqs.ts   (SUPABASE_DB_URL per la produzione, altrimenti il locale)
// Il file catalog-sync/faq/faq-raw.json si rigenera con scripts/faq/extract_faqs.py quando
// Bandai pubblica nuove FAQ.

import { readFile } from 'node:fs/promises'
import { connect, finishJobRun, startJobRun } from './catalog-store.ts'
import { faqsByCard, upsertFaqs, type RawFaqRow } from './faq-sync.ts'

const RAW_FILE = new URL('./faq/faq-raw.json', import.meta.url)

async function main(): Promise<void> {
  const rows = JSON.parse(await readFile(RAW_FILE, 'utf8')) as RawFaqRow[]
  const byCard = faqsByCard(rows)
  const sql = connect()
  try {
    const runId = await startJobRun(sql, 'faq_sync')
    try {
      const stats = await sql.begin((tx) => upsertFaqs(tx, byCard))
      await finishJobRun(sql, runId, { status: 'success', stats })
      console.log(
        `FAQ Sync completato: ${String(stats.questions)} domande per ${String(stats.cards)} carte ` +
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
  console.error('FAQ Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
