import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormMessage } from '@/account/form'
import { cn } from '@/lib/utils'
import { fetchOverview, type MissingContent, type Overview } from './admin-api'
import { adminJobPath, adminPath, type AdminTab } from './admin-paths'
import { healthCounts, jobTiles, overallHealth, STALE_HOURS, type Health } from './job-health'

// Panoramica dell'area Admin (RIB-89): a colpo d'occhio se i job della notte sono andati bene
// e i numeri principali dell'app.

const HEALTH_STYLE: Record<Health, string> = {
  ok: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
  running: 'border-border bg-muted text-foreground',
  stale: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
}

const HEALTH_ICON = {
  ok: CheckCircle2,
  running: Loader2,
  stale: AlertTriangle,
  failed: XCircle,
} as const

export function AdminOverviewPage() {
  const { t } = useTranslation()
  // L'ora di riferimento si fissa a ogni lettura: i colori non cambiano mentre si guarda.
  const [loaded, setLoaded] = useState<{ overview: Overview; now: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    fetchOverview().then(
      (overview) => {
        if (!current) return
        setLoaded({ overview, now: Date.now() })
        setFailed(false)
      },
      () => {
        if (current) setFailed(true)
      },
    )
    return () => {
      current = false
    }
  }, [version])

  if (failed) return <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>
  if (!loaded) return <p className="text-muted-foreground">{t('account.loading')}</p>

  const { overview, now } = loaded
  const tiles = jobTiles(overview.jobs, now)
  const overall = overallHealth(tiles)
  const counts = healthCounts(tiles)
  const OverallIcon = HEALTH_ICON[overall]

  return (
    <div className="space-y-6">
      <section aria-labelledby="salute-titolo" className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 id="salute-titolo" className="text-lg font-semibold tracking-tight">
            {t('admin.overview.jobsTitle')}
          </h2>
          <button
            type="button"
            onClick={() => {
              setLoaded(null)
              setVersion((v) => v + 1)
            }}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm hover:bg-muted"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('admin.jobs.reload')}
          </button>
        </div>
        <div
          role="status"
          className={cn('flex items-start gap-3 rounded-2xl border p-4', HEALTH_STYLE[overall])}
        >
          <OverallIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium">
              {t(`admin.overview.overall.${overall}`, { hours: STALE_HOURS })}
            </p>
            <p className="text-sm opacity-90">
              {[
                t('admin.overview.count.ok', { count: counts.ok }),
                counts.running > 0 && t('admin.overview.count.running', { count: counts.running }),
                counts.stale > 0 && t('admin.overview.count.stale', { count: counts.stale }),
                counts.failed > 0 && t('admin.overview.count.failed', { count: counts.failed }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = HEALTH_ICON[tile.health]
            return (
              <li key={tile.job}>
                <Link
                  to={adminJobPath(tile.job)}
                  className={cn(
                    'flex h-full flex-col gap-1 rounded-2xl border p-3 hover:opacity-90',
                    HEALTH_STYLE[tile.health],
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {t(`admin.jobs.name.${tile.job}`)}
                  </span>
                  <span className="text-xs opacity-90">
                    {tile.summary
                      ? t(`admin.overview.health.${tile.health}`)
                      : t('admin.overview.health.never')}
                    {tile.summary && (
                      <>
                        {' · '}
                        <Ago iso={tile.summary.started_at} now={now} />
                      </>
                    )}
                  </span>
                  {tile.health === 'failed' && tile.summary?.error && (
                    <span className="line-clamp-2 font-mono text-xs break-words">
                      {tile.summary.error}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {overview.content && <ContentSection content={overview.content} />}

      <section aria-labelledby="numeri-titolo" className="space-y-3">
        <h2 id="numeri-titolo" className="text-lg font-semibold tracking-tight">
          {t('admin.overview.numbersTitle')}
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi label={t('admin.overview.kpi.users')} value={overview.users} to="users" />
          <Kpi label={t('admin.overview.kpi.usersNew')} value={overview.users_new_7d} to="users" />
          <Kpi
            label={t('admin.overview.kpi.usersActive')}
            value={overview.users_active_7d}
            to="users"
          />
          <Kpi
            label={t('admin.overview.kpi.usersSuspended')}
            value={overview.users_suspended}
            to="users"
          />
          <Kpi label={t('admin.overview.kpi.decks')} value={overview.decks} />
          <Kpi label={t('admin.overview.kpi.copies')} value={overview.collection_copies} />
          <Kpi
            label={t('admin.overview.kpi.reports')}
            value={overview.open_reports}
            to="reports"
            warn={overview.open_reports > 0}
          />
        </ul>
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  to,
  warn = false,
}: {
  label: string
  value: number
  to?: AdminTab
  warn?: boolean
}) {
  const { i18n } = useTranslation()
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">
        {new Intl.NumberFormat(i18n.language).format(value)}
      </span>
    </>
  )
  const style = cn(
    'flex h-full flex-col justify-between gap-1 rounded-2xl border p-3',
    warn && HEALTH_STYLE.stale,
  )
  return (
    <li>
      {to ? (
        <Link to={adminPath(to)} className={cn(style, 'hover:bg-muted')}>
          {body}
        </Link>
      ) : (
        <div className={style}>{body}</div>
      )}
    </li>
  )
}

/** "3 h fa", "2 giorni fa": quanto tempo fa è partita l'ultima esecuzione. */
function Ago({ iso, now }: { iso: string; now: number }) {
  const { t } = useTranslation()
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  const hours = Math.round(minutes / 60)
  if (minutes < 60) return t('admin.overview.ago.minutes', { count: minutes })
  if (hours < 48) return t('admin.overview.ago.hours', { count: hours })
  return t('admin.overview.ago.days', { count: Math.round(hours / 24) })
}

/**
 * Contenuti da completare in sessione (RIB-93): le carte nuove arrivano da sole, spiegazioni
 * e FAQ no. Così si vede quando serve una sessione di lavoro.
 */
function ContentSection({ content }: { content: MissingContent }) {
  const { t } = useTranslation()
  const sets = content.missing_by_set.slice(0, 8)
  const complete =
    content.missing_explanations === 0 &&
    content.missing_explanations_preview === 0 &&
    content.sets_without_faq.length === 0
  return (
    <section aria-labelledby="contenuti-titolo" className="space-y-3">
      <h2 id="contenuti-titolo" className="text-lg font-semibold tracking-tight">
        {t('admin.overview.content.title')}
      </h2>
      {complete ? (
        <p className={cn('flex items-center gap-2 rounded-2xl border p-4', HEALTH_STYLE.ok)}>
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          {t('admin.overview.content.complete')}
        </p>
      ) : (
        <div className={cn('space-y-2 rounded-2xl border p-4 text-sm', HEALTH_STYLE.stale)}>
          {content.missing_explanations > 0 && (
            <p className="font-medium">
              {t('admin.overview.content.explanations', { count: content.missing_explanations })}
            </p>
          )}
          {content.missing_explanations_preview > 0 && (
            <p className="font-medium">
              {t('admin.overview.content.previews', {
                count: content.missing_explanations_preview,
              })}
            </p>
          )}
          {sets.length > 0 && (
            <p className="opacity-90">
              {sets
                .map(
                  (s) =>
                    `${s.set} ${String(s.count)}${s.preview ? ` (${t('admin.overview.content.preview')})` : ''}`,
                )
                .join(' · ')}
            </p>
          )}
          {content.sets_without_faq.length > 0 && (
            <p>{t('admin.overview.content.faq', { sets: content.sets_without_faq.join(', ') })}</p>
          )}
          <p className="text-xs opacity-80">{t('admin.overview.content.hint')}</p>
        </div>
      )}
    </section>
  )
}
