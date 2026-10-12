import { describe, expect, it } from 'vitest'
import {
  healthCounts,
  jobHealth,
  jobTiles,
  JOBS,
  overallHealth,
  STALE_HOURS,
  type JobSummary,
} from './job-health'

const NOW = Date.parse('2026-10-12T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

function run(patch: Partial<JobSummary> = {}): JobSummary {
  return {
    job: 'catalog_sync',
    status: 'success',
    started_at: hoursAgo(9),
    finished_at: hoursAgo(8.9),
    error: null,
    last_success_at: hoursAgo(8.9),
    ...patch,
  }
}

describe('Salute di un job', () => {
  it('riuscito stanotte: ok', () => {
    expect(jobHealth(run(), NOW)).toBe('ok')
  })

  it('ultima esecuzione fallita: failed, anche se recente', () => {
    expect(jobHealth(run({ status: 'error', error: 'HTTP 500' }), NOW)).toBe('failed')
  })

  it('riuscito ma da più di un giorno e un po’: stale', () => {
    expect(jobHealth(run({ started_at: hoursAgo(STALE_HOURS + 1) }), NOW)).toBe('stale')
  })

  it('in corso: running; bloccato in corso da più di un giorno: stale', () => {
    expect(jobHealth(run({ status: 'running', finished_at: null }), NOW)).toBe('running')
    expect(
      jobHealth(run({ status: 'running', started_at: hoursAgo(30), finished_at: null }), NOW),
    ).toBe('stale')
  })

  it('mai eseguito: stale', () => {
    expect(jobHealth(undefined, NOW)).toBe('stale')
  })
})

describe('Panoramica dei job', () => {
  it('un riquadro per ogni job noto, il complessivo è il peggiore', () => {
    const tiles = jobTiles(
      [run(), run({ job: 'faq_sync', status: 'error' }), run({ job: 'other_job' })],
      NOW,
    )
    expect(tiles.map((t) => t.job)).toEqual([...JOBS])
    expect(tiles.find((t) => t.job === 'faq_sync')?.health).toBe('failed')
    expect(overallHealth(tiles)).toBe('failed')
    expect(healthCounts(tiles)).toEqual({ ok: 1, running: 0, stale: 6, failed: 1 })
  })

  it('tutti riusciti stanotte: ok', () => {
    const tiles = jobTiles(
      JOBS.map((job) => run({ job })),
      NOW,
    )
    expect(overallHealth(tiles)).toBe('ok')
  })
})
