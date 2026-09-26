import { describe, expect, it } from 'vitest'
import { groupQueue, queueAsText, type QueueRow } from './explanation-queue'

const row = (id: number, card_code: string, over: Partial<QueueRow> = {}): QueueRow => ({
  id,
  card_code,
  kind: 'report',
  reason: 'wrong',
  note: null,
  status: 'open',
  created_at: `2026-09-2${String(id)}T10:00:00Z`,
  ...over,
})

describe('coda delle segnalazioni', () => {
  const rows = [
    row(1, 'OP01-002', { kind: 'request', reason: null }),
    row(2, 'OP01-001', { note: 'Il costo è 4, non 5' }),
    row(3, 'OP01-001', { reason: 'unclear', status: 'in_progress' }),
    row(4, 'OP01-003'),
    row(5, 'OP01-004', { status: 'resolved' }),
  ]

  it('raggruppa per carta e tipo, solo le voci aperte; prima le segnalazioni più numerose', () => {
    const items = groupQueue(rows)
    expect(items.map((i) => [i.cardCode, i.kind, i.ids])).toEqual([
      ['OP01-001', 'report', [2, 3]],
      ['OP01-003', 'report', [4]],
      ['OP01-002', 'request', [1]],
    ])
    expect(items[0]).toMatchObject({
      reasons: { wrong: 1, unclear: 1 },
      notes: ['Il costo è 4, non 5'],
      status: 'in_progress',
    })
  })

  it('in testo per la sessione di sviluppo', () => {
    expect(queueAsText(groupQueue(rows).slice(0, 1), () => 'Zoro')).toBe(
      'OP01-001 Zoro · report ×2 (wrong ×1, unclear ×1)\n  - Il costo è 4, non 5',
    )
  })
})
