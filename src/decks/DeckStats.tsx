import { useTranslation } from 'react-i18next'
import { COLORS } from '@/catalog/filters'
import { gameColor } from '@/catalog/game-colors'
import { COST_BUCKETS, COUNTER_VALUES, type DeckStats } from './deck-rules'

// Statistiche del Deck (RIB-23): curva dei costi e distribuzioni, con barre semplici.

const CATEGORY_KEYS = ['Character', 'Event', 'Stage'] as const

export function DeckStatsPanel({ stats }: { stats: DeckStats }) {
  const { t } = useTranslation()
  const tallest = Math.max(1, ...stats.costCurve)

  return (
    <details className="group rounded-2xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">{t('decks.stats.title')}</summary>
      <div className="mt-4 space-y-5">
        <div>
          <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('decks.stats.curve')}
          </h4>
          <ol className="flex h-28 items-end gap-1" aria-label={t('decks.stats.curve')}>
            {stats.costCurve.map((count, cost) => {
              const label = cost === COST_BUCKETS - 1 ? `${String(cost)}+` : String(cost)
              return (
                <li
                  key={label}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  aria-label={t('decks.stats.costBar', { cost: label, count })}
                >
                  <span
                    className="text-[10px] text-muted-foreground tabular-nums"
                    aria-hidden="true"
                  >
                    {count > 0 ? count : ''}
                  </span>
                  <span
                    className="w-full rounded-t bg-foreground/80"
                    style={{ height: `${String((count / tallest) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] tabular-nums" aria-hidden="true">
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('decks.stats.categories')}
            </dt>
            {CATEGORY_KEYS.map((key) => (
              <dd key={key} className="flex justify-between gap-2">
                <span>{t(`decks.stats.category.${key}`)}</span>
                <span className="tabular-nums">{stats.categories[key] ?? 0}</span>
              </dd>
            ))}
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('decks.stats.colors')}
            </dt>
            {COLORS.filter((color) => (stats.colors[color] ?? 0) > 0).map((color) => (
              <dd key={color} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: gameColor(color) }}
                    aria-hidden="true"
                  />
                  {t(`color.${color}`)}
                </span>
                <span className="tabular-nums">{stats.colors[color]}</span>
              </dd>
            ))}
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('decks.stats.counter')}
            </dt>
            {COUNTER_VALUES.map((value) => (
              <dd key={value} className="flex justify-between gap-2">
                <span>{value === 0 ? t('decks.stats.noCounter') : `+${String(value)}`}</span>
                <span className="tabular-nums">{stats.counters[String(value)] ?? 0}</span>
              </dd>
            ))}
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('decks.stats.trigger')}
            </dt>
            <dd className="tabular-nums">{t('decks.stats.triggers', { count: stats.triggers })}</dd>
          </div>
        </dl>
      </div>
    </details>
  )
}
