import { describe, expect, it } from 'vitest'
import { duration, statsSummary } from './job-runs'

describe('stato dei job', () => {
  const at = (seconds: number) =>
    new Date(Date.UTC(2026, 8, 25, 3, 17, 0) + seconds * 1000).toISOString()

  it('mostra la durata in forma breve', () => {
    expect(duration({ started_at: at(0), finished_at: at(45) })).toBe('45 s')
    expect(duration({ started_at: at(0), finished_at: at(200) })).toBe('3 min 20 s')
    expect(duration({ started_at: at(0), finished_at: at(3900) })).toBe('1 h 5 min')
    expect(duration({ started_at: at(0), finished_at: null })).toBeNull()
  })

  it('riassume le statistiche: numeri annidati e lunghezza degli elenchi', () => {
    expect(
      statsSummary({
        pages: 60,
        catalog: { sets: 60, cards: 2785 },
        duplicatePrintIds: ['a', 'b'],
        note: 'testo ignorato',
      }),
    ).toEqual([
      ['pages', 60],
      ['catalog.sets', 60],
      ['catalog.cards', 2785],
      ['duplicatePrintIds', 2],
    ])
    expect(statsSummary({ synced: 800, failed: [], remaining: 1200 })).toEqual([
      ['synced', 800],
      ['failed', 0],
      ['remaining', 1200],
    ])
    expect(statsSummary(null)).toEqual([])
    expect(statsSummary([1, 2])).toEqual([])
  })
})
