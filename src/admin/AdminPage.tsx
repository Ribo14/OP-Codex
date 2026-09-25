import { RefreshCw, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormMessage } from '@/account/form'
import { PROFILE_PATH } from '@/account/paths'
import { RequireAccount } from '@/account/ProfilePage'
import { getSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { duration, JOB_RUNS_LIMIT, statsSummary, type JobRun } from './job-runs'

// Area Admin (RIB-19, ADR-0014). Il database decide chi entra (private.admin_attivo): Admin,
// sessione valida e codice della verifica in due passaggi. Qui si mostra solo il risultato.

type AdminState = 'loading' | 'no' | 'codice' | 'ok' | 'error'

export function AdminPage() {
  return <RequireAccount>{() => <AdminArea />}</RequireAccount>
}

function AdminArea() {
  const { t } = useTranslation()
  const [state, setState] = useState<AdminState>('loading')

  useEffect(() => {
    let current = true
    void getSupabase()
      .rpc('stato_admin')
      .then(({ data, error }) => {
        if (!current) return
        setState(error ? 'error' : data === 'ok' || data === 'codice' ? data : 'no')
      })
    return () => {
      current = false
    }
  }, [])

  if (state === 'loading') return <p className="text-muted-foreground">{t('account.loading')}</p>
  if (state === 'error')
    return <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>
  if (state === 'no') {
    return (
      <section className="mx-auto max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <p className="text-muted-foreground">{t('admin.notAdmin')}</p>
      </section>
    )
  }
  if (state === 'codice') {
    return (
      <section className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <div className="flex gap-3 rounded-2xl border p-5">
          <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
          <div className="space-y-2 text-sm">
            <p>{t('admin.needsTwoFactor')}</p>
            <Link to={PROFILE_PATH} className="underline underline-offset-2">
              {t('admin.toProfile')}
            </Link>
          </div>
        </div>
      </section>
    )
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('admin.title')}</h1>
      <JobRuns />
    </div>
  )
}

function JobRuns() {
  const { t } = useTranslation()
  const [runs, setRuns] = useState<JobRun[] | null>(null)
  const [failed, setFailed] = useState(false)

  const read = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('job_runs')
      .select('id, job, status, started_at, finished_at, stats, error')
      .order('started_at', { ascending: false })
      .limit(JOB_RUNS_LIMIT)
    return error ? null : data
  }, [])

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
      <div className="flex items-center gap-3">
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
  success: 'bg-muted text-foreground',
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
  const job = run.job === 'catalog_sync' || run.job === 'image_sync' ? run.job : 'other'
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
