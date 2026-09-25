import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { catalogPath } from '@/catalog/card-links'
import type { Catalog } from '@/catalog/catalog-data'
import { EMPTY_FILTERS, filtersToSearchParams } from '@/catalog/filters'
import type { CollectionEntry } from './collection'
import { percent, setCompletion } from './set-completion'

// Completamento dei Set nella pagina Collezione (RIB-22): i Set di cui possiedi almeno una
// Card, con la barra; "Mostra tutti i Set" aggiunge quelli a zero. Un Set apre il catalogo
// filtrato su quel Set.

export function SetCompletionSection({
  catalog,
  entries,
}: {
  catalog: Catalog
  entries: readonly CollectionEntry[]
}) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const rows = useMemo(
    () => setCompletion(catalog.cards, catalog.sets, entries),
    [catalog, entries],
  )
  const started = rows.filter((row) => row.owned > 0)
  const shown = all ? rows : started

  return (
    <section aria-labelledby="completamento-titolo" className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 id="completamento-titolo" className="text-lg font-semibold tracking-tight">
          {t('collection.setCompletion')}
        </h2>
        {rows.length > started.length && (
          <button
            type="button"
            aria-pressed={all}
            onClick={() => {
              setAll((v) => !v)
            }}
            className="ml-auto text-sm font-medium underline underline-offset-2"
          >
            {all ? t('collection.setsStarted') : t('collection.setsAll', { count: rows.length })}
          </button>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((row) => {
          const value = percent(row)
          return (
            <li key={row.set.code}>
              <Link
                to={catalogPath(filtersToSearchParams({ ...EMPTY_FILTERS, sets: [row.set.code] }))}
                className="block space-y-1.5 rounded-xl border px-3 py-2.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium">{row.set.code}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {row.set.name}
                  </span>
                  <span className="tabular-nums">
                    {row.owned}/{row.total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={t('collection.setProgress', { set: row.set.code })}
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={t('collection.setProgressText', {
                    owned: row.owned,
                    total: row.total,
                    percent: value,
                  })}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${String(value)}%` }}
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
