// Salute dei job nella panoramica Admin (RIB-89): un colore per job e uno per tutti, così si
// capisce a colpo d'occhio se la notte è andata bene.

/** I job notturni (.github/workflows/catalog-sync.yml), nell'ordine in cui girano. */
export const JOBS = [
  'catalog_sync',
  'preview_sync',
  'faq_sync',
  'explanation_sync',
  'recipe_sync',
  'image_sync',
  'price_sync',
  'cardtrader_sync',
] as const

export type JobName = (typeof JOBS)[number]

/** L'ultima esecuzione di un job, come la restituisce admin_panoramica(). */
export interface JobSummary {
  job: string
  status: string
  started_at: string
  finished_at: string | null
  error: string | null
  last_success_at: string | null
}

/**
 * ok = ultima esecuzione riuscita e recente; running = in corso; stale = non gira da più di
 * STALE_HOURS (o mai, o bloccato in corso); failed = l'ultima esecuzione è fallita.
 */
export type Health = 'ok' | 'running' | 'stale' | 'failed'

/** I job girano ogni notte: oltre 26 ore (un giorno più un margine) qualcosa non va. */
export const STALE_HOURS = 26

const HOUR = 3_600_000

export function jobHealth(summary: JobSummary | undefined, now: number): Health {
  if (!summary) return 'stale'
  const age = now - Date.parse(summary.started_at)
  if (summary.status === 'running') return age > STALE_HOURS * HOUR ? 'stale' : 'running'
  if (summary.status !== 'success') return 'failed'
  return age > STALE_HOURS * HOUR ? 'stale' : 'ok'
}

const SEVERITY: Record<Health, number> = { ok: 0, running: 1, stale: 2, failed: 3 }

export interface JobTile {
  job: JobName
  health: Health
  summary: JobSummary | undefined
}

/** Un riquadro per ogni job noto, anche per quelli che non hanno mai girato. */
export function jobTiles(summaries: JobSummary[], now: number): JobTile[] {
  return JOBS.map((job) => {
    const summary = summaries.find((s) => s.job === job)
    return { job, health: jobHealth(summary, now), summary }
  })
}

/** Lo stato complessivo è quello del job messo peggio. */
export function overallHealth(tiles: JobTile[]): Health {
  return tiles.reduce<Health>(
    (worst, tile) => (SEVERITY[tile.health] > SEVERITY[worst] ? tile.health : worst),
    'ok',
  )
}

/** Quanti job per ogni stato, per il riepilogo ("6 ok, 1 fallito, 1 fermo"). */
export function healthCounts(tiles: JobTile[]): Record<Health, number> {
  const counts: Record<Health, number> = { ok: 0, running: 0, stale: 0, failed: 0 }
  for (const tile of tiles) counts[tile.health] += 1
  return counts
}
