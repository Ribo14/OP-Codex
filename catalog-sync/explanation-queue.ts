// La coda delle segnalazioni e richieste di spiegazione (RIB-54), per la sessione di sviluppo che
// scrive le spiegazioni (ADR-0006, docs/spiegazioni.md).
// Uso: node catalog-sync/explanation-queue.ts                       elenca le voci aperte
//      node catalog-sync/explanation-queue.ts --resolve OP01-001,...  le segna risolte
// SUPABASE_DB_URL per la produzione, altrimenti il Supabase locale. Solo Card Code e testo delle
// note: nessun dato che identifichi gli utenti.

import { parseArgs } from 'node:util'
import { groupQueue, queueAsText, type QueueRow } from '../src/admin/explanation-queue.ts'
import { connect } from './catalog-store.ts'

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { resolve: { type: 'string' } } })
  const sql = connect()
  try {
    if (values.resolve) {
      const codes = values.resolve
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
      const done = await sql`
        update public.explanation_reports set status = 'resolved'
        where status in ('open', 'in_progress') and card_code = any(${codes}::text[])
      `
      console.log(`Segnate risolte: ${String(done.count)} voci per ${codes.join(', ')}`)
      return
    }
    const rows = await sql<QueueRow[]>`
      select id, card_code, kind, reason, note, status, created_at::text
      from public.explanation_reports
      where status in ('open', 'in_progress')
      order by created_at
    `
    const names = new Map(
      (
        await sql<{ card_code: string; name: string }[]>`
          select card_code, name from public.cards
          where card_code = any(${[...new Set(rows.map((r) => r.card_code))]}::text[])
        `
      ).map((c) => [c.card_code, c.name]),
    )
    const items = groupQueue(rows)
    console.log(
      items.length === 0
        ? 'Nessuna voce aperta.'
        : queueAsText(items, (code) => names.get(code) ?? ''),
    )
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Coda delle spiegazioni:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
