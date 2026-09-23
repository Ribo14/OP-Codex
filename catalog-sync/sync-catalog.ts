// Catalog Sync completo: tutti i Set della Official Card List.
// Uso: npm run sync:catalog -- [--delay-ms 3000]

import { parseArgs } from 'node:util'
import { runCatalogSync } from './catalog-job.ts'
import { connect } from './catalog-store.ts'
import { fetchSetPage } from './official-site.ts'

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'delay-ms': { type: 'string', default: '3000' } } })
  const delayMs = Number(values['delay-ms'])
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error('--delay-ms deve essere un intero >= 0')
  }

  const sql = connect()
  try {
    const stats = await runCatalogSync({
      sql,
      fetchSetPage: (seriesId) => fetchSetPage(seriesId),
      delayMs,
      log: (message) => {
        console.log(message)
      },
    })
    const { catalog, sets, cards, printings, duplicatePrintIds } = stats
    console.log(
      `Catalog Sync completato: ${String(catalog.sets)} Set, ${String(catalog.cards)} Card, ${String(catalog.printings)} Printing`,
    )
    console.log(
      `Nuove/aggiornate: Set ${String(sets.inserted)}/${String(sets.updated)}, ` +
        `Card ${String(cards.inserted)}/${String(cards.updated)}, ` +
        `Printing ${String(printings.inserted)}/${String(printings.updated)}`,
    )
    if (duplicatePrintIds.length > 0) {
      console.log(`Print ID presenti in più Set (vale il primo): ${duplicatePrintIds.join(', ')}`)
    }
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Catalog Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
