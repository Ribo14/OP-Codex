import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { FormMessage } from '@/account/form'
import { getSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { JOBS } from './job-health'
import { duration, JOB_RUNS_LIMIT, statsSummary, type JobRun } from './job-runs'

// Scheda "Job" (RIB-89): le ultime esecuzioni, tutte o di un solo job (?job=…, dai riquadri
// della panoramica).

export function AdminJobsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const selected = JOBS.find((job) => job === params.get('job')) ?? null
  const [runs, setRuns] = useState<JobRun[] | null>(null)
  const [failed, setFailed] = useState(false)

  const read = useCallback(async () => {
    let query = getSupabase()
      .from('job_runs')
      .select('id, job, status, started_at, finished_at, stats, error')
      .order('started_at', { ascending: false })
      .limit(JOB_RUNS_LIMIT)
    if (selected) query = query.eq('job', selected)
    const { data, error } = await query
    return error ? null : data
  }, [selected])

  const show = useCallback((data: JobRun[] | null) => {
    setFailed(data === null)
    setRuns(data ?? [])
  }, [])

  useEffect(() => {
    let current = true
    void read().then((data) => {
      if (current) show(data)
    })
    return () => {
      current = false
    }
  }, [read, show])

  return (
    <section className="space-y-4" aria-labelledby="job-titolo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="job-titolo" className="text-lg font-semibold tracking-tight">
          {t('admin.jobs.title')}
        </h2>
        <button
          type="button"
          onClick={() => {
            setRuns(null)
            void read().then(show)
          }}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm hover:bg-muted"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('admin.jobs.reload')}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('admin.jobs.filter')}</span>
        <select
          value={selected ?? ''}
          onChange={(e) => {
            setRuns(null)
            setParams(e.target.value ? { job: e.target.value } : {}, { replace: true })
          }}
          className="h-9 min-w-0 rounded-full border bg-background px-3 text-base sm:text-sm"
        >
          <option value="">{t('admin.jobs.all')}</option>
          {JOBS.map((job) => (
            <option key={job} value={job}>
              {t(`admin.jobs.name.${job}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        {t('admin.jobs.intro', { count: JOB_RUNS_LIMIT })}
      </p>
      {failed && <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>}
      {runs === null ? (
        <p className="text-muted-foreground">{t('account.loading')}</p>
      ) : runs.length === 0 ? (
        !failed && <p className="text-muted-foreground">{t('admin.jobs.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <JobRunItem key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  )
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  running: 'bg-muted text-muted-foreground',
  error: 'bg-destructive/10 text-destructive',
}

function JobRunItem({ run }: { run: JobRun }) {
  const { t, i18n } = useTranslation()
  const started = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(run.started_at))
  const took = duration(run)
  const numbers = statsSummary(run.stats)
  const job = JOBS.find((name) => name === run.job) ?? 'other'
  const status =
    run.status === 'success' || run.status === 'running' || run.status === 'error'
      ? run.status
      : 'other'

  return (
    <li className="space-y-2 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{t(`admin.jobs.name.${job}`)}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status])}>
          {t(`admin.jobs.status.${status}`)}
        </span>
        <span className="ml-auto text-sm text-muted-foreground">
          {started}
          {took && ` · ${took}`}
        </span>
      </div>
      {numbers.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {numbers.map(([key, value]) => (
            <div key={key} className="flex gap-1">
              <dt>{key}</dt>
              <dd className="font-medium text-foreground tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {run.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 font-mono text-xs break-words text-destructive">
          {run.error}
        </p>
      )}
    </li>
  )
}
