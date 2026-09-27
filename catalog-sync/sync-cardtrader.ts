// Prezzi CardTrader (RIB-32, slice 5.5): da lanciare dopo sync-prices.ts (usa i suoi abbinamenti).
// Uso: CARDTRADER_TOKEN=… node catalog-sync/sync-cardtrader.ts
// Senza token il job non parte e lo dice: il resto dei prezzi funziona lo stesso.

import { CARDTRADER_API, runCardTraderSync } from './cardtrader-sync.ts'
import { connect } from './catalog-store.ts'
import { USER_AGENT } from './official-site.ts'

const TIMEOUT_MS = 60_000
/** Pausa tra le richieste: ben sotto i limiti dell'API (10/s sul marketplace). */
const DELAY_MS = 300

async function main(): Promise<void> {
  const token = process.env.CARDTRADER_TOKEN?.trim() ?? ''
  if (token === '') {
    console.log('CardTrader saltato: manca CARDTRADER_TOKEN.')
    return
  }
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(`${CARDTRADER_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // Mai il token nei messaggi: solo percorso e stato.
    if (!response.ok) throw new Error(`HTTP ${String(response.status)} per ${path}`)
    return response.json()
  }

  const sql = connect()
  try {
    const stats = await runCardTraderSync({ sql, get, delayMs: DELAY_MS, log: console.log })
    console.log(
      `CardTrader completato: ${String(stats.expansions)} espansioni, ${String(stats.blueprints)} ` +
        `blueprint; ${String(stats.mapped)} Printing abbinate, ${String(stats.withPrice)} con un ` +
        `prezzo in euro; prezzi cambiati ${String(stats.pricesChanged)}`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('CardTrader fallito:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
