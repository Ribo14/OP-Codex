// Price Sync (RIB-32, ADR-0008): prezzi Cardmarket dai file pubblici, abbinati alle Printing.
// Uso: node catalog-sync/sync-prices.ts   (SUPABASE_DB_URL per la produzione, altrimenti il locale)

import { connect } from './catalog-store.ts'
import { USER_AGENT } from './official-site.ts'
import { runPriceSync } from './price-sync.ts'

const TIMEOUT_MS = 60_000

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)} per ${url}`)
  return response.json()
}

async function main(): Promise<void> {
  const sql = connect()
  try {
    const stats = await runPriceSync({ sql, fetchJson })
    console.log(
      `Price Sync completato (listino del ${stats.priceDate}): ${String(stats.mapped)} Printing con ` +
        `prezzo (${String(stats.toCheck)} da verificare, ${String(stats.overrides)} override), ` +
        `${String(stats.unmapped)} senza; prezzi cambiati ${String(stats.pricesChanged)}, ` +
        `storico ${String(stats.snapshots)} righe (${String(stats.snapshotsPruned)} vecchie tolte)`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Price Sync fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
