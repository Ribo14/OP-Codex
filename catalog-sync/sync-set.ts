// Sync di un singolo Set dalla Official Card List al database.
// Uso: npm run sync:set -- <series id>   (es. 569101 = OP-01, predefinito)

import { parseCardListPage } from './card-list-parser.ts'
import { connect, upsertCatalogPage } from './catalog-store.ts'
import { fetchSetPage } from './official-site.ts'

const DEFAULT_SERIES_ID = 569101 // OP-01

async function main(): Promise<void> {
  const arg = process.argv[2]
  const seriesId = arg ? Number(arg) : DEFAULT_SERIES_ID

  const html = await fetchSetPage(seriesId)
  const page = parseCardListPage(html)

  const sql = connect()
  try {
    const summary = await sql.begin((tx) => upsertCatalogPage(tx, page))
    console.log(
      `Sync completato: ${summary.set} (${String(summary.cards)} Card, ${String(summary.printings)} Printing)`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
