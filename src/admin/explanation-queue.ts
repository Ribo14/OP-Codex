// Coda Admin delle segnalazioni e richieste di spiegazione (RIB-54): le voci aperte raggruppate per
// carta e tipo, così più utenti che segnalano la stessa carta diventano un solo lavoro.

export interface QueueRow {
  id: number
  card_code: string
  kind: string
  reason: string | null
  note: string | null
  status: string
  created_at: string
}

export interface QueueItem {
  cardCode: string
  kind: 'report' | 'request'
  /** Le voci del gruppo, per cambiarne lo stato tutte insieme. */
  ids: number[]
  /** Quante segnalazioni per motivo. */
  reasons: Partial<Record<'wrong' | 'unclear' | 'other', number>>
  notes: string[]
  /** "in_progress" se almeno una voce è già in lavorazione. */
  status: 'open' | 'in_progress'
  oldest: string
}

export function groupQueue(rows: readonly QueueRow[]): QueueItem[] {
  const groups = new Map<string, QueueItem>()
  for (const row of rows) {
    if (row.status !== 'open' && row.status !== 'in_progress') continue
    const kind = row.kind === 'request' ? 'request' : 'report'
    const key = `${row.card_code}|${kind}`
    const item = groups.get(key) ?? {
      cardCode: row.card_code,
      kind,
      ids: [],
      reasons: {},
      notes: [],
      status: 'open',
      oldest: row.created_at,
    }
    item.ids.push(row.id)
    if (row.reason === 'wrong' || row.reason === 'unclear' || row.reason === 'other') {
      item.reasons[row.reason] = (item.reasons[row.reason] ?? 0) + 1
    }
    if (row.note) item.notes.push(row.note)
    if (row.status === 'in_progress') item.status = 'in_progress'
    if (row.created_at < item.oldest) item.oldest = row.created_at
    groups.set(key, item)
  }
  // Prima le segnalazioni (una spiegazione sbagliata è più urgente di una mancante), poi le carte
  // con più voci, poi le più vecchie.
  return [...groups.values()].sort(
    (a, b) =>
      (a.kind === 'report' ? 0 : 1) - (b.kind === 'report' ? 0 : 1) ||
      b.ids.length - a.ids.length ||
      a.oldest.localeCompare(b.oldest),
  )
}

/** La coda in testo, da incollare nella sessione di sviluppo che scrive le spiegazioni. */
export function queueAsText(items: readonly QueueItem[], nameOf: (code: string) => string): string {
  return items
    .map((item) => {
      const reasons = Object.entries(item.reasons)
        .map(([reason, count]) => `${reason} ×${String(count)}`)
        .join(', ')
      const head = `${item.cardCode} ${nameOf(item.cardCode)} · ${item.kind} ×${String(item.ids.length)}`
      const lines = [reasons ? `${head} (${reasons})` : head, ...item.notes.map((n) => `  - ${n}`)]
      return lines.join('\n')
    })
    .join('\n')
}
