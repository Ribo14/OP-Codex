import type { Tables } from '@/lib/database.types'

// Stato dei job nell'area Admin (RIB-19): come mostrare un'esecuzione di job_runs.

export type JobRun = Pick<
  Tables<'job_runs'>,
  'id' | 'job' | 'status' | 'started_at' | 'finished_at' | 'stats' | 'error'
>

export const JOB_RUNS_LIMIT = 30

/** Durata in forma breve ("45 s", "3 min 20 s", "1 h 5 min"); null se il job è ancora in corso. */
export function duration(run: Pick<JobRun, 'started_at' | 'finished_at'>): string | null {
  if (!run.finished_at) return null
  const seconds = Math.max(
    0,
    Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000),
  )
  if (seconds < 60) return `${String(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)} min ${String(seconds % 60)} s`
  return `${String(Math.floor(minutes / 60))} h ${String(minutes % 60)} min`
}

/**
 * I numeri delle statistiche, come coppie chiave/valore: quelli annidati con il percorso
 * ("catalog.cards"), gli elenchi con la loro lunghezza ("failed" = quante immagini fallite).
 */
export function statsSummary(stats: unknown, prefix = ''): [string, number][] {
  if (stats === null || typeof stats !== 'object' || Array.isArray(stats)) return []
  return Object.entries(stats).flatMap(([key, value]): [string, number][] => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'number') return [[path, value]]
    if (Array.isArray(value)) return [[path, value.length]]
    return statsSummary(value, path)
  })
}
